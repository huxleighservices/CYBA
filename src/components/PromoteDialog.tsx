'use client';

import { useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Zap, Target, Check, Megaphone, Gift } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DEFAULT_AD_DROP_CONFIG, AD_TIER_ORDER, AD_TIER_LABELS,
  AD_TIER_INCLUDED_UPSELLS, getSelectableUpsells, parsePriceLabel,
  type AdDropConfig, type AdMediaType, type AdTierKey, type FreePromoVouchers,
} from '@/lib/ad-drop';
import { buildStripeUrl, openDeferredWindow, redirectDeferredWindow } from '@/lib/promo-blast-checkout';
import { logCashTransaction } from '@/lib/transactions';

export function PromoteDialog({
  open,
  onOpenChange,
  mediaUrl,
  mediaType,
  videoDurationSeconds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string;
  mediaType: AdMediaType;
  videoDurationSeconds?: number | null;
}) {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [selectedTier, setSelectedTierRaw] = useState<AdTierKey>('day7');
  const [wantUnskippable, setWantUnskippable] = useState(false);
  const [wantMediaQuest, setWantMediaQuest] = useState(false);
  const [questInstructions, setQuestInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payWithWalletCash, setPayWithWalletCash] = useState(false);
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);

  const includedUpsells = AD_TIER_INCLUDED_UPSELLS[selectedTier];
  const selectableUpsells = getSelectableUpsells(selectedTier);
  const setSelectedTier = (tier: AdTierKey) => {
    setSelectedTierRaw(tier);
    const selectable = getSelectableUpsells(tier);
    if (!selectable.includes('unskippable')) setWantUnskippable(false);
    if (!selectable.includes('mediaQuest')) setWantMediaQuest(false);
  };

  const [pendingAdId, setPendingAdId] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [pendingUpsells, setPendingUpsells] = useState<{ unskippable: boolean; mediaQuest: boolean }>({ unskippable: false, mediaQuest: false });

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile } = useDoc<{ username?: string; payoutBalance?: number; freePromoVouchers?: FreePromoVouchers }>(userDocRef);

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'adDropConfig'), [firestore]);
  const { data: rawConfig } = useDoc<Partial<AdDropConfig>>(configRef);
  const config: AdDropConfig = {
    ...DEFAULT_AD_DROP_CONFIG,
    ...rawConfig,
    tiers: { ...DEFAULT_AD_DROP_CONFIG.tiers, ...rawConfig?.tiers },
    unskippable: { ...DEFAULT_AD_DROP_CONFIG.unskippable, ...rawConfig?.unskippable },
    mediaQuest: { ...DEFAULT_AD_DROP_CONFIG.mediaQuest, ...rawConfig?.mediaQuest },
  };

  const selectedUpsellCount = [wantUnskippable, wantMediaQuest].filter(Boolean).length;
  const questActive = includedUpsells.includes('mediaQuest') || wantMediaQuest;

  const walletBalance = userProfile?.payoutBalance ?? 0;
  const walletCashTotal =
    parsePriceLabel(config.tiers[selectedTier].priceLabel) +
    (wantUnskippable ? parsePriceLabel(config.unskippable.priceLabel) : 0) +
    (wantMediaQuest ? parsePriceLabel(config.mediaQuest.priceLabel) : 0);

  const availableVouchers = userProfile?.freePromoVouchers?.[selectedTier] ?? 0;

  const validateCommon = () => {
    if (!user || !userProfile?.username) return false;
    if (!buttonText.trim() || !buttonLink.trim()) {
      toast({ variant: 'destructive', title: 'Missing info', description: 'Add a button label and link.' });
      return false;
    }
    if (questActive && !questInstructions.trim()) {
      toast({ variant: 'destructive', title: 'Missing CYBAQUEST info', description: 'Tell us what you want members to do.' });
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setButtonText('');
    setButtonLink('');
    setWantUnskippable(false);
    setWantMediaQuest(false);
    setQuestInstructions('');
    setPayWithWalletCash(false);
  };

  const handleSubmit = async () => {
    if (!validateCommon()) return;
    const tierConfig = config.tiers[selectedTier];
    if (!tierConfig.buttonLink) {
      toast({ variant: 'destructive', title: 'Payments not configured yet', description: 'Ask an admin to set the PROMO BLAST payment link for this tier.' });
      return;
    }
    if (wantUnskippable && !config.unskippable.buttonLink) {
      toast({ variant: 'destructive', title: 'Unskippable upsell not configured yet', description: 'Ask an admin to set its payment link, or unselect it.' });
      return;
    }
    if (wantMediaQuest && !config.mediaQuest.buttonLink) {
      toast({ variant: 'destructive', title: 'CYBAQUEST upsell not configured yet', description: 'Ask an admin to set its payment link, or unselect it.' });
      return;
    }

    const payWin = openDeferredWindow();
    setSubmitting(true);
    try {
      const adDoc = await addDoc(collection(firestore, 'ads'), {
        userId: user!.uid,
        username: userProfile!.username,
        mediaUrl,
        mediaType,
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim(),
        status: 'pending_payment',
        tier: selectedTier,
        durationDays: tierConfig.days,
        ...(videoDurationSeconds ? { videoDurationSeconds } : {}),
        ...(questActive && questInstructions.trim() ? { questInstructions: questInstructions.trim() } : {}),
        unskippable: false,
        wantsMediaQuest: false,
        viewCount: 0,
        clickCount: 0,
        totalWatchSeconds: 0,
        createdAt: serverTimestamp(),
      });

      const stripeUrl = buildStripeUrl(tierConfig.buttonLink, userProfile!.username!, adDoc.id);
      redirectDeferredWindow(payWin, stripeUrl, toast);

      if (wantUnskippable || wantMediaQuest) {
        setPendingAdId(adDoc.id);
        setPendingUsername(userProfile!.username!);
        setPendingUpsells({ unskippable: wantUnskippable, mediaQuest: wantMediaQuest });
      }

      toast({
        title: 'Promo created!',
        description: wantUnskippable || wantMediaQuest
          ? 'Complete payment in the new tab, then finish your upsell purchase(s) below.'
          : 'Complete payment in the new tab. Your promo goes live automatically once payment is confirmed.',
      });
      resetForm();
    } catch {
      if (payWin) payWin.close();
      toast({ variant: 'destructive', title: 'Failed to create promo', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWithWalletCash = async () => {
    if (!validateCommon()) return;
    if (walletBalance < walletCashTotal) {
      toast({ variant: 'destructive', title: 'Not enough wallet cash' });
      return;
    }
    const tierConfig = config.tiers[selectedTier];
    setSubmitting(true);
    try {
      const adRef = await addDoc(collection(firestore, 'ads'), {
        userId: user!.uid,
        username: userProfile!.username,
        mediaUrl,
        mediaType,
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim(),
        status: 'pending_payment',
        tier: selectedTier,
        durationDays: tierConfig.days,
        ...(videoDurationSeconds ? { videoDurationSeconds } : {}),
        ...(questActive && questInstructions.trim() ? { questInstructions: questInstructions.trim() } : {}),
        unskippable: false,
        wantsMediaQuest: false,
        viewCount: 0,
        clickCount: 0,
        totalWatchSeconds: 0,
        createdAt: serverTimestamp(),
      });

      const now = new Date();
      await updateDoc(adRef, {
        status: 'active',
        activatedAt: serverTimestamp(),
        expiresAt: new Date(now.getTime() + tierConfig.days * 24 * 60 * 60 * 1000),
        unskippable: includedUpsells.includes('unskippable') || wantUnskippable,
        wantsMediaQuest: includedUpsells.includes('mediaQuest') || wantMediaQuest,
      });

      await updateDoc(doc(firestore, 'users', user!.uid), { payoutBalance: increment(-walletCashTotal) });
      await logCashTransaction(firestore, user!.uid, {
        type: 'promo_blast_purchase',
        amount: -walletCashTotal,
        description: `Promo Blast (Wallet Cash): ${AD_TIER_LABELS[selectedTier]}${wantUnskippable ? ' + Unskippable' : ''}${wantMediaQuest ? ' + CYBAQUEST' : ''}`,
      });

      toast({ title: 'Promo is live!', description: `$${walletCashTotal.toFixed(2)} wallet cash spent — your promo is active now.` });
      resetForm();
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemVoucher = async () => {
    if (!validateCommon()) return;
    if (availableVouchers <= 0) {
      toast({ variant: 'destructive', title: 'No free promo available for this duration' });
      return;
    }
    const tierConfig = config.tiers[selectedTier];
    setRedeemingVoucher(true);
    setSubmitting(true);
    try {
      const adRef = await addDoc(collection(firestore, 'ads'), {
        userId: user!.uid,
        username: userProfile!.username,
        mediaUrl,
        mediaType,
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim(),
        status: 'pending_payment',
        tier: selectedTier,
        durationDays: tierConfig.days,
        ...(videoDurationSeconds ? { videoDurationSeconds } : {}),
        ...(questActive && questInstructions.trim() ? { questInstructions: questInstructions.trim() } : {}),
        unskippable: false,
        wantsMediaQuest: false,
        viewCount: 0,
        clickCount: 0,
        totalWatchSeconds: 0,
        createdAt: serverTimestamp(),
      });

      const now = new Date();
      await updateDoc(adRef, {
        status: 'active',
        activatedAt: serverTimestamp(),
        expiresAt: new Date(now.getTime() + tierConfig.days * 24 * 60 * 60 * 1000),
        unskippable: includedUpsells.includes('unskippable'),
        wantsMediaQuest: includedUpsells.includes('mediaQuest'),
        redeemedWithVoucher: true,
      });

      await updateDoc(doc(firestore, 'users', user!.uid), {
        [`freePromoVouchers.${selectedTier}`]: increment(-1),
      });

      toast({ title: 'Free promo redeemed!', description: `Your ${AD_TIER_LABELS[selectedTier]} slot is live at no cost.` });
      resetForm();
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Redemption failed', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
      setRedeemingVoucher(false);
    }
  };

  const handleUpsellCheckout = (kind: 'unskippable' | 'mediaQuest') => {
    if (!pendingAdId || !pendingUsername) return;
    const upsellConfig = kind === 'unskippable' ? config.unskippable : config.mediaQuest;
    if (!upsellConfig.buttonLink) return;
    const stripeUrl = buildStripeUrl(upsellConfig.buttonLink, pendingUsername, pendingAdId);
    window.open(stripeUrl, '_blank');
    setPendingUpsells(prev => ({ ...prev, [kind]: false }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Promote This Post
          </DialogTitle>
          <DialogDescription>Turn this post into a PROMO BLAST — pick a duration and complete payment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {AD_TIER_ORDER.map(key => {
                const tier = config.tiers[key];
                const active = selectedTier === key;
                const vouchers = userProfile?.freePromoVouchers?.[key] ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTier(key)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-center transition-colors',
                      active ? 'border-primary bg-primary/10' : 'border-border bg-card/50 hover:border-primary/40'
                    )}
                  >
                    <p className="text-xs font-semibold">{AD_TIER_LABELS[key]}</p>
                    <p className="text-sm font-bold text-foreground">{tier.priceLabel}</p>
                    {vouchers > 0 && <p className="text-[10px] font-bold text-green-400 mt-0.5">🎁 {vouchers} free</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {(includedUpsells.length > 0 || selectableUpsells.length > 0) && (
            <div className="space-y-2 border rounded-lg p-3 border-border/60">
              {includedUpsells.length > 0 && (
                <div className="space-y-1.5 pb-1.5 mb-1.5 border-b border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Included with this slot</p>
                  {includedUpsells.includes('unskippable') && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-green-400"><Check className="w-3.5 h-3.5" /> Unskippable</p>
                  )}
                  {includedUpsells.includes('mediaQuest') && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-green-400"><Check className="w-3.5 h-3.5" /> CYBAQUEST</p>
                  )}
                </div>
              )}
              {selectableUpsells.includes('unskippable') && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={wantUnskippable} onCheckedChange={c => setWantUnskippable(c === true)} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold"><Zap className="w-3.5 h-3.5" /> Unskippable — {config.unskippable.priceLabel}</span>
                    <span className="block text-xs text-muted-foreground">Your promo plays in full with no skip option.</span>
                  </span>
                </label>
              )}
              {selectableUpsells.includes('mediaQuest') && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={wantMediaQuest} onCheckedChange={c => setWantMediaQuest(c === true)} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold"><Target className="w-3.5 h-3.5" /> CYBAQUEST — {config.mediaQuest.priceLabel}</span>
                    <span className="block text-xs text-muted-foreground">A CYBAQUEST is created prompting CYBAs to purchase your product or service.</span>
                  </span>
                </label>
              )}
              {questActive && (
                <div className="pt-1">
                  <label className="text-xs text-muted-foreground mb-1 block">What do you want members to do?</label>
                  <Textarea value={questInstructions} onChange={e => setQuestInstructions(e.target.value)} placeholder="e.g. Visit my store and tag us in a photo" rows={2} />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Button text</label>
            <Input value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder="Shop Now" maxLength={30} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Button link</label>
            <Input value={buttonLink} onChange={e => setButtonLink(e.target.value)} placeholder="https://…" />
          </div>

          {availableVouchers > 0 && (
            <Button
              variant="outline"
              className="w-full border-green-600 text-green-400 hover:bg-green-950"
              onClick={handleRedeemVoucher}
              disabled={submitting || !buttonText.trim() || !buttonLink.trim()}
            >
              {redeemingVoucher ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
              Redeem Free {AD_TIER_LABELS[selectedTier]} Promo
            </Button>
          )}

          {walletBalance > 0 && (
            <label className="flex items-center gap-2.5 cursor-pointer text-sm border rounded-lg p-2.5 border-border/60">
              <Checkbox checked={payWithWalletCash} onCheckedChange={c => setPayWithWalletCash(c === true)} />
              <span>Pay with Wallet Cash (${walletBalance.toFixed(2)} available) instead of card</span>
            </label>
          )}
          {payWithWalletCash ? (
            <Button
              className="w-full"
              onClick={handleSubmitWithWalletCash}
              disabled={submitting || !buttonText.trim() || !buttonLink.trim() || walletBalance < walletCashTotal}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
              {walletBalance < walletCashTotal ? 'Not enough wallet cash' : `Select a Slot — $${walletCashTotal.toFixed(2)} wallet cash`}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !buttonText.trim() || !buttonLink.trim()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
              Select a Slot
              {selectedUpsellCount > 0 ? ` + ${selectedUpsellCount} add-on${selectedUpsellCount > 1 ? 's' : ''}` : ''}
            </Button>
          )}

          {(pendingUpsells.unskippable || pendingUpsells.mediaQuest) && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">Finish your upsell purchase{[pendingUpsells.unskippable, pendingUpsells.mediaQuest].filter(Boolean).length > 1 ? 's' : ''}:</p>
              {pendingUpsells.unskippable && (
                <Button variant="outline" className="w-full" onClick={() => handleUpsellCheckout('unskippable')}>
                  <Check className="w-4 h-4 mr-2" />Complete Unskippable upgrade — {config.unskippable.priceLabel}
                </Button>
              )}
              {pendingUpsells.mediaQuest && (
                <Button variant="outline" className="w-full" onClick={() => handleUpsellCheckout('mediaQuest')}>
                  <Check className="w-4 h-4 mr-2" />Complete CYBAQUEST upgrade — {config.mediaQuest.priceLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

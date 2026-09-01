'use client';

import { useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Zap, Target, Check, Megaphone, Shirt } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DEFAULT_AD_DROP_CONFIG, AD_TIER_ORDER, AD_TIER_LABELS,
  AD_TIER_INCLUDED_UPSELLS, getSelectableUpsells, parsePriceLabel,
  type AdDropConfig, type AdMediaType, type AdTierKey,
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
  const [wantCybashirt, setWantCybashirt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payWithWalletCash, setPayWithWalletCash] = useState(false);

  const includedUpsells = AD_TIER_INCLUDED_UPSELLS[selectedTier];
  const selectableUpsells = getSelectableUpsells(selectedTier);
  const setSelectedTier = (tier: AdTierKey) => {
    setSelectedTierRaw(tier);
    const selectable = getSelectableUpsells(tier);
    if (!selectable.includes('unskippable')) setWantUnskippable(false);
    if (!selectable.includes('mediaQuest')) setWantMediaQuest(false);
    if (!selectable.includes('cybashirt')) setWantCybashirt(false);
  };

  const [pendingAdId, setPendingAdId] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [pendingUpsells, setPendingUpsells] = useState<{ unskippable: boolean; mediaQuest: boolean; cybashirt: boolean }>({ unskippable: false, mediaQuest: false, cybashirt: false });

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile } = useDoc<{ username?: string; payoutBalance?: number }>(userDocRef);

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'adDropConfig'), [firestore]);
  const { data: rawConfig } = useDoc<Partial<AdDropConfig>>(configRef);
  const config: AdDropConfig = {
    ...DEFAULT_AD_DROP_CONFIG,
    ...rawConfig,
    tiers: { ...DEFAULT_AD_DROP_CONFIG.tiers, ...rawConfig?.tiers },
    unskippable: { ...DEFAULT_AD_DROP_CONFIG.unskippable, ...rawConfig?.unskippable },
    mediaQuest: { ...DEFAULT_AD_DROP_CONFIG.mediaQuest, ...rawConfig?.mediaQuest },
    cybashirt: { ...DEFAULT_AD_DROP_CONFIG.cybashirt, ...rawConfig?.cybashirt },
  };

  const selectedUpsellCount = [wantUnskippable, wantMediaQuest, wantCybashirt].filter(Boolean).length;

  const walletBalance = userProfile?.payoutBalance ?? 0;
  const walletCashTotal =
    parsePriceLabel(config.tiers[selectedTier].priceLabel) +
    (wantUnskippable ? parsePriceLabel(config.unskippable.priceLabel) : 0) +
    (wantMediaQuest ? parsePriceLabel(config.mediaQuest.priceLabel) : 0) +
    (wantCybashirt ? parsePriceLabel(config.cybashirt.priceLabel) : 0);

  const handleSubmit = async () => {
    if (!user || !userProfile?.username) return;
    if (!buttonText.trim() || !buttonLink.trim()) {
      toast({ variant: 'destructive', title: 'Missing info', description: 'Add a button label and link.' });
      return;
    }
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
      toast({ variant: 'destructive', title: 'Media CYBAQUEST upsell not configured yet', description: 'Ask an admin to set its payment link, or unselect it.' });
      return;
    }
    if (wantCybashirt && !config.cybashirt.buttonLink) {
      toast({ variant: 'destructive', title: 'CYBASHIRT upsell not configured yet', description: 'Ask an admin to set its payment link, or unselect it.' });
      return;
    }

    const payWin = openDeferredWindow();
    setSubmitting(true);
    try {
      const adDoc = await addDoc(collection(firestore, 'ads'), {
        userId: user.uid,
        username: userProfile.username,
        mediaUrl,
        mediaType,
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim(),
        status: 'pending_payment',
        tier: selectedTier,
        durationDays: tierConfig.days,
        ...(videoDurationSeconds ? { videoDurationSeconds } : {}),
        unskippable: false,
        wantsMediaQuest: false,
        wantsCybashirt: false,
        viewCount: 0,
        clickCount: 0,
        totalWatchSeconds: 0,
        createdAt: serverTimestamp(),
      });

      const stripeUrl = buildStripeUrl(tierConfig.buttonLink, userProfile.username, adDoc.id);
      redirectDeferredWindow(payWin, stripeUrl, toast);

      if (wantUnskippable || wantMediaQuest || wantCybashirt) {
        setPendingAdId(adDoc.id);
        setPendingUsername(userProfile.username);
        setPendingUpsells({ unskippable: wantUnskippable, mediaQuest: wantMediaQuest, cybashirt: wantCybashirt });
      }

      toast({
        title: 'Promo created!',
        description: wantUnskippable || wantMediaQuest || wantCybashirt
          ? 'Complete payment in the new tab, then finish your upsell purchase(s) below.'
          : 'Complete payment in the new tab. Your promo goes live automatically once payment is confirmed.',
      });
      setButtonText('');
      setButtonLink('');
    } catch {
      if (payWin) payWin.close();
      toast({ variant: 'destructive', title: 'Failed to create promo', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWithWalletCash = async () => {
    if (!user || !userProfile?.username) return;
    if (!buttonText.trim() || !buttonLink.trim()) {
      toast({ variant: 'destructive', title: 'Missing info', description: 'Add a button label and link.' });
      return;
    }
    if (walletBalance < walletCashTotal) {
      toast({ variant: 'destructive', title: 'Not enough wallet cash' });
      return;
    }
    const tierConfig = config.tiers[selectedTier];
    setSubmitting(true);
    try {
      const adRef = await addDoc(collection(firestore, 'ads'), {
        userId: user.uid,
        username: userProfile.username,
        mediaUrl,
        mediaType,
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim(),
        status: 'pending_payment',
        tier: selectedTier,
        durationDays: tierConfig.days,
        ...(videoDurationSeconds ? { videoDurationSeconds } : {}),
        unskippable: false,
        wantsMediaQuest: false,
        wantsCybashirt: false,
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
        wantsCybashirt: includedUpsells.includes('cybashirt') || wantCybashirt,
      });

      await updateDoc(doc(firestore, 'users', user.uid), { payoutBalance: increment(-walletCashTotal) });
      await logCashTransaction(firestore, user.uid, {
        type: 'promo_blast_purchase',
        amount: -walletCashTotal,
        description: `Promo Blast (Wallet Cash): ${AD_TIER_LABELS[selectedTier]}${wantUnskippable ? ' + Unskippable' : ''}${wantMediaQuest ? ' + Media CYBAQUEST' : ''}${wantCybashirt ? ' + CYBASHIRT' : ''}`,
      });

      toast({ title: 'Promo is live!', description: `$${walletCashTotal.toFixed(2)} wallet cash spent — your promo is active now.` });
      setButtonText('');
      setButtonLink('');
      setPayWithWalletCash(false);
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpsellCheckout = (kind: 'unskippable' | 'mediaQuest' | 'cybashirt') => {
    if (!pendingAdId || !pendingUsername) return;
    const upsellConfig = kind === 'unskippable' ? config.unskippable : kind === 'mediaQuest' ? config.mediaQuest : config.cybashirt;
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
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-green-400"><Check className="w-3.5 h-3.5" /> Media CYBAQUEST</p>
                  )}
                  {includedUpsells.includes('cybashirt') && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-green-400"><Check className="w-3.5 h-3.5" /> CYBASHIRT</p>
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
                    <span className="flex items-center gap-1.5 text-sm font-semibold"><Target className="w-3.5 h-3.5" /> Media CYBAQUEST — {config.mediaQuest.priceLabel}</span>
                    <span className="block text-xs text-muted-foreground">A CYBAQUEST is created prompting CYBAs to purchase your product or service.</span>
                  </span>
                </label>
              )}
              {selectableUpsells.includes('cybashirt') && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={wantCybashirt} onCheckedChange={c => setWantCybashirt(c === true)} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold"><Shirt className="w-3.5 h-3.5" /> CYBASHIRT — {config.cybashirt.priceLabel}</span>
                    <span className="block text-xs text-muted-foreground">Your logo printed on a CYBASHIRT, worn around the Zone.</span>
                  </span>
                </label>
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
              {walletBalance < walletCashTotal ? 'Not enough wallet cash' : `Go Live — $${walletCashTotal.toFixed(2)} wallet cash`}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !buttonText.trim() || !buttonLink.trim()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
              Continue to Payment — {config.tiers[selectedTier].priceLabel}
              {selectedUpsellCount > 0 ? ` + ${selectedUpsellCount} add-on${selectedUpsellCount > 1 ? 's' : ''}` : ''}
            </Button>
          )}

          {(pendingUpsells.unskippable || pendingUpsells.mediaQuest || pendingUpsells.cybashirt) && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">Finish your upsell purchase{[pendingUpsells.unskippable, pendingUpsells.mediaQuest, pendingUpsells.cybashirt].filter(Boolean).length > 1 ? 's' : ''}:</p>
              {pendingUpsells.unskippable && (
                <Button variant="outline" className="w-full" onClick={() => handleUpsellCheckout('unskippable')}>
                  <Check className="w-4 h-4 mr-2" />Complete Unskippable upgrade — {config.unskippable.priceLabel}
                </Button>
              )}
              {pendingUpsells.mediaQuest && (
                <Button variant="outline" className="w-full" onClick={() => handleUpsellCheckout('mediaQuest')}>
                  <Check className="w-4 h-4 mr-2" />Complete Media CYBAQUEST upgrade — {config.mediaQuest.priceLabel}
                </Button>
              )}
              {pendingUpsells.cybashirt && (
                <Button variant="outline" className="w-full" onClick={() => handleUpsellCheckout('cybashirt')}>
                  <Check className="w-4 h-4 mr-2" />Complete CYBASHIRT upgrade — {config.cybashirt.priceLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

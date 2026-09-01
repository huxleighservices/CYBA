'use client';

import { useState, useRef } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy, doc, addDoc, updateDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ImagePlus, Video, Zap, Target, Check, Shirt } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DEFAULT_AD_DROP_CONFIG, AD_TIER_MAX_VIDEO_SECONDS, AD_TIER_ORDER, AD_TIER_LABELS,
  AD_TIER_INCLUDED_UPSELLS, getSelectableUpsells, parsePriceLabel,
  type AdDropConfig, type AdDoc, type AdMediaType, type AdTierKey,
} from '@/lib/ad-drop';
import {
  getVideoDuration, buildStripeUrl, openDeferredWindow, redirectDeferredWindow,
} from '@/lib/promo-blast-checkout';
import { logCashTransaction } from '@/lib/transactions';

type UserProfile = { username?: string; payoutBalance?: number };

export default function AdDropPage() {
  const { firestore, storage, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<AdMediaType | null>(null);
  // Raw, uncapped duration read from the file — kept local-only so the effective cap can be
  // recomputed if the advertiser switches tiers after picking a video.
  const [rawVideoDurationSeconds, setRawVideoDurationSeconds] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [selectedTier, setSelectedTierRaw] = useState<AdTierKey>('day7');
  const [wantUnskippable, setWantUnskippable] = useState(false);
  const [wantMediaQuest, setWantMediaQuest] = useState(false);
  const [wantCybashirt, setWantCybashirt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [payWithWalletCash, setPayWithWalletCash] = useState(false);

  // Each tier bundles some add-ons free; the rest are offered as paid extras. Switching tiers
  // can move an add-on from "paid extra" to "included" (or vice versa) — clear any paid
  // selection that's no longer a paid extra at the new tier, so the total never double-counts
  // something that's now free, or references something no longer offered.
  const includedUpsells = AD_TIER_INCLUDED_UPSELLS[selectedTier];
  const selectableUpsells = getSelectableUpsells(selectedTier);
  const setSelectedTier = (tier: AdTierKey) => {
    setSelectedTierRaw(tier);
    const selectable = getSelectableUpsells(tier);
    if (!selectable.includes('unskippable')) setWantUnskippable(false);
    if (!selectable.includes('mediaQuest')) setWantMediaQuest(false);
    if (!selectable.includes('cybashirt')) setWantCybashirt(false);
  };

  // After the base ad is created, these hold the still-pending upsell checkouts so the
  // advertiser can complete each with its own fresh click (browsers block stacked popups
  // fired from a single gesture).
  const [pendingAdId, setPendingAdId] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [pendingUpsells, setPendingUpsells] = useState<{ unskippable: boolean; mediaQuest: boolean; cybashirt: boolean }>({ unskippable: false, mediaQuest: false, cybashirt: false });

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

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

  const galleryQuery = useMemoFirebase(
    () => query(collection(firestore, 'ads'), where('status', '==', 'active'), orderBy('activatedAt', 'desc')),
    [firestore]
  );
  const { data: activeAds, isLoading: isLoadingGallery } = useCollection<AdDoc>(galleryQuery);

  // Effective duration stored on the ad — capped to the selected tier's limit, recomputed
  // live if the advertiser switches tiers after picking a video (never sent uncapped).
  const videoDurationSeconds = rawVideoDurationSeconds != null
    ? Math.min(rawVideoDurationSeconds, AD_TIER_MAX_VIDEO_SECONDS[selectedTier])
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast({ variant: 'destructive', title: 'Unsupported file', description: 'Upload an image or a video.' });
      return;
    }
    let duration: number | null = null;
    if (isVideo) {
      try {
        duration = await getVideoDuration(f);
        const limit = AD_TIER_MAX_VIDEO_SECONDS[selectedTier];
        if (duration > limit) {
          toast({ title: 'Video will be trimmed', description: `This tier's limit is ${limit}s — playback will automatically stop there.` });
        }
      } catch {
        toast({ variant: 'destructive', title: 'Could not read video file' });
        return;
      }
    }
    setFile(f);
    setMediaType(isImage ? 'image' : 'video');
    setRawVideoDurationSeconds(duration);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!user || !userProfile?.username || !file || !mediaType) return;
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

    // Open the tab synchronously, still inside this click's user-gesture context — filling in
    // its location once the real Stripe URL is known avoids the popup blocker entirely.
    const payWin = openDeferredWindow();

    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop() ?? (mediaType === 'image' ? 'jpg' : 'mp4');
      const path = `ad_drop/${uuidv4()}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

      const mediaUrl = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 90)),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref)),
        );
      });

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
        // Included-with-tier add-ons activate alongside the base tier itself (see the Stripe
        // webhook's activateAdTier) — not set here, since the tier isn't paid/active yet.
        unskippable: false,
        wantsMediaQuest: false,
        wantsCybashirt: false,
        viewCount: 0,
        clickCount: 0,
        totalWatchSeconds: 0,
        createdAt: serverTimestamp(),
      });
      setUploadProgress(100);

      const stripeUrl = buildStripeUrl(tierConfig.buttonLink, userProfile.username, adDoc.id);
      redirectDeferredWindow(payWin, stripeUrl, toast);

      if (wantUnskippable || wantMediaQuest || wantCybashirt) {
        setPendingAdId(adDoc.id);
        setPendingUsername(userProfile.username);
        setPendingUpsells({ unskippable: wantUnskippable, mediaQuest: wantMediaQuest, cybashirt: wantCybashirt });
      }

      toast({
        title: 'Promo uploaded!',
        description: wantUnskippable || wantMediaQuest || wantCybashirt
          ? 'Complete payment in the new tab, then finish your upsell purchase(s) below. Your promo goes live automatically once the base payment is confirmed.'
          : 'Complete payment in the new tab. Your promo goes live automatically once payment is confirmed.',
      });
      setFile(null);
      setMediaType(null);
      setRawVideoDurationSeconds(null);
      setPreviewUrl(null);
      setButtonText('');
      setButtonLink('');
      setWantUnskippable(false);
      setWantMediaQuest(false);
      setWantCybashirt(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      if (payWin) payWin.close();
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitWithWalletCash = async () => {
    if (!user || !userProfile?.username || !file || !mediaType) return;
    if (!buttonText.trim() || !buttonLink.trim()) {
      toast({ variant: 'destructive', title: 'Missing info', description: 'Add a button label and link.' });
      return;
    }
    if (walletBalance < walletCashTotal) {
      toast({ variant: 'destructive', title: 'Not enough wallet cash' });
      return;
    }
    const tierConfig = config.tiers[selectedTier];

    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop() ?? (mediaType === 'image' ? 'jpg' : 'mp4');
      const path = `ad_drop/${uuidv4()}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

      const mediaUrl = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 90)),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref)),
        );
      });

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
      setUploadProgress(100);

      await updateDoc(doc(firestore, 'users', user.uid), { payoutBalance: increment(-walletCashTotal) });
      await logCashTransaction(firestore, user.uid, {
        type: 'promo_blast_purchase',
        amount: -walletCashTotal,
        description: `Promo Blast (Wallet Cash): ${AD_TIER_LABELS[selectedTier]}${wantUnskippable ? ' + Unskippable' : ''}${wantMediaQuest ? ' + Media CYBAQUEST' : ''}${wantCybashirt ? ' + CYBASHIRT' : ''}`,
      });

      toast({ title: 'Promo is live!', description: `$${walletCashTotal.toFixed(2)} wallet cash spent — your promo is active now.` });
      setFile(null);
      setMediaType(null);
      setRawVideoDurationSeconds(null);
      setPreviewUrl(null);
      setButtonText('');
      setButtonLink('');
      setWantUnskippable(false);
      setWantMediaQuest(false);
      setWantCybashirt(false);
      setPayWithWalletCash(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setUploading(false);
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
    <div className="container mx-auto px-4 pt-4 pb-16 max-w-5xl">
      <SectionHeader
        title="PROMOTE YOUR BUSINESS"
        description="Turn your business into a PROMO BLAST — pick a duration and complete payment. Goes live in front of the whole Pittsburgh CYBA community."
      />

      {/* Select a slot */}
      <Card className="mb-16 max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Select a Slot</CardTitle>
          <CardDescription>Upload your creative, pick a duration, then complete payment. Your promo goes live immediately once payment is confirmed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isUserLoading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : !user ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">Sign in to select a promo slot.</p>
              <Button asChild><Link href="/login">Sign In</Link></Button>
            </div>
          ) : (
            <>
              {/* Tier picker */}
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

              {/* Add-ons — bundled free ones for this tier show as included; the rest are
                  offered as paid extras. */}
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
                <label className="text-xs text-muted-foreground mb-1 block">
                  Image or video (max {AD_TIER_MAX_VIDEO_SECONDS[selectedTier]}s for {AD_TIER_LABELS[selectedTier]} — longer videos auto-trim)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-sm"
                />
                {previewUrl && mediaType === 'image' && (
                  <img src={previewUrl} alt="Preview" className="mt-3 max-h-48 rounded-lg object-cover" />
                )}
                {previewUrl && mediaType === 'video' && (
                  <video src={previewUrl} controls className="mt-3 max-h-48 rounded-lg" />
                )}
              </div>
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
              {uploading && <Progress value={uploadProgress} />}
              {payWithWalletCash ? (
                <Button
                  className="w-full"
                  onClick={handleSubmitWithWalletCash}
                  disabled={uploading || !file || !buttonText.trim() || !buttonLink.trim() || walletBalance < walletCashTotal}
                >
                  {uploading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : mediaType === 'video' ? <Video className="h-4 w-4 mr-2" /> : <ImagePlus className="h-4 w-4 mr-2" />
                  }
                  {walletBalance < walletCashTotal ? 'Not enough wallet cash' : `Upload & Go Live — $${walletCashTotal.toFixed(2)} wallet cash`}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={uploading || !file || !buttonText.trim() || !buttonLink.trim()}
                >
                  {uploading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : mediaType === 'video' ? <Video className="h-4 w-4 mr-2" /> : <ImagePlus className="h-4 w-4 mr-2" />
                  }
                  Upload & Continue to Payment — {config.tiers[selectedTier].priceLabel}
                  {selectedUpsellCount > 0 ? ` + ${selectedUpsellCount} add-on${selectedUpsellCount > 1 ? 's' : ''}` : ''}
                </Button>
              )}

              {/* Pending upsell checkouts — each needs its own click (fresh gesture) */}
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Gallery */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-border/50" />
        <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-2">Active Promos</h2>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {isLoadingGallery ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !activeAds || activeAds.length === 0 ? (
        <p className="text-center text-foreground/60">No active promos right now — be the first!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {activeAds.map((ad: any) => (
            <a
              key={ad.id}
              href={ad.buttonLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="group rounded-xl overflow-hidden border border-primary/20 bg-card/50 hover:border-primary transition-all"
            >
              {ad.mediaType === 'image' ? (
                <img src={ad.mediaUrl} alt="" className="w-full aspect-square object-cover" />
              ) : (
                <video src={ad.mediaUrl} className="w-full aspect-square object-cover" muted loop autoPlay playsInline />
              )}
              <div className="p-2">
                <p className="text-xs text-muted-foreground truncate">@{ad.username}</p>
                <p className="text-sm font-semibold truncate group-hover:text-primary">{ad.buttonText}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

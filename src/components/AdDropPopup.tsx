'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, increment, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logTransaction } from '@/lib/transactions';
import { DEFAULT_AD_DROP_CONFIG, type AdDropConfig, type AdDoc } from '@/lib/ad-drop';

// A pop-up fires every 10 minutes of active use, or immediately on section navigation —
// whichever comes first — but never more often than the hard minimum gap below.
const ACTIVE_USE_INTERVAL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 2 * 60 * 1000;
const FORCED_VIEW_SECONDS = 5;
const REWARD_CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // once per unique ad per user per 24h

export function AdDropPopup() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile } = useDoc<{ cybaCoinBalance?: number; adFreeBoost?: boolean }>(userDocRef);

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'adDropConfig'), [firestore]);
  const { data: rawConfig } = useDoc<Partial<AdDropConfig>>(configRef);
  const config: AdDropConfig = { ...DEFAULT_AD_DROP_CONFIG, ...rawConfig };

  const adsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, 'ads'), where('status', '==', 'active')) : null),
    [firestore, user]
  );
  const { data: activeAds } = useCollection<AdDoc>(adsQuery);

  const [open, setOpen] = useState(false);
  const [currentAd, setCurrentAd] = useState<(AdDoc & { id: string }) | null>(null);
  const [canClose, setCanClose] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const indexRef = useRef(0);
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forcedViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewStartRef = useRef<number>(0);
  const currentAdRef = useRef<(AdDoc & { id: string }) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastShownAtRef = useRef<number>(0);
  const pathname = usePathname();

  const ads = useMemo(() => activeAds ?? [], [activeAds]);
  const adFree = !!userProfile?.adFreeBoost;

  // Records watch time for whatever ad is currently showing. Called from every exit path
  // (skip, manual close, and silent replacement by the next ad) so none of them are missed.
  const recordWatchTime = () => {
    const ad = currentAdRef.current;
    if (!ad || !viewStartRef.current) return;
    const elapsedSeconds = (Date.now() - viewStartRef.current) / 1000;
    if (elapsedSeconds > 0) {
      updateDoc(doc(firestore, 'ads', ad.id), { totalWatchSeconds: increment(elapsedSeconds) }).catch(() => {});
    }
    viewStartRef.current = 0;
  };

  const tryShowNext = () => {
    if (Date.now() - lastShownAtRef.current < MIN_GAP_MS) return;
    if (!ads.length) return;
    recordWatchTime();
    lastShownAtRef.current = Date.now();
    const ad = ads[indexRef.current % ads.length];
    indexRef.current += 1;
    currentAdRef.current = ad;
    viewStartRef.current = Date.now();
    setCurrentAd(ad);
    setCanClose(false);
    setOpen(true);
    updateDoc(doc(firestore, 'ads', ad.id), { viewCount: increment(1) }).catch(() => {});
  };

  // 10-minute active-use timer.
  useEffect(() => {
    if (!user || ads.length === 0 || adFree) return;
    intervalTimerRef.current = setInterval(tryShowNext, ACTIVE_USE_INTERVAL_MS);
    return () => { if (intervalTimerRef.current) clearInterval(intervalTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ads, adFree]);

  // Nav-triggered — fires on section navigation, still subject to the same minimum gap.
  // Skips the very first render (that's a page load, not a navigation).
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (!user || ads.length === 0 || adFree) return;
    if (!hasNavigatedRef.current) { hasNavigatedRef.current = true; return; }
    tryShowNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open || !currentAd) return;
    setCanClose(false);
    const forcedSeconds = currentAd.mediaType === 'video' && currentAd.unskippable && currentAd.videoDurationSeconds
      ? currentAd.videoDurationSeconds
      : FORCED_VIEW_SECONDS;

    forcedViewTimerRef.current = setTimeout(() => {
      setCanClose(true);
      grantWatchReward(currentAd);
    }, forcedSeconds * 1000);

    return () => {
      if (forcedViewTimerRef.current) clearTimeout(forcedViewTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentAd]);

  // Enforce the tier's video length cap during playback — the raw uploaded file is never
  // re-encoded (see ad-drop/page.tsx), so a video longer than its tier's limit will otherwise
  // keep playing/looping past videoDurationSeconds. Loop back to 0 once the cap is hit instead.
  useEffect(() => {
    const el = videoRef.current;
    const cap = currentAd?.videoDurationSeconds;
    if (!open || !el || !cap) return;
    const onTimeUpdate = () => {
      if (el.currentTime >= cap) el.currentTime = 0;
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [open, currentAd]);

  const grantWatchReward = async (ad: AdDoc & { id: string }) => {
    if (!user || config.watchRewardCC <= 0) return;
    try {
      const claimRef = doc(firestore, 'users', user.uid, 'adRewardClaims', ad.id);
      const granted = await runTransaction(firestore, async tx => {
        const claimSnap = await tx.get(claimRef);
        const lastClaimedAt = claimSnap.data()?.lastClaimedAt as Timestamp | undefined;
        if (lastClaimedAt && Date.now() - lastClaimedAt.toMillis() < REWARD_CLAIM_COOLDOWN_MS) {
          return false;
        }
        tx.set(claimRef, { lastClaimedAt: serverTimestamp() });
        tx.update(doc(firestore, 'users', user.uid), { cybaCoinBalance: increment(config.watchRewardCC) });
        return true;
      });
      if (granted) {
        await logTransaction(firestore, user.uid, {
          type: 'ad_watch_reward',
          amount: config.watchRewardCC,
          description: 'Watched PROMO BLAST promo',
        });
      }
    } catch {
      // Non-critical — never block the ad UI on reward bookkeeping
    }
  };

  const handleSkip = async () => {
    if (!user || !userProfile || !currentAd) return;
    const balance = userProfile.cybaCoinBalance ?? 0;
    if (balance < config.skipCostCC) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN', description: `Skipping costs ${config.skipCostCC.toLocaleString()} CC.` });
      return;
    }
    setSkipping(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-config.skipCostCC),
      });
      await logTransaction(firestore, user.uid, {
        type: 'ad_skip',
        amount: -config.skipCostCC,
        description: 'Skipped PROMO BLAST popup',
      });
      recordWatchTime();
      setOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Skip failed', description: 'Please try again.' });
    } finally {
      setSkipping(false);
    }
  };

  const handleClick = () => {
    if (!currentAd) return;
    updateDoc(doc(firestore, 'ads', currentAd.id), { clickCount: increment(1) }).catch(() => {});
  };

  const handleManualClose = () => {
    if (!canClose) return;
    recordWatchTime();
    setOpen(false);
  };

  if (!user || !currentAd || adFree) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (canClose) { if (!v) recordWatchTime(); setOpen(v); } }}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden gap-0 [&>button]:hidden"
        onInteractOutside={e => { if (!canClose) e.preventDefault(); }}
        onEscapeKeyDown={e => { if (!canClose) e.preventDefault(); }}
      >
        <div className="relative">
          {currentAd.mediaType === 'image' ? (
            <img src={currentAd.mediaUrl} alt="" className="w-full max-h-80 object-cover" />
          ) : (
            <video ref={videoRef} src={currentAd.mediaUrl} className="w-full max-h-80 object-cover" autoPlay muted loop playsInline />
          )}
          <button
            onClick={handleManualClose}
            disabled={!canClose}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white disabled:opacity-40"
            title={canClose ? 'Close' : `Available in a moment…`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Sponsored by @{currentAd.username}</p>
          <div className="flex gap-2">
            <Button asChild className="flex-1" onClick={handleClick}>
              <a href={currentAd.buttonLink} target="_blank" rel="noopener noreferrer sponsored">
                {currentAd.buttonText}
              </a>
            </Button>
            {!canClose && !currentAd.unskippable && (
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={skipping}
                className="shrink-0 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Skip — {config.skipCostCC.toLocaleString()} CC
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

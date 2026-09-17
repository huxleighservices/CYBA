'use client';

import { useState, useRef } from 'react';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, increment, arrayUnion, collection, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Loader2, CheckCircle2, Lock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { computeLevel, LEVEL_CONFIG } from '@/lib/levels';
import { DEFAULT_CC_RATES, mergeWithDefaults, type CCRates } from '@/lib/cc-rewards';
import {
  PURCHASABLE_BACKGROUNDS,
  isBackgroundUnlocked,
  type ProfileBackground,
} from '@/lib/profile-backgrounds';
import { logTransaction } from '@/lib/transactions';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';
import { cn } from '@/lib/utils';
import type { CustomQuest } from '@/lib/quests';
import type { Level } from '@/lib/levels';
import { GEAR_CATALOG } from '@/lib/avatar-gear';

const DIFF_TO_LEVEL: Record<CustomQuest['difficulty'], Level> = {
  easy: 'spark',
  medium: 'charge',
  hard: 'surge',
  legendary: 'storm',
};

type UserProfile = {
  username?: string;
  cybaCoinBalance?: number;
  postCount?: number;
  levelOverride?: string;
  supportGiven?: number;
  unlockedBackgrounds?: string[];
  purchasedRewards?: string[];
  unlockedQuests?: string[];
  purchasedGear?: string[];
  equippedGear?: string[];
};

type RewardExtra = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceCurrency: 'usd' | 'cc';
  cybaCoinPrice?: number;
  features: string[];
  buttonText: string;
  buttonLink: string;
  type: 'reward';
  order?: number;
  requiresSubmission?: boolean;
  submissionPayoutType?: 'none' | 'cybacoin' | 'cash';
  submissionPayoutAmount?: number;
};

/** Convert a Firestore background record (style stored as plain map) to ProfileBackground */
function toProfileBackground(raw: any): ProfileBackground {
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    emoji: raw.emoji ?? '✨',
    unlockType: raw.unlockType ?? 'coins',
    coinCost: raw.coinCost,
    requiredLevel: raw.requiredLevel,
    style: (typeof raw.style === 'object' && raw.style !== null) ? raw.style : {},
    preview: raw.preview ?? '',
  } as ProfileBackground;
}

function BackgroundCard({
  bg,
  owned,
  canAfford,
  meetsLevel,
  onBuy,
  buying,
}: {
  bg: ProfileBackground;
  owned: boolean;
  canAfford: boolean;
  meetsLevel: boolean;
  onBuy: (bg: ProfileBackground) => void;
  buying: boolean;
}) {
  const locked = !meetsLevel;
  const affordable = canAfford && meetsLevel;

  return (
    <div className={cn(
      'relative rounded-2xl border overflow-hidden flex flex-col transition-all duration-200',
      owned
        ? 'border-primary/60 shadow-[0_0_16px_rgba(138,43,226,0.3)]'
        : 'border-border/50 hover:border-border',
    )}>
      {/* Preview */}
      <div className="relative h-28 w-full shrink-0" style={bg.style}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 right-2 text-xl">{bg.emoji}</div>
        {owned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-primary drop-shadow-lg" />
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Lock className="h-8 w-8 text-white/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1 bg-card/80">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm leading-tight">{bg.name}</p>
          {owned && <Badge variant="default" className="text-[10px] shrink-0">OWNED</Badge>}
          {locked && (
            <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">
              {bg.requiredLevel}+
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{bg.description}</p>

        {/* Price */}
        <div className="flex items-center gap-1.5 mt-1">
          <Image src="/CCoin.png?v=2" alt="CC" width={16} height={16} />
          <span className={cn(
            'text-sm font-bold tabular-nums',
            owned || canAfford ? 'text-yellow-400' : 'text-muted-foreground',
          )}>
            {bg.coinCost?.toLocaleString()}
          </span>
          {bg.requiredLevel && (
            <span className="text-[10px] text-muted-foreground ml-auto capitalize">
              {bg.requiredLevel}+ level
            </span>
          )}
        </div>

        <Button
          size="sm"
          className="w-full mt-1"
          disabled={owned || locked || !affordable || buying}
          variant={owned ? 'secondary' : affordable ? 'default' : 'outline'}
          onClick={() => !owned && !locked && affordable && onBuy(bg)}
        >
          {buying ? <Loader2 className="h-4 w-4 animate-spin" /> :
           owned       ? 'Owned' :
           locked      ? `Requires ${bg.requiredLevel} level` :
           !canAfford  ? 'Not enough CC' :
                         'Unlock'}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reward Media Submit Dialog
// ─────────────────────────────────────────────────────────────────────────────
function RewardSubmitDialog({
  item,
  open,
  onClose,
  userId,
  username,
  balance,
  storage,
  firestore,
}: {
  item: RewardExtra;
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  balance: number;
  storage: any;
  firestore: any;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const hasPayout = item.submissionPayoutType && item.submissionPayoutType !== 'none' && (item.submissionPayoutAmount ?? 0) > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) { toast({ variant: 'destructive', title: 'Please select a media file.' }); return; }
    if (item.priceCurrency === 'cc' && balance < item.price) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN.' }); return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split('.').pop();
      const storageRef = ref(storage, `reward_submissions/${userId}/${Date.now()}.${ext}`);
      const task = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        );
      });

      const mediaUrl = await getDownloadURL(storageRef);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      if (item.priceCurrency === 'cc' && item.price > 0) {
        await updateDoc(doc(firestore, 'users', userId), {
          cybaCoinBalance: increment(-item.price),
        });
        await addDoc(collection(firestore, 'users', userId, 'coinTransactions'), {
          type: 'reward_purchase',
          amount: -item.price,
          description: `Reward Submitted: ${item.name}`,
          timestamp: serverTimestamp(),
        });
      }

      const payout = hasPayout
        ? { type: item.submissionPayoutType as 'cybacoin' | 'cash', amount: item.submissionPayoutAmount! }
        : null;

      await addDoc(collection(firestore, 'quest_submissions'), {
        submissionType: 'reward',
        rewardId: item.id,
        rewardName: item.name,
        payout,
        userId,
        username,
        mediaUrl,
        mediaType,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });

      toast({ title: 'Submitted!', description: 'Your media is pending admin approval.' });
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Submission failed', description: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const isVideo = file?.type.startsWith('video/');
  const payoutLabel = hasPayout
    ? item.submissionPayoutType === 'cybacoin'
      ? `+${item.submissionPayoutAmount!.toLocaleString()} CC on approval`
      : `+$${item.submissionPayoutAmount!.toFixed(2)} on approval`
    : null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Media: {item.name}</DialogTitle>
          <DialogDescription>
            Upload your media for admin review.
            {payoutLabel && <span className="text-green-400 font-semibold"> {payoutLabel}.</span>}
            {item.priceCurrency === 'cc' && item.price > 0 && ` Costs ${item.price.toLocaleString()} CC.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Media (image or video)</label>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            {preview ? (
              <div className="relative rounded-lg overflow-hidden border border-border bg-black/30 flex items-center justify-center max-h-48">
                {isVideo
                  ? <video src={preview} className="max-h-48 max-w-full" muted />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={preview} alt="preview" className="max-h-48 max-w-full object-contain" />
                }
                <button
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-xs text-white"
                  onClick={() => { setFile(null); setPreview(null); }}
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-border rounded-lg py-10 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm">Click to upload image or video</span>
              </button>
            )}
          </div>

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progress}% uploaded</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="secondary" disabled={uploading}>Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={uploading || !file}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Submit{item.priceCurrency === 'cc' && item.price > 0 ? ` (${item.price.toLocaleString()} CC)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function RewardsPage() {
  const { firestore, storage, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [rewardSubmitItem, setRewardSubmitItem] = useState<RewardExtra | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  // Load admin-configured backgrounds from Firestore
  const rewardsConfigRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'rewardsConfig'),
    [firestore]
  );
  const { data: rewardsConfig } = useDoc<{ backgrounds?: any[] }>(rewardsConfigRef);

  // Load reward-type extras
  const extrasQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), where('type', '==', 'reward'), orderBy('order')),
    [firestore]
  );
  const { data: rewardExtras } = useCollection<RewardExtra>(extrasQuery);

  // Load custom quests marked for rewards page
  const questRewardsQuery = useMemoFirebase(
    () => query(collection(firestore, 'custom_quests'), where('showOnRewardsPage', '==', true), where('active', '==', true)),
    [firestore]
  );
  const { data: questRewards } = useCollection<CustomQuest>(questRewardsQuery);

  const ccRatesRef = useMemoFirebase(() => doc(firestore, 'settings', 'ccRates'), [firestore]);
  const { data: ccRatesRaw } = useDoc<Partial<CCRates>>(ccRatesRef);
  const ccRates = ccRatesRaw ? mergeWithDefaults(ccRatesRaw) : DEFAULT_CC_RATES;

  const backgrounds: ProfileBackground[] = rewardsConfig?.backgrounds
    ? rewardsConfig.backgrounds.map(toProfileBackground)
    : PURCHASABLE_BACKGROUNDS;

  const balance = userProfile?.cybaCoinBalance ?? 0;
  const level = computeLevel(userProfile?.postCount, userProfile?.supportGiven, undefined, userProfile?.levelOverride);
  const ownedIds = userProfile?.unlockedBackgrounds ?? [];
  const unlockedQuestIds = userProfile?.unlockedQuests ?? [];

  const handleBuy = async (bg: ProfileBackground) => {
    if (!user || !userProfile) return;
    if ((userProfile.cybaCoinBalance ?? 0) < (bg.coinCost ?? 0)) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setBuyingId(bg.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-(bg.coinCost ?? 0)),
        unlockedBackgrounds: arrayUnion(bg.id),
      });
      await logTransaction(firestore, user.uid, {
        type: 'reward_purchase',
        amount: -(bg.coinCost ?? 0),
        description: `Unlocked: ${bg.emoji} ${bg.name}`,
      });
      toast({
        title: `${bg.emoji} ${bg.name} unlocked!`,
        description: `${bg.coinCost?.toLocaleString()} CYBACOIN spent. Apply it on your profile.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setBuyingId(null);
    }
  };

  const handleBuyExtra = async (item: RewardExtra) => {
    if (!user || !userProfile) return;
    if ((userProfile.cybaCoinBalance ?? 0) < item.price) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setBuyingId(item.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-item.price),
        purchasedRewards: arrayUnion(item.id),
      });
      await logTransaction(firestore, user.uid, {
        type: 'reward_purchase',
        amount: -item.price,
        description: `Purchased: ${item.name}`,
      });
      toast({ title: `${item.name} purchased!`, description: `${item.price.toLocaleString()} CYBACOIN spent.` });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setBuyingId(null);
    }
  };

  const handleBuyExtraCC = async (item: RewardExtra) => {
    if (!user || !userProfile) return;
    const ccPrice = item.cybaCoinPrice ?? 0;
    if ((userProfile.cybaCoinBalance ?? 0) < ccPrice) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setBuyingId(`cc_${item.id}`);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-ccPrice),
        purchasedRewards: arrayUnion(item.id),
      });
      await logTransaction(firestore, user.uid, {
        type: 'reward_purchase',
        amount: -ccPrice,
        description: `Purchased with CC: ${item.name}`,
      });
      toast({ title: `${item.name} purchased!`, description: `${ccPrice.toLocaleString()} CYBACOIN spent.` });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setBuyingId(null);
    }
  };

  const purchasedGear = userProfile?.purchasedGear ?? [];
  const equippedGear = userProfile?.equippedGear ?? [];

  const handleBuyGear = async (gearId: string) => {
    if (!user || !userProfile) return;
    const item = GEAR_CATALOG.find(g => g.id === gearId);
    if (!item) return;
    if (balance < item.price) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setBuyingId(`gear_${gearId}`);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-item.price),
        purchasedGear: arrayUnion(gearId),
      });
      await logTransaction(firestore, user.uid, {
        type: 'reward_purchase',
        amount: -item.price,
        description: `Avatar Gear: ${item.emoji} ${item.name}`,
      });
      toast({ title: `${item.emoji} ${item.name} unlocked!`, description: `${item.price.toLocaleString()} CYBACOIN spent.` });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setBuyingId(null);
    }
  };

  const handleToggleEquipGear = async (gearId: string) => {
    if (!user) return;
    const item = GEAR_CATALOG.find(g => g.id === gearId);
    if (!item) return;
    const isEquipped = equippedGear.includes(gearId);
    // Only one item per slot can be equipped at a time.
    const nextEquipped = isEquipped
      ? equippedGear.filter(id => id !== gearId)
      : [...equippedGear.filter(id => GEAR_CATALOG.find(g => g.id === id)?.slot !== item.slot), gearId];
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { equippedGear: nextEquipped });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update gear' });
    }
  };

  const handleUnlockQuest = async (quest: CustomQuest) => {
    if (!user || !userProfile || !quest.unlockPrice) return;
    const { currency, amount } = quest.unlockPrice;
    if (currency === 'cc') {
      if (balance < amount) { toast({ variant: 'destructive', title: 'Not enough CYBACOIN' }); return; }
      setBuyingId(`quest_${quest.id}`);
      try {
        await updateDoc(doc(firestore, 'users', user.uid), {
          cybaCoinBalance: increment(-amount),
          unlockedQuests: arrayUnion(quest.id),
        });
        await logTransaction(firestore, user.uid, {
          type: 'reward_purchase',
          amount: -amount,
          description: `Unlocked Quest: ${quest.nodeEmoji} ${quest.title}`,
        });
        toast({ title: `${quest.nodeEmoji} ${quest.title} unlocked!`, description: 'Head to CYBAQuests to complete it.' });
      } catch {
        toast({ variant: 'destructive', title: 'Purchase failed' });
      } finally {
        setBuyingId(null);
      }
    } else {
      // cash — redirect to Stripe or show payment link (placeholder)
      toast({ title: 'Cash payment coming soon', description: 'CC purchase is available now.' });
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-4 pb-16 max-w-5xl">
      <SectionHeader title="REWARDS" description="Spend your CYBACOIN on exclusive profile upgrades and quests." />

      {/* Balance + section nav share one row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {user ? (
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 bg-card border border-yellow-500/30 rounded-full px-4 py-1.5 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:border-yellow-400/50 transition-colors"
          >
            <Image src="/CCoin.png?v=2" alt="CC" width={18} height={18} />
            <span className="text-base font-bold text-yellow-400 tabular-nums">{balance.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">CYBACOIN</span>
          </Link>
        ) : (
          <div className="inline-flex items-center gap-2 bg-card border border-primary/20 rounded-full px-4 py-1.5">
            <span className="text-xs text-muted-foreground">
              <Link href="/login" className="text-primary underline">Sign in</Link> to spend CYBACOIN
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => scrollToSection('rewards-quests')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-card/60 border border-border/50 hover:border-primary/40 transition-colors">
            🗺️ CYBAQuests
          </button>
          <button onClick={() => scrollToSection('rewards-extras')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-card/60 border border-border/50 hover:border-primary/40 transition-colors">
            🎁 Rewards
          </button>
          <button onClick={() => scrollToSection('rewards-backgrounds')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-card/60 border border-border/50 hover:border-primary/40 transition-colors">
            🎨 Backgrounds
          </button>
          <button onClick={() => scrollToSection('rewards-avatar')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-card/60 border border-border/50 hover:border-primary/40 transition-colors">
            🎽 Avatar Upgrades
          </button>
        </div>
      </div>

      {/* CC Earning Rates — single compact strip, no section header treatment */}
      {user && (
        <div className="mb-6 bg-card/60 border border-border/50 rounded-xl px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="font-bold text-muted-foreground uppercase tracking-wide shrink-0">
            {LEVEL_CONFIG[level].emoji} {LEVEL_CONFIG[level].name} rates
          </span>
          <span className="w-px h-3.5 bg-border/50 shrink-0" />
          {([['text', '✍️'], ['image', '🖼️'], ['video', '🎥']] as const).map(([type, emoji]) => (
            <span key={type} className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-foreground/60">{emoji}</span>
              <span className="font-bold text-yellow-400">+{ccRates.post[type][level].toLocaleString()}</span>
            </span>
          ))}
          <span className="w-px h-3.5 bg-border/50 shrink-0" />
          {([['like', '❤️'], ['comment', '💬'], ['share', '🔄']] as const).map(([type, emoji]) => (
            <span key={type} className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-foreground/60">{emoji}</span>
              <span className="font-bold text-yellow-400">+{ccRates.engagement[type][level].toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* Unlock Quests */}
      {questRewards && questRewards.length > 0 && (
        <section id="rewards-quests" className="mb-10 scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-border/50" />
            <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-2">
              Unlock Quests
            </h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {questRewards.map((quest) => {
              const unlocked = unlockedQuestIds.includes(quest.id);
              const price = quest.unlockPrice;
              const ccPrice = price?.currency === 'cc' ? price.amount : null;
              const canAffordCC = ccPrice !== null && balance >= ccPrice;
              const buyKey = `quest_${quest.id}`;

              return (
                <div
                  key={quest.id}
                  className={cn(
                    'relative rounded-2xl border flex flex-col overflow-hidden transition-all duration-200 bg-card/80',
                    unlocked
                      ? 'border-primary/60 shadow-[0_0_16px_rgba(138,43,226,0.3)]'
                      : 'border-border/50 hover:border-border',
                  )}
                >
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{quest.nodeEmoji}</span>
                        <h3 className="font-bold text-sm leading-tight">{quest.title}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unlocked && <Badge variant="default" className="text-[10px]">UNLOCKED</Badge>}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {LEVEL_CONFIG[DIFF_TO_LEVEL[quest.difficulty]].emoji} {LEVEL_CONFIG[DIFF_TO_LEVEL[quest.difficulty]].name}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">{quest.description}</p>
                    {quest.flavorText && (
                      <p className="text-[11px] text-zinc-500 italic">{quest.flavorText}</p>
                    )}

                    {/* Payout badge */}
                    <div className="flex items-center gap-1.5">
                      {quest.payout.type === 'cybacoin' ? (
                        <>
                          <Image src="/CCoin.png?v=2" alt="CC" width={14} height={14} />
                          <span className="text-xs font-bold text-yellow-400">+{quest.payout.amount.toLocaleString()} CC reward</span>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-green-400">+${quest.payout.amount.toFixed(2)} reward</span>
                      )}
                      {quest.isMediaQuest !== false && (
                        <span className="text-[10px] text-zinc-500">· upon approval</span>
                      )}
                    </div>

                    {/* Price + CTA */}
                    {price && (
                      <div className="space-y-2 mt-1">
                        {ccPrice !== null && (
                          <button
                            disabled={unlocked || !user || !canAffordCC || buyingId === buyKey}
                            onClick={() => !unlocked && user && canAffordCC && handleUnlockQuest(quest)}
                            className={cn(
                              'w-full py-2 rounded-lg text-sm font-semibold transition-all',
                              unlocked
                                ? 'bg-muted text-muted-foreground cursor-default'
                                : canAffordCC && user
                                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                  : 'bg-muted text-muted-foreground cursor-not-allowed',
                            )}
                          >
                            {buyingId === buyKey
                              ? <span className="flex items-center justify-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Purchasing…</span>
                              : unlocked ? '✓ Unlocked — go to CYBAQuests'
                              : !user ? 'Sign in to unlock'
                              : !canAffordCC ? `Need ${ccPrice.toLocaleString()} CC`
                              : `🪙 Unlock for ${ccPrice.toLocaleString()} CC`}
                          </button>
                        )}
                        {price.currency === 'cash' && (
                          <button
                            disabled={unlocked || !user}
                            className={cn(
                              'w-full py-2 rounded-lg text-sm font-semibold transition-all',
                              unlocked ? 'bg-muted text-muted-foreground cursor-default' : 'bg-green-600 hover:bg-green-500 text-white',
                            )}
                            onClick={() => !unlocked && handleUnlockQuest(quest)}
                          >
                            {unlocked ? '✓ Unlocked' : `Unlock for $${price.amount.toFixed(2)}`}
                          </button>
                        )}
                        {unlocked && (
                          <Link
                            href="/cybaquests"
                            className="block w-full py-2 rounded-lg text-sm font-semibold text-center border border-primary/40 text-primary hover:bg-primary/10 transition-all"
                          >
                            Go to CYBAQuests →
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reward extras from admin */}
      {rewardExtras && rewardExtras.length > 0 && (
        <section id="rewards-extras" className="mb-10 scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-border/50" />
            <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-2">
              Rewards
            </h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewardExtras.map((item) => {
              const isCc = item.priceCurrency === 'cc';
              const purchased = userProfile?.purchasedRewards?.includes(item.id) ?? false;
              const canAfford = isCc ? balance >= item.price : true;
              const soldOut = (item as any).soldOut === true;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'relative rounded-2xl border flex flex-col overflow-hidden transition-all duration-200 bg-card/80',
                    purchased ? 'border-primary/60 shadow-[0_0_16px_rgba(138,43,226,0.3)]' : 'border-border/50 hover:border-border',
                    soldOut && 'opacity-75',
                  )}
                >
                  {soldOut && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <span className="bg-black/70 text-white font-black text-sm tracking-widest uppercase px-3 py-1.5 rounded-lg border border-white/20 rotate-[-8deg]">
                        SOLD OUT
                      </span>
                    </div>
                  )}
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm leading-tight">{item.name}</h3>
                      {purchased && isCc && (
                        <Badge variant="default" className="text-[10px] shrink-0">OWNED</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">{item.description}</p>

                    {item.features && item.features.length > 0 && (
                      <ul className="space-y-1">
                        {item.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="text-primary">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Price */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {isCc ? (
                        <>
                          <Image src="/CCoin.png?v=2" alt="CC" width={16} height={16} />
                          <span className={cn('text-sm font-bold tabular-nums', canAfford ? 'text-yellow-400' : 'text-muted-foreground')}>
                            {item.price.toLocaleString()} CC
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-green-400">${item.price.toFixed(2)} USD</span>
                      )}
                    </div>

                    {/* CTA */}
                    {soldOut ? (
                      <button disabled className="w-full py-2 rounded-lg text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed">
                        Sold Out
                      </button>
                    ) : (() => {
                      const alreadyDone = !item.requiresSubmission && purchased;
                      const hasCCOption = !isCc && (item.cybaCoinPrice ?? 0) > 0;
                      const canAffordCC = balance >= (item.cybaCoinPrice ?? 0);

                      return (
                        <div className="flex flex-col gap-2">
                          {isCc ? (
                            <button
                              disabled={alreadyDone || !canAfford || buyingId === item.id || !user}
                              onClick={() => {
                                if (!canAfford || !user) return;
                                if (item.requiresSubmission) setRewardSubmitItem(item);
                                else if (!purchased) handleBuyExtra(item);
                              }}
                              className={cn(
                                'w-full py-2 rounded-lg text-sm font-semibold transition-all',
                                alreadyDone
                                  ? 'bg-muted text-muted-foreground cursor-default'
                                  : canAfford && user
                                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                              )}
                            >
                              {buyingId === item.id
                                ? <span className="flex items-center justify-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Purchasing…</span>
                                : alreadyDone ? 'Purchased'
                                : !user ? 'Sign in to buy'
                                : !canAfford ? 'Not enough CC'
                                : item.requiresSubmission ? `${item.buttonText || 'Submit Media'}`
                                : item.buttonText || 'Purchase'}
                            </button>
                          ) : (
                            <a
                              href={item.buttonLink || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 rounded-lg text-sm font-semibold text-center bg-primary hover:bg-primary/90 text-primary-foreground transition-all block"
                            >
                              {item.buttonText || 'Buy Now'}
                            </a>
                          )}

                          {hasCCOption && !alreadyDone && (
                            <button
                              disabled={!user || !canAffordCC || buyingId === `cc_${item.id}`}
                              onClick={() => { if (user && canAffordCC) handleBuyExtraCC(item); }}
                              className={cn(
                                'w-full py-2 rounded-lg text-sm font-semibold transition-all border',
                                canAffordCC && user
                                  ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10'
                                  : 'border-border text-muted-foreground cursor-not-allowed',
                              )}
                            >
                              {buyingId === `cc_${item.id}`
                                ? <span className="flex items-center justify-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Purchasing…</span>
                                : !user ? 'Sign in'
                                : !canAffordCC ? 'Not enough CC'
                                : `🪙 Buy with ${item.cybaCoinPrice!.toLocaleString()} CC`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Background rewards grid */}
      <section id="rewards-backgrounds" className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-border/50" />
          <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-2">
            Profile Backgrounds
          </h2>
          <div className="h-px flex-1 bg-border/50" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {backgrounds.map((bg) => {
            const owned = ownedIds.includes(bg.id);
            const canAfford = balance >= (bg.coinCost ?? 0);
            const meetsLevel = bg.unlockType === 'coins'
              ? true
              : isBackgroundUnlocked({ ...bg, unlockType: 'level', coinCost: undefined }, level, []);

            return (
              <BackgroundCard
                key={bg.id}
                bg={bg}
                owned={owned}
                canAfford={canAfford}
                meetsLevel={meetsLevel}
                onBuy={handleBuy}
                buying={buyingId === bg.id}
              />
            );
          })}
        </div>
      </section>

      <section id="rewards-avatar" className="mt-14 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-border/50" />
          <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-2">
            Avatar Upgrades
          </h2>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <p className="text-center text-xs text-muted-foreground mb-6 max-w-lg mx-auto">
          Equip gear for a passive CC bonus — earn extra CYBACOIN every time you post, like, comment, or share.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {GEAR_CATALOG.map(item => {
            const owned = purchasedGear.includes(item.id);
            const equipped = equippedGear.includes(item.id);
            const canAfford = balance >= item.price;
            const bonusLabel = Object.entries(item.bonus).map(([k, v]) => `+${Math.round((v ?? 0) * 100)}% ${k}`).join(' · ');
            return (
              <div key={item.id} className={cn(
                'rounded-2xl border p-4 flex flex-col items-center text-center gap-2 transition-all',
                equipped ? 'border-primary/60 shadow-[0_0_16px_rgba(138,43,226,0.3)] bg-card/80' : 'border-border/50 bg-card/50',
              )}>
                <span className="text-3xl">{item.emoji}</span>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-[10px] text-yellow-400 font-bold">{bonusLabel}</p>
                {owned ? (
                  <Button size="sm" variant={equipped ? 'outline' : 'default'} className="w-full" onClick={() => handleToggleEquipGear(item.id)}>
                    {equipped ? 'Unequip' : 'Equip'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!user || !canAfford || buyingId === `gear_${item.id}`}
                    onClick={() => handleBuyGear(item.id)}
                  >
                    {buyingId === `gear_${item.id}`
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : `${item.price.toLocaleString()} CC`
                    }
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground mt-12">
        Earn CYBACOIN by posting, engaging, and spinning the{' '}
        <Link href="/winners-wheel" className="text-primary underline">CYBAWHEEL</Link>.
        Apply backgrounds from your{' '}
        <Link href="/profile" className="text-primary underline">profile settings</Link>.
      </p>

      {/* Reward media submit dialog */}
      {rewardSubmitItem && user && (
        <RewardSubmitDialog
          item={rewardSubmitItem}
          open={!!rewardSubmitItem}
          onClose={() => setRewardSubmitItem(null)}
          userId={user.uid}
          username={userProfile?.username ?? user.displayName ?? 'user'}
          balance={balance}
          storage={storage}
          firestore={firestore}
        />
      )}
    </div>
  );
}

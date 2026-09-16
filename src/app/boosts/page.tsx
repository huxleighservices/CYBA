'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Check, Loader2, DollarSign, Banknote, Zap, Video, Upload } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy, doc, updateDoc, increment,
  addDoc, serverTimestamp, getDocs, limit,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { useState, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { logTransaction } from '@/lib/transactions';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_BOOST_SUBSCRIPTION_RATES, BOOST_SUBSCRIPTION_TYPES, BOOST_FLAG_FIELD,
  MARKET_TIER_ITEM_CAP, MARKET_TIER_EXTRA_RATE,
  type BoostSubscriptionRates, type BoostSubscriptionType, type BoostSubscriptionDescriptions, type MarketBoostTier,
} from '@/lib/boost-subscriptions';
import { Radio, ShoppingBag, Sparkles, Pause, Banknote as BanknoteIcon, ShieldOff } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';

type UserProfile = {
  username?: string;
  cybaCoinBalance?: number;
  payoutEnrolled?: boolean;
  marketBoost?: boolean;
  radioBoost?: boolean;
  spotlightBoost?: boolean;
  adFreeBoost?: boolean;
  membershipTier?: string;
  boostSubscriptions?: Partial<Record<BoostSubscriptionType, { subscribed: boolean; priority?: number }>>;
  radioExtraSlots?: number;
  marketBoostTier?: 'base' | 'mid' | 'top';
  inventory?: {
    sponsored_post?: { quantity: number };
    sponsored_profile?: { quantity: number };
  };
};

const SUBSCRIPTION_META: Record<BoostSubscriptionType, { label: string; description: string; icon: any; card: string; badge: string; btn: string }> = {
  payout: {
    label: 'Payout Boost',
    description: 'Enroll in cash payouts for your creator earnings while subscribed.',
    icon: BanknoteIcon,
    card: 'border-green-500/30 hover:border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.08)]',
    badge: 'bg-green-950/40 border border-green-500/30 text-green-400',
    btn: 'bg-green-600 hover:bg-green-500 text-white',
  },
  radio: {
    label: 'Radio Boost',
    description: 'Submit a track to CYBAZONE RADIO every month while subscribed.',
    icon: Radio,
    card: 'border-amber-500/30 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.08)]',
    badge: 'bg-amber-950/40 border border-amber-500/30 text-amber-400',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
  },
  market: {
    label: 'Market Boost',
    description: 'Unlocks "My Store" — list your own items on the Market page.',
    icon: ShoppingBag,
    card: 'border-blue-500/30 hover:border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    badge: 'bg-blue-950/40 border border-blue-500/30 text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
  spotlight: {
    label: 'Spotlight Boost',
    description: 'Your posts get a glowing purple spotlight treatment in the feed.',
    icon: Sparkles,
    card: 'border-purple-500/30 hover:border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.08)]',
    badge: 'bg-purple-950/40 border border-purple-500/30 text-purple-400',
    btn: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  adFree: {
    label: 'Promo-Free Boost',
    description: "Promos won't pop up while you're scrolling. You can still access PROMO BLAST any time from its page.",
    icon: ShieldOff,
    card: 'border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.08)]',
    badge: 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-400',
    btn: 'bg-cyan-600 hover:bg-cyan-500 text-white',
  },
};

// Per-boost colour tokens (full Tailwind class strings — no dynamic construction)
const BOOST_STYLES: Record<string, { card: string; badge: string; btn: string; check: string }> = {
  payout_boost: {
    card: 'border-green-500/30 hover:border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.08)]',
    badge: 'bg-green-950/40 border border-green-500/30 text-green-400',
    btn: 'bg-green-600 hover:bg-green-500 text-white',
    check: 'text-green-400',
  },
  market_boost: {
    card: 'border-blue-500/30 hover:border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    badge: 'bg-blue-950/40 border border-blue-500/30 text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
    check: 'text-blue-400',
  },
  radio_boost: {
    card: 'border-amber-500/30 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.08)]',
    badge: 'bg-amber-950/40 border border-amber-500/30 text-amber-400',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    check: 'text-amber-400',
  },
  spotlight_boost: {
    card: 'border-purple-500/30 hover:border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.08)]',
    badge: 'bg-purple-950/40 border border-purple-500/30 text-purple-400',
    btn: 'bg-purple-600 hover:bg-purple-500 text-white',
    check: 'text-purple-400',
  },
  zone_pass: {
    card: 'border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.08)]',
    badge: 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-400',
    btn: 'bg-cyan-600 hover:bg-cyan-500 text-white',
    check: 'text-cyan-400',
  },
  zone_pass_pro: {
    card: 'border-indigo-500/30 hover:border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.08)]',
    badge: 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-400',
    btn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    check: 'text-indigo-400',
  },
  zone_pass_ultimate: {
    card: 'border-violet-500/30 hover:border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.08)]',
    badge: 'bg-violet-950/40 border border-violet-500/30 text-violet-400',
    btn: 'bg-violet-600 hover:bg-violet-500 text-white',
    check: 'text-violet-400',
  },
};

function detectBoostType(itemName: string): string {
  const n = itemName.toLowerCase();
  if (n.includes('zone pass ultimate')) return 'zone_pass_ultimate';
  if (n.includes('zone pass pro')) return 'zone_pass_pro';
  if (n.includes('zone pass')) return 'zone_pass';
  if (n.includes('payout')) return 'payout_boost';
  if (n.includes('market')) return 'market_boost';
  if (n.includes('radio')) return 'radio_boost';
  if (n.includes('spotlight')) return 'spotlight_boost';
  return 'payout_boost';
}

function getBoostStatus(boostType: string, userProfile?: UserProfile | null): {
  active: boolean;
  label: string;
  inventoryNote?: string; // shown as info alongside the buy button, never blocks purchase
} {
  const tier = userProfile?.membershipTier ?? '';
  switch (boostType) {
    case 'payout_boost':
      return { active: !!userProfile?.payoutEnrolled, label: '🏦 Enrolled in Payout Boost' };
    case 'market_boost':
      return { active: !!userProfile?.marketBoost, label: '🛒 Market Boost Active' };
    case 'radio_boost':
      return { active: !!userProfile?.radioBoost, label: '📻 Radio Boost Active' };
    case 'spotlight_boost': {
      const qty = userProfile?.inventory?.sponsored_post?.quantity ?? 0;
      // Never block purchase — slots stack and don't expire
      return {
        active: false,
        label: '',
        inventoryNote: qty > 0 ? `📝 You have ${qty} slot${qty !== 1 ? 's' : ''} in inventory` : undefined,
      };
    }
    case 'zone_pass':
      return { active: ['zone_pass', 'zone_pass_pro', 'zone_pass_ultimate'].includes(tier), label: '🎟️ Zone Pass Active' };
    case 'zone_pass_pro':
      return { active: ['zone_pass_pro', 'zone_pass_ultimate'].includes(tier), label: '🎟️ Zone Pass Pro Active' };
    case 'zone_pass_ultimate':
      return { active: tier === 'zone_pass_ultimate', label: '🎟️ Zone Pass Ultimate Active' };
    default:
      return { active: false, label: 'Active' };
  }
}

function StripeBoostCard({
  item,
  username,
  userProfile,
}: {
  item: any;
  username?: string;
  userProfile?: UserProfile | null;
}) {
  const boostType = detectBoostType(item.name ?? '');
  const styles = BOOST_STYLES[boostType] ?? BOOST_STYLES.payout_boost;
  const { active, label, inventoryNote } = getBoostStatus(boostType, userProfile);

  const baseUrl = item.buttonLink ?? '';
  // client_reference_id (not prefilled_custom_field, which Stripe Payment Links don't actually
  // support) reliably carries the username through to session.client_reference_id in the webhook.
  const stripeUrl = baseUrl && username
    ? `${baseUrl}?client_reference_id=${encodeURIComponent(username)}`
    : baseUrl;

  return (
    <Card className={cn('flex flex-col bg-card/50 transition-all duration-300', styles.card)}>
      <CardHeader className="items-center text-center">
        <div className="text-3xl mb-1">{item.emoji ?? '⚡'}</div>
        <CardTitle className="text-2xl font-bold tracking-widest">{item.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="text-4xl font-bold text-foreground">{item.price}</span>
          <DollarSign className="h-8 w-8 text-muted-foreground" />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <p className="text-center text-foreground/70 min-h-[40px]">{item.description}</p>
        <ul className="space-y-2">
          {item.features?.map((feature: string, index: number) => (
            <li key={index} className="flex items-center">
              <Check className={cn('h-4 w-4 mr-2', styles.check)} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        {inventoryNote && (
          <div className="text-xs bg-muted/30 rounded-lg px-3 py-2 text-center text-muted-foreground">
            {inventoryNote} —{' '}
            <Link href="/sponsor" className="underline text-foreground">Activate →</Link>
          </div>
        )}
        {username && !active && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 text-center">
            Purchasing as: <span className="text-foreground font-semibold">@{username}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {active ? (
          <div className="w-full space-y-1.5">
            <div className={cn('w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold', styles.badge)}>
              {label}
            </div>
            {item.cancelLink && (
              <a
                href={item.cancelLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Manage or Cancel →
              </a>
            )}
          </div>
        ) : (
          <Button
            className={cn('w-full', styles.btn)}
            onClick={() => stripeUrl && window.open(stripeUrl, '_blank')}
            disabled={!stripeUrl}
          >
            <Banknote className="w-4 h-4 mr-2" />
            {item.buttonText || 'Buy Now'}
          </Button>
        )}
        {!active && (
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            After payment, enter your CYBAZONE username exactly as shown above.
            Activates automatically within a few minutes.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

function ItemCard({
  item,
  balance = 0,
  buyingId,
  onBuyCC,
  isLoggedIn = false,
}: {
  item: any;
  balance?: number;
  buyingId?: string | null;
  onBuyCC?: (item: any) => void;
  isLoggedIn?: boolean;
}) {
  const isCC = item.priceCurrency === 'cc';
  const soldOut = item.soldOut === true;
  const hasCCOption = !isCC && (item.cybaCoinPrice ?? 0) > 0;
  const canAffordCC = balance >= (item.cybaCoinPrice ?? 0);

  return (
    <Card className={cn('flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary relative', soldOut && 'opacity-75')}>
      {soldOut && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none rounded-lg">
          <span className="bg-black/70 text-white font-black text-lg tracking-widest uppercase px-4 py-2 rounded-lg border border-white/20 rotate-[-10deg]">
            SOLD OUT
          </span>
        </div>
      )}
      <CardHeader className="items-center text-center">
        <CardTitle className="text-2xl font-bold tracking-widest">{item.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {isCC ? (
            <>
              <Image src="/CCoin.png?v=2" alt="CC" width={32} height={32} />
              <span className="text-4xl font-bold text-yellow-400">{item.price?.toLocaleString()}</span>
            </>
          ) : (
            <>
              <span className="text-4xl font-bold text-foreground">{item.price}</span>
              <DollarSign className="h-8 w-8 text-primary" />
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <p className="text-center text-foreground/70 min-h-[40px]">{item.description}</p>
        <ul className="space-y-2">
          {item.features?.map((feature: string, index: number) => (
            <li key={index} className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {soldOut ? (
          <Button className="w-full" disabled variant="secondary">Sold Out</Button>
        ) : (
          <>
            {isCC ? (
              <Button className="w-full" asChild>
                <Link href={item.buttonLink}>{item.buttonText || 'Buy with CC'}</Link>
              </Button>
            ) : (
              <Button className="w-full" asChild>
                <Link href={item.buttonLink} target="_blank" rel="noopener noreferrer">{item.buttonText || 'Buy Now'}</Link>
              </Button>
            )}
            {hasCCOption && onBuyCC && (
              <Button
                variant="outline"
                className="w-full border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                disabled={!isLoggedIn || !canAffordCC || buyingId === item.id}
                onClick={() => onBuyCC(item)}
              >
                {buyingId === item.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : !isLoggedIn ? 'Sign in to buy with CC'
                  : !canAffordCC ? 'Not enough CC'
                  : <><Image src="/CCoin.png?v=2" alt="CC" width={16} height={16} className="mr-1.5" />{item.cybaCoinPrice?.toLocaleString()} CC</>
                }
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function SubscriptionBoostCard({
  type,
  price,
  description,
  isGranted,
  isSubscribed,
  priority,
  balance,
  isLoggedIn,
  busy,
  onSubscribe,
  onCancel,
  onPriorityChange,
}: {
  type: BoostSubscriptionType;
  price: number;
  description: string;
  isGranted: boolean;
  isSubscribed: boolean;
  priority: number;
  balance: number;
  isLoggedIn: boolean;
  busy: boolean;
  onSubscribe: (type: BoostSubscriptionType) => void;
  onCancel: (type: BoostSubscriptionType) => void;
  onPriorityChange: (type: BoostSubscriptionType, priority: number) => void;
}) {
  const meta = SUBSCRIPTION_META[type];
  const Icon = meta.icon;
  const canAfford = balance >= price;
  const isPaused = isSubscribed && !isGranted;

  return (
    <Card className={cn('flex flex-col bg-card/50 transition-all duration-300', meta.card)}>
      <CardHeader className="items-center text-center">
        <Icon className="h-7 w-7 mb-1" />
        <CardTitle className="text-xl font-bold tracking-widest">{meta.label}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Image src="/CCoin.png?v=2" alt="CC" width={24} height={24} />
          <span className="text-3xl font-bold text-yellow-400">{price.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground self-end mb-1">/ week</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-center text-foreground/70 min-h-[40px]">{description}</p>
        {isPaused && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-lg px-3 py-2">
            <Pause className="w-3.5 h-3.5 shrink-0" />
            <span>Paused — not enough CYBACOIN for this week&apos;s charge. Top up your <Link href="/wallet" className="underline">wallet</Link> and it&apos;ll auto-resume.</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {isSubscribed ? (
          <div className="w-full space-y-1.5">
            <div className={cn('w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold', meta.badge)}>
              {isGranted ? `✅ Active` : `⏸️ Paused`}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Priority</span>
              <Select value={String(priority)} onValueChange={v => onPriorityChange(type, parseInt(v, 10))}>
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Highest)</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5 (Lowest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-red-500/40 text-red-400 hover:text-red-300"
              onClick={() => onCancel(type)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel Subscription'}
            </Button>
          </div>
        ) : (
          <Button
            className={cn('w-full', meta.btn)}
            onClick={() => onSubscribe(type)}
            disabled={!isLoggedIn || !canAfford || busy}
          >
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : !isLoggedIn ? 'Sign in to subscribe'
              : !canAfford ? 'Not enough CC'
              : 'Subscribe'
            }
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function MarketBoostTierSelector({ userId, currentTier, balance }: { userId: string; currentTier: MarketBoostTier; balance: number }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [switching, setSwitching] = useState<MarketBoostTier | null>(null);

  const handleSwitch = async (tier: MarketBoostTier) => {
    if (tier === currentTier) return;
    const price = MARKET_TIER_EXTRA_RATE[tier];
    if (price > 0 && balance < price) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setSwitching(tier);
    try {
      await updateDoc(doc(firestore, 'users', userId), { marketBoostTier: tier });
      toast({ title: `Market Boost set to ${tier === 'base' ? 'Base' : tier === 'mid' ? 'Mid' : 'Top'}`, description: `Takes effect on your next weekly billing cycle.` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not switch tier' });
    } finally {
      setSwitching(null);
    }
  };

  const TIER_LABEL: Record<MarketBoostTier, string> = { base: 'Base (1-3 items)', mid: 'Mid (4-7 items)', top: 'Top (unlimited)' };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">🛒 Market Listing Tier</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(['base', 'mid', 'top'] as MarketBoostTier[]).map(tier => (
          <button
            key={tier}
            type="button"
            onClick={() => handleSwitch(tier)}
            disabled={switching !== null}
            className={cn(
              'rounded-md border px-2 py-1.5 text-[11px] text-center transition-colors',
              currentTier === tier ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-border/50 text-muted-foreground hover:border-blue-500/40',
            )}
          >
            {switching === tier ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : TIER_LABEL[tier]}
            {MARKET_TIER_EXTRA_RATE[tier] > 0 && <span className="block text-[10px] opacity-70">+{MARKET_TIER_EXTRA_RATE[tier].toLocaleString()} CC/wk</span>}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Current cap: {MARKET_TIER_ITEM_CAP[currentTier] === Infinity ? 'Unlimited' : MARKET_TIER_ITEM_CAP[currentTier]} listings.</p>
    </div>
  );
}

function extractYtVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

const RADIO_EXTRA_SLOT_COST_CC = 2500;

function RadioBoostSubmission({ userId, username, extraSlots = 0, balance = 0 }: { userId: string; username: string; extraSlots?: number; balance?: number }) {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [mode, setMode] = useState<'youtube' | 'upload'>('youtube');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [buyingSlot, setBuyingSlot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthKey = new Date().toISOString().slice(0, 7);
  const slotLimit = 1 + extraSlots;

  const subQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'radio_submissions'),
      where('userId', '==', userId),
      where('monthKey', '==', monthKey),
      limit(10),
    ),
    [firestore, userId, monthKey]
  );
  const { data: existingSubs } = useCollection<{ id: string; videoId?: string; mediaUrl?: string; sourceType?: 'youtube' | 'upload'; youtubeUrl?: string; submittedAt: any }>(subQuery);
  const submissions = existingSubs ?? [];
  const atLimit = submissions.length >= slotLimit;

  const handleBuyExtraSlot = async () => {
    if (balance < RADIO_EXTRA_SLOT_COST_CC) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setBuyingSlot(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), {
        cybaCoinBalance: increment(-RADIO_EXTRA_SLOT_COST_CC),
        radioExtraSlots: increment(1),
      });
      await logTransaction(firestore, userId, {
        type: 'boost_purchase',
        amount: -RADIO_EXTRA_SLOT_COST_CC,
        description: 'Radio Boost — extra video slot',
      });
      toast({ title: 'Extra Radio slot purchased!' });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed' });
    } finally {
      setBuyingSlot(false);
    }
  };

  const handleSubmitYouTube = async () => {
    const videoId = extractYtVideoId(url);
    if (!videoId) {
      toast({ variant: 'destructive', title: 'Invalid YouTube URL', description: 'Please paste a valid youtube.com/watch or youtu.be link.' });
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'radio_submissions'), {
        userId, username, youtubeUrl: url.trim(), videoId, sourceType: 'youtube', title: title.trim() || null, monthKey, submittedAt: serverTimestamp(),
      });
      toast({ title: '🎵 Submission added!', description: 'Your track is in the radio queue for this month.' });
      setUrl('');
      setTitle('');
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUpload = async () => {
    if (!videoFile) return;
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const ext = videoFile.name.split('.').pop() ?? 'mp4';
      const path = `radio_uploads/${uuidv4()}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, videoFile, { contentType: videoFile.type });
      const mediaUrl = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref)),
        );
      });
      await addDoc(collection(firestore, 'radio_submissions'), {
        userId, username, mediaUrl, sourceType: 'upload', title: title.trim() || null, monthKey, submittedAt: serverTimestamp(),
      });
      toast({ title: '🎵 Submission added!', description: 'Your track is in the radio queue for this month.' });
      setVideoFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed' });
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  if (atLimit) {
    return (
      <div className="mt-3 border-t border-amber-500/20 pt-3 space-y-2">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">🎵 Radio Submissions — {monthKey} ({submissions.length}/{slotLimit})</p>
        <div className="space-y-1.5">
          {submissions.map(sub => (
            <div key={sub.id} className="text-xs bg-amber-950/30 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-300">
              {sub.sourceType === 'upload' ? (
                <a href={sub.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">Uploaded video</a>
              ) : (
                <a href={`https://www.youtube.com/watch?v=${sub.videoId}`} target="_blank" rel="noopener noreferrer"
                  className="underline font-mono">{sub.videoId}</a>
              )}
            </div>
          ))}
        </div>
        <p className="text-amber-500/60 text-[11px]">All slots used for this month — new slots open on the 1st.</p>
        <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-400" onClick={handleBuyExtraSlot} disabled={buyingSlot || balance < RADIO_EXTRA_SLOT_COST_CC}>
          {buyingSlot ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
          Buy Extra Slot — {RADIO_EXTRA_SLOT_COST_CC.toLocaleString()} CC
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-amber-500/20 pt-3 space-y-2">
      <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">🎵 Radio Submission — {monthKey}</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setMode('youtube')}
          className={cn('flex-1 h-7 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors',
            mode === 'youtube' ? 'bg-amber-600 text-white' : 'bg-amber-950/30 text-amber-400 hover:bg-amber-900/40')}>
          YouTube Link
        </button>
        <button type="button" onClick={() => setMode('upload')}
          className={cn('flex-1 h-7 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors',
            mode === 'upload' ? 'bg-amber-600 text-white' : 'bg-amber-950/30 text-amber-400 hover:bg-amber-900/40')}>
          <Upload className="w-3 h-3" /> Upload Video
        </button>
      </div>
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Track title (optional)"
        className="h-8 text-sm"
      />
      {mode === 'youtube' ? (
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="flex-1 h-8 text-sm font-mono"
          />
          <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-500 text-white" onClick={handleSubmitYouTube} disabled={submitting || !url.trim()}>
            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={e => setVideoFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-8 rounded-md border border-dashed border-amber-500/40 hover:border-amber-400/60 flex items-center justify-center gap-1.5 text-xs text-amber-400 truncate px-2">
              <Video className="w-3.5 h-3.5 shrink-0" />
              {videoFile ? videoFile.name : 'Choose a video file'}
            </button>
            <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-500 text-white" onClick={handleSubmitUpload} disabled={submitting || !videoFile}>
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit'}
            </Button>
          </div>
          {uploadProgress !== null && <Progress value={uploadProgress} className="h-1.5" />}
        </div>
      )}
    </div>
  );
}

export default function BoostsPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [ccBuyingId, setCcBuyingId] = useState<string | null>(null);

  const boostsQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), where('type', '==', 'boost'), orderBy('order')),
    [firestore]
  );
  const { data: boosts, isLoading } = useCollection(boostsQuery);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  // Load admin-configured CC boost subscription rates
  const subRatesRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'boostSubscriptionRates'),
    [firestore]
  );
  const { data: subRatesRaw } = useDoc<Partial<BoostSubscriptionRates> & { descriptions?: BoostSubscriptionDescriptions }>(subRatesRef);
  const subRates: BoostSubscriptionRates = { ...DEFAULT_BOOST_SUBSCRIPTION_RATES, ...subRatesRaw };
  const subDescriptions: BoostSubscriptionDescriptions = subRatesRaw?.descriptions ?? {};
  const [subBusyType, setSubBusyType] = useState<BoostSubscriptionType | null>(null);

  const balance = userProfile?.cybaCoinBalance ?? 0;

  const handleSubscribeBoost = async (type: BoostSubscriptionType) => {
    if (!user || !userProfile) return;
    const price = subRates[type];
    if (balance < price) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setSubBusyType(type);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-price),
        [`boostSubscriptions.${type}`]: { subscribed: true, subscribedAt: serverTimestamp(), priority: 3 },
        [BOOST_FLAG_FIELD[type]]: true,
      });
      await logTransaction(firestore, user.uid, {
        type: 'boost_subscription',
        amount: -price,
        description: `${SUBSCRIPTION_META[type].label} — weekly subscription`,
      });
      toast({ title: `${SUBSCRIPTION_META[type].label} activated!`, description: `${price.toLocaleString()} CYBACOIN charged. Renews weekly.` });
    } catch {
      toast({ variant: 'destructive', title: 'Subscription failed', description: 'Please try again.' });
    } finally {
      setSubBusyType(null);
    }
  };

  const handleCancelBoost = async (type: BoostSubscriptionType) => {
    if (!user) return;
    setSubBusyType(type);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        [`boostSubscriptions.${type}.subscribed`]: false,
        [BOOST_FLAG_FIELD[type]]: false,
      });
      toast({ title: `${SUBSCRIPTION_META[type].label} cancelled` });
    } catch {
      toast({ variant: 'destructive', title: 'Cancel failed', description: 'Please try again.' });
    } finally {
      setSubBusyType(null);
    }
  };

  const handlePriorityChange = async (type: BoostSubscriptionType, priority: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        [`boostSubscriptions.${type}.priority`]: priority,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update priority' });
    }
  };

  const handleBuyBoostCC = async (item: any) => {
    if (!user || !userProfile) return;
    const ccPrice = item.cybaCoinPrice ?? 0;
    if (balance < ccPrice) {
      toast({ variant: 'destructive', title: 'Not enough CYBACOIN' });
      return;
    }
    setCcBuyingId(item.id);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        cybaCoinBalance: increment(-ccPrice),
      });
      await logTransaction(firestore, user.uid, {
        type: 'boost_purchase',
        amount: -ccPrice,
        description: `Boost (CC): ${item.name}`,
      });
      toast({ title: `${item.name} purchased!`, description: `${ccPrice.toLocaleString()} CYBACOIN spent.` });
    } catch {
      toast({ variant: 'destructive', title: 'Purchase failed', description: 'Please try again.' });
    } finally {
      setCcBuyingId(null);
    }
  };

  // Radio/Market/Spotlight/Payout moved to CC subscriptions below — never render their old
  // Stripe cards here even if a stale 'extras' doc for them still exists.
  const REPLACED_BY_SUBSCRIPTION = new Set(['radio_boost', 'market_boost', 'spotlight_boost', 'payout_boost']);
  const isStripeBoost = (item: any) =>
    item.buttonLink?.includes('buy.stripe.com') || item.name?.toLowerCase().includes('payout');

  const remainingBoosts = (boosts ?? []).filter(
    (item: any) => !REPLACED_BY_SUBSCRIPTION.has(detectBoostType(item.name ?? ''))
  );

  return (
    <div className="container mx-auto px-4 pt-4 pb-16 max-w-6xl">
      <SectionHeader title="BOOSTS" description="Amplify your presence in the Zone." />

      {/* Standard boosts from admin */}
      {isLoading ? (
        <div className="flex justify-center mb-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : remainingBoosts.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {remainingBoosts.map((item: any) => {
            if (isStripeBoost(item)) {
              return <StripeBoostCard key={item.id} item={item} username={userProfile?.username} userProfile={userProfile} />;
            }
            return (
              <ItemCard
                key={item.id}
                item={item}
                balance={balance}
                buyingId={ccBuyingId}
                onBuyCC={handleBuyBoostCC}
                isLoggedIn={!!user}
              />
            );
          })}
        </div>
      )}

      {/* Weekly CC Boost Subscriptions */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-border/50" />
        <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-2 flex items-center gap-1.5">
          📅 Weekly CC Boosts
        </h2>
        <div className="h-px flex-1 bg-border/50" />
      </div>
      <p className="text-sm text-muted-foreground text-center mb-8 max-w-xl mx-auto">
        Subscribe with CYBACOIN - charged automatically every week. Run low on CC and your boost(s) pause
        automatically based on your priority settings. Earn more CC and they resume on their own.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
        {BOOST_SUBSCRIPTION_TYPES.map(type => (
          <div key={type} className="flex flex-col">
            <SubscriptionBoostCard
              type={type}
              price={subRates[type]}
              description={subDescriptions[type] ?? SUBSCRIPTION_META[type].description}
              isGranted={!!(userProfile as any)?.[BOOST_FLAG_FIELD[type]]}
              isSubscribed={!!userProfile?.boostSubscriptions?.[type]?.subscribed}
              priority={userProfile?.boostSubscriptions?.[type]?.priority ?? 3}
              balance={balance}
              isLoggedIn={!!user}
              busy={subBusyType === type}
              onSubscribe={handleSubscribeBoost}
              onCancel={handleCancelBoost}
              onPriorityChange={handlePriorityChange}
            />
            {type === 'radio' && userProfile?.radioBoost && user && userProfile.username && (
              <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3">
                <RadioBoostSubmission userId={user.uid} username={userProfile.username} extraSlots={userProfile.radioExtraSlots ?? 0} balance={balance} />
              </div>
            )}
            {type === 'market' && userProfile?.marketBoost && user && (
              <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-950/10 px-4 py-3">
                <MarketBoostTierSelector userId={user.uid} currentTier={userProfile.marketBoostTier ?? 'base'} balance={balance} />
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && remainingBoosts.length === 0 && (
        <p className="text-center text-foreground/60 mt-8">
          No additional boosts available at the moment.
        </p>
      )}
    </div>
  );
}

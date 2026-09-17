'use client';

import { useState } from 'react';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  doc, collection, query, orderBy, limit, addDoc, serverTimestamp, updateDoc, increment,
} from 'firebase/firestore';
import { Loader2, Wallet, TrendingUp, Zap, RotateCw, Star, DollarSign } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { TransactionType, CashTransactionType } from '@/lib/transactions';
import { logCashTransaction } from '@/lib/transactions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CC_BUNDLE_ORDER, DEFAULT_CC_BUNDLES, type CcBundlesConfig } from '@/lib/cybacoin-bundles';

type UserProfile = {
  cybaCoinBalance?: number;
  payoutEnrolled?: boolean;
  payoutBalance?: number;
  username?: string;
  lastCashoutRequestAt?: number;
};

const CASHOUT_MIN = 10;
const CASHOUT_CAP = 10;

/** Most recent Sunday 12:00am ET, as an epoch ms — same week-boundary convention used by the
 *  Leaderboard's weekly reset, reused here so "$10 per Saturday" cash-out requests are gated to
 *  once per that same weekly cycle. */
function lastSundayMidnightEst(): number {
  const now = new Date();
  const etDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
  const etDow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const daysBack = DOW_MAP[etDow] ?? 0;
  const [y, m, d] = etDateStr.split('-').map(Number);
  const lastSunday = new Date(Date.UTC(y, m - 1, d - daysBack));
  const sy = lastSunday.getUTCFullYear();
  const sm = String(lastSunday.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(lastSunday.getUTCDate()).padStart(2, '0');
  return new Date(`${sy}-${sm}-${sd}T00:00:00-05:00`).getTime();
}

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: any;
};

type CashTransaction = {
  id: string;
  type: CashTransactionType;
  amount: number;
  description: string;
  timestamp: any;
};

const TX_META: Record<TransactionType, { icon: string; color: string }> = {
  quest_reward:       { icon: '🗺️', color: 'text-green-400' },
  wheel_spin:         { icon: '🎡', color: 'text-blue-400' },
  reward_purchase:    { icon: '🛍️', color: 'text-red-400' },
  support_bonus:      { icon: '🤝', color: 'text-yellow-400' },
  post_bonus:         { icon: '📝', color: 'text-purple-400' },
  admin_adjustment:   { icon: '⚙️', color: 'text-muted-foreground' },
  post_reward:        { icon: '📝', color: 'text-purple-400' },
  engagement_reward:  { icon: '🤝', color: 'text-yellow-400' },
  quest_media_payout: { icon: '📸', color: 'text-green-400' },
  boost_purchase:     { icon: '🚀', color: 'text-red-400' },
  merch_purchase:     { icon: '👕', color: 'text-red-400' },
  market_purchase:    { icon: '🛒', color: 'text-red-400' },
  boost_subscription: { icon: '📅', color: 'text-red-400' },
  ad_skip:            { icon: '📢', color: 'text-red-400' },
  ad_watch_reward:    { icon: '📢', color: 'text-green-400' },
  promo_renewal_bonus: { icon: '🎁', color: 'text-green-400' },
  pulse_reward:       { icon: '✨', color: 'text-purple-400' },
};

const CASH_TX_META: Record<CashTransactionType, { icon: string; color: string }> = {
  quest_payout:    { icon: '🏆', color: 'text-green-400' },
  cashout_request: { icon: '💸', color: 'text-blue-400' },
  cashout_fulfilled: { icon: '✅', color: 'text-green-400' },
  admin_adjustment: { icon: '⚙️', color: 'text-muted-foreground' },
  market_purchase:  { icon: '🛒', color: 'text-red-400' },
  promo_blast_purchase: { icon: '📢', color: 'text-red-400' },
};

const EARN_METHODS = [
  {
    icon: '📝',
    title: 'Post Content',
    desc: 'Share your work, thoughts, or anything in Central.',
    href: '/create',
    label: 'Create Post',
  },
  {
    icon: '🤝',
    title: 'Support CYBAS',
    desc: "Like and engage with other CYBAS' posts to earn coins.",
    href: '/',
    label: 'Go to Central',
  },
  {
    icon: '🗺️',
    title: 'Complete Quests',
    desc: 'Finish CYBAQuests to earn large coin rewards.',
    href: '/cybaquests',
    label: 'View Quests',
  },
  {
    icon: '🎡',
    title: "CYBAWHEEL",
    desc: "Try your luck on the CYBAWHEEL for big payouts.",
    href: '/winners-wheel',
    label: 'Spin Now',
  },
];

export default function WalletPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [cashingOut, setCashingOut] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const bundlesConfigRef = useMemoFirebase(() => doc(firestore, 'settings', 'cybaCoinBundles'), [firestore]);
  const { data: bundlesConfigRaw } = useDoc<Partial<CcBundlesConfig>>(bundlesConfigRef);
  const bundlesConfig: CcBundlesConfig = { ...DEFAULT_CC_BUNDLES, ...bundlesConfigRaw };

  const txQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, 'users', user.uid, 'coinTransactions'),
            orderBy('timestamp', 'desc'),
            limit(50)
          )
        : null,
    [firestore, user]
  );
  const { data: transactions, isLoading: isTxLoading } = useCollection<Transaction>(txQuery);

  const cashTxQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, 'users', user.uid, 'cashTransactions'),
            orderBy('timestamp', 'desc'),
            limit(50)
          )
        : null,
    [firestore, user]
  );
  const { data: cashTransactions, isLoading: isCashTxLoading } = useCollection<CashTransaction>(cashTxQuery);

  const balance = userProfile?.cybaCoinBalance ?? 0;
  const payoutEnrolled = userProfile?.payoutEnrolled ?? false;
  const payoutBalance = userProfile?.payoutBalance ?? 0;

  // Terms of Use: "Members with an active Payout Boost may request cash payouts up to $10 per
  // Saturday... remaining balances carry over to the following Saturday." Gate the request to
  // once per weekly cycle (same Sunday-midnight-ET boundary the Leaderboard uses) and cap the
  // requested amount at $10, requiring at least $10 banked before the button is usable at all.
  const currentCycleStart = lastSundayMidnightEst();
  const alreadyRequestedThisCycle = !!userProfile?.lastCashoutRequestAt && userProfile.lastCashoutRequestAt >= currentCycleStart;
  const canRequestCashout = payoutEnrolled && payoutBalance >= CASHOUT_MIN && !alreadyRequestedThisCycle;
  const cashoutRequestAmount = Math.min(payoutBalance, CASHOUT_CAP);

  const handleCashOut = async () => {
    if (!user || !userProfile || !canRequestCashout) return;
    setCashingOut(true);
    try {
      // Create the cash out request — balance stays in wallet until admin approves
      await addDoc(collection(firestore, 'cashout_requests'), {
        userId: user.uid,
        username: userProfile.username ?? '',
        amount: cashoutRequestAmount,
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      // Log the cash transaction (no deduction yet — balance cleared on approval)
      await logCashTransaction(firestore, user.uid, {
        type: 'cashout_request',
        amount: 0,
        description: `Cash Out Request: $${cashoutRequestAmount.toFixed(2)} pending approval`,
      });
      // Lock out further requests until next week's cycle — remainder rolls over automatically
      // since payoutBalance itself isn't touched here.
      await updateDoc(doc(firestore, 'users', user.uid), {
        lastCashoutRequestAt: Date.now(),
      });
      toast({
        title: 'Cash Out Requested!',
        description: `$${cashoutRequestAmount.toFixed(2)} payout request submitted. Any remaining balance carries over to next Saturday. We'll process it via CashApp/Venmo.`,
      });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Failed to submit cash out request.' });
    } finally {
      setCashingOut(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-center">
          <Wallet className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold font-headline mb-2">CYBAWALLET</h1>
          <p className="text-muted-foreground mb-4">
            <Link href="/login" className="text-primary underline">Sign in</Link> to view your wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-4 pb-16 max-w-4xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-headline font-bold text-glow">CYBAWALLET</h1>
        </div>
        <p className="text-foreground/60 text-sm">Your CYBACOIN/Cash balance and transaction history.</p>
      </div>

      {/* CYBACOIN Balance Card */}
      <div className="relative rounded-2xl overflow-hidden border border-yellow-500/30 bg-card p-8 mb-6 shadow-[0_0_40px_rgba(234,179,8,0.08)]">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">CYBACOIN Balance</p>
        <div className="flex items-center gap-3 mb-5">
          <Image src="/CCoin.png?v=2" alt="CC" width={40} height={40} />
          <span className="text-5xl font-bold text-yellow-400 tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-xl text-muted-foreground">CYBACOIN</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/rewards"
            className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            <Star className="h-4 w-4" /> Spend in Rewards
          </Link>
          <Link
            href="/winners-wheel"
            className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            <RotateCw className="h-4 w-4" /> Spin the CYBAWHEEL
          </Link>
        </div>
      </div>

      {/* CYBACOIN Bundle Packs — fiat purchase tiers */}
      <div className="rounded-2xl border border-yellow-500/20 bg-card/50 p-6 mb-10">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">Buy CYBACOIN</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {CC_BUNDLE_ORDER.map(key => {
            const bundle = bundlesConfig[key];
            // client_reference_id (not prefilled_custom_field, which Stripe Payment Links don't
            // actually support) reliably carries the username through to the webhook.
            const stripeUrl = bundle.buttonLink && userProfile?.username
              ? `${bundle.buttonLink}?client_reference_id=${encodeURIComponent(userProfile.username)}`
              : bundle.buttonLink;
            return (
              <a
                key={key}
                href={stripeUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-xl border border-yellow-500/30 bg-yellow-950/10 px-4 py-3 text-center hover:border-yellow-400/60 transition-colors ${!stripeUrl ? 'pointer-events-none opacity-50' : ''}`}
              >
                <p className="text-sm font-bold">{bundle.name}</p>
                <p className="text-xs text-yellow-400 font-semibold">{bundle.amount.toLocaleString()} CC</p>
                <p className="text-xs text-muted-foreground mt-1">{bundle.priceLabel}</p>
              </a>
            );
          })}
        </div>
      </div>

      {/* Payout Boost / Cash Balance Card */}
      <div className={`relative rounded-2xl overflow-hidden border bg-card p-8 mb-10 ${payoutEnrolled ? 'border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.06)]' : 'border-border'}`}>
        <div className={`absolute inset-0 pointer-events-none ${payoutEnrolled ? 'bg-gradient-to-br from-green-500/5 to-transparent' : 'bg-gradient-to-br from-muted/20 to-transparent'}`} />
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏦</span>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Cash Balance</p>
        </div>
        {payoutEnrolled ? (
          <>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-bold text-green-400 tabular-nums">
                ${payoutBalance.toFixed(2)}
              </span>
              <span className="text-lg text-muted-foreground mb-1">USD</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mb-4">
              Your cash balance from referrals, quest payouts, and Payout Boost earnings. Request up to ${CASHOUT_CAP} per Saturday via CashApp or Venmo — the rest carries over automatically.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {canRequestCashout ? (
                <Button
                  onClick={handleCashOut}
                  disabled={cashingOut}
                  className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-full px-6"
                >
                  {cashingOut
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <DollarSign className="w-4 h-4 mr-2" />
                  }
                  Cash Out ${cashoutRequestAmount.toFixed(2)}
                </Button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-green-950/40 border border-green-500/30 text-green-400 text-xs rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {alreadyRequestedThisCycle
                    ? 'Requested this week — check back Saturday!'
                    : payoutBalance < CASHOUT_MIN
                      ? `Keep earning — $${CASHOUT_MIN} minimum to cash out`
                      : payoutEnrolled ? 'Enrolled — Keep earning!' : 'Keep referring to earn more!'}
                </div>
              )}
              {!payoutEnrolled && (
                <Link
                  href="/boosts"
                  className="inline-flex items-center gap-1.5 bg-muted/40 border border-border text-muted-foreground hover:text-foreground text-xs rounded-full px-3 py-1 transition-colors"
                >
                  Enroll in Payout Boost for more earnings →
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-bold text-muted-foreground tabular-nums">$0.00</span>
              <span className="text-lg text-muted-foreground mb-1">USD</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Earn cash by referring friends or enrolling in Payout Boost to earn from your CYBAZONE activity.
            </p>
            <Link
              href="/boosts"
              className="mt-3 inline-flex items-center gap-1.5 bg-muted/40 border border-border text-muted-foreground hover:text-foreground text-xs rounded-full px-3 py-1 transition-colors"
            >
              Enroll in Payout Boost →
            </Link>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Transaction History */}
        <div className="space-y-6">
          {/* CYBACOIN Transactions */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> CYBACOIN History
            </h2>
            {isTxLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary h-6 w-6" />
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="text-center border border-dashed border-border rounded-xl p-8 text-muted-foreground text-sm">
                <p className="mb-1 font-medium">No transactions yet.</p>
                <p className="text-xs">Complete quests, spin the wheel, and buy rewards to see history here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const meta = TX_META[tx.type] ?? { icon: '💰', color: 'text-foreground' };
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                      <span className="text-lg shrink-0">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.timestamp?.toDate
                            ? formatDistanceToNow(tx.timestamp.toDate(), { addSuffix: true })
                            : '—'}
                        </p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{tx.amount.toLocaleString()} CC
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cash Transactions — only show if enrolled */}
          {payoutEnrolled && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Cash History
              </h2>
              {isCashTxLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-primary h-6 w-6" />
                </div>
              ) : !cashTransactions || cashTransactions.length === 0 ? (
                <div className="text-center border border-dashed border-border rounded-xl p-6 text-muted-foreground text-sm">
                  <p className="text-xs">No cash transactions yet. Complete media quests to earn cash payouts.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cashTransactions.map((tx) => {
                    const meta = CASH_TX_META[tx.type] ?? { icon: '💵', color: 'text-foreground' };
                    const isPositive = tx.amount > 0;
                    return (
                      <div key={tx.id} className="flex items-center gap-3 bg-card border border-green-500/20 rounded-lg px-4 py-3">
                        <span className="text-lg shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.timestamp?.toDate
                              ? formatDistanceToNow(tx.timestamp.toDate(), { addSuffix: true })
                              : '—'}
                          </p>
                        </div>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${isPositive ? 'text-green-400' : 'text-blue-400'}`}>
                          {isPositive ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* How to Earn */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4" /> How to Earn
          </h2>
          <div className="space-y-3">
            {EARN_METHODS.map((m) => (
              <div key={m.title} className="bg-card border border-border rounded-xl p-4 flex gap-4 items-start">
                <span className="text-2xl shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">{m.desc}</p>
                  <Link href={m.href} className="text-xs text-primary hover:underline font-medium">
                    {m.label} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

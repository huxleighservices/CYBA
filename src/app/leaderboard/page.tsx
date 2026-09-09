'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2, Trophy } from 'lucide-react';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { computeLevel, LEVEL_CONFIG } from '@/lib/levels';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { SectionHeader } from '@/components/SectionHeader';

type UserEntry = {
  id: string;
  username?: string;
  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string;
  postCount?: number;
  supportGiven?: number;
  levelOverride?: string;
  weeklyPostCount?: number;
  weeklySupportGiven?: number;
  membershipTier?: string;
  leaderboardOptOut?: boolean;
};

type WeeklyWinner = {
  rank: number;
  name: string;
  profilePictureUrl?: string | null;
  avatarConfig?: AvatarConfig | null;
  posts: number;
  support: number;
};

type WeeklyWinnersData = {
  winners: WeeklyWinner[];
  weekOf: number;
  setAt: number;
};

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };


function score(u: UserEntry) {
  return (u.postCount ?? 0) + (u.supportGiven ?? 0);
}

function weeklyScore(u: UserEntry) {
  return (u.weeklyPostCount ?? 0) + (u.weeklySupportGiven ?? 0);
}

/** UTC timestamp of the most-recent Sunday at 12:00 AM EST, browser-timezone-independent */
function lastSundayMidnightEst(): number {
  const now = new Date();

  // Get today's date string in ET (YYYY-MM-DD via en-CA locale)
  const etDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(now);

  const etDow = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
  }).format(now);

  const DOW_MAP: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const daysBack = DOW_MAP[etDow] ?? 0;

  // Build last-Sunday date by subtracting daysBack from today in ET
  const [y, m, d] = etDateStr.split('-').map(Number);
  const lastSunday = new Date(Date.UTC(y, m - 1, d - daysBack));
  const sy = lastSunday.getUTCFullYear();
  const sm = String(lastSunday.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(lastSunday.getUTCDate()).padStart(2, '0');

  // Parse midnight EST explicitly (EST = UTC-5) — consistent regardless of browser timezone
  return new Date(`${sy}-${sm}-${sd}T00:00:00-05:00`).getTime();
}

export default function LeaderboardPage() {
  const { firestore, user } = useFirebase();
  const weeklyUpdateInFlight = useRef(false);
  const [tab, setTab] = useState<'alltime' | 'weekly'>('alltime');

  const usersQuery = useMemoFirebase(
    () => query(collection(firestore, 'users')),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<UserEntry>(usersQuery);

  const weeklyRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'weeklyWinners'),
    [firestore]
  );
  const { data: weeklyData } = useDoc<WeeklyWinnersData>(weeklyRef);

  const ranked = useMemo(() => {
    if (!users) return [];
    return [...users]
      .filter(u => u.username && !u.leaderboardOptOut)
      .sort((a, b) => score(b) - score(a));
  }, [users]);

  // Live current-week ranking — the settings/weeklyWinners doc below is a frozen
  // once-per-week snapshot (used by the homepage ticker to announce last week's
  // winners), not a live view, so the Weekly tab must compute its own ranking
  // straight from each user's current weeklyPostCount/weeklySupportGiven.
  const weeklyRankedLive = useMemo(() => {
    if (!users) return [];
    return [...users]
      .filter(u => u.username && !u.leaderboardOptOut)
      .sort((a, b) => weeklyScore(b) - weeklyScore(a));
  }, [users]);

  // Update weekly winners snapshot — this writes to settings/weeklyWinners, which Firestore
  // rules only allow for signed-in users. Signed-out visitors used to trigger this on every
  // leaderboard load and get a logged permission error for a write they were never going to
  // be allowed to make.
  const updateWeeklyWinners = useCallback(async () => {
    if (!user || weeklyUpdateInFlight.current || ranked.length < 1) return;
    weeklyUpdateInFlight.current = true;
    try {
      const snap = await getDoc(doc(firestore, 'settings', 'weeklyWinners'));
      const existing = snap.exists() ? snap.data() : null;
      const weekOf: number | undefined = existing?.weekOf;
      const threshold = lastSundayMidnightEst();
      // Only snapshot when a new week has started (not on every load)
      if (!weekOf || weekOf < threshold) {
        const weeklyRankedLive = [...ranked]
          .sort((a, b) => weeklyScore(b) - weeklyScore(a));
        const top10 = weeklyRankedLive.slice(0, 10).map((u, i) => ({
          rank: i + 1,
          name: u.username ?? 'Unknown',
          profilePictureUrl: u.profilePictureUrl ?? null,
          avatarConfig: u.avatarConfig ?? null,
          posts: u.weeklyPostCount ?? 0,
          support: u.weeklySupportGiven ?? 0,
        }));
        await setDoc(doc(firestore, 'settings', 'weeklyWinners'), {
          winners: top10,
          weekOf: threshold,
          setAt: Date.now(),
        });
      }
    } catch (e) {
      console.error('Weekly winners update failed:', e);
    } finally {
      weeklyUpdateInFlight.current = false;
    }
  }, [firestore, ranked, user]);

  useEffect(() => {
    if (ranked.length > 0) updateWeeklyWinners();
  }, [ranked, updateWeeklyWinners]);

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeRanked = tab === 'alltime' ? ranked : weeklyRankedLive;
  const weekLabel = weeklyData?.weekOf
    ? new Date(weeklyData.weekOf).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short', day: 'numeric',
      })
    : null;

  // Next Sunday reset in ET
  const now = new Date();
  const etDow = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
  }).format(now);
  const DOW_TO_SUN: Record<string, number> = {
    Sun: 7, Mon: 6, Tue: 5, Wed: 4, Thu: 3, Fri: 2, Sat: 1,
  };
  const daysUntilSun = DOW_TO_SUN[etDow] ?? 1;
  const nextSun = new Date(now);
  nextSun.setDate(now.getDate() + daysUntilSun);
  const nextResetLabel = nextSun.toLocaleDateString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
  });

  return (
    <div className="container mx-auto px-4 pt-3 pb-8 max-w-5xl">
      <SectionHeader
        title="Leaderboard"
        description="Live rankings based on posts and community support."
        className="mb-4"
      />

      {/* Toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-xl border border-border/60 bg-card/60 p-1 gap-1">
          <button
            onClick={() => setTab('alltime')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              tab === 'alltime'
                ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(138,43,226,0.4)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🏆 All-Time
          </button>
          <button
            onClick={() => setTab('weekly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              tab === 'weekly'
                ? 'bg-yellow-500/80 text-black shadow-[0_0_16px_rgba(234,179,8,0.35)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ⚡ Weekly
          </button>
        </div>
      </div>

      {/* Weekly meta info */}
      {tab === 'weekly' && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
          {weekLabel && (
            <span className="bg-yellow-950/40 border border-yellow-600/20 rounded-full px-3 py-1">
              📅 Week of {weekLabel}
            </span>
          )}
          <span className="bg-card/60 border border-border/40 rounded-full px-3 py-1">
            🔄 Resets Sunday · Next: {nextResetLabel} EST
          </span>
        </div>
      )}

      {/* Table */}
      <Card className="border-primary/20 bg-card/50">
        <CardContent className="p-0">
          {activeRanked.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {tab === 'weekly' ? 'No weekly data yet' : 'No entries yet'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {tab === 'weekly'
                  ? 'Weekly rankings update each Sunday EST.'
                  : 'Start posting to appear on the leaderboard!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                    <th className="py-2 pl-2 pr-1 sm:px-3 text-center w-8 sm:w-14">Rank</th>
                    <th className="py-2 pl-3 pr-1 sm:pl-5 sm:pr-3 text-left">User</th>
                    <th className="py-2 px-1 sm:px-3 text-center w-12 sm:w-20">Posts</th>
                    <th className="py-2 pl-1 pr-2 sm:px-3 text-center w-12 sm:w-20">Supp</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRanked.map((user, i) => {
                    const rank = i + 1;
                    const level = computeLevel(user.postCount, user.supportGiven, undefined, user.levelOverride);
                    const levelCfg = LEVEL_CONFIG[level] ?? Object.values(LEVEL_CONFIG)[0];
                    const posts = tab === 'weekly' ? (user.weeklyPostCount ?? 0) : (user.postCount ?? 0);
                    const supports = tab === 'weekly' ? (user.weeklySupportGiven ?? 0) : (user.supportGiven ?? 0);
                    const rowCls =
                      rank === 1 ? 'bg-yellow-950/20 border-l-2 border-yellow-400' :
                      rank === 2 ? 'bg-slate-900/20 border-l-2 border-slate-400' :
                      rank === 3 ? 'bg-orange-950/20 border-l-2 border-orange-500' :
                      'hover:bg-muted/20';

                    return (
                      <tr key={user.id} className={`border-b border-border/30 transition-colors ${rowCls}`}>
                        {/* Rank */}
                        <td className="py-2 pl-2 pr-1 sm:px-3 text-center font-black">
                          {rank <= 3
                            ? <span className="text-base sm:text-xl">{RANK_MEDAL[rank]}</span>
                            : <span className="text-muted-foreground tabular-nums text-xs sm:text-sm">{rank}</span>
                          }
                        </td>

                        {/* User */}
                        <td className="py-2 pl-3 pr-1 sm:pl-5 sm:pr-3 min-w-0">
                          <Link href={`/u/${user.username}`} className="flex items-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity">
                            <AvatarDisplay
                              profilePictureUrl={user.profilePictureUrl}
                              avatarConfig={user.avatarConfig}
                              size={28}
                              level={level}
                            />
                            <div className="min-w-0">
                              <p className={`font-bold text-xs sm:text-sm truncate ${rank === 1 ? 'text-yellow-300' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-300' : ''}`}>
                                {user.username}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{levelCfg.emoji} {levelCfg.name}</p>
                            </div>
                          </Link>
                        </td>

                        {/* Posts */}
                        <td className="py-2 px-1 sm:px-3 text-center font-semibold tabular-nums text-xs sm:text-sm">
                          {posts.toLocaleString()}
                        </td>

                        {/* Support */}
                        <td className="py-2 pl-1 pr-2 sm:px-3 text-center font-semibold tabular-nums text-xs sm:text-sm text-primary">
                          {supports.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

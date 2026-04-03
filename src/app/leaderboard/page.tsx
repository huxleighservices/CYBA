'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2, Trophy, Medal, Flame, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface LeaderboardEntry {
  cybaName?: string;
  cybaIg?: string;
  tier?: string;
  outwardEngagement?: number;
  inwardEngagement?: number;
  features?: number;
  cybaCoin?: number;
  [key: string]: any;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = parseFloat(value); return isNaN(n) ? 0 : n; }
  return 0;
};
const formatNumber = (value: any) => getNumber(value).toLocaleString();
const getString = (value: any): string => (!value ? '' : String(value).trim());

/** Timestamp of the most-recent Saturday at 12:01 AM (local time) */
function lastSaturdayAt1201(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const daysBack = day === 6 ? 0 : day + 1;
  const sat = new Date(now);
  sat.setDate(now.getDate() - daysBack);
  sat.setHours(0, 1, 0, 0);
  return sat.getTime();
}

function needsWeeklyReset(weekOf: number | undefined): boolean {
  const threshold = lastSaturdayAt1201();
  if (Date.now() < threshold) return false; // This Saturday's 12:01 AM hasn't hit yet
  if (!weekOf) return true;
  return weekOf < threshold;
}

// ── Rank icon (table) ──────────────────────────────────────────────────────

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Medal className="h-5 w-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-orange-500" />;
  return <Flame className="h-5 w-5 text-orange-400/60" />;
};

// ── Podium card themes ────────────────────────────────────────────────────

const PODIUM = [
  {
    rank: 2,
    order: 'sm:order-1',
    medal: '🥈',
    label: '2ND PLACE',
    cardCls:
      'border-slate-400/50 bg-gradient-to-b from-slate-700/30 via-slate-800/20 to-slate-900/40',
    glowCls: 'shadow-[0_0_20px_rgba(148,163,184,0.25),0_0_4px_rgba(148,163,184,0.15)]',
    textCls: 'text-slate-300',
    nameCls: 'text-slate-100',
    heightCls: 'pt-6',
  },
  {
    rank: 1,
    order: 'sm:order-2',
    medal: '🥇',
    label: 'CHAMPION',
    cardCls:
      'border-yellow-400/70 bg-gradient-to-b from-yellow-700/40 via-yellow-900/25 to-yellow-950/50 gold-shimmer winner-glow',
    glowCls: '',
    textCls: 'text-yellow-400',
    nameCls: 'text-yellow-100',
    heightCls: 'pt-2',
    isChamp: true,
  },
  {
    rank: 3,
    order: 'sm:order-3',
    medal: '🥉',
    label: '3RD PLACE',
    cardCls:
      'border-orange-600/50 bg-gradient-to-b from-orange-800/30 via-orange-950/20 to-orange-950/40',
    glowCls: 'shadow-[0_0_18px_rgba(234,88,12,0.2),0_0_4px_rgba(234,88,12,0.1)]',
    textCls: 'text-orange-400',
    nameCls: 'text-orange-100',
    heightCls: 'pt-8',
  },
] as const;

function PodiumSection({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length < 3) return null;

  return (
    <div className="mb-10">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold tracking-widest text-yellow-400 uppercase drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">
          ✦ CYBA Weekly Winners ✦
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Current top performers this week</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        {PODIUM.map((theme) => {
          const entry = entries[theme.rank - 1];
          return (
            <div key={theme.rank} className={`${theme.order} ${theme.heightCls}`}>
              <div
                className={`relative border-2 rounded-2xl p-6 text-center transition-transform hover:-translate-y-1 ${theme.cardCls} ${theme.glowCls}`}
              >
                {/* Crown / star for #1 */}
                {theme.isChamp && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl animate-bounce">
                    👑
                  </div>
                )}

                {/* Sparkle dots in corners for #1 */}
                {theme.isChamp && (
                  <>
                    <span className="absolute top-2 left-3 text-yellow-400 opacity-60 text-xs animate-pulse">✦</span>
                    <span className="absolute top-2 right-3 text-yellow-400 opacity-60 text-xs animate-pulse [animation-delay:0.4s]">✦</span>
                    <span className="absolute bottom-2 left-3 text-yellow-400 opacity-40 text-xs animate-pulse [animation-delay:0.8s]">✦</span>
                    <span className="absolute bottom-2 right-3 text-yellow-400 opacity-40 text-xs animate-pulse [animation-delay:1.2s]">✦</span>
                  </>
                )}

                <div className="text-4xl mb-1">{theme.medal}</div>
                <p className={`text-[10px] font-black tracking-[0.2em] uppercase mb-2 ${theme.textCls}`}>
                  {theme.label}
                </p>
                <p className={`text-lg font-bold mb-1 truncate ${theme.nameCls}`}>
                  {getString(entry.cybaName) || 'TBD'}
                </p>
                {entry.cybaIg && (
                  <a
                    href={`https://instagram.com/${entry.cybaIg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs hover:underline block mb-2 ${theme.textCls}`}
                  >
                    @{entry.cybaIg}
                  </a>
                )}
                <div className={`flex items-center justify-center gap-1.5 mt-2 ${theme.textCls}`}>
                  <Image src="/CCoin.png?v=2" alt="" width={16} height={16} />
                  <span className="text-sm font-bold tabular-nums">
                    {formatNumber(entry.cybaCoin)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Prevent double-writing within a session
  const weeklyUpdateAttempted = useRef(false);

  // ── Weekly winners snapshot ──────────────────────────────────────────────

  const saveWeeklyWinners = useCallback(async (entries: LeaderboardEntry[]) => {
    try {
      const top3 = entries.slice(0, 3).map((e, i) => ({
        rank: i + 1,
        name: getString(e.cybaName) || 'Unknown',
        cybaIg: getString(e.cybaIg) || null,
        cybaCoin: getNumber(e.cybaCoin),
      }));
      await setDoc(doc(firestore, 'settings', 'weeklyWinners'), {
        winners: top3,
        weekOf: lastSaturdayAt1201(),
        setAt: Date.now(),
      });
    } catch (e) {
      console.error('Failed to save weekly winners:', e);
    }
  }, [firestore]);

  const checkAndUpdateWeeklyWinners = useCallback(async (entries: LeaderboardEntry[]) => {
    if (weeklyUpdateAttempted.current || entries.length < 3) return;
    weeklyUpdateAttempted.current = true;
    try {
      const snap = await getDoc(doc(firestore, 'settings', 'weeklyWinners'));
      const weekOf: number | undefined = snap.exists() ? snap.data()?.weekOf : undefined;
      if (needsWeeklyReset(weekOf)) {
        await saveWeeklyWinners(entries);
      }
    } catch (e) {
      console.error('Weekly winners check failed:', e);
    }
  }, [firestore, saveWeeklyWinners]);

  // ── Leaderboard sync ────────────────────────────────────────────────────

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-leaderboard', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Sync failed');
      toast({ title: 'Sync Complete', description: `${result.updatedCount} user balances updated.` });
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  const fetchLeaderboard = useCallback(async (isManualRefresh = false) => {
    if (!isManualRefresh) setIsLoading(true);
    try {
      const response = await fetch('/api/sheets');
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.details || `Failed to fetch: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.details || data.error);
      const entries: LeaderboardEntry[] = Array.isArray(data) ? data : [];
      setLeaderboardData(entries);
      setLastUpdated(new Date());
      setError(null);

      // Background operations — don't block render
      checkAndUpdateWeeklyWinners(entries);
      if (user) triggerSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Leaderboard fetch error:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [user, triggerSync, checkAndUpdateWeeklyWinners]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(() => fetchLeaderboard(), 60_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading && leaderboardData.length === 0) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  const top3 = leaderboardData.slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBAZONE Leaderboard
        </h1>
        <p className="text-lg text-foreground/80 mb-2">
          See which CYBAS are making the biggest impact in the CYBAZONE.
        </p>
        <div className="flex items-center justify-center gap-4">
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLeaderboard(true)}
            disabled={isLoading || isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading || isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Golden top 3 podium ── */}
      {top3.length >= 3 && <PodiumSection entries={leaderboardData} />}

      {/* ── Full table ── */}
      <Card className="border-primary/20 bg-card/50 shadow-lg">
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="bg-destructive/10 p-6 rounded-lg max-w-md">
                <h3 className="text-xl font-semibold text-destructive mb-2">Error Loading Leaderboard</h3>
                <p className="text-sm text-destructive/80 mb-4 break-words">{error}</p>
                <Button onClick={() => fetchLeaderboard(true)} className="text-sm px-4 py-2">
                  Try Again
                </Button>
              </div>
            </div>
          ) : leaderboardData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 text-center font-bold">Rank</TableHead>
                    <TableHead className="font-bold">Name</TableHead>
                    <TableHead className="font-bold">Instagram</TableHead>
                    <TableHead className="font-bold">Tier</TableHead>
                    <TableHead className="text-center font-bold">Outward</TableHead>
                    <TableHead className="text-center font-bold">Inward</TableHead>
                    <TableHead className="text-center font-bold">Features</TableHead>
                    <TableHead className="text-right font-bold">
                      <div className="flex justify-end items-center gap-1">
                        <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={22} height={22} />
                        CYBACOIN
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardData.map((entry, index) => {
                    const rank = index + 1;
                    const isTop3 = rank <= 3;

                    // Gold / silver / bronze row styling
                    const rowCls = isTop3
                      ? rank === 1
                        ? 'bg-yellow-950/30 hover:bg-yellow-950/50 border-l-4 border-yellow-400'
                        : rank === 2
                        ? 'bg-slate-900/30 hover:bg-slate-900/50 border-l-4 border-slate-400'
                        : 'bg-orange-950/30 hover:bg-orange-950/50 border-l-4 border-orange-500'
                      : 'hover:bg-muted/30';

                    const nameCls = isTop3
                      ? rank === 1 ? 'text-yellow-300' : rank === 2 ? 'text-slate-300' : 'text-orange-300'
                      : '';

                    return (
                      <TableRow key={`${entry.cybaName || index}-${index}`} className={`transition-colors ${rowCls}`}>
                        <TableCell className="text-center font-bold">
                          <div className="flex items-center justify-center">{getRankIcon(rank)}</div>
                        </TableCell>
                        <TableCell className={`font-semibold ${nameCls}`}>
                          {getString(entry.cybaName) || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {entry.cybaIg ? (
                            <a
                              href={`https://instagram.com/${entry.cybaIg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              @{entry.cybaIg}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.tier ? (
                            <Badge
                              variant={entry.tier === 'Surge' ? 'default' : 'secondary'}
                              className={entry.tier === 'Surge' ? 'bg-gradient-to-r from-primary to-primary/80' : 'bg-accent text-accent-foreground'}
                            >
                              {entry.tier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">{formatNumber(entry.outwardEngagement)}</TableCell>
                        <TableCell className="text-center font-medium">{formatNumber(entry.inwardEngagement)}</TableCell>
                        <TableCell className="text-center font-medium">{formatNumber(entry.features)}</TableCell>
                        <TableCell className="text-right font-bold text-primary text-lg">
                          {formatNumber(entry.cybaCoin)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">The Leaderboard is Empty</h3>
              <p className="text-muted-foreground">Check back later to see who's climbing the ranks!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Summary stats ── */}
      {leaderboardData.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <CardContent className="p-6 text-center">
              <Medal className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Top Performer</p>
              <p className="text-lg font-bold">{getString(leaderboardData[0]?.cybaName) || 'N/A'}</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                <Image src="/CCoin.png?v=2" alt="" width={14} height={14} />
                <p className="text-xs text-muted-foreground">{formatNumber(leaderboardData[0]?.cybaCoin)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <CardContent className="p-6 text-center">
              <div className="text-xl font-bold mb-2">📊</div>
              <p className="text-sm text-muted-foreground mb-1">Total Competitors</p>
              <p className="text-lg font-bold">{leaderboardData.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="p-6 text-center">
              <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={40} height={40} className="mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Total CYBACOIN</p>
              <p className="text-lg font-bold">
                {formatNumber(leaderboardData.reduce((s, e) => s + getNumber(e.cybaCoin), 0))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

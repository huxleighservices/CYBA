'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { Loader2, Coins, Trophy, Medal, Flame } from 'lucide-react';
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

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-orange-600" />;
  return <Flame className="h-5 w-5 text-orange-400" />;
};

// Helper to safely get numeric value
const getNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper to format number safely
const formatNumber = (value: any): string => {
  const num = getNumber(value);
  return num.toLocaleString();
};

// Helper to safely get string value
const getString = (value: any): string => {
  if (!value) return '';
  return String(value).trim();
};

export default function LeaderboardPage() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sheets');
      
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.details || `Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      // Safely handle the response
      const entries = Array.isArray(data) ? data : [];
      setLeaderboardData(entries);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Leaderboard fetch error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeaderboard();

      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchLeaderboard, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (isUserLoading || (user && isLoading && leaderboardData.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBAZONE Leaderboard
        </h1>
        <p className="text-lg text-foreground/80 mb-2">
          See Which CYBAs are Making the Biggest Impact in the CYBAZONE.
        </p>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      <Card className="border-primary/20 bg-card/50 shadow-lg">
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="bg-destructive/10 p-6 rounded-lg max-w-md">
                <h3 className="text-xl font-semibold text-destructive mb-2">
                  Error Loading Leaderboard
                </h3>
                <p className="text-sm text-destructive/80 mb-4 break-words">{error}</p>
                <button
                  onClick={() => fetchLeaderboard()}
                  className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : leaderboardData && leaderboardData.length > 0 ? (
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
                        <Coins className="h-4 w-4" />
                        Cybacoin
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboardData.map((entry, index) => {
                    const rank = index + 1;
                    const isTopThree = rank <= 3;

                    return (
                      <TableRow
                        key={`${entry.cybaName || index}-${index}`}
                        className={`transition-colors ${
                          isTopThree
                            ? 'bg-primary/5 hover:bg-primary/10 border-l-4 border-primary'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <TableCell className="text-center font-bold">
                          <div className="flex items-center justify-center">
                            {getRankIcon(rank)}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`font-semibold ${
                            isTopThree ? 'text-primary' : ''
                          }`}
                        >
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
                              variant={
                                entry.tier === 'Surge' ? 'default' : 'secondary'
                              }
                              className={
                                entry.tier === 'Surge'
                                  ? 'bg-gradient-to-r from-primary to-primary/80'
                                  : 'bg-accent text-accent-foreground'
                              }
                            >
                              {entry.tier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatNumber(entry.outwardEngagement)}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatNumber(entry.inwardEngagement)}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatNumber(entry.features)}
                        </TableCell>
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
              <h3 className="text-xl font-semibold mb-2">
                The Leaderboard is Empty
              </h3>
              <p className="text-muted-foreground">
                Check back later to see who's climbing the ranks!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {leaderboardData.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <CardContent className="p-6 text-center">
              <Medal className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Top Performer</p>
              <p className="text-lg font-bold">
                {getString(leaderboardData[0]?.cybaName) || 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatNumber(leaderboardData[0]?.cybaCoin)} Cybacoin
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <CardContent className="p-6 text-center">
              <div className="text-xl font-bold mb-2">📊</div>
              <p className="text-sm text-muted-foreground mb-1">
                Total Competitors
              </p>
              <p className="text-lg font-bold">{leaderboardData.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="p-6 text-center">
              <Coins className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Total Cybacoin</p>
              <p className="text-lg font-bold">
                {formatNumber(
                  leaderboardData.reduce(
                    (sum, entry) => sum + getNumber(entry.cybaCoin),
                    0
                  )
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { Loader2, Coins, Trophy } from 'lucide-react';
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
  id: string;
  cybaName: string;
  cybaIg: string;
  tier: string;
  outwardEngagement: number;
  inwardEngagement: number;
  features: number;
  cybaCoin: number;
}

export default function LeaderboardPage() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect unauthenticated users.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetch('/api/sheets')
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.error) {
            throw new Error(data.details || data.error);
          }
          setLeaderboardData(data);
          setError(null);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [user]);

  // Show loading spinner while checking for user auth or fetching data
  if (isUserLoading || (user && isLoading)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
      return null; // Don't render anything while redirecting
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Leaderboard
        </h1>
        <p className="text-lg text-foreground/80">
          See who is making the biggest impact in the CYBAZONE.
        </p>
      </div>

      <Card className="border-primary/20 bg-card/50">
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-destructive">
                <h3 className="text-xl font-semibold">Error Loading Leaderboard</h3>
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-2 text-muted-foreground">Please check backend logs and environment variable configuration.</p>
            </div>
          ) : leaderboardData && leaderboardData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Outward</TableHead>
                  <TableHead>Inward</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead className="text-right">
                    <div className="flex justify-end items-center">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboardData?.map((entry, index) => (
                  <TableRow key={entry.cybaName + index}>
                    <TableCell className="font-bold">{index + 1}</TableCell>
                    <TableCell>{entry.cybaName}</TableCell>
                    <TableCell>{entry.cybaIg}</TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.tier === 'Surge' ? 'default' : 'secondary'}
                        className={
                          entry.tier === 'Surge'
                            ? 'bg-primary'
                            : 'bg-accent text-accent-foreground'
                        }
                      >
                        {entry.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.outwardEngagement}</TableCell>
                    <TableCell>{entry.inwardEngagement}</TableCell>
                    <TableCell>{entry.features}</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {entry.cybaCoin}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">The Leaderboard is Empty</h3>
                <p className="text-muted-foreground">Check back later to see who's climbing the ranks!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

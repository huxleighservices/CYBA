'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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

export default function LeaderboardPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();

  // Create the query reference. It will only be used by useCollection when it's not null.
  const leaderboardRef = useMemoFirebase(
    () =>
      user
        ? query(collection(firestore, 'leaderboard'), orderBy('cybaCoin', 'desc'))
        : null,
    [firestore, user]
  );

  // useCollection will wait for leaderboardRef to be non-null before fetching.
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useCollection(leaderboardRef);

  useEffect(() => {
    // Redirect unauthenticated users.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  // Combined loading state.
  const isLoading = isUserLoading || isLeaderboardLoading;

  // This content will only be rendered for authenticated users,
  // as the useEffect above handles redirection.
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
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
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
                  <TableRow key={entry.id}>
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

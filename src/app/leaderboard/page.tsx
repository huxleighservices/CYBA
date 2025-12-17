'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Loader2, Trophy, Coins } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function LeaderboardPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();

  const leaderboardRef = useMemoFirebase(
    () => query(collection(firestore, 'leaderboard'), orderBy('cybaCoin', 'desc')),
    [firestore]
  );
  const { data: leaderboardData, isLoading } = useCollection(leaderboardRef);

  useEffect(() => {
    // If user loading is finished and there is no user, redirect to login.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  // Show a loading spinner while checking for the user or loading data.
  if (isUserLoading || isLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (user) {
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

        <div className="border border-primary/20 rounded-lg bg-card/50">
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
                  <div className="flex justify-end">
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
                        className={entry.tier === 'Surge' ? 'bg-primary' : 'bg-accent text-accent-foreground'}
                     >
                        {entry.tier}
                     </Badge>
                  </TableCell>
                  <TableCell>{entry.outwardEngagement}</TableCell>
                  <TableCell>{entry.inwardEngagement}</TableCell>
                  <TableCell>{entry.features}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{entry.cybaCoin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Render nothing while redirecting for non-users.
  return null;
}

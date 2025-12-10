'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { Loader2, HardHat } from 'lucide-react';

export default function LeaderboardPage() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    // If user loading is finished and there is no user, redirect to login.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  // Show a loading spinner while checking for the user.
  if (isUserLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If there's a user, show the under construction message.
  // The useEffect above will handle redirection for non-users, so this content
  // will only be visible to authenticated users.
  if (user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
            Leaderboard
          </h1>
          <p className="text-lg text-foreground/80 mb-12">
            The central hub for the CYBA family. Connect, collaborate, and create.
          </p>
        </div>

        <div className="border border-primary/20 rounded-lg bg-card/50 flex flex-col items-center justify-center text-center p-16">
          <HardHat className="h-16 w-16 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Under Construction</h2>
          <p className="text-foreground/70">
            This section is currently being built. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  // Render nothing while redirecting for non-users.
  return null;
}

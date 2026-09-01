'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function BanGate({ children }: { children: React.ReactNode }) {
  const { firestore, user, isUserLoading } = useFirebase();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: profile, isLoading } = useDoc<{ banned?: boolean }>(userDocRef);

  // Show banned screen only once we have a confirmed banned status
  if (user && !isUserLoading && !isLoading && profile?.banned) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background text-foreground">
        <div className="text-center space-y-5 max-w-md">
          <div className="text-7xl select-none">🚫</div>
          <h1 className="text-4xl font-headline font-bold text-destructive tracking-wide">
            Account Suspended
          </h1>
          <p className="text-lg text-muted-foreground">
            Your CYBAZONE account has been suspended.
          </p>
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, contact us at{' '}
            <span className="text-primary font-medium">service@huxleigh.com</span>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

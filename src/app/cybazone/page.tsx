'use client';

import { useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';

type UserProfile = {
    username: string;
    avatarConfig?: AvatarConfig;
};

function LoggedInView() {
    const { firestore, user } = useFirebase();
    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    if (isProfileLoading) {
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
    }

    return (
        <div className="text-center">
            {userProfile && (
                <div className="mb-8 flex justify-center">
                    <AvatarDisplay avatarConfig={userProfile.avatarConfig} size={160} />
                </div>
            )}
            <h2 className="text-4xl font-bold text-black">
                Welcome to the CYBAZONE, {userProfile?.username || 'CYBA'}!
            </h2>
            <p className="text-gray-600 mt-2">
                The future of creative collaboration is here.
            </p>
        </div>
  );
}

function LoggedOutView() {
  return (
    <div className="text-center">
      <h2 className="text-4xl font-bold text-black">
        You must be logged in to enter the CYBAZONE.
      </h2>
      <p className="text-gray-600 mt-2">Please sign in to continue.</p>
      <div className="mt-6 flex justify-center gap-4">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/login">Sign In</Link>
        </Button>
        <Button asChild variant="outline" className="text-primary border-primary hover:bg-primary/10 hover:text-primary">
          <Link href="/signup">Create Account</Link>
        </Button>
      </div>
    </div>
  );
}

export default function CybazonePage() {
  const [isOpen, setIsOpen] = useState(true);
  const { user, isUserLoading } = useFirebase();

  return (
    <>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
            CYBAZONE
          </h1>
          <p className="text-lg text-foreground/80 mb-12">
            The central hub for the CYBA family. Click the button below to re-launch the CYBAZONE experience.
          </p>
           <Button onClick={() => setIsOpen(true)} disabled={isOpen}>Launch CYBAZONE</Button>
        </div>
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white max-w-none w-[calc(100%-2rem)] sm:w-[95vw] h-[90vh] flex flex-col p-0 text-black rounded-lg shadow-2xl border-primary border-2">
           <DialogHeader className="p-4 border-b border-gray-200 flex flex-row items-center justify-between flex-shrink-0">
            <DialogTitle className="text-2xl font-bold text-primary tracking-widest">
                CYBAZONE
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-gray-500 hover:text-black">
                <X className="h-6 w-6" />
              </Button>
            </DialogClose>
          </DialogHeader>
          
          <div className="flex-grow flex items-center justify-center p-8 overflow-y-auto">
            {isUserLoading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : user ? (
              <LoggedInView />
            ) : (
              <LoggedOutView />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
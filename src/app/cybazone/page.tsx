'use client';

import { useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  Loader2,
  Home,
  Compass,
  Heart,
  ShoppingBag,
  Megaphone,
  User as ProfileIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import Image from 'next/image';

type UserProfile = {
    username: string;
    avatarConfig?: AvatarConfig;
};

function CybazoneHeader() {
  const navItems = [
    { icon: Home, label: 'Feed' },
    { icon: Compass, label: 'Discover' },
    { icon: Heart, label: 'Engagement' },
    { icon: ShoppingBag, label: 'Shop' },
    { icon: Megaphone, label: 'Ads' },
    { icon: ProfileIcon, label: 'Profile' },
  ];

  return (
    <header className="w-full bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
      <nav className="flex justify-around items-center">
        {navItems.map((item, index) => (
          <Button key={index} variant="ghost" className="flex flex-col h-auto p-2 text-gray-500 hover:text-primary hover:bg-primary/10">
            <item.icon className="h-6 w-6" />
            <span className="text-xs mt-1">{item.label}</span>
          </Button>
        ))}
      </nav>
    </header>
  );
}


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
        <div className="h-full w-full flex flex-col bg-white">
            <CybazoneHeader />
            <main className="flex-grow flex flex-col items-center justify-center text-center p-8 overflow-y-auto">
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
                 <p className="text-gray-400 mt-8">(Content for the selected feed will go here)</p>
            </main>
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
            <DialogTitle>
                <span className="sr-only">CYBAZONE</span>
                <Image
                    src="https://preview.redd.it/cybazone-logo-v0-weh6u4jcz4kg1.png?width=1080&crop=smart&auto=webp&s=170ecdc62fb796fd7dffe8e8c4e00ff0aa04f3a0"
                    alt="CYBAZONE Logo"
                    width={180}
                    height={30}
                    priority
                />
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-grow flex items-center justify-center overflow-y-auto">
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

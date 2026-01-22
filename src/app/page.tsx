'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { Loader2 } from 'lucide-react';

type UserProfile = {
    username: string;
    avatarConfig?: AvatarConfig;
};

function LoggedInHome({ user }: { user: any }) {
    const { firestore } = useFirebase();
    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    if (isProfileLoading) {
        return (
            <div className="relative z-10 px-6 py-24 md:py-32 flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="relative z-10 px-6 py-16 md:py-24 flex flex-col items-center">
            {userProfile && (
                <div className="mb-8">
                    <AvatarDisplay avatarConfig={userProfile.avatarConfig} size={160} />
                </div>
            )}
            <h1 className="text-4xl md:text-6xl font-headline font-bold mb-4 tracking-tighter animate-text-glow">
                WELCOME, {userProfile?.username || 'CYBA'}
            </h1>
            <p className="text-lg text-foreground/80 mb-8">You have returned to the CYBAZONE.</p>
            <Button asChild size="lg" className="font-bold group bg-primary/50 hover:bg-primary/70 text-xl py-4 px-10">
                <Link href="/leaderboard">
                    View Leaderboard
                </Link>
            </Button>
        </div>
    );
}

function LoggedOutHome() {
    return (
        <div className="relative z-10 px-6 py-24 md:py-32">
            <h1 className="text-4xl md:text-7xl font-headline font-bold mb-8 tracking-tighter animate-text-glow">
                WELCOME TO THE CYBAZONE
            </h1>
            <Button
                asChild
                size="lg"
                className="font-bold group animate-button-glow bg-primary/50 hover:bg-primary/70 text-xl py-4 px-10"
            >
                <Link href="/membership">
                    ENTER
                </Link>
            </Button>
        </div>
    );
}

export default function Home() {
    const { user, isUserLoading } = useFirebase();

    return (
        <div className="container mx-auto px-4 py-8 md:py-16">
            <section className="relative text-center rounded-lg overflow-hidden mb-16">
                {isUserLoading ? (
                     <div className="relative z-10 px-6 py-24 md:py-32 flex flex-col items-center justify-center min-h-[400px]">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                ) : user ? (
                    <LoggedInHome user={user} />
                ) : (
                    <LoggedOutHome />
                )}
            </section>
        </div>
    );
}

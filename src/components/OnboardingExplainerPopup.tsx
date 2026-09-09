'use client';

import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * First-login explainer — shown once, right after the Just Landed CYBAQUEST prompt has been
 * dismissed, covering the two ways to earn on CYBAZONE: real cash (Just Landed, Top CYBAs of
 * the Week, Zone Builder referrals) and CYBACOIN (posting, supporting, CYBAQUESTS).
 */
export function OnboardingExplainerPopup() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [open, setOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<{
    questPromptSeen?: boolean;
    onboardingExplainerSeen?: boolean;
  }>(userDocRef);

  useEffect(() => {
    if (isUserLoading || isProfileLoading || !user || !profile) return;
    if (profile.onboardingExplainerSeen) return;
    if (!profile.questPromptSeen) return; // sequenced after the Just Landed prompt
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [user, profile, isUserLoading, isProfileLoading]);

  const dismiss = async () => {
    setOpen(false);
    if (!user) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
      onboardingExplainerSeen: true,
    }).catch(() => {});
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-yellow-500 via-primary to-purple-500" />
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 py-6 space-y-4">
          <div>
            <h2 className="font-bold text-base leading-tight">Welcome to the Zone! Here's how to earn</h2>
            <p className="text-xs text-muted-foreground">Two currencies, two ways to win</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-green-400">💵 Real Cash</p>
            <ul className="text-sm text-foreground/80 space-y-1 list-disc list-inside">
              <li><span className="font-semibold">Just Landed</span> — complete onboarding for a quick payout</li>
              <li><span className="font-semibold">Top CYBAs of the Week</span> — rank in the top 3 every Saturday</li>
              <li><span className="font-semibold">Zone Builder</span> — earn cash for every friend you refer</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">🪙 CYBACOIN</p>
            <ul className="text-sm text-foreground/80 space-y-1 list-disc list-inside">
              <li>Posting to Central, Pulses, and Zaps</li>
              <li>Supporting others — likes, comments, shares</li>
              <li>Completing CYBAQUESTS</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Link href="/cybaquests" className="flex-1" onClick={dismiss}>
              <Button className="w-full bg-gradient-to-r from-yellow-600 to-purple-600 hover:from-yellow-500 hover:to-purple-500 text-white font-semibold">
                Let's Go 🚀
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

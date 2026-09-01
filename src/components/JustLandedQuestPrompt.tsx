'use client';

import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function JustLandedQuestPrompt() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [open, setOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<{
    questPromptSeen?: boolean;
    igHandleSkipped?: boolean;
    instagramHandle?: string;
    tiktokHandle?: string;
    tiktokHandleSkipped?: boolean;
  }>(userDocRef);

  useEffect(() => {
    if (isUserLoading || isProfileLoading || !user || !profile) return;
    if (profile.questPromptSeen) return;
    // Show only after both handle prompts are resolved
    const igResolved = !!profile.instagramHandle || profile.igHandleSkipped === true;
    const ttResolved = !!profile.tiktokHandle || profile.tiktokHandleSkipped === true;
    if (igResolved && ttResolved) {
      const t = setTimeout(() => setOpen(true), 3500);
      return () => clearTimeout(t);
    }
  }, [user, profile, isUserLoading, isProfileLoading]);

  const dismiss = async () => {
    setOpen(false);
    if (!user) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
      questPromptSeen: true,
    }).catch(() => {});
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient top strip */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 py-6 space-y-4">
          {/* Icon + heading */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shrink-0 text-xl">
              🗺️
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Just Landed? Start a CYBAQUEST!</h2>
              <p className="text-xs text-muted-foreground">New missions just dropped — earn CYBACOIN & level up</p>
            </div>
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed">
            CYBAQuests are live challenges that reward you with <span className="text-yellow-400 font-semibold">CYBACOIN</span> and cash for completing missions. New quests just landed — check them out now!
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Link href="/cybaquests" className="flex-1" onClick={dismiss}>
              <Button className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-semibold">
                View CYBAQuests 🗺️
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground text-xs">
              Later
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Access quests anytime from the main navigation.
          </p>
        </div>
      </div>
    </div>
  );
}

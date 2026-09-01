'use client';

import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Instagram, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function IGHandlePrompt() {
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<{
    instagramHandle?: string;
    igHandleSkipped?: boolean;
  }>(userDocRef);

  useEffect(() => {
    if (isUserLoading || isProfileLoading || !user || !profile) return;
    const alreadySet = !!profile.instagramHandle;
    const skipped = profile.igHandleSkipped === true;
    if (!alreadySet && !skipped) {
      // Small delay so the page settles before the modal appears
      const t = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, [user, profile, isUserLoading, isProfileLoading]);

  const handleSave = async () => {
    if (!user || !handle.trim()) return;
    setSaving(true);
    try {
      const cleaned = handle.trim().replace(/^@/, '');
      await updateDoc(doc(firestore, 'users', user.uid), {
        instagramHandle: cleaned,
      });
      toast({ title: '📸 Instagram handle saved!', description: `@${cleaned} linked to your profile.` });
      setOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not save handle', description: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setOpen(false);
    if (!user) return;
    // Suppress future prompts for this user
    await updateDoc(doc(firestore, 'users', user.uid), {
      igHandleSkipped: true,
    }).catch(() => {});
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient top strip */}
        <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

        {/* Close */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 py-6 space-y-4">
          {/* Icon + heading */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Connect Your Instagram</h2>
              <p className="text-xs text-muted-foreground">Let the community find you on IG</p>
            </div>
          </div>

          {/* Input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
            <input
              type="text"
              value={handle}
              onChange={e => setHandle(e.target.value.replace(/\s/g, ''))}
              placeholder="your_handle"
              maxLength={30}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              className="w-full bg-muted/40 border border-border rounded-lg pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!handle.trim() || saving}
              className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold"
            >
              {saving ? 'Saving…' : 'Save Handle'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground text-xs">
              Skip
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            You can update this anytime from your profile settings.
          </p>
        </div>
      </div>
    </div>
  );
}

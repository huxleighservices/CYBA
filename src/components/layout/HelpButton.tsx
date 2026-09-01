'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HelpCircle, X, ShieldCheck, Mail, ScrollText, Instagram, Youtube, Facebook, ExternalLink, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, getDoc, doc, query, where, limit, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export const HELP_LINKS = [
  { label: 'FAQ',            href: '/faq',     icon: HelpCircle  },
  { label: 'Privacy Policy', href: '/privacy', icon: ShieldCheck },
  { label: 'Terms of Use',   href: '/terms',   icon: ScrollText  },
];

/** CYBAZONE's own system/support account username — Contact Us opens a DM with this account
 *  instead of the old email-style contact form. Falls back to /contact if it can't be found
 *  (e.g. the account hasn't been created in this environment yet). */
const CYBAZONE_SYSTEM_USERNAME = 'cybazone';

export const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/cybazone/?hl=en',               icon: Instagram },
  { label: 'YouTube',   href: 'https://www.youtube.com/hashtag/cyba',                    icon: Youtube   },
  { label: 'Facebook',  href: 'https://www.facebook.com/people/Cybazone/61570841902450/', icon: Facebook  },
];

export function HelpButton({ dropUp = false, className }: { dropUp?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewAnon, setReviewAnon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactingSystem, setContactingSystem] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const handleContactUs = async () => {
    setOpen(false);
    if (!user) { router.push('/login?redirect=/contact'); return; }
    setContactingSystem(true);
    try {
      const sysSnap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '==', CYBAZONE_SYSTEM_USERNAME),
        limit(1),
      ));
      if (sysSnap.empty) { router.push('/contact'); return; }

      const sysDoc = sysSnap.docs[0];
      const sysData = sysDoc.data() as any;
      const key = [user.uid, sysDoc.id].sort().join('_');
      const existing = await getDocs(query(collection(firestore, 'conversations'), where('participantKey', '==', key)));
      if (!existing.empty) { router.push(`/messages/${existing.docs[0].id}`); return; }

      const mySnap = await getDoc(doc(firestore, 'users', user.uid));
      const myData = mySnap.data() as any;
      const convRef = await addDoc(collection(firestore, 'conversations'), {
        type: 'direct',
        participants: [user.uid, sysDoc.id],
        participantInfo: {
          [user.uid]: { username: myData?.username ?? 'Me', profilePictureUrl: myData?.profilePictureUrl ?? null, avatarConfig: myData?.avatarConfig ?? null },
          [sysDoc.id]: { username: sysData?.username ?? 'CYBAZONE', profilePictureUrl: sysData?.profilePictureUrl ?? null, avatarConfig: sysData?.avatarConfig ?? null },
        },
        participantKey: key,
        unreadCounts: { [user.uid]: 0, [sysDoc.id]: 0 },
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        lastMessageAt: serverTimestamp(),
        lastMessage: '',
        name: null,
      });
      router.push(`/messages/${convRef.id}`);
    } catch {
      toast({ variant: 'destructive', title: 'Could not open chat', description: 'Please try again.' });
      router.push('/contact');
    } finally {
      setContactingSystem(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSubmitReview = async () => {
    if (!user || !reviewText.trim()) return;
    setSubmitting(true);
    try {
      const mySnap = await getDoc(doc(firestore, 'users', user.uid));
      const myData = mySnap.data() as any;
      await addDoc(collection(firestore, 'reviews'), {
        userId: user.uid,
        username: reviewAnon ? null : (myData?.username ?? null),
        rating: reviewRating,
        text: reviewText.trim(),
        anonymous: reviewAnon,
        createdAt: serverTimestamp(),
      });
      toast({ title: '⭐ Review posted!', description: 'Your review is live on the feed.' });
      setShowReview(false);
      setReviewText('');
      setReviewRating(5);
      setReviewAnon(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to post review' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div ref={ref} className={cn('relative flex items-center', className)}>
        {/* Popup panel */}
        <div
          className={cn(
            'absolute z-50 w-52 flex flex-col gap-1 bg-black/90 backdrop-blur-md border border-purple-500/40 rounded-2xl p-3 shadow-[0_0_24px_rgba(139,92,246,0.25)] transition-all duration-200',
            dropUp
              ? 'bottom-full mb-2 left-0 origin-bottom-left'
              : 'top-full mt-2 right-0 origin-top-right',
            open
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-90 pointer-events-none',
          )}
        >
          {/* Write a Review — top of menu */}
          {user && (
            <button
              onClick={() => { setOpen(false); setShowReview(true); }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/80 hover:text-white hover:bg-yellow-600/20 transition-colors whitespace-nowrap w-full text-left"
            >
              <Star className="h-4 w-4 text-yellow-400 shrink-0" />
              Write a Review
            </button>
          )}

          {/* Divider */}
          <div className="h-px bg-purple-500/20 my-1" />

          {/* Contact Us — opens a DM with the CYBAZONE system account instead of a form */}
          <button
            onClick={handleContactUs}
            disabled={contactingSystem}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/80 hover:text-white hover:bg-purple-600/30 transition-colors whitespace-nowrap w-full text-left disabled:opacity-60"
          >
            {contactingSystem ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Mail className="h-4 w-4 text-purple-400 shrink-0" />}
            Contact Us
          </button>

          {/* Page links */}
          {HELP_LINKS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/80 hover:text-white hover:bg-purple-600/30 transition-colors whitespace-nowrap"
            >
              <Icon className="h-4 w-4 text-purple-400 shrink-0" />
              {label}
            </Link>
          ))}

          {/* Divider */}
          <div className="h-px bg-purple-500/20 my-1" />

          {/* Socials */}
          <div className="flex items-center justify-around px-1 py-1 gap-1">
            {SOCIALS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-white/60 hover:text-white hover:bg-purple-600/30 transition-colors"
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{label}</span>
              </a>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-purple-500/20 my-1" />

          {/* Developed by */}
          <a
            href="https://www.huxleigh.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-purple-600/20 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            developed by Huxleigh
          </a>
        </div>

        {/* Trigger button */}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close help menu' : 'Help & Info'}
          className="h-9 w-9 rounded-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white shadow-[0_0_16px_rgba(139,92,246,0.5)] flex items-center justify-center transition-all hover:scale-110"
        >
          {open ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
        </button>
      </div>

      {/* Review Dialog — rendered outside the relative container to avoid z-index issues */}
      <Dialog open={showReview} onOpenChange={v => setShowReview(v)}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400" />
              Write a Review
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            {/* Star rating */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setReviewRating(n)}
                    className="text-2xl transition-transform hover:scale-110"
                    style={{ color: n <= reviewRating ? '#fbbf24' : '#374151', textShadow: n <= reviewRating ? '0 0 8px rgba(251,191,36,0.5)' : 'none' }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            {/* Review text */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Review</label>
              <Textarea
                placeholder="Share your experience on CYBAZONE…"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                maxLength={300}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground text-right">{reviewText.length}/300</p>
            </div>
            {/* Anonymous toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Post Anonymously</p>
                <p className="text-xs text-muted-foreground">Your username won&apos;t be shown</p>
              </div>
              <Switch checked={reviewAnon} onCheckedChange={setReviewAnon} />
            </div>
          </div>
          <div className="px-5 pb-5">
            <Button
              className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white"
              disabled={!reviewText.trim() || submitting}
              onClick={handleSubmitReview}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
              Post Review to Feed
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

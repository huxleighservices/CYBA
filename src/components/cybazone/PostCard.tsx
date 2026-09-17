'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Trash2, Repeat, Loader2, Megaphone, Eye, UserPlus, Pencil, Send, Sparkles } from 'lucide-react';
import { PromoteDialog } from '@/components/PromoteDialog';
import { ShareToDMDialog } from '@/components/cybazone/ShareToDMDialog';
import { MentionTextarea } from '@/components/MentionTextarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useFirebase } from '@/firebase';
import {
  doc,
  arrayUnion,
  arrayRemove,
  increment,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { useDoc, useMemoFirebase } from '@/firebase';

import { formatDistanceToNow } from 'date-fns';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { createNotification } from '@/lib/notifications';
import { CommentSheet } from './CommentSheet';
import { LevelBadge } from '@/components/LevelBadge';
import { type Level, computeLevel } from '@/lib/levels';
import { sharePulseFromMedia } from '@/lib/pulses';
import { requestSubnetAccess } from '@/lib/subnets';
import { applyGearMultiplier } from '@/lib/avatar-gear';
import { getCCForEngagement, mergeWithDefaults, type CCRates, CYBAZONE_ENGAGEMENT_MULTIPLIER, isCybazoneAccount } from '@/lib/cc-rewards';
import { logTransaction } from '@/lib/transactions';
import { logEngagement } from '@/lib/engagement-log';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export type CybazonePost = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatar?: AvatarConfig;
  authorProfilePictureUrl?: string;
  authorLevel?: Level;
  authorPayoutEnrolled?: boolean;
  authorSpotlightBoost?: boolean;
  authorIsCurator?: boolean;
  content: string;
  imageUrl?: string;
  mediaType?: 'image' | 'video' | null;
  /** Extra media beyond the first item — imageUrl/mediaType above always mirror mediaItems[0]
   *  for backward compatibility with older cards/consumers that only read the single-media fields. */
  mediaItems?: { url: string; type: 'image' | 'video' }[];
  timestamp: any; // Firestore Timestamp
  likeCount: number;
  likedBy: string[];
  commentCount: number;
  repostCount: number;
  repostedBy: string[];
  hashtags?: string[];
  viewCount?: number;
  trimStart?: number;
  trimEnd?: number;
  thumbnailUrl?: string;
  subnetOnly?: boolean;
};

type ViewerProfile = { username?: string; profilePictureUrl?: string; postCount?: number; supportGiven?: number; following?: string[]; levelOverride?: string; equippedGear?: string[] };

export function PostCard({
  post,
  viewerProfile: viewerProfileProp,
  ccRates: ccRatesProp,
  subnetAccessOwnerIds,
}: {
  post: CybazonePost;
  /** Pass this from the parent feed when rendering many cards at once (e.g. the main feed)
   *  to avoid every card opening its own duplicate listener for the same viewer doc. Falls
   *  back to self-fetching when omitted, so standalone usages (single-post modal, profile
   *  grids, search results) keep working unchanged. */
  viewerProfile?: ViewerProfile | null;
  /** Same dedup story as viewerProfile, for the global ccRates settings doc. */
  ccRates?: CCRates | null;
  /** Owner IDs of Subnets the viewer currently has active (paid) access to — omit this prop
   *  entirely on surfaces that never render subnetOnly posts (e.g. a single already-unlocked
   *  post view) to skip the gating check. */
  subnetAccessOwnerIds?: Set<string>;
}) {
  const { user, firestore } = useFirebase();

  // Only self-fetch if the parent didn't already provide it.
  const actorDocRef = useMemoFirebase(
    () => (!viewerProfileProp && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user, viewerProfileProp],
  );
  const { data: fetchedActorProfile } = useDoc<ViewerProfile>(actorDocRef);
  const actorProfile = viewerProfileProp ?? fetchedActorProfile;

  const ccRatesRef = useMemoFirebase(
    () => (ccRatesProp ? null : doc(firestore, 'settings', 'ccRates')),
    [firestore, ccRatesProp]
  );
  const { data: ccRatesRaw } = useDoc<Partial<CCRates>>(ccRatesRef);
  const ccRates = ccRatesProp ?? (ccRatesRaw ? mergeWithDefaults(ccRatesRaw) : null);
  const actorUsername = actorProfile?.username ?? user?.displayName ?? user?.email?.split('@')[0] ?? '';
  const actorProfilePictureUrl = actorProfile?.profilePictureUrl ?? null;

  // Denormalized onto the post at creation time (same pattern as authorPayoutEnrolled) —
  // avoids every card opening a live listener on its author's doc just for a cosmetic glow.
  // Posts created before this field existed simply won't show the glow until re-posted.
  const hasSpotlightBoost = post.authorSpotlightBoost === true;
  const isCurator = post.authorIsCurator === true;
  const { toast } = useToast();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSharingPulse, setIsSharingPulse] = useState(false);
  const [isRequestingSubnet, setIsRequestingSubnet] = useState(false);
  const [subnetRequested, setSubnetRequested] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Guards the view-count increment to once per card mount — the observer below re-fires on
  // every scroll in/out (no "once" flag), so a naive increment would overcount.
  const hasCountedView = useRef(false);

  useEffect(() => {
    if (post.mediaType !== 'video' || !videoRef.current) return;
    const el = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (post.trimStart) el.currentTime = post.trimStart;
          el.play().catch(() => {});
          if (!hasCountedView.current) {
            hasCountedView.current = true;
            updateDoc(doc(firestore, 'cybazone_posts', post.id), { viewCount: increment(1) }).catch(() => {});
          }
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.mediaType]);

  // Loop back to trimStart once playback reaches trimEnd — native #t=start,end media-fragment
  // URLs don't reliably loop past `end` in all browsers, and the uploaded file itself is never
  // re-encoded, so this is enforced purely at playback time.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || post.trimEnd == null) return;
    const onTimeUpdate = () => {
      if (el.currentTime >= post.trimEnd!) el.currentTime = post.trimStart ?? 0;
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [post.trimStart, post.trimEnd]);

  const hasLiked = user ? post.likedBy?.includes(user.uid) : false;
  const hasReposted = user ? post.repostedBy?.includes(user.uid) : false;
  const isFollowingAuthor = actorProfile?.following?.includes(post.authorId) ?? false;
  const [isFollowMutating, setIsFollowMutating] = useState(false);

  const handleFollowToggle = async () => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be logged in to follow other CYBAs.',
        action: (
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        ),
      });
      return;
    }
    setIsFollowMutating(true);
    try {
      const currentUserRef = doc(firestore, 'users', user.uid);
      const targetUserRef = doc(firestore, 'users', post.authorId);
      if (isFollowingAuthor) {
        await Promise.all([
          updateDoc(currentUserRef, { following: arrayRemove(post.authorId) }),
          updateDoc(targetUserRef, { followers: arrayRemove(user.uid) }),
        ]);
      } else {
        await Promise.all([
          updateDoc(currentUserRef, { following: arrayUnion(post.authorId) }),
          updateDoc(targetUserRef, { followers: arrayUnion(user.uid) }),
        ]);
        createNotification(firestore, post.authorId, {
          type: 'follow',
          actorId: user.uid,
          actorUsername: actorUsername ?? user.displayName ?? 'Someone',
          actorProfilePictureUrl: actorProfilePictureUrl ?? null,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFollowMutating(false);
    }
  };

  const handleLike = () => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be logged in to interact with posts.',
        action: (
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        ),
      });
      return;
    }

    const postRef = doc(firestore, 'cybazone_posts', post.id);

    const isOthersPost = post.authorId !== user.uid;
    const userRef = doc(firestore, 'users', user.uid);

    if (hasLiked) {
      updateDoc(postRef, {
        likedBy: arrayRemove(user.uid),
        likeCount: increment(-1),
      }).catch((err) => {
        console.error('Error unliking post:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update like status.' });
      });
      if (isOthersPost) updateDoc(userRef, { supportGiven: increment(-1), weeklySupportGiven: increment(-1) }).catch(() => {});
    } else {
      updateDoc(postRef, {
        likedBy: arrayUnion(user.uid),
        likeCount: increment(1),
      }).catch((err) => {
        console.error('Error liking post:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update like status.' });
      });
      if (isOthersPost) {
        const level = computeLevel(actorProfile?.postCount, actorProfile?.supportGiven, undefined, actorProfile?.levelOverride);
        const cc = applyGearMultiplier(getCCForEngagement('like', level, ccRates), actorProfile?.equippedGear, 'like')
          * (isCybazoneAccount(post.authorUsername) ? CYBAZONE_ENGAGEMENT_MULTIPLIER : 1);
        updateDoc(userRef, { supportGiven: increment(1), weeklySupportGiven: increment(1), cybaCoinBalance: increment(cc) }).catch(() => {});
        logTransaction(firestore, user.uid, { type: 'engagement_reward', amount: cc, description: '❤️ Like' });
        createNotification(firestore, post.authorId, {
          type: 'like',
          actorId: user.uid,
          actorUsername: actorUsername ?? user.displayName ?? 'Someone',
          actorProfilePictureUrl: actorProfilePictureUrl ?? null,
          postId: post.id,
          postSnippet: post.content.slice(0, 80),
        });
        logEngagement(user.uid, post.authorId, 'like', post.id);
      }
    }
  };

  const handleRepost = () => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be logged in to interact with posts.',
        action: (
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        ),
      });
      return;
    }

    const postRef = doc(firestore, 'cybazone_posts', post.id);
    const isOthersPost = post.authorId !== user.uid;
    const userRef = doc(firestore, 'users', user.uid);

    if (hasReposted) {
      updateDoc(postRef, {
        repostedBy: arrayRemove(user.uid),
        repostCount: increment(-1),
      }).catch((err) => {
        console.error('Error unreposting post:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update repost status.' });
      });
      if (isOthersPost) updateDoc(userRef, { supportGiven: increment(-1), weeklySupportGiven: increment(-1) }).catch(() => {});
    } else {
      updateDoc(postRef, {
        repostedBy: arrayUnion(user.uid),
        repostCount: increment(1),
      }).catch((err) => {
        console.error('Error reposting post:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update repost status.' });
      });
      if (isOthersPost) {
        const level = computeLevel(actorProfile?.postCount, actorProfile?.supportGiven, undefined, actorProfile?.levelOverride);
        const cc = applyGearMultiplier(getCCForEngagement('share', level, ccRates), actorProfile?.equippedGear, 'share')
          * (isCybazoneAccount(post.authorUsername) ? CYBAZONE_ENGAGEMENT_MULTIPLIER : 1);
        updateDoc(userRef, { supportGiven: increment(1), weeklySupportGiven: increment(1), cybaCoinBalance: increment(cc) }).catch(() => {});
        logTransaction(firestore, user.uid, { type: 'engagement_reward', amount: cc, description: '🔁 Share' });
        createNotification(firestore, post.authorId, {
          type: 'repost',
          actorId: user.uid,
          actorUsername: actorUsername ?? user.displayName ?? 'Someone',
          actorProfilePictureUrl: actorProfilePictureUrl ?? null,
          postId: post.id,
          postSnippet: post.content.slice(0, 80),
        });
        logEngagement(user.uid, post.authorId, 'repost', post.id);
      }
    }
  };

  const handleShareToPulse = async () => {
    if (!user || !actorUsername || !post.imageUrl || !post.mediaType || isSharingPulse) return;
    setIsSharingPulse(true);
    try {
      const level = computeLevel(actorProfile?.postCount, actorProfile?.supportGiven, undefined, actorProfile?.levelOverride);
      const { cc } = await sharePulseFromMedia(firestore, {
        userId: user.uid,
        username: actorUsername,
        profilePictureUrl: actorProfilePictureUrl,
        avatarConfig: null,
        mediaUrl: post.imageUrl,
        mediaType: post.mediaType,
        level,
        ccRates,
      });
      toast({ title: '✨ Shared to your Pulse!', description: `Visible to your followers for 24 hours. +${cc.toLocaleString()} CC` });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to share to Pulse' });
    } finally {
      setIsSharingPulse(false);
    }
  };

  const handleDelete = async () => {
    if (!user || user.uid !== post.authorId || isDeleting) return;

    setIsDeleting(true);
    try {
      const postRef = doc(firestore, 'cybazone_posts', post.id);
      const commentsRef = collection(
        firestore,
        'cybazone_posts',
        post.id,
        'comments'
      );

      const commentsSnapshot = await getDocs(commentsRef);
      const batch = writeBatch(firestore);
      commentsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      batch.delete(postRef);

      await batch.commit();

      toast({ title: 'Post Deleted Successfully' });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description:
          'Could not delete the post. Please check your permissions or try again later.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!user || user.uid !== post.authorId || !editContent.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(firestore, 'cybazone_posts', post.id), { content: editContent.trim(), editedAt: serverTimestamp() });
      toast({ title: 'Post updated' });
      setIsEditOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not save changes' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formattedDate = post.timestamp?.toDate
    ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true })
    : 'just now';

  // Fails closed: any subnetOnly post is treated as locked for a non-owner unless the caller
  // explicitly proved access via subnetAccessOwnerIds.
  const isLocked = !!post.subnetOnly && user?.uid !== post.authorId && !subnetAccessOwnerIds?.has(post.authorId);

  const handleRequestSubnetAccess = async () => {
    if (!user || !actorUsername || isRequestingSubnet) return;
    setIsRequestingSubnet(true);
    try {
      await requestSubnetAccess(firestore, {
        ownerId: post.authorId,
        ownerUsername: post.authorUsername,
        memberId: user.uid,
        memberUsername: actorUsername,
      });
      setSubnetRequested(true);
      toast({ title: 'Request sent!', description: `${post.authorUsername} will be notified.` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not send request' });
    } finally {
      setIsRequestingSubnet(false);
    }
  };

  return (
    <>
      {(hasSpotlightBoost || isCurator) && (
        <style>{`
          @keyframes spotlight-ring-spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes spotlight-label-pulse {
            0%, 100% { opacity: 0.7; }
            50%       { opacity: 1; }
          }
          .spotlight-glow-ring { animation: spotlight-ring-spin 5s linear infinite; }
          .spotlight-label-pulse { animation: spotlight-label-pulse 2s ease-in-out infinite; }
          @keyframes curator-glow-pulse {
            0%, 100% { box-shadow: 0 0 18px rgba(34,197,94,0.55), 0 0 40px rgba(22,163,74,0.25); }
            50%       { box-shadow: 0 0 28px rgba(34,197,94,0.85), 0 0 60px rgba(22,163,74,0.4); }
          }
          .curator-glow { animation: curator-glow-pulse 3s ease-in-out infinite; border-color: rgba(34,197,94,0.6) !important; }
        `}</style>
      )}
      <div className="relative w-full h-full">
        {hasSpotlightBoost && !isCurator && (
          <>
            {/* Spinning gradient border ring — same treatment as the Spotlight Boost subscription
                uses everywhere else it renders a glow (unified per the CYBAZONE style guide). */}
            <div className="absolute -inset-[2px] rounded-2xl overflow-hidden z-0 pointer-events-none">
              <div
                className="spotlight-glow-ring absolute inset-[-100%]"
                style={{ background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed, #3b82f6, #7c3aed)' }}
              />
            </div>
            <div
              className="absolute -inset-[3px] rounded-2xl pointer-events-none spotlight-label-pulse"
              style={{ boxShadow: '0 0 30px rgba(139,92,246,0.5), 0 0 60px rgba(139,92,246,0.2)' }}
            />
            <div className="absolute -top-3 left-4 z-20">
              <span
                className="spotlight-label-pulse inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[9px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full shadow-lg"
                style={{ boxShadow: '0 0 12px rgba(139,92,246,0.8)' }}
              >
                <span className="text-yellow-300">★</span>
                SPOTLIGHT
              </span>
            </div>
          </>
        )}
      <Card className={`relative z-10 w-full h-full flex flex-col${hasSpotlightBoost && !isCurator ? ' mt-2 border-purple-500/40 bg-card/50' : ' border-primary/20 bg-card/50'}${isCurator ? ' curator-glow border-green-500/60 bg-gradient-to-b from-green-950/30 via-card/80 to-card/60' : ''}`}>
        {post.authorLevel && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <LevelBadge level={post.authorLevel} />
          </div>
        )}
        {isCurator && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
            <span className="inline-flex items-center gap-1 bg-green-600/20 border border-green-500/50 text-green-300 text-[10px] font-black tracking-widest uppercase rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Curator
            </span>
          </div>
        )}
        <CardHeader className="flex flex-row items-center gap-4 p-4">
          <Link href={`/u/${post.authorUsername}`}>
            <AvatarDisplay
              avatarConfig={post.authorAvatar}
              profilePictureUrl={post.authorProfilePictureUrl}
              size={48}
              level={post.authorLevel}
            />
          </Link>
          <div className="flex flex-col">
            <Link href={`/u/${post.authorUsername}`} className="hover:underline">
              <p className="font-bold flex items-center gap-1">
                {post.authorUsername}
                {post.authorPayoutEnrolled && (
                  <span title="Payout Boost Member" className="text-base leading-none">🏦</span>
                )}
              </p>
            </Link>
            <p className="text-xs text-foreground/60">{formattedDate}</p>
          </div>
          {user && user.uid !== post.authorId && !isFollowingAuthor && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
              onClick={handleFollowToggle}
              disabled={isFollowMutating}
            >
              {isFollowMutating ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              Follow
            </Button>
          )}
          {user && user.uid === post.authorId && (
            <div className="ml-auto flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={() => { setEditContent(post.content); setIsEditOpen(true); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      your post and all associated comments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardHeader>
        {isLocked ? (
          <CardContent className="p-4 pt-0 flex-grow">
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary/30 bg-card/30 py-10 px-4 text-center opacity-90">
              <span className="text-3xl">🔒</span>
              <p className="text-sm font-semibold">Subnet Only</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                This post is exclusive to @{post.authorUsername}'s Subnet members.
              </p>
              {user && (
                <Button
                  size="sm"
                  disabled={isRequestingSubnet || subnetRequested}
                  onClick={handleRequestSubnetAccess}
                >
                  {isRequestingSubnet ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  {subnetRequested ? 'Request Sent' : 'Request Access'}
                </Button>
              )}
            </div>
          </CardContent>
        ) : (
        <CardContent className="p-4 pt-0 space-y-4 flex-grow">
          <p className="text-base text-foreground/90 whitespace-pre-wrap">
            {post.content.split(/(https?:\/\/[^\s]+|#[\w]+|@[\w]+)/g).map((part, i) => {
               if (part.startsWith('#')) {
                 return <Link key={i} href={`/search?q=${encodeURIComponent(part)}`} className="text-primary font-semibold hover:underline drop-shadow-sm">{part}</Link>;
               }
               if (part.startsWith('@')) {
                 return <Link key={i} href={`/u/${part.slice(1)}`} className="text-cyan-400 font-semibold hover:underline">{part}</Link>;
               }
               if (part.startsWith('http')) {
                 return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
               }
               return <span key={i}>{part}</span>;
            })}
          </p>
          {post.mediaItems && post.mediaItems.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory rounded-lg -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
              {post.mediaItems.map((item, i) => (
                <div key={i} className="relative shrink-0 w-[85%] aspect-square snap-center rounded-lg overflow-hidden border bg-black">
                  {item.type === 'video' ? (
                    <video src={item.url} className="w-full h-full object-contain" controls muted preload="metadata" playsInline loop />
                  ) : (
                    <Image src={item.url} alt={`Post image ${i + 1}`} fill className="object-cover" />
                  )}
                  <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/90">
                    {i + 1}/{post.mediaItems!.length}
                  </span>
                </div>
              ))}
            </div>
          ) : post.imageUrl && (
            (post.mediaType === 'video' || (!post.mediaType && /\.(mp4|webm|mov)/i.test(post.imageUrl))) ? (
              <div className="relative rounded-lg overflow-hidden border bg-black">
                <video
                  ref={videoRef}
                  src={post.imageUrl}
                  poster={post.thumbnailUrl}
                  className="w-full max-h-[480px] object-contain"
                  controls
                  muted
                  preload="metadata"
                  playsInline
                  loop
                />
                {(post.viewCount ?? 0) > 0 && (
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/90">
                    <Eye className="h-3 w-3" /> {post.viewCount!.toLocaleString()}
                  </span>
                )}
              </div>
            ) : (
              <div className="relative aspect-square rounded-lg overflow-hidden border">
                <Image
                  src={post.imageUrl}
                  alt="Post image"
                  fill
                  className="object-cover"
                />
              </div>
            )
          )}
        </CardContent>
        )}
        {!isLocked && (
        <CardFooter className="flex justify-between items-center px-4 py-1 border-t border-border">
          <div className="flex items-center gap-1 text-foreground/80">
            <button
              type="button"
              onClick={handleLike}
              className="flex items-center gap-2 rounded-lg px-3 min-h-[48px] hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation select-none"
            >
              <Heart
                className={hasLiked ? 'fill-primary text-primary h-5 w-5' : 'text-foreground/60 h-5 w-5'}
              />
              <span className="font-semibold text-sm min-w-[1ch]">
                {post.likeCount > 0 ? post.likeCount : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsCommentsOpen(true)}
              className="flex items-center gap-2 rounded-lg px-3 min-h-[48px] hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation select-none"
            >
              <MessageCircle className="text-foreground/60 h-5 w-5" />
              <span className="font-semibold text-sm min-w-[1ch]">
                {post.commentCount > 0 ? post.commentCount : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={handleRepost}
              className="flex items-center gap-2 rounded-lg px-3 min-h-[48px] hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation select-none"
            >
              <Repeat
                className={hasReposted ? 'text-primary h-5 w-5' : 'text-foreground/60 h-5 w-5'}
              />
              <span className="font-semibold text-sm min-w-[1ch]">
                {post.repostCount > 0 ? post.repostCount : ''}
              </span>
            </button>

            {user && (
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                title="Share to DM"
                className="flex items-center gap-2 rounded-lg px-3 min-h-[48px] hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation select-none"
              >
                <Send className="text-foreground/60 h-5 w-5" />
              </button>
            )}

            {user && post.imageUrl && post.mediaType && (
              <button
                type="button"
                onClick={handleShareToPulse}
                disabled={isSharingPulse}
                title="Share to Pulse"
                className="flex items-center gap-2 rounded-lg px-3 min-h-[48px] hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation select-none disabled:opacity-50"
              >
                {isSharingPulse ? <Loader2 className="h-5 w-5 animate-spin text-foreground/60" /> : <Sparkles className="text-foreground/60 h-5 w-5" />}
              </button>
            )}
          </div>

          {/* Promote — bottom-right, labeled like IG's "Boost Post" so it reads as a distinct action */}
          {user && user.uid === post.authorId && post.imageUrl && (
            <button
              type="button"
              onClick={() => setIsPromoteOpen(true)}
              title="Promote this post"
              className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 min-h-[36px] border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors touch-manipulation select-none shrink-0"
            >
              <Megaphone className="h-4 w-4" />
              <span className="font-semibold text-xs">Promote</span>
            </button>
          )}
        </CardFooter>
        )}

        {!isLocked && post.imageUrl && post.mediaType && (
          <PromoteDialog
            open={isPromoteOpen}
            onOpenChange={setIsPromoteOpen}
            mediaUrl={post.imageUrl}
            mediaType={post.mediaType}
          />
        )}
      </Card>
      </div>
      <CommentSheet
        open={isCommentsOpen}
        onOpenChange={setIsCommentsOpen}
        postId={post.id}
        postAuthorId={post.authorId}
        postAuthorUsername={post.authorUsername}
      />
      <ShareToDMDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        content={{
          kind: 'post',
          postId: post.id,
          authorUsername: post.authorUsername,
          authorProfilePictureUrl: post.authorProfilePictureUrl,
          contentSnippet: post.content,
          imageUrl: post.imageUrl,
          mediaType: post.mediaType,
        }}
      />
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <MentionTextarea
            value={editContent}
            onChange={setEditContent}
            placeholder="What's on your mind?"
            minHeight={120}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || !editContent.trim()}>
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

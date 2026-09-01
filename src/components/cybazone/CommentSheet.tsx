'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  useFirebase,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  useDoc,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  increment,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Heart, Reply, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notifications';
import { computeLevel } from '@/lib/levels';
import { getCCForEngagement, mergeWithDefaults, type CCRates } from '@/lib/cc-rewards';
import { logTransaction } from '@/lib/transactions';
import { logEngagement } from '@/lib/engagement-log';
import { MentionTextarea, extractMentions } from '@/components/MentionTextarea';
import { getDocs, query as fsQuery, collection as fsCollection, where as fsWhere } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type Comment = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatar?: AvatarConfig;
  authorProfilePictureUrl?: string;
  content: string;
  timestamp: any;
  likedBy?: string[];
  likeCount?: number;
  parentCommentId?: string | null;
};

type ReplyTarget = { id: string; authorUsername: string };

type UserProfile = {
    username: string;
    avatarConfig?: AvatarConfig;
    profilePictureUrl?: string;
    postCount?: number;
    supportGiven?: number;
};

function CommentForm({
  postId,
  postAuthorId,
  replyingTo,
  onCancelReply,
}: {
  postId: string;
  postAuthorId: string;
  replyingTo: ReplyTarget | null;
  onCancelReply: () => void;
}) {
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill the @mention when a reply target is picked, without clobbering anything the user
  // already typed for a previous reply.
  useEffect(() => {
    if (replyingTo) setContent(`@${replyingTo.authorUsername} `);
  }, [replyingTo]);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const ccRatesRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'ccRates'),
    [firestore]
  );
  const { data: ccRatesRaw } = useDoc<Partial<CCRates>>(ccRatesRef);
  const ccRates = ccRatesRaw ? mergeWithDefaults(ccRatesRaw) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user || !userProfile) return;

    setIsSubmitting(true);
    const commentsColRef = collection(firestore, 'cybazone_posts', postId, 'comments');
    const postRef = doc(firestore, 'cybazone_posts', postId);

    try {
      addDocumentNonBlocking(commentsColRef, {
        postId: postId,
        authorId: user.uid,
        authorUsername: userProfile.username,
        authorAvatar: userProfile.avatarConfig || {},
        authorProfilePictureUrl: userProfile.profilePictureUrl || null,
        content: content.trim(),
        timestamp: serverTimestamp(),
        likedBy: [],
        likeCount: 0,
        parentCommentId: replyingTo?.id ?? null,
      });

      // Increment comment count on the post
      await updateDoc(postRef, {
        commentCount: increment(1),
      });

      // Track outward support + award CC (only when commenting on others' posts)
      if (user.uid !== postAuthorId) {
        const level = computeLevel(userProfile?.postCount, userProfile?.supportGiven);
        const cc = getCCForEngagement('comment', level, ccRates);
        updateDoc(doc(firestore, 'users', user.uid), { supportGiven: increment(1), cybaCoinBalance: increment(cc) }).catch(() => {});
        logTransaction(firestore, user.uid, { type: 'engagement_reward', amount: cc, description: '💬 Comment' });
        createNotification(firestore, postAuthorId, {
          type: 'comment',
          actorId: user.uid,
          actorUsername: userProfile.username,
          actorProfilePictureUrl: userProfile.profilePictureUrl ?? null,
          postId: postId,
          commentContent: content.trim().slice(0, 100),
        });
        logEngagement(user.uid, postAuthorId, 'comment', postId);
      }

      // Fire mention notifications
      const mentions = extractMentions(content.trim());
      if (mentions.length) {
        const snap = await getDocs(fsQuery(
          fsCollection(firestore, 'users'),
          fsWhere('username_lowercase', 'in', mentions.slice(0, 10)),
        ));
        snap.docs.forEach(d => {
          if (d.id === user.uid || d.id === postAuthorId) return; // skip self + already notified
          createNotification(firestore, d.id, {
            type: 'mention',
            actorId: user.uid,
            actorUsername: userProfile.username,
            actorProfilePictureUrl: userProfile.profilePictureUrl ?? null,
            postId: postId,
            commentContent: content.trim().slice(0, 100),
          });
        });
      }

      setContent('');
      onCancelReply();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not post your comment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isProfileLoading) return <Loader2 className="animate-spin" />;

  if (!user) {
    return (
        <div className="p-4 text-center text-sm border-t">
            <Link href="/login" className="text-primary underline">Sign in</Link> to comment.
        </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t p-4">
      {replyingTo && (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-md px-2 py-1">
          <span>Replying to <strong>{replyingTo.authorUsername}</strong></span>
          <button type="button" onClick={onCancelReply} className="hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-start gap-2">
      <AvatarDisplay avatarConfig={userProfile?.avatarConfig} profilePictureUrl={userProfile?.profilePictureUrl} size={32} />
      <div className="flex-1 min-w-0">
        <MentionTextarea
          value={content}
          onChange={setContent}
          placeholder="Add a comment… use @ to mention"
          disabled={isSubmitting}
          minHeight={40}
          className="text-sm"
        />
      </div>
      <Button type="submit" size="icon" className="shrink-0 mt-0.5" disabled={!content.trim() || isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
      </Button>
      </div>
    </form>
  );
}

function CommentItem({
  postId,
  comment,
  replies,
  onReply,
}: {
  postId: string;
  comment: Comment;
  replies: Comment[];
  onReply: (target: ReplyTarget) => void;
}) {
  const { firestore, user } = useFirebase();
  const formattedDate = comment.timestamp?.toDate
    ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true })
    : 'just now';

  const hasLiked = user ? (comment.likedBy ?? []).includes(user.uid) : false;

  // Comment likes are a plain toggle — no CC/notification. Post likes are capped at one grant
  // per liker per post; comments have no equivalent cap (a user can post throwaway comments
  // indefinitely), so rewarding these would be trivially farmable between two colluding accounts.
  const handleToggleLike = () => {
    if (!user) return;
    const commentRef = doc(firestore, 'cybazone_posts', postId, 'comments', comment.id);
    if (hasLiked) {
      updateDoc(commentRef, { likedBy: arrayRemove(user.uid), likeCount: increment(-1) }).catch(() => {});
    } else {
      updateDoc(commentRef, { likedBy: arrayUnion(user.uid), likeCount: increment(1) }).catch(() => {});
    }
  };

  return (
    <div className="p-4">
      <div className="flex gap-3">
        <AvatarDisplay avatarConfig={comment.authorAvatar} profilePictureUrl={comment.authorProfilePictureUrl} size={32} />
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{comment.authorUsername}</span>
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">
            {comment.content.split(/(#[\w]+|@[\w]+)/g).map((part, i) => {
              if (part.startsWith('#')) return <Link key={i} href={`/search?q=${encodeURIComponent(part)}`} className="text-primary font-semibold hover:underline">{part}</Link>;
              if (part.startsWith('@')) return <Link key={i} href={`/u/${part.slice(1)}`} className="text-cyan-400 font-semibold hover:underline">{part}</Link>;
              return <span key={i}>{part}</span>;
            })}
          </p>
          <div className="flex items-center gap-4 mt-1">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={!user}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Heart className={cn('h-3.5 w-3.5', hasLiked && 'fill-primary text-primary')} />
              {(comment.likeCount ?? 0) > 0 && <span>{comment.likeCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => onReply({ id: comment.id, authorUsername: comment.authorUsername })}
              disabled={!user}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Reply className="h-3.5 w-3.5" /> Reply
            </button>
          </div>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-11 mt-2 space-y-3 border-l-2 border-border/50 pl-3">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-2.5">
              <AvatarDisplay avatarConfig={reply.authorAvatar} profilePictureUrl={reply.authorProfilePictureUrl} size={24} />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs">{reply.authorUsername}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {reply.timestamp?.toDate ? formatDistanceToNow(reply.timestamp.toDate(), { addSuffix: true }) : 'just now'}
                  </span>
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap">
                  {reply.content.split(/(#[\w]+|@[\w]+)/g).map((part, i) => {
                    if (part.startsWith('#')) return <Link key={i} href={`/search?q=${encodeURIComponent(part)}`} className="text-primary font-semibold hover:underline">{part}</Link>;
                    if (part.startsWith('@')) return <Link key={i} href={`/u/${part.slice(1)}`} className="text-cyan-400 font-semibold hover:underline">{part}</Link>;
                    return <span key={i}>{part}</span>;
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSheet({
  open,
  onOpenChange,
  postId,
  postAuthorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postAuthorId: string;
}) {
  const { firestore } = useFirebase();

  // Gated on `open` — this listener was previously always active as soon as a postId was
  // passed in, meaning every post card in a feed streamed its full comment list live even
  // while its sheet was closed. Also capped with a limit as a defensive ceiling.
  const commentsQuery = useMemoFirebase(
    () =>
      open && postId
        ? query(
            collection(firestore, 'cybazone_posts', postId, 'comments'),
            orderBy('timestamp', 'desc'),
            limit(200)
          )
        : null,
    [firestore, postId, open]
  );
  const { data: comments, isLoading } = useCollection<Comment>(commentsQuery);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);

  // Group the already-fetched flat comment list into top-level comments + their replies —
  // no separate Firestore query needed for threading.
  const topLevel = (comments ?? []).filter(c => !c.parentCommentId);
  const repliesByParent = new Map<string, Comment[]>();
  (comments ?? []).forEach(c => {
    if (!c.parentCommentId) return;
    const list = repliesByParent.get(c.parentCommentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentCommentId, list);
  });
  // Replies were fetched newest-first same as everything else — flip to chronological within a thread.
  repliesByParent.forEach(list => list.reverse());

  // modal={false}: this Sheet can be opened from within another Dialog (e.g. a post opened
  // from a notification) — two nested Radix modal instances fight over the shared body
  // scroll-lock/pointer-events state and can leave the page unresponsive.
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent className="flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow">
            {isLoading && (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="animate-spin" />
                </div>
            )}
            {!isLoading && topLevel.length === 0 && (
                <div className="text-center text-muted-foreground p-8">
                    <p>No comments yet.</p>
                    <p className="text-sm">Be the first to reply!</p>
                </div>
            )}
            {topLevel.map((comment) => (
                <CommentItem
                  key={comment.id}
                  postId={postId}
                  comment={comment}
                  replies={repliesByParent.get(comment.id) ?? []}
                  onReply={setReplyingTo}
                />
            ))}
        </ScrollArea>
        <SheetFooter className="p-0">
            <CommentForm
              postId={postId}
              postAuthorId={postAuthorId}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

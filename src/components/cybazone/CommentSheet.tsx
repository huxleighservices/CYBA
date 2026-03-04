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
  serverTimestamp,
  doc,
  increment,
  updateDoc,
} from 'firebase/firestore';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type Comment = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatar?: AvatarConfig;
  content: string;
  timestamp: any;
};

type UserProfile = {
    username: string;
    avatarConfig?: AvatarConfig;
};

function CommentForm({ postId }: { postId: string }) {
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

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
        content: content.trim(),
        timestamp: serverTimestamp(),
      });

      // Increment comment count on the post
      await updateDoc(postRef, {
        commentCount: increment(1),
      });

      setContent('');
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-4">
      <AvatarDisplay avatarConfig={userProfile?.avatarConfig} size={32} />
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        disabled={isSubmitting}
      />
      <Button type="submit" size="icon" disabled={!content.trim() || isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
      </Button>
    </form>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  const formattedDate = comment.timestamp?.toDate
    ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true })
    : 'just now';

  return (
    <div className="flex gap-3 p-4">
      <AvatarDisplay avatarConfig={comment.authorAvatar} size={32} />
      <div className="flex-grow">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{comment.authorUsername}</span>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
        <p className="text-sm text-foreground/90">{comment.content}</p>
      </div>
    </div>
  );
}

export function CommentSheet({
  open,
  onOpenChange,
  postId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}) {
  const { firestore } = useFirebase();

  const commentsQuery = useMemoFirebase(
    () =>
      postId
        ? query(
            collection(firestore, 'cybazone_posts', postId, 'comments'),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, postId]
  );
  const { data: comments, isLoading } = useCollection<Comment>(commentsQuery);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            {!isLoading && comments?.length === 0 && (
                <div className="text-center text-muted-foreground p-8">
                    <p>No comments yet.</p>
                    <p className="text-sm">Be the first to reply!</p>
                </div>
            )}
            {comments && comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
            ))}
        </ScrollArea>
        <SheetFooter className="p-0">
            <CommentForm postId={postId} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

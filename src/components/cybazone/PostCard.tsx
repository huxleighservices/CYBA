'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Trash2, Repeat, Loader2 } from 'lucide-react';
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
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { CommentSheet } from './CommentSheet';
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
  content: string;
  imageUrl?: string;
  timestamp: any; // Firestore Timestamp
  likeCount: number;
  likedBy: string[];
  commentCount: number;
  repostCount: number;
  repostedBy: string[];
};

export function PostCard({ post }: { post: CybazonePost }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasLiked = user ? post.likedBy?.includes(user.uid) : false;
  const hasReposted = user ? post.repostedBy?.includes(user.uid) : false;

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

    if (hasLiked) {
      updateDoc(postRef, {
        likedBy: arrayRemove(user.uid),
        likeCount: increment(-1),
      }).catch((err) => {
        console.error('Error unliking post:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not update like status.',
        });
      });
    } else {
      updateDoc(postRef, {
        likedBy: arrayUnion(user.uid),
        likeCount: increment(1),
      }).catch((err) => {
        console.error('Error liking post:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not update like status.',
        });
      });
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

    if (hasReposted) {
      updateDoc(postRef, {
        repostedBy: arrayRemove(user.uid),
        repostCount: increment(-1),
      }).catch((err) => {
        console.error('Error unreposting post:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not update repost status.',
        });
      });
    } else {
      updateDoc(postRef, {
        repostedBy: arrayUnion(user.uid),
        repostCount: increment(1),
      }).catch((err) => {
        console.error('Error reposting post:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not update repost status.',
        });
      });
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

  const formattedDate = post.timestamp?.toDate
    ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true })
    : 'just now';

  return (
    <>
      <Card className="w-full h-full flex flex-col border-primary/20 bg-card/50">
        <CardHeader className="flex flex-row items-center gap-4 p-4">
          <Link href={`/u/${post.authorUsername}`}>
            <AvatarDisplay avatarConfig={post.authorAvatar} size={48} />
          </Link>
          <div className="flex flex-col">
            <Link href={`/u/${post.authorUsername}`} className="hover:underline">
              <p className="font-bold">{post.authorUsername}</p>
            </Link>
            <p className="text-xs text-foreground/60">{formattedDate}</p>
          </div>
          {user && user.uid === post.authorId && (
            <div className="ml-auto">
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
        <CardContent className="p-4 pt-0 space-y-4 flex-grow">
          <p className="text-base text-foreground/90 whitespace-pre-wrap">
            {post.content}
          </p>
          {post.imageUrl && (
            <div className="relative aspect-video rounded-lg overflow-hidden border">
              <Image
                src={post.imageUrl}
                alt="Post image"
                fill
                className="object-contain bg-black/20"
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-start items-center p-4 pt-2 mt-2 border-t border-border">
          <div className="flex items-center gap-4 text-foreground/80">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className="flex items-center gap-2 hover:bg-primary/10"
            >
              <Heart
                className={
                  hasLiked ? 'fill-primary text-primary' : 'text-foreground/60'
                }
              />
              <span className="font-semibold">
                {post.likeCount > 0 ? post.likeCount : ''}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCommentsOpen(true)}
              className="flex items-center gap-2 hover:bg-primary/10"
            >
              <MessageCircle className="text-foreground/60" />
              <span className="font-semibold">
                {post.commentCount > 0 ? post.commentCount : ''}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRepost}
              className="flex items-center gap-2 hover:bg-primary/10"
            >
              <Repeat
                className={hasReposted ? 'text-primary' : 'text-foreground/60'}
              />
              <span className="font-semibold">
                {post.repostCount > 0 ? post.repostCount : ''}
              </span>
            </Button>
          </div>
        </CardFooter>
      </Card>
      <CommentSheet
        open={isCommentsOpen}
        onOpenChange={setIsCommentsOpen}
        postId={post.id}
      />
    </>
  );
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import {
  Loader2,
  Heart,
  MessageCircle,
  Share2,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormItem } from '@/components/ui/form';
import { useRouter } from 'next/navigation';

// --- Types & Schemas ---

type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
};

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty.').max(280, 'Comment is too long.'),
});
type CommentFormValues = z.infer<typeof commentSchema>;

// --- Helper Functions ---
const formatTimestamp = (timestamp: any) => {
  if (!timestamp || !timestamp.toDate) {
    return 'Just now';
  }
  return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
};


// --- Main Page Component ---
export default function CybazonePage() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
       <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBAZONE
        </h1>
        <p className="text-lg text-foreground/80">
          The central hub for the CYBA family.
        </p>
      </div>
      <PostFeed />
    </div>
  );
}


// --- Post Feed & Card ---

function PostFeed() {
    const { firestore } = useFirebase();
    const postsQuery = useMemoFirebase(
      () => query(collection(firestore, 'cybazone_posts'), orderBy('timestamp', 'desc')),
      [firestore]
    );
    const { data: posts, isLoading } = useCollection(postsQuery);
  
    if (isLoading) {
      return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
  
    return (
      <div className="space-y-6">
        {posts && posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-lg">
            <h3 className="text-xl font-semibold">Welcome to the CYBAZONE!</h3>
            <p>Be the first to share something with the community.</p>
          </div>
        )}
      </div>
    );
}

function PostCard({ post }: { post: any }) {
    const { firestore, user } = useFirebase();
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        if(user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
    }, [post.likedBy, user]);
  
    const handleLike = async () => {
      if (!user) return;
      const postRef = doc(firestore, 'cybazone_posts', post.id);
  
      try {
        if (isLiked) {
          await updateDoc(postRef, {
            likedBy: arrayRemove(user.uid),
            likeCount: increment(-1),
          });
        } else {
          await updateDoc(postRef, {
            likedBy: arrayUnion(user.uid),
            likeCount: increment(1),
          });
        }
      } catch (error) {
        console.error('Error updating like:', error);
      }
    };
  
    return (
      <Card className="shadow-md border-primary/20 bg-card/50 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex gap-4 items-start mb-4">
            <AvatarDisplay avatarConfig={post.authorAvatar} size={40} />
            <div>
              <p className="font-bold">{post.authorUsername}</p>
              <p className="text-xs text-muted-foreground">{formatTimestamp(post.timestamp)}</p>
            </div>
          </div>
          <p className="text-foreground/90 whitespace-pre-wrap mb-4">{post.content}</p>
        </CardContent>
  
        {post.imageUrl && (
          <div className="bg-black">
             {post.imageUrl.includes('.mp4') || post.imageUrl.includes('.webm') ? (
              <video
                src={post.imageUrl}
                controls
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            ) : (
              <Image
                src={post.imageUrl}
                alt="Post image"
                width={800}
                height={800}
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            )}
          </div>
        )}
        
        <Collapsible>
            <div className="px-5 py-2">
                 <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{post.likeCount || 0} Likes</span>
                    <CollapsibleTrigger asChild>
                        <Button variant="link" className="p-0 h-auto text-muted-foreground">
                            View comments
                        </Button>
                    </CollapsibleTrigger>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-4 gap-1 text-center">
                    <Button variant="ghost" onClick={handleLike} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                        <Heart className={cn("h-5 w-5", isLiked && "fill-current text-red-500")} />
                        Like
                    </Button>
                     <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                            <MessageCircle className="h-5 w-5" />
                            Comment
                        </Button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                        <Share2 className="h-5 w-5" />
                        Share
                    </Button>
                     <a href={`mailto:contactcyba@gmail.com?subject=Report Post ID: ${post.id}`} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-destructive h-10 px-4 py-2 text-sm font-medium">
                        <Flag className="h-5 w-5" />
                        Report
                    </a>
                </div>
            </div>
            <CollapsibleContent>
                <CommentSection post={post} />
            </CollapsibleContent>
        </Collapsible>
      </Card>
    );
}

// --- Comment Section ---

function CommentSection({ post }: { post: any }) {
    const { firestore, user } = useFirebase();
    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const commentsQuery = useMemoFirebase(
      () => query(collection(firestore, `cybazone_posts/${post.id}/comments`), orderBy('timestamp', 'asc')),
      [firestore, post.id]
    );
    const { data: comments, isLoading } = useCollection(commentsQuery);
    const { toast } = useToast();
    const form = useForm<CommentFormValues>({
      resolver: zodResolver(commentSchema),
      defaultValues: { content: '' },
    });
  
    const onCommentSubmit = async (values: CommentFormValues) => {
        if (!user || !userProfile) return;
        
        try {
            await addDoc(collection(firestore, `cybazone_posts/${post.id}/comments`), {
                postId: post.id,
                authorId: user.uid,
                authorUsername: userProfile.username,
                authorAvatar: userProfile.avatarConfig || {},
                content: values.content,
                timestamp: serverTimestamp(),
            });
            form.reset();
        } catch (error) {
            console.error('Error adding comment:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add comment.' });
        }
    };
  
    return (
      <div className="bg-background/50 px-5 py-4 border-t">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        <div className="space-y-4 mb-4">
            {comments?.map(comment => (
                <div key={comment.id} className="flex gap-3 items-start">
                    <AvatarDisplay avatarConfig={comment.authorAvatar} size={32} />
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm w-full">
                        <span className="font-bold mr-2">{comment.authorUsername}</span>
                        <p className="inline text-foreground/80">{comment.content}</p>
                    </div>
                </div>
            ))}
        </div>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onCommentSubmit)} className="flex gap-3 items-center">
                <AvatarDisplay avatarConfig={userProfile?.avatarConfig} size={32} />
                <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                    <FormItem className="flex-grow">
                        <FormControl>
                            <Input {...field} placeholder="Write a comment..." className="text-sm rounded-full" />
                        </FormControl>
                    </FormItem>
                )}
                />
                 <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>Send</Button>
            </form>
        </Form>
      </div>
    );
}

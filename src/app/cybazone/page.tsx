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
  setDoc,
} from 'firebase/firestore';
import {
  Loader2,
  Home,
  Compass,
  Heart,
  ShoppingBag,
  Megaphone,
  User as ProfileIcon,
  MessageCircle,
  Share2,
  Flag,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { AvatarConfig } from '@/lib/avatar-assets';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

// --- Types & Schemas ---

type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
};

const postSchema = z.object({
  content: z.string().min(1, 'Post cannot be empty.').max(500, 'Post is too long.'),
  image: z.custom<FileList>().optional(),
});
type PostFormValues = z.infer<typeof postSchema>;

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
  const [isOpen, setIsOpen] = useState(true);
  const { user, isUserLoading } = useFirebase();

  // This forces the dialog to close and reopen, resetting its internal state
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // You can add logic here if you need to re-fetch data when it opens
    }
  }

  return (
    <>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
            CYBAZONE
          </h1>
          <p className="text-lg text-foreground/80 mb-12">
            The central hub for the CYBA family. Click the button below to re-launch the CYBAZONE experience.
          </p>
          <Button onClick={() => setIsOpen(true)} disabled={isOpen}>Launch CYBAZONE</Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-black max-w-none w-[calc(100%-2rem)] sm:w-[95vw] lg:w-[80vw] xl:w-[60vw] h-[90vh] flex flex-col p-0 text-white rounded-lg shadow-2xl border-primary border-2">
          <DialogHeader className="p-4 border-b border-gray-800 flex flex-row items-center justify-between flex-shrink-0">
            <DialogTitle>
              <span className="sr-only">CYBAZONE</span>
              <Image
                src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0"
                alt="CYBAZONE Logo"
                width={180}
                height={30}
                priority
              />
            </DialogTitle>
          </DialogHeader>

          <div className="flex-grow flex items-center justify-center overflow-hidden">
            {isUserLoading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : user ? (
              <CybazoneMainView />
            ) : (
              <LoggedOutView />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Logged Out View ---

function LoggedOutView() {
  return (
    <div className="text-center p-4">
      <h2 className="text-4xl font-bold text-white">
        You must be logged in to enter the CYBAZONE.
      </h2>
      <p className="text-gray-400 mt-2">Please sign in to continue.</p>
      <div className="mt-6 flex justify-center gap-4">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/login">Sign In</Link>
        </Button>
        <Button asChild variant="outline" className="text-primary border-primary hover:bg-primary/10 hover:text-primary">
          <Link href="/signup">Create Account</Link>
        </Button>
      </div>
    </div>
  );
}


// --- Main Logged In View ---

function CybazoneHeader() {
    const navItems = [
      { icon: Home, label: 'Feed' },
      { icon: Compass, label: 'Discover' },
      { icon: Heart, label: 'Engagement' },
      { icon: ShoppingBag, label: 'Shop' },
      { icon: Megaphone, label: 'Ads' },
      { icon: ProfileIcon, label: 'Profile' },
    ];
  
    return (
      <header className="w-full bg-black border-b border-gray-800 px-4 py-2 flex-shrink-0">
        <nav className="flex justify-around items-center">
          {navItems.map((item, index) => (
            <Button key={index} variant="ghost" className="flex flex-col h-auto p-2 text-gray-400 hover:text-primary hover:bg-primary/10">
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </Button>
          ))}
        </nav>
      </header>
    );
}

function CybazoneMainView() {
  const { firestore, user } = useFirebase();
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  if (isProfileLoading) {
    return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
  }

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <CybazoneHeader />
      <main className="flex-grow flex flex-col overflow-y-auto bg-black">
        <div className="p-4 sm:p-6 md:p-8">
            {user && userProfile && <CreatePostForm user={user} userProfile={userProfile} />}
            <Separator className="my-8 bg-gray-800" />
            <PostFeed />
        </div>
      </main>
    </div>
  );
}

// --- Create Post Form ---

function CreatePostForm({ user, userProfile }: { user: any; userProfile: UserProfile }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { content: '', image: undefined },
  });

  const onSubmit = async (values: PostFormValues) => {
    if (!user || !userProfile) return;

    setIsUploading(true);
    setUploadProgress(null);
    
    try {
      const imageFile = values.image?.[0];

      if (imageFile) {
        setUploadProgress(10);
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onloadend = async () => {
          const fileDataUri = reader.result as string;
          setUploadProgress(30);

          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileDataUri: fileDataUri,
              fileName: imageFile.name,
              fileType: imageFile.type,
            }),
          });
          
          setUploadProgress(70);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ details: 'Server returned non-JSON error.' }));
            throw new Error(errorData.details || 'Server failed to upload file.');
          }

          const { imageUrl } = await response.json();
          setUploadProgress(90);

          // Once uploaded, create the post document
          await addDoc(collection(firestore, 'cybazone_posts'), {
            authorId: user.uid,
            authorUsername: userProfile.username,
            authorAvatar: userProfile.avatarConfig || {},
            content: values.content,
            imageUrl: imageUrl,
            timestamp: serverTimestamp(),
            likeCount: 0,
            likedBy: [],
          });
          setUploadProgress(100);
          toast({ title: 'Posted!', description: 'Your post is now live in the CYBAZONE.' });
          form.reset();
          setIsExpanded(false);
          setIsUploading(false);
          setUploadProgress(null);
        }
      } else {
         // Create post without an image
         await addDoc(collection(firestore, 'cybazone_posts'), {
            authorId: user.uid,
            authorUsername: userProfile.username,
            authorAvatar: userProfile.avatarConfig || {},
            content: values.content,
            imageUrl: null,
            timestamp: serverTimestamp(),
            likeCount: 0,
            likedBy: [],
        });
        toast({ title: 'Posted!', description: 'Your post is now live in the CYBAZONE.' });
        form.reset();
        setIsExpanded(false);
        setIsUploading(false);
      }

    } catch (error) {
      console.error('Error creating post:', error);
      toast({ variant: 'destructive', title: 'Post Error', description: error instanceof Error ? error.message : 'Could not create post. Please try again.' });
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <Card className="shadow-md border-gray-800 bg-black">
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          <AvatarDisplay avatarConfig={userProfile.avatarConfig} size={40} />
          <div className="w-full">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={`What's on your mind, ${userProfile.username}?`}
                          className="text-base bg-black text-white border-none focus-visible:ring-0 shadow-none"
                          onFocus={() => setIsExpanded(true)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {isExpanded && (
                    <>
                         <FormField
                            control={form.control}
                            name="image"
                            render={({ field: { onChange, value, ...rest } }) => (
                              <FormItem>
                                <FormLabel>Image or Video</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="file" 
                                    accept="image/*,video/*"
                                    onChange={(e) => onChange(e.target.files)}
                                    className="text-sm bg-gray-900 border-gray-800 text-white" 
                                    {...rest}
                                  />
                                </FormControl>
                                <FormDescription>Max file size: 25MB</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                        />
                        {isUploading && uploadProgress !== null && (
                          <Progress value={uploadProgress} className="w-full h-2" />
                        )}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isUploading}>
                                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Post
                            </Button>
                        </div>
                    </>
                )}
              </form>
            </Form>
          </div>
        </div>
      </CardContent>
    </Card>
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
          <div className="text-center py-12 text-gray-500">
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
      <Card className="shadow-md border-gray-800 overflow-hidden bg-black">
        <CardContent className="p-5">
          <div className="flex gap-4 items-start mb-4">
            <AvatarDisplay avatarConfig={post.authorAvatar} size={40} />
            <div>
              <p className="font-bold text-white">{post.authorUsername}</p>
              <p className="text-xs text-gray-400">{formatTimestamp(post.timestamp)}</p>
            </div>
          </div>
          <p className="text-gray-200 whitespace-pre-wrap mb-4">{post.content}</p>
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
                 <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>{post.likeCount || 0} Likes</span>
                    <CollapsibleTrigger asChild>
                        <Button variant="link" className="p-0 h-auto text-gray-400">
                            {/* In a real app, you'd fetch comment count here */}
                            View comments
                        </Button>
                    </CollapsibleTrigger>
                </div>

                <Separator className="my-2 bg-gray-800" />

                <div className="grid grid-cols-4 gap-1 text-center">
                    <Button variant="ghost" onClick={handleLike} className="flex items-center gap-2 text-gray-400 hover:text-primary">
                        <Heart className={cn("h-5 w-5", isLiked && "fill-current text-red-500")} />
                        Like
                    </Button>
                     <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 text-gray-400 hover:text-primary">
                            <MessageCircle className="h-5 w-5" />
                            Comment
                        </Button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" className="flex items-center gap-2 text-gray-400 hover:text-primary">
                        <Share2 className="h-5 w-5" />
                        Share
                    </Button>
                     <a href={`mailto:contactcyba@gmail.com?subject=Report Post ID: ${post.id}`} className="flex items-center justify-center gap-2 text-gray-400 hover:text-destructive h-10 px-4 py-2 text-sm font-medium">
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
      <div className="bg-black px-5 py-4 border-t border-gray-800">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        <div className="space-y-4 mb-4">
            {comments?.map(comment => (
                <div key={comment.id} className="flex gap-3 items-start">
                    <AvatarDisplay avatarConfig={comment.authorAvatar} size={32} />
                    <div className="bg-gray-900 rounded-lg px-3 py-2 text-sm w-full">
                        <span className="font-bold text-white mr-2">{comment.authorUsername}</span>
                        <p className="inline text-gray-200">{comment.content}</p>
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
                            <Input {...field} placeholder="Write a comment..." className="text-sm rounded-full bg-gray-800 text-white placeholder:text-gray-500 border-gray-700" />
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

'use client';

import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Trash2, Repeat } from 'lucide-react';
import { useFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { doc, arrayUnion, arrayRemove, increment, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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
};

export function PostCard({ post }: { post: CybazonePost }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  
  const hasLiked = user ? post.likedBy.includes(user.uid) : false;

  const handleLike = () => {
    if (!user) {
        toast({
            title: "Please sign in",
            description: "You need to be logged in to like posts.",
            action: <Button asChild><Link href="/login">Sign In</Link></Button>
        })
        return;
    };

    const postRef = doc(firestore, 'cybazone_posts', post.id);
    
    if (hasLiked) {
      updateDoc(postRef, {
        likedBy: arrayRemove(user.uid),
        likeCount: increment(-1),
      }).catch((err) => {
          console.error("Error unliking post:", err);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not update like status.' });
      });
    } else {
      updateDoc(postRef, {
        likedBy: arrayUnion(user.uid),
        likeCount: increment(1),
      }).catch((err) => {
          console.error("Error liking post:", err);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not update like status.' });
      });
    }
  };
  
  const handleDelete = () => {
      if (!user || user.uid !== post.authorId) return;
      if (confirm('Are you sure you want to delete this post?')) {
          const postRef = doc(firestore, 'cybazone_posts', post.id);
          deleteDocumentNonBlocking(postRef);
          toast({ title: "Post Deleted" });
      }
  };

  const handleComment = () => {
    toast({
      title: "Coming Soon!",
      description: "Commenting functionality is under development.",
    });
  };

  const handleRepost = () => {
    toast({
      title: "Coming Soon!",
      description: "Reposting functionality is under development.",
    });
  };

  const formattedDate = post.timestamp?.toDate ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'just now';

  return (
    <Card className="w-full max-w-2xl mx-auto border-primary/20 bg-card/50">
      <CardHeader className="flex flex-row items-center gap-4 p-4">
        <AvatarDisplay avatarConfig={post.authorAvatar} size={48} />
        <div className="flex flex-col">
          <p className="font-bold">{post.authorUsername}</p>
          <p className="text-xs text-foreground/60">{formattedDate}</p>
        </div>
         {user && user.uid === post.authorId && (
            <div className="ml-auto">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleDelete}>
                    <Trash2 className="h-5 w-5" />
                </Button>
            </div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Using whitespace-pre-wrap to respect newlines and wrap text */}
        <p className="text-base text-foreground/90 whitespace-pre-wrap">{post.content}</p>
        {post.imageUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden border">
            <Image src={post.imageUrl} alt="Post image" fill className="object-contain bg-black/20" />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-start items-center p-4 pt-2 mt-2 border-t border-border">
        <div className="flex items-center gap-4 text-foreground/80">
            <Button variant="ghost" size="sm" onClick={handleLike} className="flex items-center gap-2 hover:bg-primary/10">
                <Heart className={hasLiked ? 'fill-primary text-primary' : 'text-foreground/60'} />
                <span className="font-semibold">{post.likeCount > 0 ? post.likeCount : ''}</span>
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleComment} className="flex items-center gap-2 hover:bg-primary/10">
                <MessageCircle className="text-foreground/60" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleRepost} className="flex items-center gap-2 hover:bg-primary/10">
                <Repeat className="text-foreground/60" />
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

'use client';

import { useEffect } from 'react';
import { useParams, notFound as nextNotFound } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { Card, CardContent } from '@/components/ui/card';

type UserProfile = {
  id: string;
  username: string;
  avatarConfig?: AvatarConfig;
};

export default function UserPublicProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { firestore } = useFirebase();

  // 1. Find user by username
  const userQuery = useMemoFirebase(
    () =>
      username
        ? query(
            collection(firestore, 'users'),
            where('username', '==', username),
            limit(1)
          )
        : null,
    [firestore, username]
  );
  
  const { data: users, isLoading: isLoadingUser } = useCollection<UserProfile>(userQuery);
  const userProfile = users?.[0];

  // 2. Fetch posts if user is found
  const postsQuery = useMemoFirebase(
    () =>
      userProfile
        ? query(
            collection(firestore, 'cybazone_posts'),
            where('authorId', '==', userProfile.id),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, userProfile]
  );
  const { data: posts, isLoading: isLoadingPosts } = useCollection<CybazonePost>(postsQuery);

  // Handle loading state
  if (isLoadingUser) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Handle not found
  useEffect(() => {
    if (!isLoadingUser && !userProfile) {
      nextNotFound();
    }
  }, [isLoadingUser, userProfile]);

  if (!userProfile) {
    // Render a loader while waiting for the notFound to trigger on the client.
    return (
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto mb-12 border-primary/20 bg-card/50">
          <CardContent className="flex flex-col md:flex-row items-center gap-6 p-8">
            <AvatarDisplay avatarConfig={userProfile.avatarConfig} size={128} />
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-headline font-bold text-glow">{userProfile.username}</h1>
            </div>
          </CardContent>
        </Card>

      {isLoadingPosts ? (
         <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
          </div>
      ) : posts && posts.length > 0 ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
                <PostCard key={post.id} post={post} />
            ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground p-12 border-dashed border-2 rounded-lg max-w-2xl mx-auto bg-card/50">
            <h3 className="text-xl font-bold">No Posts Yet</h3>
            <p>{userProfile.username} hasn't posted anything.</p>
        </div>
      )}
    </div>
  );
}

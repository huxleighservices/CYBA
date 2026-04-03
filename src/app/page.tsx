'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Users, Globe } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeeklyWinnersTicker } from '@/components/WeeklyWinnersTicker';

// We need a lightweight UserProfile type
type UserProfile = {
  id: string;
  following?: string[];
};

export default function FeedPage() {
  const { firestore, user: currentUser, isUserLoading } = useFirebase();
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('all');

  // Fetch current user extended profile for 'following' array
  const currentUserQuery = useMemoFirebase(
      () =>
        currentUser?.uid
          ? query(collection(firestore, 'users'), where('id', '==', currentUser.uid), limit(1))
          : null,
      [firestore, currentUser?.uid]
  );
  const { data: currentUsers } = useCollection<UserProfile>(currentUserQuery);
  const currentUserProfile = currentUsers?.[0];

  const followingList = currentUserProfile?.following || [];
  
  // To avoid Firestore "in" limit of 30, we'll cap it at 30 for this query for now
  // We stringify it to provide a stable dependency for useMemoFirebase
  const safeFollowingListStr = JSON.stringify(followingList.slice(0, 30));

  // All Posts Query
  const allPostsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'cybazone_posts'), orderBy('timestamp', 'desc'), limit(50)) : null),
    [firestore]
  );
  const { data: allPosts, isLoading: isLoadingAll } = useCollection<CybazonePost>(allPostsQuery);

  // Following Posts Query (only if followingList has items to avoid IN [] error)
  const followingPostsQuery = useMemoFirebase(
    () => {
        const list = JSON.parse(safeFollowingListStr);
        if (!firestore || !currentUserProfile || list.length === 0) return null;
        return query(
            collection(firestore, 'cybazone_posts'),
            where('authorId', 'in', list),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    },
    [firestore, currentUserProfile?.id, safeFollowingListStr]
  );
  
  const { data: followingPostsData, isLoading: isLoadingFollowing } = useCollection<CybazonePost>(followingPostsQuery);

  const followingPosts = JSON.parse(safeFollowingListStr).length === 0 ? [] : followingPostsData;

  const renderPosts = (posts: CybazonePost[] | null | undefined, isLoading: boolean, emptyMessage: string) => {
      if (isLoading || isUserLoading) {
          return (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
      }
      if (posts && posts.length > 0) {
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {posts.map((post) => (
                <div key={post.id} className="w-full max-w-2xl mx-auto">
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          );
      }
      return (
        <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-muted-foreground/30 bg-card/10 rounded-xl max-w-2xl mx-auto backdrop-blur-sm animate-in fade-in">
          <h3 className="text-xl font-bold font-headline mb-2">{emptyMessage}</h3>
          <p>Get active and start connecting!</p>
        </div>
      );
  };

  return (
    <div className="container mx-auto px-4 py-16 min-h-screen">
      <div className="text-center max-w-3xl mx-auto mb-8">
        <Image
          src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0"
          alt="CYBAZONE Logo"
          width={466}
          height={80}
          className="mx-auto mb-4 cyba-logo-glow"
        />
        <p className="text-lg text-foreground/80 mb-4">
          Catch Up On Your Feed
        </p>
      </div>

      {/* Weekly Winners ticker tape */}
      <div className="mb-8 -mx-4">
        <WeeklyWinnersTicker />
      </div>

      <div className="max-w-3xl mx-auto">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'following')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto bg-card/50 border border-primary/20 rounded-full p-1 mb-10 shadow-lg">
                <TabsTrigger value="all" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold flex items-center gap-2 transition-all">
                    <Globe className="w-4 h-4" /> Global Feed
                </TabsTrigger>
                <TabsTrigger value="following" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold flex items-center gap-2 transition-all">
                    <Users className="w-4 h-4" /> Following
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="w-full">
                {renderPosts(allPosts, isLoadingAll, "The Global Feed is Quiet...")}
            </TabsContent>

            <TabsContent value="following" className="w-full">
                {!currentUser ? (
                    <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-primary/20 bg-card/20 rounded-xl max-w-2xl mx-auto">
                       <h3 className="text-xl font-bold font-headline mb-2">Sign In Required</h3>
                       <p>You must be logged in to have a personalized feed.</p>
                    </div>
                ) : (
                    renderPosts(followingPosts, isLoadingFollowing, "You aren't following anyone yet, or they haven't posted.")
                )}
            </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}

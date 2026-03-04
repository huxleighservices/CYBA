'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FeedPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  const postsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, 'cybazone_posts'), orderBy('timestamp', 'desc')) : null),
    [firestore, user]
  );

  const { data: posts, isLoading: isLoadingPosts } = useCollection<CybazonePost>(postsQuery);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <Image
          src="https://preview.redd.it/cybazone-2-v0-pg6fhpkr65kg1.png?width=1080&crop=smart&auto=webp&s=6df4067e5f00ad1660deb7f6b1b13dcb326f26f0"
          alt="CYBAZONE Logo"
          width={466}
          height={80}
          className="mx-auto mb-4 cyba-logo-glow"
        />
        <p className="text-lg text-foreground/80 mb-12">
          Catch Up On Your Feed
        </p>
      </div>

      {isUserLoading || (user && isLoadingPosts) ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-8">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : user ? (
        <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-muted-foreground/30 rounded-lg max-w-2xl mx-auto">
          <h3 className="text-xl font-bold">The Feed is Quiet...</h3>
          <p>Be the first to post and get the conversation started!</p>
        </div>
      ) : null}
    </div>
  );
}

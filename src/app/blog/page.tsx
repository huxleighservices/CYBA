'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

export default function BlogPage() {
  const { firestore } = useFirebase();
  const blogPostsRef = useMemoFirebase(
    () => query(collection(firestore, 'blogPosts'), orderBy('publicationDate', 'desc')),
    [firestore]
  );
  const { data: blogPosts, isLoading } = useCollection(blogPostsRef);

  // Function to create a slug from a title
  const createSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
  };
  
  // Convert date object to a readable string, or show 'Just now' for recent posts.
  const formatDate = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) {
      return 'Just now';
    }
    return new Date(timestamp.toDate()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBA BLOG
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Insights, news, and transmissions from the heart of the music
          industry.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : blogPosts && blogPosts.length > 0 ? (
        <div className="grid lg:grid-cols-3 gap-8">
          {blogPosts.map((post) => {
            const slug = createSlug(post.title);
            return (
              <Link
                key={post.id}
                href={`/blog/${slug}`}
                className="group block"
              >
                <Card className="h-full flex flex-col overflow-hidden border-primary/20 bg-card/50 transition-all duration-300 group-hover:border-primary">
                  <CardHeader className="p-0">
                    {post.imageUrl && (
                      <div className="aspect-video overflow-hidden">
                        <Image
                          src={post.imageUrl}
                          alt={post.title}
                          width={800}
                          height={450}
                          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-6 flex-grow">
                    <Badge
                      variant="outline"
                      className="mb-2 border-primary text-primary"
                    >
                      {post.category}
                    </Badge>
                    <h2 className="text-xl font-bold font-headline mb-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-foreground/70 mb-4">
                      {post.excerpt}
                    </p>
                  </CardContent>
                  <CardFooter className="p-6 pt-0 flex justify-between items-center">
                    <p className="text-xs text-foreground/60">{formatDate(post.publicationDate)}</p>
                    <div className="flex items-center text-primary">
                      Read More
                      <ArrowRight className="h-4 w-4 ml-1 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-foreground/60">
          <p>No blog posts yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}

    
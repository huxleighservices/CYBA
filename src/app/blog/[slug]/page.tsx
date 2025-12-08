'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

// Function to create a slug from a title (must be identical to the one on the blog list page)
const createSlug = (title: string) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
};

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

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const { firestore } = useFirebase();
  const blogPostsRef = useMemoFirebase(
    () => collection(firestore, 'blogPosts'),
    [firestore]
  );
  const { data: blogPosts, isLoading } = useCollection(blogPostsRef);

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const post = blogPosts?.find((p) => createSlug(p.title) === params.slug);

  if (!post) {
    // Wait for loading to finish before showing notFound
    if (!isLoading) {
      notFound();
    }
    // Can show a loading skeleton here as well
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="mb-8">
        <Link
          href="/blog"
          className="inline-flex items-center text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Blog
        </Link>
      </div>

      <article>
        <Badge variant="outline" className="mb-2 border-primary text-primary">
          {post.category}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-glow mb-4">
          {post.title}
        </h1>
        <p className="text-sm text-foreground/60 mb-8">{formatDate(post.publicationDate)}</p>

        {post.imageUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden mb-8 shadow-lg shadow-primary/10">
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <div
          className="prose prose-invert prose-lg max-w-none text-foreground/90 prose-headings:text-glow prose-a:text-primary prose-strong:text-foreground"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  );
}

    
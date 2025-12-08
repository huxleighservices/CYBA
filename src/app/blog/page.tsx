
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';

const blogPosts = [
  {
    slug: 'the-rise-of-synthwave',
    title: 'The Rise of Synthwave: A Retro-Futuristic Revolution',
    date: 'August 12, 2024',
    category: 'Music Trends',
    excerpt:
      'Explore the origins and modern resurgence of synthwave, the genre that blends 80s nostalgia with futuristic soundscapes.',
    imageId: 'blog-1',
  },
  {
    slug: 'building-your-fanbase',
    title: '5 Unconventional Ways to Build Your Fanbase in 2024',
    date: 'July 28, 2024',
    category: 'Marketing',
    excerpt:
      'Move beyond the usual social media tactics. We dive into creative strategies that create real connections with listeners.',
    imageId: 'blog-2',
  },
  {
    slug: 'the-art-of-the-album-cover',
    title: 'The Art of the Album Cover in the Streaming Age',
    date: 'July 15, 2024',
    category: 'Design',
    excerpt:
      'Does album art still matter? We argue that in a sea of digital noise, a compelling visual is more important than ever.',
    imageId: 'blog-3',
  },
];

export default function BlogPage() {
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

      <div className="grid lg:grid-cols-3 gap-8">
        {blogPosts.map((post) => {
          const image = PlaceHolderImages.find((p) => p.id === post.imageId);
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block"
            >
              <Card className="h-full flex flex-col overflow-hidden border-primary/20 bg-card/50 transition-all duration-300 group-hover:border-primary">
                <CardHeader className="p-0">
                  {image && (
                    <div className="aspect-video overflow-hidden">
                      <Image
                        src={image.imageUrl}
                        alt={post.title}
                        width={800}
                        height={450}
                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                        data-ai-hint={image.imageHint}
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
                  <p className="text-xs text-foreground/60">{post.date}</p>
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
    </div>
  );
}

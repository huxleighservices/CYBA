import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

const blogPosts = [
  {
    slug: 'the-rise-of-synthwave',
    title: 'The Rise of Synthwave: A Retro-Futuristic Revolution',
    date: 'August 12, 2024',
    category: 'Music Trends',
    imageId: 'blog-1',
    content: `
<p class="mb-4 text-foreground/80">Synthwave, also known as outrun, is a microgenre of electronic music that emerged in the mid-2000s. It's heavily inspired by the music and culture of the 1980s, particularly the soundtracks of films, video games, and television shows from that era.</p>
<p class="mb-4 text-foreground/80">Characterized by its use of synthesizers, gated reverb on drums, and a retro-futuristic aesthetic, synthwave evokes a sense of nostalgia for a past that never quite existed. Artists like Kavinsky, Carpenter Brut, and Perturbator have been instrumental in popularizing the genre, with Kavinsky's "Nightcall" gaining mainstream attention after being featured in the 2011 film "Drive".</p>
<h3 class="text-2xl font-bold font-headline text-glow mt-8 mb-4">The Aesthetics of a Decade</h3>
<p class="mb-4 text-foreground/80">The visual component of synthwave is just as important as the music. Think neon grids, chrome logos, 80s sports cars, and sunset-drenched cityscapes. It's a style that's both a loving tribute and a stylized exaggeration of the 1980s. This aesthetic has bled into fashion, graphic design, and even film, creating a powerful cultural feedback loop.</p>
<p class="mb-4 text-foreground/80">As we move further into the 21st century, the appeal of synthwave's optimistic-yet-dystopian vision of the future only seems to grow stronger. It's a sonic and visual escape to a cooler, more stylish timeline.</p>
`,
  },
  {
    slug: 'building-your-fanbase',
    title: '5 Unconventional Ways to Build Your Fanbase in 2024',
    date: 'July 28, 2024',
    category: 'Marketing',
    imageId: 'blog-2',
    content: `
<p class="mb-4 text-foreground/80">In a world saturated with music, just being on Spotify isn't enough. To truly build a dedicated fanbase, you need to think outside the box. Here are five unconventional strategies to try.</p>
<h3 class="text-2xl font-bold font-headline text-glow mt-8 mb-4">1. Create an Alternate Reality Game (ARG)</h3>
<p class="mb-4 text-foreground/80">Hide clues in your music, album art, and social media posts that lead fans on a scavenger hunt. It's an immersive way to get them deeply engaged with your world.</p>
<h3 class="text-2xl font-bold font-headline text-glow mt-8 mb-4">2. Host a "Listening Party" in a Video Game</h3>
<p class="mb-4 text-foreground/80">Instead of a standard livestream, gather your fans in a game like Minecraft or Fortnite. Create a custom space, hang out, and debut your new music in a memorable way.</p>
<p class="mb-4 text-foreground/80">These are just a couple of ideas. The key is to create experiences, not just content. Give your fans a story to be a part of, and they'll become your most passionate advocates.</p>
`,
  },
  {
    slug: 'the-art-of-the-album-cover',
    title: 'The Art of the Album Cover in the Streaming Age',
    date: 'July 15, 2024',
    category: 'Design',
    imageId: 'blog-3',
    content: `
<p class="mb-4 text-foreground/80">With the decline of physical media, some have declared the album cover dead. We couldn't disagree more. In the infinite scroll of a streaming service, your album art is the first, and sometimes only, chance to make an impression.</p>
<h3 class="text-2xl font-bold font-headline text-glow mt-8 mb-4">A Thumbnail-Sized Billboard</h3>
<p class="mb-4 text-foreground/80">Think of your album art as a tiny billboard. It needs to be bold, instantly recognizable, and evocative of the music within. It must work at 1000x1000 pixels on a desktop screen and at 60x60 pixels on a mobile playlist.</p>
<p class="mb-4 text-foreground/80">Great album art in the streaming age tells a story, establishes a brand, and entices the listener to press play. It's not just a wrapper; it's the visual handshake for your music.</p>
`,
  },
];

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  const image = PlaceHolderImages.find((p) => p.id === post.imageId);

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
        <p className="text-sm text-foreground/60 mb-8">{post.date}</p>

        {image && (
          <div className="relative aspect-video rounded-lg overflow-hidden mb-8 shadow-lg shadow-primary/10">
            <Image
              src={image.imageUrl}
              alt={post.title}
              fill
              className="object-cover"
              data-ai-hint={image.imageHint}
            />
          </div>
        )}

        <div
          className="text-lg"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  );
}

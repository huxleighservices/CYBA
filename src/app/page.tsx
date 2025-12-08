import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';
import { ArrowRight, Mic, Music, Users } from 'lucide-react';

export default function Home() {
  const heroImage = PlaceHolderImages.find((p) => p.id === 'hero');

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <section className="relative text-center rounded-lg overflow-hidden mb-16">
        <div className="relative z-10 px-6 py-24 md:py-32">
          <h1 className="text-4xl md:text-7xl font-headline font-bold mb-8 tracking-tighter animate-text-glow">
            Welcome to the CYBAVerse
          </h1>
          <Button
            asChild
            size="lg"
            className="font-bold group"
          >
            <Link href="/membership">
              Join the Galaxy{' '}
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

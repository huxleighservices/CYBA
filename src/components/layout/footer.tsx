'use client';

import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full bg-black text-white">
      <div className="container mx-auto flex items-center justify-between py-4 text-sm">
        <div className="text-foreground/60">
          Website developed by{' '}
          <a
            href="https://www.huxleigh.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            Huxleigh
          </a>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <Button asChild>
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://www.instagram.com/cybazone/?hl=en"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-foreground/60 hover:text-primary transition-colors p-2"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href="https://www.youtube.com/hashtag/cyba"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="text-foreground/60 hover:text-primary transition-colors p-2"
          >
            <Youtube className="h-5 w-5" />
          </a>
          <a
            href="https://www.facebook.com/people/Cybazone/61570841902450/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-foreground/60 hover:text-primary transition-colors p-2"
          >
            <Facebook className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

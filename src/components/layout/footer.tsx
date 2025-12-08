'use client';

import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container grid grid-cols-1 md:grid-cols-3 items-center justify-between py-6 gap-4 text-center md:text-left">
        <div className="text-sm text-foreground/60 order-3 md:order-1">
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
        <div className="flex items-center justify-center gap-4 order-2">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-foreground/60 hover:text-primary transition-colors"
          >
            <Instagram className="h-6 w-6" />
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="text-foreground/60 hover:text-primary transition-colors"
          >
            <Youtube className="h-6 w-6" />
          </a>
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-foreground/60 hover:text-primary transition-colors"
          >
            <Facebook className="h-6 w-6" />
          </a>
        </div>
        <div className="flex justify-center md:justify-end order-1 md:order-3">
          <Button asChild>
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </div>
      </div>
    </footer>
  );
}

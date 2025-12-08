'use client';

import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center justify-between py-6 text-sm">
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
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center justify-center gap-2">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-foreground/60 hover:text-primary transition-colors p-2"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="text-foreground/60 hover:text-primary transition-colors p-2"
            >
              <Youtube className="h-5 w-5" />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-foreground/60 hover:text-primary transition-colors p-2"
            >
              <Facebook className="h-5 w-5" />
            </a>
          </div>
          <div>
            <Button asChild>
              <Link href="/contact">Get in Touch</Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

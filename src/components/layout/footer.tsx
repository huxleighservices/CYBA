'use client';

import { Facebook, Instagram, Youtube } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full bg-black text-white">
      <div className="container mx-auto py-6">
        {/* Legal links */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-4 text-sm text-foreground/60">
          <Link href="/faq" className="hover:text-primary transition-colors">
            FAQ
          </Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/contact" className="hover:text-primary transition-colors">
            Contact Us
          </Link>
          <Link href="/terms" className="hover:text-primary transition-colors">
            Terms of Use
          </Link>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-foreground/60">
            developed by{' '}
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
      </div>
    </footer>
  );
}

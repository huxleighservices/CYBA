'use client';

import { HardHat } from 'lucide-react';

export default function CybazonePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBAZONE
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          The central hub for the CYBA family. More details coming soon.
        </p>
      </div>

      <div className="border border-primary/20 rounded-lg bg-card/50 flex flex-col items-center justify-center text-center p-16">
        <HardHat className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">Under Construction</h2>
        <p className="text-foreground/70">
          This section is currently being built. Check back soon for exciting new features!
        </p>
      </div>
    </div>
  );
}

'use client';

import { useRadio } from '@/contexts/radio-context';
import { RadioPlaylist } from '@/components/radio/RadioPlaylist';
import { Radio } from 'lucide-react';

/**
 * On mobile, <RadioEngine> (mounted at the root layout) renders the entire large-player UI
 * itself — video, controls, and a scrollable playlist — as one fixed full-height panel, so this
 * page renders nothing extra there. On desktop, RadioEngine only docks the video+controls as a
 * left column, and this page supplies the spacer + the "Up Next" list in the remaining space.
 */
export default function RadioPage() {
  const { hasQueue } = useRadio();

  if (!hasQueue) {
    return (
      <div className="container mx-auto hidden md:flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-4 text-center">
        <Radio className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">CYBAZONE RADIO is quiet right now — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="hidden md:flex md:flex-row md:min-h-[calc(100vh-4rem)]">
      {/* Spacer reserving the space the fixed <RadioEngine> docks into on desktop (440px left
          column). Keep this width in sync with RadioEngine.tsx. */}
      <div className="md:w-[440px] shrink-0" aria-hidden />
      <RadioPlaylist className="flex-1 min-w-0 pb-8" />
    </div>
  );
}

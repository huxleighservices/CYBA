'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRadio } from '@/contexts/radio-context';
import { Radio, Music } from 'lucide-react';

export default function RadioPage() {
  const { hasQueue, useQueue, orderedQueue, queueIndex, selectIndex } = useRadio();

  if (!hasQueue) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-4 text-center">
        <Radio className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">CYBAZONE RADIO is quiet right now — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      {/* Spacer reserving the exact space the fixed <RadioEngine> docks into: mobile is the
          38vh media dock plus its h-36 (144px) controls panel below it; desktop is the 440px
          left column. Keep these dimensions in sync with RadioEngine.tsx — if they drift, the
          fixed player overlaps and hides the top of this playlist. */}
      <div className="h-[calc(38vh+9rem)] md:h-auto md:w-[440px] shrink-0" aria-hidden />

      <div className="flex-1 min-w-0 min-h-0">
        {useQueue ? (
          <div className="px-2 pb-24 md:pb-8">
            <div className="px-3 py-4 flex items-center justify-between">
              <h1 className="text-sm font-black tracking-widest uppercase text-muted-foreground">Up Next</h1>
              <span className="text-xs text-muted-foreground">{orderedQueue.length} track{orderedQueue.length !== 1 ? 's' : ''}</span>
            </div>
            {orderedQueue.map((item, i) => (
              <button
                key={`${item.type}-${item.type === 'youtube' ? item.videoId : item.mediaUrl}-${i}`}
                onClick={() => selectIndex(i)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors',
                  i === queueIndex ? 'bg-purple-500/15 text-purple-200' : 'hover:bg-muted/50 text-foreground/90',
                )}
              >
                <span className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                  i === queueIndex ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground',
                )}>
                  <Music className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">
                    {item.username ? (
                      <Link href={`/u/${item.username}`} onClick={e => e.stopPropagation()} className="hover:underline">
                        {item.username}
                      </Link>
                    ) : 'Unknown'}
                  </span>
                  {item.title && <span className="block text-xs text-muted-foreground truncate">{item.title}</span>}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                  {item.type === 'upload' ? 'Upload' : 'YouTube'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
            <p>Playing the CYBAZONE RADIO playlist.</p>
            <p className="text-xs text-muted-foreground/70">Submit a Radio Boost track to join the rotation.</p>
          </div>
        )}
      </div>
    </div>
  );
}

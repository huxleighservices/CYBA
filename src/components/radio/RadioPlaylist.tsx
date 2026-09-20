'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRadio } from '@/contexts/radio-context';
import { Music } from 'lucide-react';

/** The "Up Next" track list — shared between RadioEngine (mobile, inside the fixed docked
 *  panel) and the /radio page (desktop, right column). Pass a `className` to control sizing;
 *  the caller owns the scroll container (this just renders the header + rows). */
export function RadioPlaylist({ className }: { className?: string }) {
  const { useQueue, orderedQueue, queueIndex, selectIndex } = useRadio();

  if (!useQueue) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground', className)}>
        <p>Playing the CYBAZONE RADIO playlist.</p>
        <p className="text-xs text-muted-foreground/70">Submit a Radio Boost track to join the rotation.</p>
      </div>
    );
  }

  return (
    <div className={cn('px-2', className)}>
      <div className="px-3 py-3 flex items-center justify-between sticky top-0 bg-inherit z-10">
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
              {item.title ?? (item.username ? `@${item.username}` : 'Unknown')}
            </span>
            {item.username && (
              <Link href={`/u/${item.username}`} onClick={e => e.stopPropagation()} className="block text-xs text-muted-foreground hover:underline truncate">
                {item.username}
              </Link>
            )}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
            {item.type === 'upload' ? 'Upload' : 'YouTube'}
          </span>
        </button>
      ))}
    </div>
  );
}

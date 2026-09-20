'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useRadio } from '@/contexts/radio-context';
import { RadioPlaylist } from '@/components/radio/RadioPlaylist';
import { Radio, Play, Pause, SkipForward, Shuffle, Repeat } from 'lucide-react';

/**
 * The single persistent CYBAZONE RADIO player — mounted once at the root layout and never
 * unmounted by route changes, so playback survives navigation.
 *
 * IMPORTANT: everything below lives inside ONE outer wrapper that is always mounted — only its
 * CSS classes (and its media-dock child's CSS) change based on route, never its position in the
 * tree. The media dock (holding the YT-iframe container / <video>) must never be nested inside a
 * route-conditional JSX branch: doing that would make React unmount/remount the underlying DOM
 * node on every navigation to or from /radio, tearing down the live YouTube iframe (and the
 * player attached to it) even though the owning effect — in RadioProvider, also never unmounted —
 * never re-runs to recreate it, silently killing playback the moment the mode switched.
 *
 * Two looks, CSS-only, both living in the same wrapper:
 *  - `/radio`: wrapper is a fixed full-height panel from the header down to the viewport bottom.
 *    On mobile it renders EVERYTHING itself — video (aspect-video, so its height is proportional
 *    to width rather than a guessed vh fraction), compact controls, and the "Up Next" playlist in
 *    a flex-1 overflow-y-auto pane that gets all remaining space (this is what makes the list
 *    genuinely scrollable instead of being squeezed into whatever was left over). On desktop the
 *    wrapper only docks the video+controls as a 440px left column; the /radio page supplies the
 *    playlist in the remaining space to its right (full page height there, so no internal scroll
 *    pane is needed).
 *  - everywhere else: wrapper is a thin bottom bar. The media dock is pulled out via absolute
 *    positioning to a real-but-offscreen size (YouTube's embed falls back to a broken "expand"
 *    overlay UI below ~200px, so it can't just shrink into the bar) and the bar shows a static
 *    icon + username/title instead of a live video thumbnail.
 */
export function RadioEngine() {
  const pathname = usePathname();
  const {
    hasQueue, useQueue, currentItem,
    isPlaying, isReady, isShuffled, isRepeating,
    containerRef, videoElRef,
    togglePlay, skipNext, toggleShuffle, toggleRepeat, handleUploadEnded,
  } = useRadio();

  if (!hasQueue) return null;

  const isLarge = pathname === '/radio';

  return (
    <div
      className={cn(
        'fixed z-30 border-purple-500/40 bg-gradient-to-b from-purple-950/95 via-black/95 to-black/90 backdrop-blur-md',
        isLarge
          ? 'top-16 inset-x-0 bottom-0 md:inset-x-auto md:left-0 md:w-[440px] border-b md:border-b-0 md:border-r flex flex-col overflow-hidden'
          : 'inset-x-0 bottom-14 md:bottom-0 h-14 border-t bg-gradient-to-r flex items-center px-3 gap-3 overflow-visible',
      )}
    >
      {/* Media dock — always mounted at the same position in the tree; only its own CSS moves.
          aspect-video on mobile (proportional to width, not a guessed vh fraction) instead of a
          fixed height, so it never eats more room than it visually needs to. */}
      <div className={cn('bg-black overflow-hidden shrink-0', isLarge ? 'w-full aspect-video md:aspect-auto md:h-auto md:flex-1 md:min-h-0' : 'absolute -left-[9999px] top-0 h-[220px] w-[360px]')}>
        {useQueue && currentItem?.type === 'upload' ? (
          <video
            ref={videoElRef}
            src={currentItem.mediaUrl}
            className="h-full w-full bg-black object-contain"
            muted
            playsInline
            onEnded={handleUploadEnded}
          />
        ) : (
          <div ref={containerRef} className="h-full w-full bg-black" />
        )}
      </div>

      {isLarge ? (
        <>
          <div className="shrink-0 p-3 md:p-4 flex flex-col gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'radial-gradient(circle,#7c3aed,#4c1d95)' }}>
                <Radio className="h-3 w-3 text-purple-200" />
              </div>
              <p className="text-sm font-semibold text-white truncate">
                {currentItem?.title ?? (currentItem?.username ? `@${currentItem.username}` : 'CYBAZONE RADIO')}
              </p>
            </div>
            {currentItem?.username && (
              <Link href={`/u/${currentItem.username}`} className="text-xs text-purple-300 hover:underline -mt-2">
                {currentItem.username}
              </Link>
            )}
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={toggleShuffle}
                disabled={!useQueue}
                title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                className={cn('h-9 w-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30',
                  isShuffled ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:text-white')}
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!isReady}
                className="h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-40 bg-white text-black"
              >
                {isPlaying ? <Pause className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" /> : <Play className="h-5 w-5 md:h-6 md:w-6 ml-0.5" fill="currentColor" />}
              </button>
              <button
                onClick={skipNext}
                disabled={!isReady || !useQueue}
                title="Next"
                className="h-9 w-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 bg-white/10 text-white/60 hover:text-white"
              >
                <SkipForward className="h-4 w-4" fill="currentColor" />
              </button>
              <button
                onClick={toggleRepeat}
                title={isRepeating ? 'Repeat on' : 'Repeat off'}
                className={cn('h-9 w-9 rounded-full flex items-center justify-center transition-all',
                  isRepeating ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:text-white')}
              >
                <Repeat className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile-only: the playlist lives here, inside the fixed panel, as a real
              flex-1/overflow-y-auto pane so it gets ALL remaining space down to the bottom of
              the screen. On desktop, the /radio page renders it instead (full page height, no
              internal scroll pane needed there). */}
          <RadioPlaylist className="md:hidden flex-1 min-h-0 overflow-y-auto pb-4" />
        </>
      ) : (
        <>
          <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'radial-gradient(circle,#7c3aed,#4c1d95)' }}>
            <Radio className={cn('h-3 w-3 text-purple-200', isPlaying && 'animate-pulse')} />
          </div>
          <Link href="/radio" className="flex-1 min-w-0 leading-tight py-0.5">
            <span className="block text-xs font-bold text-purple-300 truncate">
              {currentItem?.title ?? (currentItem?.username ? `@${currentItem.username}` : 'CYBAZONE RADIO')}
            </span>
            {currentItem?.username && currentItem?.title && (
              <span className="block text-[11px] text-white/70 truncate">{currentItem.username}</span>
            )}
          </Link>
          <button
            onClick={(e) => { e.preventDefault(); togglePlay(); }}
            disabled={!isReady}
            className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />}
          </button>
        </>
      )}
    </div>
  );
}

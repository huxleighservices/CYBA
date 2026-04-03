'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
//  YouTube URL → video ID
// ─────────────────────────────────────────────
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

// ─────────────────────────────────────────────
//  AnthemPlayer — inline jukebox
// ─────────────────────────────────────────────
interface AnthemPlayerProps {
  anthemUrl?: string | null;
  username: string;
  className?: string;
}

export function AnthemPlayer({ anthemUrl, username, className }: AnthemPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const videoId = anthemUrl ? extractYouTubeId(anthemUrl) : null;
  const hasAnthem = !!videoId;
  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @keyframes jukebox-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(168,85,247,0.5), 0 0 20px rgba(168,85,247,0.2); }
          50%       { box-shadow: 0 0 14px rgba(168,85,247,0.8), 0 0 32px rgba(168,85,247,0.35); }
        }
        @keyframes light-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
        .jb-playing { animation: jukebox-glow 2s ease-in-out infinite; }
        .jb-light-1 { animation: light-blink 0.6s ease-in-out infinite; }
        .jb-light-2 { animation: light-blink 0.6s ease-in-out 0.2s infinite; }
        .jb-light-3 { animation: light-blink 0.6s ease-in-out 0.4s infinite; }
      `}</style>

      <div className={cn('flex flex-col items-center', className)}>
        {/* ── Jukebox body ── */}
        <div
          className={cn(
            'relative flex flex-col rounded-t-[40px] rounded-b-lg overflow-hidden border-2 transition-all duration-300',
            hasAnthem
              ? 'border-purple-600/70 bg-gradient-to-b from-[#1a0a2e] via-[#110720] to-[#0a0512]'
              : 'border-zinc-700/50 bg-gradient-to-b from-[#111] via-[#0d0d0d] to-[#080808] opacity-60 grayscale',
            playing && 'jb-playing'
          )}
          style={{ width: 200 }}
        >
          {/* ── Arch top with lights ── */}
          <div
            className="flex items-end justify-center gap-2 pt-4 pb-2 px-4"
            style={{
              background: hasAnthem
                ? 'linear-gradient(to bottom, #2d0a4e, #1a0a2e)'
                : 'linear-gradient(to bottom, #1a1a1a, #111)',
              borderBottom: '2px solid rgba(139,92,246,0.3)',
            }}
          >
            {/* Decorative arch lights */}
            {['#f472b6','#a78bfa','#38bdf8','#a78bfa','#f472b6'].map((color, i) => (
              <div
                key={i}
                className={cn('rounded-full', playing && [`jb-light-${(i % 3) + 1}`])}
                style={{
                  width: i === 2 ? 10 : 7,
                  height: i === 2 ? 10 : 7,
                  background: hasAnthem ? color : '#333',
                  boxShadow: hasAnthem && playing ? `0 0 6px ${color}` : 'none',
                }}
              />
            ))}
          </div>

          {/* ── ANTHEM label ── */}
          <div className="text-center py-1.5" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <span
              className="text-[7px] tracking-[0.25em] uppercase"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                color: hasAnthem ? '#a78bfa' : '#444',
              }}
            >
              MY ANTHEM
            </span>
          </div>

          {/* ── Screen / video display ── */}
          <div className="px-3 py-2">
            <div
              className="relative overflow-hidden rounded"
              style={{
                width: '100%',
                aspectRatio: '16/9',
                background: '#000',
                border: '2px solid rgba(139,92,246,0.4)',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
              }}
            >
              {hasAnthem ? (
                playing ? (
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                    title={`${username}'s Anthem`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  // Thumbnail + play overlay
                  <button
                    onClick={() => setPlaying(true)}
                    className="absolute inset-0 w-full h-full group"
                    title={`Play ${username}'s Anthem`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrl!}
                      alt="Anthem thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(139,92,246,0.9)', boxShadow: '0 0 12px rgba(139,92,246,0.7)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                          <polygon points="3,1 13,7 3,13" />
                        </svg>
                      </div>
                    </div>
                  </button>
                )
              ) : (
                // No anthem state — dark screen with scanlines effect
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-[6px] text-center leading-relaxed"
                    style={{ fontFamily: "'Press Start 2P', monospace", color: '#333' }}
                  >
                    NO SIGNAL
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom panel with decorative knobs ── */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(139,92,246,0.2)' }}
          >
            {/* Knobs */}
            <div className="flex gap-2">
              {['#7c3aed','#5b21b6'].map((c, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{ width: 10, height: 10, background: c, boxShadow: `0 0 4px ${c}` }}
                />
              ))}
            </div>
            {/* Username */}
            <span
              className="text-[6px] truncate max-w-[80px]"
              style={{ fontFamily: "'Press Start 2P', monospace", color: '#6d28d9' }}
            >
              {username}
            </span>
            {/* Stop button */}
            {playing && (
              <button
                onClick={() => setPlaying(false)}
                className="rounded px-1.5 py-0.5 text-[6px] text-white transition-colors"
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  background: '#7c3aed',
                  boxShadow: '0 0 6px rgba(124,58,237,0.6)',
                }}
              >
                ■
              </button>
            )}
            {!playing && (
              <div style={{ width: 24 }} /> // spacer
            )}
          </div>
        </div>
      </div>
    </>
  );
}

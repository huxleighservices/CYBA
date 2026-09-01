'use client';

import { formatDistanceToNow } from 'date-fns';
import type { Shoutout } from '@/lib/shoutouts';

export function ShoutoutCard({ shoutout }: { shoutout: Shoutout }) {
  const timeAgo = shoutout.createdAt?.toDate
    ? formatDistanceToNow(shoutout.createdAt.toDate(), { addSuffix: true })
    : '';

  return (
    <>
      <style>{`
        @keyframes shoutout-pulse {
          0%, 100% { opacity: 0.6; box-shadow: 0 0 12px rgba(239,68,68,0.4), 0 0 30px rgba(239,68,68,0.15); }
          50%       { opacity: 1;   box-shadow: 0 0 20px rgba(239,68,68,0.7), 0 0 50px rgba(239,68,68,0.3); }
        }
        .shoutout-glow {
          animation: shoutout-pulse 2.5s ease-in-out infinite;
        }
        @keyframes shoutout-spark {
          0%, 100% { opacity: 0; transform: scaleX(0.3); }
          50%       { opacity: 1; transform: scaleX(1); }
        }
        .shoutout-spark { animation: shoutout-spark 1.8s ease-in-out infinite; }
        .shoutout-spark-2 { animation: shoutout-spark 1.8s ease-in-out infinite 0.9s; }
      `}</style>

      <div className="relative w-full max-w-2xl mx-auto">
        {/* Electric glow border */}
        <div
          className="absolute -inset-[1.5px] rounded-xl pointer-events-none shoutout-glow"
          style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c, #ef4444)', borderRadius: 12 }}
        />

        {/* Spark lines top */}
        <div className="absolute -top-[1px] left-8 right-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-red-400 to-transparent shoutout-spark pointer-events-none" />
        <div className="absolute -bottom-[1px] left-8 right-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-red-400 to-transparent shoutout-spark-2 pointer-events-none" />

        {/* Card body */}
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-red-950/60 via-black/80 to-red-950/40 backdrop-blur-sm border border-red-500/30">
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)',
            }}
          />

          <div className="relative flex items-center gap-3 px-4 py-3">
            {/* Icon */}
            <div
              className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'radial-gradient(circle, #ef4444, #991b1b)', boxShadow: '0 0 12px rgba(239,68,68,0.6)' }}
            >
              ⚡
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[9px] font-black tracking-[0.2em] uppercase"
                  style={{ color: '#ef4444', textShadow: '0 0 8px rgba(239,68,68,0.8)' }}
                >
                  SITE ACTIVITY
                </span>
                {timeAgo && (
                  <span className="text-[9px] text-red-900/80">· {timeAgo}</span>
                )}
              </div>
              <p className="text-sm text-red-100/90 font-medium leading-snug">{shoutout.message}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

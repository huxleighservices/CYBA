'use client';

import { formatDistanceToNow } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

export interface Review {
  id: string;
  userId: string;
  username?: string;
  rating: number;
  text: string;
  anonymous: boolean;
  createdAt: Timestamp;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= rating ? '#fbbf24' : '#374151', textShadow: n <= rating ? '0 0 6px rgba(251,191,36,0.6)' : 'none' }}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ReviewCard({ review }: { review: Review }) {
  const timeAgo = review.createdAt?.toDate
    ? formatDistanceToNow(review.createdAt.toDate(), { addSuffix: true })
    : '';
  const displayName = review.anonymous ? 'Anonymous' : `@${review.username ?? 'user'}`;

  return (
    <>
      <style>{`
        @keyframes review-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(251,191,36,0.3), 0 0 24px rgba(251,191,36,0.1); }
          50%       { box-shadow: 0 0 18px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2); }
        }
        .review-card-glow { animation: review-glow 3s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full max-w-2xl mx-auto">
        <div
          className="review-card-glow rounded-xl overflow-hidden border border-yellow-500/30 bg-gradient-to-br from-yellow-950/40 via-black/80 to-amber-950/30 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3 px-4 py-3">
            {/* Icon */}
            <div
              className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'radial-gradient(circle, #d97706, #92400e)', boxShadow: '0 0 10px rgba(217,119,6,0.5)' }}
            >
              ⭐
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-black tracking-[0.2em] uppercase"
                    style={{ color: '#fbbf24', textShadow: '0 0 8px rgba(251,191,36,0.6)' }}
                  >
                    CYBAZONE REVIEW
                  </span>
                  {timeAgo && <span className="text-[9px] text-yellow-900/80">· {timeAgo}</span>}
                </div>
                <Stars rating={review.rating} />
              </div>
              <p className="text-sm text-yellow-100/90 font-medium leading-snug">{review.text}</p>
              <p className="text-[10px] text-yellow-500/60">
                {review.anonymous ? '🎭 Anonymous' : `👤 ${displayName}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

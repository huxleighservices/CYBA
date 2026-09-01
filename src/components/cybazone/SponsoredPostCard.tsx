'use client';

import { PostCard, type CybazonePost } from './PostCard';
import { useFirebase } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { X } from 'lucide-react';

export function SponsoredPostCard({
  post,
  sponsoredItemId,
  ownerId,
}: {
  post: CybazonePost;
  sponsoredItemId?: string;
  ownerId?: string;
}) {
  const { firestore, user } = useFirebase();
  const isOwner = user?.uid === ownerId;

  const handleDelete = async () => {
    if (!sponsoredItemId) return;
    await deleteDoc(doc(firestore, 'sponsored_items', sponsoredItemId));
  };

  return (
    <>
      <style>{`
        @keyframes sponsor-border-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sponsor-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
        .sponsor-glow-ring {
          animation: sponsor-border-spin 5s linear infinite;
        }
        .sponsor-label-pulse {
          animation: sponsor-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="relative w-full">
        {/* Spinning gradient border */}
        <div className="absolute -inset-[2px] rounded-2xl overflow-hidden z-0 pointer-events-none">
          <div
            className="sponsor-glow-ring absolute inset-[-100%]"
            style={{
              background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed, #3b82f6, #7c3aed)',
            }}
          />
        </div>

        {/* Outer glow */}
        <div
          className="absolute -inset-[3px] rounded-2xl pointer-events-none sponsor-label-pulse"
          style={{ boxShadow: '0 0 30px rgba(139,92,246,0.5), 0 0 60px rgba(139,92,246,0.2)' }}
        />

        {/* Sponsored label */}
        <div className="absolute -top-3 left-4 z-20">
          <span
            className="sponsor-label-pulse inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[9px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full shadow-lg"
            style={{ boxShadow: '0 0 12px rgba(139,92,246,0.8)' }}
          >
            <span className="text-yellow-300">★</span>
            SPOTLIGHT
          </span>
        </div>

        {/* Owner delete button */}
        {isOwner && sponsoredItemId && (
          <button
            onClick={handleDelete}
            className="absolute -top-3 right-2 z-20 h-6 w-6 rounded-full bg-black/80 border border-purple-500/40 text-white/70 hover:text-white hover:bg-red-900/80 flex items-center justify-center transition-colors"
            title="Remove spotlight post"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Card */}
        <div className="relative z-10 mt-2">
          <PostCard post={post} />
        </div>
      </div>
    </>
  );
}

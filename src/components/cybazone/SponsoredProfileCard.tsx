'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { LevelBadge } from '@/components/LevelBadge';
import { Button } from '@/components/ui/button';
import { MapPin, UserPlus, UserMinus, Loader2, X } from 'lucide-react';
import { computeLevel } from '@/lib/levels';
import { useState } from 'react';
import Link from 'next/link';
import type { AvatarConfig } from '@/lib/avatar-assets';
import type { CybazonePost } from './PostCard';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

type SponsoredUser = {
  id: string;
  username: string;
  bio?: string;
  location?: string;
  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string;
  postCount?: number;
  supportGiven?: number;
  followers?: string[];
  following?: string[];
  membershipTier?: string;
  payoutEnrolled?: boolean;
};

function MiniPost({ post }: { post: CybazonePost }) {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-black/30 p-3 text-xs text-purple-100/80 leading-relaxed line-clamp-3">
      {post.content}
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="mt-2 w-full rounded object-cover max-h-24" />
      )}
      <p className="text-[10px] text-purple-400/60 mt-1.5">
        {post.timestamp?.toDate ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : ''}
      </p>
    </div>
  );
}

export function SponsoredProfileCard({ userId, sponsoredItemId }: { userId: string; sponsoredItemId?: string }) {
  const { firestore, user: currentUser } = useFirebase();
  const [isFollowMutating, setIsFollowMutating] = useState(false);

  const handleDelete = async () => {
    if (!sponsoredItemId) return;
    await deleteDoc(doc(firestore, 'sponsored_items', sponsoredItemId));
  };

  const userQuery = useMemoFirebase(
    () => query(collection(firestore, 'users'), where('id', '==', userId), limit(1)),
    [firestore, userId]
  );
  const { data: users } = useCollection<SponsoredUser>(userQuery);
  const profile = users?.[0];

  const postsQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'cybazone_posts'),
      where('authorId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(3)
    ),
    [firestore, userId]
  );
  const { data: posts } = useCollection<CybazonePost>(postsQuery);

  const currentUserQuery = useMemoFirebase(
    () => currentUser?.uid
      ? query(collection(firestore, 'users'), where('id', '==', currentUser.uid), limit(1))
      : null,
    [firestore, currentUser?.uid]
  );
  const { data: currentUsers } = useCollection<SponsoredUser>(currentUserQuery);
  const currentUserProfile = currentUsers?.[0];

  if (!profile) return null;

  const level = computeLevel(profile.postCount, profile.supportGiven);
  const followerCount = profile.followers?.length ?? 0;
  const isFollowing = currentUser && profile.followers?.includes(currentUser.uid);
  const isSelf = currentUser?.uid === profile.id;

  const handleFollowToggle = async () => {
    if (!currentUser || isSelf) return;
    setIsFollowMutating(true);
    try {
      const currentUserRef = doc(firestore, 'users', currentUser.uid);
      const targetRef = doc(firestore, 'users', profile.id);
      if (isFollowing) {
        await Promise.all([
          updateDoc(currentUserRef, { following: arrayRemove(profile.id) }),
          updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) }),
        ]);
      } else {
        await Promise.all([
          updateDoc(currentUserRef, { following: arrayUnion(profile.id) }),
          updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) }),
        ]);
      }
    } catch (e) { console.error(e); }
    finally { setIsFollowMutating(false); }
  };

  return (
    <>
      <style>{`
        @keyframes sp-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes sp-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .sp-ring { animation: sp-spin 5s linear infinite; }
        .sp-pulse { animation: sp-pulse 2s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full">
        {/* Spinning gradient border */}
        <div className="absolute -inset-[2px] rounded-2xl overflow-hidden z-0 pointer-events-none">
          <div
            className="sp-ring absolute inset-[-100%]"
            style={{ background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed, #3b82f6, #7c3aed)' }}
          />
        </div>
        <div
          className="absolute -inset-[3px] rounded-2xl pointer-events-none sp-pulse"
          style={{ boxShadow: '0 0 30px rgba(139,92,246,0.5), 0 0 60px rgba(139,92,246,0.2)' }}
        />

        {/* Sponsored label */}
        <div className="absolute -top-3 left-4 z-20">
          <span
            className="sp-pulse inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[9px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full shadow-lg"
            style={{ boxShadow: '0 0 12px rgba(139,92,246,0.8)' }}
          >
            <span className="text-yellow-300">★</span>
            SPOTLIGHT PROFILE
          </span>
        </div>

        {/* Owner delete button */}
        {isSelf && sponsoredItemId && (
          <button
            onClick={handleDelete}
            className="absolute -top-3 right-2 z-20 h-6 w-6 rounded-full bg-black/80 border border-purple-500/40 text-white/70 hover:text-white hover:bg-red-900/80 flex items-center justify-center transition-colors"
            title="Remove spotlight profile"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Card body */}
        <div
          className="relative z-10 rounded-2xl overflow-hidden mt-2"
          style={{ background: 'linear-gradient(135deg, #120826 0%, #0d0520 60%, #080312 100%)' }}
        >
          {/* Scanline */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: '100%',
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139,92,246,0.03) 2px, rgba(139,92,246,0.03) 4px)',
            }}
          />

          <div className="relative p-5 space-y-4">
            {/* Profile header */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  className="absolute -inset-1 rounded-full sp-pulse"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', filter: 'blur(4px)', opacity: 0.7 }}
                />
                <AvatarDisplay
                  profilePictureUrl={profile.profilePictureUrl}
                  avatarConfig={profile.avatarConfig}
                  size={72}
                  level={level}
                />
              </div>

              <div className="flex-1 min-w-0">
                <Link href={`/u/${profile.username}`} className="hover:underline">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                    {profile.username}
                    <LevelBadge level={level} size="sm" />
                    {profile.payoutEnrolled && <span title="Payout Boost Member">🏦</span>}
                    {profile.membershipTier === 'pro' && (
                      <span className="text-[9px] font-black bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full">PRO</span>
                    )}
                  </h3>
                </Link>
                <p className="text-xs text-purple-300/60 mt-0.5">
                  <strong className="text-white">{followerCount}</strong> followers
                </p>
                {profile.location && (
                  <p className="text-xs text-purple-300/50 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {profile.location}
                  </p>
                )}
              </div>

              {/* Follow button */}
              {!isSelf && currentUser && (
                <Button
                  size="sm"
                  variant={isFollowing ? 'outline' : 'default'}
                  className={`shrink-0 rounded-full px-4 ${!isFollowing ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0' : 'border-purple-500/40 text-purple-300 hover:text-white'}`}
                  onClick={handleFollowToggle}
                  disabled={isFollowMutating}
                >
                  {isFollowMutating
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : isFollowing
                      ? <><UserMinus className="w-3 h-3 mr-1" />Unfollow</>
                      : <><UserPlus className="w-3 h-3 mr-1" />Follow</>
                  }
                </Button>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-purple-200/70 leading-relaxed border-l-2 border-purple-500/30 pl-3">
                {profile.bio}
              </p>
            )}

            {/* Recent posts */}
            {posts && posts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] text-purple-400/60 uppercase tracking-widest font-semibold">Recent Posts</p>
                {posts.slice(0, 2).map(post => (
                  <MiniPost key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* View profile CTA */}
            <Link
              href={`/u/${profile.username}`}
              className="block text-center text-xs text-purple-400 hover:text-purple-300 transition-colors py-2 border border-purple-500/20 rounded-lg hover:border-purple-400/40 hover:bg-purple-950/30"
            >
              View Full Profile →
            </Link>
          </div>

          {/* Footer glow */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent sp-pulse" />
        </div>
      </div>
    </>
  );
}

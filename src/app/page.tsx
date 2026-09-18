'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Users, Globe, Radio, Megaphone, Zap, Boxes } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, where, limit, doc, updateDoc, increment, type Timestamp } from 'firebase/firestore';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import { ShoutoutCard } from '@/components/cybazone/ShoutoutCard';
import { ReviewCard, type Review } from '@/components/cybazone/ReviewCard';
import { WeeklyWinnersTicker } from '@/components/WeeklyWinnersTicker';
import { cn } from '@/lib/utils';
import type { Shoutout } from '@/lib/shoutouts';
import { SkipForward, Menu, X, Play, Pause } from 'lucide-react';
import { mergeWithDefaults, type CCRates } from '@/lib/cc-rewards';
import { PulsesRow } from '@/components/cybazone/PulsesRow';
import { SubnetsTab } from '@/components/cybazone/SubnetsTab';
import type { AvatarConfig } from '@/lib/avatar-assets';

type UserProfile = {
  id: string;
  following?: string[];
  username?: string;
  profilePictureUrl?: string;
  avatarConfig?: AvatarConfig;
  postCount?: number;
  supportGiven?: number;
  levelOverride?: string;
  adFreeBoost?: boolean;
};

type Ad = {
  id: string;
  userId: string;
  username: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  buttonText: string;
  buttonLink: string;
  durationDays: number;
  expiresAt?: Timestamp;
  status: 'pending_payment' | 'active' | 'expired';
};

// Seeded pseudo-random to keep position stable per session
function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function isPostVisible(p: CybazonePost, now: number): boolean {
  if ((p as any).published !== false) return true; // regular post, always visible
  const scheduledAt = (p as any).scheduledAt;
  if (!scheduledAt) return false;
  return scheduledAt.toMillis() <= now; // scheduled time has passed → show it
}

function buildFeedItems(
  posts: CybazonePost[],
  shoutouts: Shoutout[] = [],
  reviews: Review[] = [],
  now: number = Date.now(),
  ads: Ad[] = [],
): Array<{ key: string; type: 'post' | 'shoutout' | 'review' | 'ad'; data: any }> {
  const result: Array<{ key: string; type: 'post' | 'shoutout' | 'review' | 'ad'; data: any }> = posts
    .filter(p => isPostVisible(p, now))
    .map(p => ({
      key: p.id,
      type: 'post',
      data: p,
    }));

  // In-feed Promo Blast ads — every 3-5 real posts (skipped entirely for Ad-Free members by
  // the caller, which simply passes an empty ads array in that case).
  if (ads.length > 0) {
    let cursor = 0;
    ads.forEach((ad, i) => {
      const gap = 3 + Math.floor(seededRandom(i * 11 + 3) * 3); // 3, 4, or 5
      cursor += gap;
      const insertAt = Math.min(cursor, result.length);
      result.splice(insertAt, 0, { key: `ad-${ad.id}`, type: 'ad', data: ad });
      cursor += 1; // account for the item we just inserted
    });
  }

  // Inject shoutouts every ~6 items (always, regardless of post count)
  shoutouts.forEach((shoutout, i) => {
    const insertAt = Math.min((i + 1) * 6, result.length);
    result.splice(insertAt, 0, {
      key: `shoutout-${shoutout.id}`,
      type: 'shoutout',
      data: shoutout,
    });
  });

  // Inject reviews every ~10 items, offset by 4 to interleave with shoutouts
  reviews.forEach((review, i) => {
    const insertAt = Math.min((i * 10) + 4, result.length);
    result.splice(insertAt, 0, {
      key: `review-${review.id}`,
      type: 'review',
      data: review,
    });
  });

  return result;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type RadioQueueItem =
  | { type: 'youtube'; videoId: string; mediaUrl?: undefined; username?: string; title?: string }
  | { type: 'upload'; mediaUrl: string; videoId?: undefined; username?: string; title?: string };

function CybaRadioPlayer({
  playlistId,
  queueItems,
}: {
  playlistId?: string;
  queueItems?: RadioQueueItem[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const useQueue = (queueItems?.length ?? 0) > 0;
  const [shuffledQueue, setShuffledQueue] = useState<RadioQueueItem[]>([]);
  useEffect(() => {
    // Always shuffled — there's no user-facing shuffle toggle, the queue is just randomized
    // once per session so repeat visits don't hear tracks in upload order.
    if (useQueue) { setShuffledQueue(shuffleArray(queueItems!)); setQueueIndex(0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useQueue, queueItems?.length]);

  const currentItem = useQueue ? shuffledQueue[queueIndex] : null;

  const advanceQueue = () => setQueueIndex(i => (shuffledQueue.length ? (i + 1) % shuffledQueue.length : 0));

  // ── YouTube player — created for the fallback playlist, or for the current queue item
  // when it's a YouTube submission. Destroyed/recreated whenever we switch to/from an
  // uploaded-video item, since the YT IFrame API can't play arbitrary file URLs. Only attempted
  // while open — the container div isn't mounted at all while closed (just the bubble), so
  // opening is what first makes the container available for `createPlayer()` to attach to.
  // Always autoplays: a player only ever gets (re)created as a result of opening, and the whole
  // point of clicking the closed bubble is "start playing," per the closed/open = stopped/playing
  // design below.
  useEffect(() => {
    if (!isOpen) return;
    if (useQueue && currentItem?.type !== 'youtube') return;
    if (useQueue && !currentItem) return;

    setIsReady(false);

    let player: any;
    function createPlayer() {
      if (!containerRef.current) return;
      if (useQueue && currentItem?.type === 'youtube') {
        player = new (window as any).YT.Player(containerRef.current, {
          height: '100%', width: '100%',
          videoId: currentItem.videoId,
          playerVars: { autoplay: 1, controls: 0, rel: 0, enablejsapi: 1 },
          events: {
            onReady: (e: any) => { playerRef.current = player; setIsReady(true); setIsPlaying(true); e.target.playVideo(); },
            onStateChange: (e: any) => {
              setIsPlaying(e.data === 1);
              if (e.data === 0) advanceQueue(); // ended → next track
            },
          },
        });
      } else if (!useQueue && playlistId) {
        player = new (window as any).YT.Player(containerRef.current, {
          height: '100%', width: '100%',
          playerVars: { listType: 'playlist', list: playlistId, autoplay: 1, controls: 0, rel: 0, enablejsapi: 1 },
          events: {
            onReady: (e: any) => { setIsReady(true); playerRef.current = player; setIsPlaying(true); e.target.playVideo(); },
            onStateChange: (e: any) => setIsPlaying(e.data === 1),
          },
        });
      }
    }

    if (typeof window === 'undefined') return;
    if ((window as any).YT?.Player) {
      createPlayer();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => { prev?.(); createPlayer(); };
    }

    return () => { player?.destroy(); playerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId, useQueue, currentItem?.type, currentItem?.videoId, queueIndex, isOpen]);

  // ── Uploaded-video playback — plain <video> element, swapped in when the current queue
  // item is a direct upload rather than a YouTube submission. ──
  useEffect(() => {
    if (!isOpen || !useQueue || currentItem?.type !== 'upload') { setIsReady(false); return; }
    setIsReady(true);
    const el = videoElRef.current;
    if (el) el.play().then(() => setIsPlaying(true)).catch(() => {});
  }, [isOpen, useQueue, currentItem, queueIndex]);

  // The YouTube IFrame API freezes the iframe's pixel size at creation time — opening the
  // player resizes the *container* via CSS, but the iframe inside needs an explicit setSize()
  // call or it stays the old size (looks blank/clipped). Not needed for the <video> case above,
  // since a native <video> element already follows CSS sizing.
  useEffect(() => {
    const el = containerRef.current;
    const p = playerRef.current;
    if (!el || !p?.setSize) return;
    const id = requestAnimationFrame(() => {
      if (containerRef.current && playerRef.current?.setSize) {
        playerRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, isReady]);

  const togglePlay = () => {
    if (useQueue && currentItem?.type === 'upload') {
      const el = videoElRef.current;
      if (!el) return;
      if (isPlaying) { el.pause(); setIsPlaying(false); } else { el.play().catch(() => {}); setIsPlaying(true); }
      return;
    }
    const p = playerRef.current;
    if (!p) return;
    isPlaying ? p.pauseVideo() : p.playVideo();
  };
  const skipNext = () => {
    if (useQueue) { advanceQueue(); return; }
    playerRef.current?.nextVideo();
  };
  // Closing tears the player down entirely (the container unmounts) rather than playing
  // silently in the background — matches "closed = idle, click the button to start playing."
  const handleClose = () => { setIsOpen(false); setShowPlaylist(false); setIsPlaying(false); };

  return (
    <>
      <style>{`
        @keyframes radio-pulse{0%,100%{box-shadow:0 0 8px rgba(168,85,247,.35),0 0 18px rgba(168,85,247,.1)}50%{box-shadow:0 0 14px rgba(168,85,247,.6),0 0 32px rgba(168,85,247,.2)}}
        @keyframes radio-bar{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
        @keyframes radio-bubble{0%,100%{box-shadow:0 0 10px rgba(168,85,247,.5),0 0 22px rgba(168,85,247,.2)}50%{box-shadow:0 0 18px rgba(168,85,247,.8),0 0 36px rgba(168,85,247,.3)}}
        .radio-glow{animation:radio-pulse 2.5s ease-in-out infinite}
        .radio-bubble-glow{animation:radio-bubble 2.5s ease-in-out infinite}
        .radio-bar-1{animation:radio-bar .6s ease-in-out infinite}
        .radio-bar-2{animation:radio-bar .6s ease-in-out .15s infinite}
        .radio-bar-3{animation:radio-bar .6s ease-in-out .3s infinite}
      `}</style>

      {!isOpen ? (
        /* Closed — just the purple button. Clicking opens the player and starts it playing. */
        <button
          onClick={() => setIsOpen(true)}
          className="radio-bubble-glow fixed bottom-20 md:bottom-4 right-4 z-40 h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
          style={{ background: 'radial-gradient(circle at 40% 35%,#7c3aed,#3b0764)', border: '1px solid rgba(139,92,246,.6)' }}
          title="Open CYBAZONE RADIO"
        >
          <Radio className="h-6 w-6 text-purple-200" />
        </button>
      ) : (
        /* Open player bar — full width w/ small side padding above the mobile footer, a fixed
           bottom-right card on desktop. */
        <div className="fixed z-40 left-2 right-2 bottom-16 md:left-auto md:right-4 md:bottom-4 md:w-[400px]">
          <div className="radio-glow rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/90 via-black/90 to-indigo-950/80 backdrop-blur-md overflow-hidden shadow-2xl">
            <div className="flex items-stretch h-[84px]">
              {/* Video panel — YT iframe for youtube tracks/fallback playlist, <video> for uploads */}
              {useQueue && currentItem?.type === 'upload' ? (
                <video
                  ref={videoElRef}
                  src={currentItem.mediaUrl}
                  className="shrink-0 bg-black object-contain w-[140px] sm:w-[160px] h-full"
                  muted
                  playsInline
                  onEnded={advanceQueue}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div ref={containerRef} className="shrink-0 bg-black w-[140px] sm:w-[160px] h-full" />
              )}

              <div className="w-px bg-purple-500/20 shrink-0" />

              {/* Controls column */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 px-3.5 relative">
                <button
                  onClick={handleClose}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center text-purple-400/70 hover:text-purple-200 hover:bg-purple-800/40 transition-colors"
                  title="Close"
                >
                  <span className="text-base leading-none">›</span>
                </button>

                {/* Status — submitter username is a link to their profile, shown as soon as a
                    track is loaded (not gated on isPlaying, so it's clickable while paused too) */}
                <span className="text-[11px] text-white/70 truncate pr-7">
                  {!isReady ? 'Loading…' : currentItem?.username ? (
                    <>
                      <Link href={`/u/${currentItem.username}`} className="text-purple-300 hover:underline font-semibold">
                        {currentItem.username}
                      </Link>
                      {currentItem.title ? ` — ${currentItem.title}` : ''}
                    </>
                  ) : isPlaying ? 'Now Streaming…' : 'CYBAZONE RADIO'}
                </span>

                {/* Playback controls */}
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setShowPlaylist(true)} disabled={!useQueue} title="Browse tracks"
                    className="h-8 w-8 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30"
                    style={{ background: 'rgba(109,40,217,.25)', border: '1px solid rgba(139,92,246,.4)' }}>
                    <Menu className="w-3.5 h-3.5 text-purple-100" />
                  </button>
                  <button onClick={togglePlay} disabled={!isReady}
                    className="h-9 w-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-40"
                    style={{ background: isPlaying ? '#6d28d9' : 'rgba(109,40,217,.35)', border: '1px solid rgba(139,92,246,.5)' }}>
                    {isPlaying
                      ? <Pause className="w-3.5 h-3.5 text-white" fill="currentColor" />
                      : <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
                    }
                  </button>
                  <button onClick={skipNext} disabled={!isReady} title="Next"
                    className="h-8 w-8 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30"
                    style={{ background: 'rgba(109,40,217,.25)', border: '1px solid rgba(139,92,246,.4)' }}>
                    <SkipForward className="w-3.5 h-3.5 text-purple-100" fill="currentColor" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen track pop-out — hamburger opens this on both mobile and desktop. Portaled
          to document.body so it isn't confined by any ancestor's backdrop-filter (the header has
          one, which otherwise traps "fixed" descendants inside its own small box). */}
      {mounted && showPlaylist && useQueue && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col" onClick={() => setShowPlaylist(false)}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 shrink-0">
            <span className="text-sm font-black tracking-widest uppercase text-purple-300">CYBAZONE RADIO — Tracks</span>
            <button
              onClick={() => setShowPlaylist(false)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
            {shuffledQueue.map((item, i) => (
              <button
                key={`${item.type}-${i}`}
                onClick={() => { setQueueIndex(i); setShowPlaylist(false); }}
                className={cn(
                  'w-full text-left px-5 py-3.5 text-sm flex items-center gap-3 border-b border-white/5 hover:bg-purple-800/20 transition-colors',
                  i === queueIndex ? 'bg-purple-800/30 text-purple-200' : 'text-white/70',
                )}
              >
                <span className="shrink-0">{item.type === 'upload' ? '📤' : '▶️'}</span>
                <span className="truncate">
                  {item.username ? <span className="font-semibold">{item.username}</span> : 'Unknown'}
                  {item.title ? ` — ${item.title}` : ''}
                </span>
              </button>
            ))}
            {shuffledQueue.length === 0 && (
              <p className="px-5 py-10 text-sm text-white/40 text-center">No submissions in the queue yet.</p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function CentralPage() {
  const { firestore, user: currentUser, isUserLoading } = useFirebase();
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'zaps' | 'subnets'>('all');
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate scheduled post visibility every minute
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Handle ?tab=<tab> from deep links (e.g. profile's "My Subnet" link)
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'all' || tab === 'following' || tab === 'zaps' || tab === 'subnets') setActiveTab(tab);
  }, []);

  // Handle ?post=<id> from notification links — scroll to and highlight the post
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get('post');
    if (!postId) return;
    setHighlightedPostId(postId);
    const tryScroll = (attempts = 0) => {
      const el = document.getElementById(`post-${postId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (attempts < 10) setTimeout(() => tryScroll(attempts + 1), 400);
    };
    setTimeout(() => tryScroll(), 600);
  }, []);

  const currentUserQuery = useMemoFirebase(
    () =>
      currentUser?.uid
        ? query(collection(firestore, 'users'), where('id', '==', currentUser.uid), limit(1))
        : null,
    [firestore, currentUser?.uid]
  );
  const { data: currentUsers } = useCollection<UserProfile>(currentUserQuery);
  const currentUserProfile = currentUsers?.[0];

  // Fetched once here and passed to every PostCard, instead of each of the (up to ~50)
  // rendered cards opening its own duplicate listener on the same global settings doc.
  const ccRatesRef = useMemoFirebase(() => doc(firestore, 'settings', 'ccRates'), [firestore]);
  const { data: ccRatesRaw } = useDoc<Partial<CCRates>>(ccRatesRef);
  const ccRates = useMemo(() => (ccRatesRaw ? mergeWithDefaults(ccRatesRaw) : null), [ccRatesRaw]);

  // Subnets the viewer currently has active (paid) access to — used to unlock subnetOnly posts.
  const mySubnetMembershipsQuery = useMemoFirebase(
    () =>
      currentUser?.uid
        ? query(collection(firestore, 'subnet_memberships'), where('memberId', '==', currentUser.uid), where('status', '==', 'active'))
        : null,
    [firestore, currentUser?.uid]
  );
  const { data: mySubnetMemberships } = useCollection<{ ownerId: string }>(mySubnetMembershipsQuery);
  const subnetAccessOwnerIds = useMemo(
    () => new Set((mySubnetMemberships ?? []).map(m => m.ownerId)),
    [mySubnetMemberships]
  );

  const followingList = currentUserProfile?.following || [];
  const safeFollowingListStr = JSON.stringify(followingList.slice(0, 30));

  const allPostsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'cybazone_posts'), orderBy('timestamp', 'desc'), limit(50)) : null),
    [firestore]
  );
  const { data: allPosts, isLoading: isLoadingAll } = useCollection<CybazonePost>(allPostsQuery);

  const followingPostsQuery = useMemoFirebase(
    () => {
      const list = JSON.parse(safeFollowingListStr);
      if (!firestore || !currentUserProfile || list.length === 0) return null;
      return query(
        collection(firestore, 'cybazone_posts'),
        where('authorId', 'in', list),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    },
    [firestore, currentUserProfile?.id, safeFollowingListStr]
  );
  const { data: followingPostsData, isLoading: isLoadingFollowing } = useCollection<CybazonePost>(followingPostsQuery);
  const followingPosts = JSON.parse(safeFollowingListStr).length === 0 ? [] : followingPostsData;

  // Load active shoutouts — no composite index needed; filter active+expiry client-side
  const shoutoutsQuery = useMemoFirebase(
    () => query(collection(firestore, 'shoutouts'), orderBy('createdAt', 'desc'), limit(24)),
    [firestore]
  );
  const { data: shoutoutsRaw } = useCollection<Shoutout>(shoutoutsQuery);
  const activeShoutouts = useMemo(() => {
    const now = Date.now();
    return (shoutoutsRaw ?? []).filter(s => s.active !== false && (!s.expiresAt || s.expiresAt > now));
  }, [shoutoutsRaw]);

  // Load recent reviews for feed injection
  const reviewsQuery = useMemoFirebase(
    () => query(collection(firestore, 'reviews'), orderBy('createdAt', 'desc'), limit(5)),
    [firestore]
  );
  const { data: reviewsRaw } = useCollection<Review>(reviewsQuery);
  const feedReviews = reviewsRaw ?? [];

  // Load current radio station
  const radioRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: radioStation } = useDoc<{ playlistId?: string; active?: boolean }>(radioRef);

  // Load Radio Boost submissions for this month
  const radioSubsQuery = useMemoFirebase(
    () => query(collection(firestore, 'radio_submissions')),
    [firestore]
  );
  const { data: radioSubmissions } = useCollection<{ videoId?: string; mediaUrl?: string; sourceType?: 'youtube' | 'upload'; username?: string; title?: string }>(radioSubsQuery);
  const radioQueueItems: RadioQueueItem[] = useMemo(() => (radioSubmissions ?? [])
    .map((s): RadioQueueItem | null => {
      if (s.sourceType === 'upload' && s.mediaUrl) {
        return { type: 'upload', mediaUrl: s.mediaUrl, username: s.username, title: s.title };
      }
      if (s.videoId) {
        return { type: 'youtube', videoId: s.videoId, username: s.username, title: s.title };
      }
      return null;
    })
    .filter((x): x is RadioQueueItem => x !== null),
  [radioSubmissions]);

  // Load active ads
  const adsQuery = useMemoFirebase(
    () => query(collection(firestore, 'ads'), where('status', '==', 'active')),
    [firestore]
  );
  const { data: adsData } = useCollection<Ad>(adsQuery);

  const isAdFree = !!currentUserProfile?.adFreeBoost;

  const activeAds = useMemo(() => {
    const now = Date.now();
    return (adsData ?? []).filter(a => {
      if (!a.expiresAt) return true;
      return a.expiresAt.toDate().getTime() > now;
    });
  }, [adsData]);

  // In-feed injection is skipped entirely for Ad-Free members — they can still opt in via /promo-blast.
  const inFeedAds = isAdFree ? [] : activeAds;

  const allFeedItems = useMemo(
    () => buildFeedItems(allPosts ?? [], activeShoutouts, feedReviews, now, inFeedAds),
    [allPosts, activeShoutouts, feedReviews, now, inFeedAds]
  );

  const followingFeedItems = useMemo(
    () => buildFeedItems(followingPosts ?? [], activeShoutouts, feedReviews, now, inFeedAds),
    [followingPosts, activeShoutouts, feedReviews, now, inFeedAds]
  );

  // Zaps — video posts only, filtered from the same Global set (no separate content type).
  const zapsFeedItems = useMemo(
    () => buildFeedItems((allPosts ?? []).filter(p => p.mediaType === 'video'), [], [], now, inFeedAds),
    [allPosts, now, inFeedAds]
  );

  const renderFeedItem = (item: ReturnType<typeof buildFeedItems>[number]) => {
    if (item.type === 'shoutout') {
      return (
        <div key={item.key} className="w-full max-w-2xl mx-auto py-2">
          <ShoutoutCard shoutout={item.data} />
        </div>
      );
    }
    if (item.type === 'review') {
      return (
        <div key={item.key} className="w-full max-w-2xl mx-auto py-2">
          <ReviewCard review={item.data} />
        </div>
      );
    }
    if (item.type === 'ad') {
      const ad: Ad = item.data;
      return (
        <div key={item.key} className="w-full max-w-2xl mx-auto py-2">
          <a
            href={ad.buttonLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => updateDoc(doc(firestore, 'ads', ad.id), { clickCount: increment(1) }).catch(() => {})}
            className="group flex items-stretch gap-3 rounded-xl border border-border/50 bg-card/50 hover:border-primary/40 transition-colors overflow-hidden"
          >
            <div className="w-28 h-28 shrink-0 bg-black/30 overflow-hidden">
              {ad.mediaType === 'video' ? (
                // No autoplay/eager fetch here — the feed can have many of these injected at
                // once, and autoplaying every single one was pulling down full video files
                // simultaneously on page load (a real contributor to slow/timed-out loads).
                <video src={ad.mediaUrl} className="w-full h-full object-cover" muted loop playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex flex-col justify-center gap-1.5 py-2 pr-3 min-w-0">
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Sponsored · @{ad.username}</span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
                {ad.buttonText}
              </span>
            </div>
          </a>
        </div>
      );
    }
    return (
      <div
        key={item.key}
        id={`post-${item.data.id}`}
        className={cn(
          'w-full max-w-2xl mx-auto rounded-xl transition-all duration-700 backdrop-blur-sm',
          highlightedPostId === item.data.id && 'ring-2 ring-primary/60 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
        )}
      >
        <PostCard post={item.data} viewerProfile={currentUserProfile} ccRates={ccRates} subnetAccessOwnerIds={subnetAccessOwnerIds} />
      </div>
    );
  };

  const renderFeed = (
    items: ReturnType<typeof buildFeedItems>,
    isLoading: boolean,
    emptyMessage: string
  ) => {
    if (isLoading || isUserLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    const realPosts = items.filter(i => i.type === 'post');
    if (realPosts.length === 0) {
      return (
        <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-muted-foreground/30 bg-card/10 rounded-xl max-w-2xl mx-auto backdrop-blur-sm animate-in fade-in">
          <h3 className="text-xl font-bold font-headline mb-2">{emptyMessage}</h3>
          <p>Get active and start connecting!</p>
        </div>
      );
    }
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {items.map(renderFeedItem)}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 pt-4 pb-16 min-h-screen">

      {/* Pulses — 24h ephemeral stories, own circle first then followed CYBAs */}
      <PulsesRow
        currentUserId={currentUser?.uid}
        currentUsername={currentUserProfile?.username}
        currentUserProfilePictureUrl={currentUserProfile?.profilePictureUrl}
        currentUserAvatarConfig={currentUserProfile?.avatarConfig}
        currentUserPostCount={currentUserProfile?.postCount}
        currentUserSupportGiven={currentUserProfile?.supportGiven}
        currentUserLevelOverride={currentUserProfile?.levelOverride}
        ccRates={ccRates}
        followingList={followingList}
      />

      {currentUser && currentUserProfile?.username && (
        <div className="max-w-3xl mx-auto mb-6 flex justify-end">
          <Link
            href={`/live/${currentUserProfile.username}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-1.5 text-xs font-bold transition-colors"
          >
            <Radio className="h-3.5 w-3.5" /> Go Live
          </Link>
        </div>
      )}

      <div className="mb-8 -mx-4">
        <WeeklyWinnersTicker />
      </div>

      <div className="flex gap-8 max-w-6xl mx-auto items-start">
        {/* Main feed */}
        <div className="flex-1 min-w-0 max-w-3xl mx-auto">

          {/* Tab buttons — frosted glass */}
          <div className="grid grid-cols-4 max-w-lg mx-auto bg-black/40 backdrop-blur-md border border-primary/20 rounded-full p-1 mb-10 shadow-lg shadow-purple-950/20">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs sm:text-sm font-semibold transition-all select-none',
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Globe className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Global</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('following')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs sm:text-sm font-semibold transition-all select-none',
                activeTab === 'following'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Users className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Following</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('zaps')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs sm:text-sm font-semibold transition-all select-none',
                activeTab === 'zaps'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Zap className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Zaps</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subnets')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs sm:text-sm font-semibold transition-all select-none',
                activeTab === 'subnets'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Boxes className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Subnets</span>
            </button>
          </div>

          <div className="w-full">
            {activeTab === 'all' && renderFeed(allFeedItems, isLoadingAll, 'Central is Quiet...')}
            {activeTab === 'following' && (
              !currentUser ? (
                <div className="text-center text-foreground/60 p-12 border-dashed border-2 border-primary/20 bg-card/20 rounded-xl max-w-2xl mx-auto">
                  <h3 className="text-xl font-bold font-headline mb-2">Sign In Required</h3>
                  <p>You must be logged in to have a personalized feed.</p>
                </div>
              ) : (
                renderFeed(followingFeedItems, isLoadingFollowing, "You aren't following anyone yet, or they haven't posted.")
              )
            )}
            {activeTab === 'zaps' && renderFeed(zapsFeedItems, isLoadingAll, 'No Zaps yet — post a video to be the first!')}
            {activeTab === 'subnets' && (
              <SubnetsTab currentUserId={currentUser?.uid} currentUsername={currentUserProfile?.username} ccRates={ccRates} />
            )}
          </div>
        </div>

        {/* Ads sidebar — desktop only, skipped for Ad-Free members */}
        {!isAdFree && activeAds.length > 0 && (
          <aside className="hidden xl:flex flex-col gap-4 w-56 shrink-0 sticky top-24 pt-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Sponsored</p>
            {activeAds.map(ad => (
              <div key={ad.id} className="rounded-xl border border-border/50 bg-card/80 overflow-hidden hover:border-primary/30 transition-colors">
                <div className="bg-black/30 flex items-center justify-center overflow-hidden max-h-32">
                  {ad.mediaType === 'video' ? (
                    <video src={ad.mediaUrl} className="w-full max-h-32 object-cover" muted loop playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.mediaUrl} alt="ad" className="w-full max-h-32 object-cover" />
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground">@{ad.username}</p>
                  <a
                    href={ad.buttonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                  >
                    {ad.buttonText}
                  </a>
                </div>
              </div>
            ))}
          </aside>
        )}
      </div>

      {/* ── PROMO BLAST — floating bubble, stacked above the radio bubble ── */}
      <Link
        href="/promo-blast"
        className="fixed bottom-40 md:bottom-24 right-4 z-50 h-14 w-14 rounded-full flex items-center justify-center transition-transform hover:scale-110"
        style={{ background: 'radial-gradient(circle at 40% 35%,#f59e0b,#7c2d12)', border: '1px solid rgba(245,158,11,.6)', boxShadow: '0 0 14px rgba(245,158,11,.4)' }}
        title="PROMO BLAST"
      >
        <Megaphone className="h-6 w-6 text-amber-100" />
      </Link>

      {/* ── CYBAZONE RADIO — floating bubble ── */}
      {(radioQueueItems.length > 0 || (radioStation?.active && radioStation?.playlistId)) && (
        <CybaRadioPlayer
          playlistId={radioStation?.playlistId}
          queueItems={radioQueueItems.length > 0 ? radioQueueItems : undefined}
        />
      )}
    </div>
  );
}

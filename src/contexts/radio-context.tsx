'use client';

import {
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';

export type RadioQueueItem =
  | { type: 'youtube'; videoId: string; mediaUrl?: undefined; username?: string; title?: string }
  | { type: 'upload'; mediaUrl: string; videoId?: undefined; username?: string; title?: string };

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Stable identity for a queue item, independent of its (possibly still-loading) title —
 *  used to shuffle/look up tracks without freezing their displayed data at shuffle time. */
function itemKey(item: RadioQueueItem): string {
  return `${item.type}-${item.type === 'youtube' ? item.videoId : item.mediaUrl}`;
}

interface RadioContextValue {
  hasQueue: boolean;
  /** True when there are real member submissions (vs. only the admin fallback playlist) —
   *  only the submissions queue supports track-by-track browsing/shuffle/skip. */
  useQueue: boolean;
  orderedQueue: RadioQueueItem[];
  queueIndex: number;
  currentItem: RadioQueueItem | null;
  isPlaying: boolean;
  isReady: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoElRef: React.RefObject<HTMLVideoElement | null>;
  togglePlay: () => void;
  skipNext: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  selectIndex: (i: number) => void;
  /** Wire directly to the <video>'s onEnded for uploaded-track playback — handles repeat vs.
   *  advance-to-next the same way the YouTube player's onStateChange does. */
  handleUploadEnded: () => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used within RadioProvider');
  return ctx;
}

/**
 * Owns all CYBAZONE RADIO playback state at the app root (mounted once in the root layout, never
 * unmounted by route changes) so audio keeps playing as the user navigates — the actual
 * video/YouTube-iframe element lives in <RadioEngine>, which reads this context and repositions
 * itself (large player on /radio, thin mini-bar everywhere else) without ever remounting.
 */
export function RadioProvider({ children }: { children: ReactNode }) {
  const { firestore } = useFirebase();

  const radioRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: radioStation } = useDoc<{ playlistId?: string; active?: boolean }>(radioRef);

  const radioSubsQuery = useMemoFirebase(
    () => query(collection(firestore, 'radio_submissions')),
    [firestore],
  );
  const { data: radioSubmissions } = useCollection<{
    videoId?: string; mediaUrl?: string; sourceType?: 'youtube' | 'upload'; username?: string; title?: string;
  }>(radioSubsQuery);

  // Most submissions never have a manually-entered title — fetch the real title straight from
  // YouTube via its no-auth oEmbed endpoint so tracks actually show a name instead of just the
  // submitter's username. Cached by videoId so each one is only fetched once.
  //
  // The effect below keys off a joined STRING of video ids, not `radioSubmissions` itself —
  // Firestore's onSnapshot delivers a new array reference on essentially every emission (cache
  // hit, then server-confirmed, etc.) even when the actual data is unchanged, which made this
  // effect re-run and cancel its own in-flight fetches before they ever reached
  // setYoutubeTitles(). A joined string of ids only changes when the real *set* of videos does,
  // so the effect (and its fetches) now only reruns when there's actually new work to do.
  const [youtubeTitles, setYoutubeTitles] = useState<Record<string, string>>({});
  const submissionVideoIdsKey = useMemo(() => Array.from(new Set(
    (radioSubmissions ?? [])
      .filter(s => s.sourceType !== 'upload' && s.videoId)
      .map(s => s.videoId!),
  )).join(','), [radioSubmissions]);

  useEffect(() => {
    const ids = submissionVideoIdsKey ? submissionVideoIdsKey.split(',').filter(id => !(id in youtubeTitles)) : [];
    if (ids.length === 0) return;
    let cancelled = false;
    ids.forEach(async (id) => {
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data?.title) return;
        setYoutubeTitles(prev => ({ ...prev, [id]: data.title }));
      } catch {
        // Non-critical — falls back to the submission's own title field, if any.
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionVideoIdsKey]);

  const submissionItems: RadioQueueItem[] = useMemo(() => (radioSubmissions ?? [])
    .map((s): RadioQueueItem | null => {
      if (s.sourceType === 'upload' && s.mediaUrl) {
        return { type: 'upload', mediaUrl: s.mediaUrl, username: s.username, title: s.title };
      }
      if (s.videoId) {
        return { type: 'youtube', videoId: s.videoId, username: s.username, title: youtubeTitles[s.videoId] ?? s.title };
      }
      return null;
    })
    .filter((x): x is RadioQueueItem => x !== null),
  [radioSubmissions, youtubeTitles]);

  const useQueue = submissionItems.length > 0;
  const hasQueue = useQueue || !!(radioStation?.active && radioStation?.playlistId);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  // Shuffled order is stored as stable KEYS, not the item objects themselves — items are looked
  // back up from the latest `submissionItems` on every render below. Storing full objects here
  // meant the shuffle snapshot froze each track's data (title, etc.) at whatever it was the
  // moment shuffling happened — since YouTube titles arrive asynchronously via oEmbed shortly
  // after tracks first load, that snapshot almost always predates the real titles, so tracks
  // displayed the username fallback forever even once the real title had actually arrived.
  const [shuffledKeys, setShuffledKeys] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(true);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (useQueue) { setShuffledKeys(shuffleArray(submissionItems.map(itemKey))); setQueueIndex(0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useQueue, submissionItems.length]);

  const orderedQueue = useMemo(() => {
    if (!isShuffled) return submissionItems;
    const byKey = new Map(submissionItems.map(it => [itemKey(it), it]));
    return shuffledKeys.map(k => byKey.get(k)).filter((it): it is RadioQueueItem => !!it);
  }, [isShuffled, shuffledKeys, submissionItems]);
  const currentItem = useQueue ? (orderedQueue[queueIndex] ?? null) : null;

  // Refs mirroring state that the long-lived YT player event callbacks (set up inside an effect
  // that intentionally doesn't re-run on every state change) need to read fresh — otherwise
  // toggling repeat, or the queue reordering via shuffle, wouldn't take effect until the next
  // track change recreated the player.
  const isRepeatingRef = useRef(isRepeating);
  useEffect(() => { isRepeatingRef.current = isRepeating; }, [isRepeating]);
  const orderedLengthRef = useRef(orderedQueue.length);
  useEffect(() => { orderedLengthRef.current = orderedQueue.length; }, [orderedQueue.length]);

  const advanceQueue = () => setQueueIndex(i => (orderedLengthRef.current ? (i + 1) % orderedLengthRef.current : 0));

  // ── YouTube player — created for the fallback playlist, or for the current queue item when
  // it's a YouTube submission. Destroyed/recreated whenever we switch to/from an uploaded-video
  // item, since the YT IFrame API can't play arbitrary file URLs. ──
  useEffect(() => {
    if (useQueue && currentItem?.type !== 'youtube') return;
    if (useQueue && !currentItem) return;
    if (!useQueue && !radioStation?.playlistId) return;

    setIsReady(false);

    let player: any;
    function createPlayer() {
      if (!containerRef.current) return;
      if (useQueue && currentItem?.type === 'youtube') {
        player = new (window as any).YT.Player(containerRef.current, {
          height: '100%', width: '100%',
          videoId: currentItem.videoId,
          playerVars: { autoplay: isPlaying ? 1 : 0, controls: 0, rel: 0, enablejsapi: 1 },
          events: {
            onReady: (e: any) => { playerRef.current = player; setIsReady(true); if (isPlaying) e.target.playVideo(); },
            onStateChange: (e: any) => {
              setIsPlaying(e.data === 1);
              if (e.data === 0) {
                if (isRepeatingRef.current) { player.seekTo(0); player.playVideo(); }
                else advanceQueue();
              }
            },
          },
        });
      } else if (!useQueue && radioStation?.playlistId) {
        player = new (window as any).YT.Player(containerRef.current, {
          height: '100%', width: '100%',
          playerVars: { listType: 'playlist', list: radioStation.playlistId, autoplay: 0, controls: 0, rel: 0, enablejsapi: 1 },
          events: {
            onReady: () => { setIsReady(true); playerRef.current = player; },
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
  }, [radioStation?.playlistId, useQueue, currentItem?.type, currentItem?.videoId, queueIndex]);

  // ── Uploaded-video playback — plain <video> element. Only touches isReady when an upload is
  // actually the current track — this effect re-runs on every isPlaying change (needed so a
  // manual play/pause on the <video> element is respected), and previously called
  // setIsReady(false) unconditionally on that guard clause, which reset isReady for YouTube
  // tracks too and permanently disabled the play/pause button after the very first toggle. ──
  useEffect(() => {
    if (!useQueue || currentItem?.type !== 'upload') return;
    setIsReady(true);
    const el = videoElRef.current;
    if (el && isPlaying) el.play().catch(() => {});
  }, [useQueue, currentItem, isPlaying, queueIndex]);

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

  const toggleShuffle = () => {
    setIsShuffled(prev => {
      const next = !prev;
      if (next) setShuffledKeys(shuffleArray(submissionItems.map(itemKey)));
      return next;
    });
    setQueueIndex(0);
  };

  const toggleRepeat = () => setIsRepeating(v => !v);

  const selectIndex = (i: number) => { setQueueIndex(i); setIsPlaying(true); };

  const handleUploadEnded = () => {
    const el = videoElRef.current;
    if (isRepeatingRef.current && el) { el.currentTime = 0; el.play().catch(() => {}); return; }
    advanceQueue();
  };

  const value: RadioContextValue = {
    hasQueue, useQueue, orderedQueue, queueIndex, currentItem,
    isPlaying, isReady, isShuffled, isRepeating,
    containerRef, videoElRef,
    togglePlay, skipNext, toggleShuffle, toggleRepeat, selectIndex, handleUploadEnded,
  };

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

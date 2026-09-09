'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, notFound as nextNotFound, useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, or, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDocs, getDoc, setDoc, documentId } from 'firebase/firestore';
import { Loader2, MapPin, Users, Award, UserPlus, UserMinus, LogOut, Pencil, Check, X, MessageCircle, Repeat, Tag, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { computeLevel, getNextLevel, LEVEL_CONFIG, DEFAULT_LEVEL_THRESHOLDS, type LevelThresholds } from '@/lib/levels';
import { LevelBadge } from '@/components/LevelBadge';
import { extractYouTubeId } from '@/components/AnthemPlayer';
import { PROFILE_BACKGROUNDS } from '@/lib/profile-backgrounds';
import { createNotification } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';
import { MyStore } from '@/components/market/MyStore';
import { PulseViewer, type Pulse } from '@/components/cybazone/PulsesRow';
import { ShareToDMDialog } from '@/components/cybazone/ShareToDMDialog';

type UserProfile = {
  id: string;
  username: string;
  username_lowercase?: string;
  fullName?: string;
  avatarConfig?: AvatarConfig;
  bio?: string;
  location?: string;
  emojiStatus?: string;
  followers?: string[];
  following?: string[];
  profilePictureUrl?: string;
  membershipTier?: 'free' | 'pro';
  cybaCoinBalance?: number;
  leaderboardCybaName?: string;
  postCount?: number;
  levelOverride?: string;
  supportGiven?: number;
  anthemUrl?: string;
  profileBackground?: string;
  profileBackgroundUrl?: string;
  instagramHandle?: string;
  marketBoost?: boolean;
};

function InlineEdit({
  value,
  placeholder,
  onSave,
  multiline = false,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="group flex items-center gap-1.5 text-left hover:text-primary transition-colors"
      >
        {value
          ? <span className="text-sm text-muted-foreground leading-relaxed">{value}</span>
          : <span className="text-sm text-muted-foreground/40 italic">{placeholder}</span>
        }
        <Pencil className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2 w-full max-w-md">
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          maxLength={200}
          className="flex-1 bg-card border border-primary/40 rounded-lg px-3 py-2 text-sm text-foreground resize-none outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={60}
          className="flex-1 bg-card border border-primary/40 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
      )}
      <button onClick={save} disabled={saving} className="text-green-400 hover:text-green-300 p-1 mt-0.5">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground p-1 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Unified CYBAZONE card — avatar + anthem
// ─────────────────────────────────────────────
function CybazoneCard({
  username,
  avatarConfig,
  anthemUrl,
  level,
}: {
  username: string;
  avatarConfig?: AvatarConfig;
  anthemUrl?: string | null;
  level: any;
}) {
  const [playing, setPlaying] = useState(false);
  const videoId = anthemUrl ? extractYouTubeId(anthemUrl) : null;
  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <>
      <style>{`
        @keyframes cyba-border-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cyba-pulse-glow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes cyba-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes cyba-scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
        .cyba-float { animation: cyba-float 3s ease-in-out infinite; }
        .cyba-glow-pulse { animation: cyba-pulse-glow 2s ease-in-out infinite; }
        .cyba-scanline {
          animation: cyba-scanline 4s linear infinite;
          background: linear-gradient(transparent, rgba(168,85,247,0.08), transparent);
          position: absolute; inset-x-0; height: 40%;
          pointer-events: none;
        }
      `}</style>

      <div className="relative w-full max-w-sm mx-auto mt-6">
        {/* Spinning gradient border */}
        <div className="absolute -inset-[2px] rounded-2xl overflow-hidden z-0">
          <div
            className="absolute inset-[-100%] cyba-glow-pulse"
            style={{
              background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed, #3b82f6, #7c3aed)',
              animation: 'cyba-border-spin 4s linear infinite, cyba-pulse-glow 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Card body */}
        <div className="relative z-10 rounded-2xl overflow-hidden bg-gradient-to-b from-[#120826] via-[#0d0520] to-[#080312] border border-purple-500/20">
          {/* Scanline effect */}
          <div className="cyba-scanline" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-purple-500/20">
            <div className="flex gap-1.5">
              {['#f472b6','#a78bfa','#38bdf8'].map((c, i) => (
                <div key={i} className="w-2 h-2 rounded-full cyba-glow-pulse" style={{ background: c, boxShadow: `0 0 5px ${c}`, animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-purple-300/70" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {username}&apos;s CYBAZONE
            </span>
            <div className="w-8" />
          </div>

          {/* Content: avatar left, anthem right */}
          <div className="flex items-center gap-4 px-4 py-4">
            {/* Avatar — large, floating (cartoon only, not profile photo) */}
            <div className="cyba-float shrink-0">
              <AvatarDisplay
                avatarConfig={avatarConfig}
                size={120}
                level={level}
              />
            </div>

            {/* Anthem player */}
            <div className="flex-1 min-w-0">
              <p className="text-[8px] text-purple-400/70 uppercase tracking-widest mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                My Anthem
              </p>
              {videoId ? (
                <div
                  className="relative rounded-lg overflow-hidden border border-purple-500/40"
                  style={{ aspectRatio: '16/9', background: '#000', boxShadow: playing ? '0 0 20px rgba(139,92,246,0.5)' : 'none', transition: 'box-shadow 0.3s' }}
                >
                  {playing ? (
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                      title={`${username}'s Anthem`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      onClick={() => setPlaying(true)}
                      className="absolute inset-0 w-full h-full group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl!} alt="Anthem" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center cyba-glow-pulse"
                          style={{ background: 'rgba(139,92,246,0.9)', boxShadow: '0 0 16px rgba(139,92,246,0.8)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                            <polygon points="3,1 13,7 3,13" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className="relative rounded-lg overflow-hidden border border-purple-500/20 flex items-center justify-center"
                  style={{ aspectRatio: '16/9', background: '#000' }}
                >
                  <span className="text-[6px] text-purple-800" style={{ fontFamily: "'Press Start 2P', monospace" }}>NO SIGNAL</span>
                </div>
              )}
              {playing && (
                <button
                  onClick={() => setPlaying(false)}
                  className="mt-2 w-full text-[7px] text-purple-400 active:text-purple-200 transition-colors py-2 px-3 rounded border border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-950/40 active:bg-purple-950/70"
                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  ■ STOP
                </button>
              )}
            </div>
          </div>

          {/* Footer glow strip */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent cyba-glow-pulse" />
        </div>
      </div>
    </>
  );
}

export default function UserPublicProfilePage() {
  const params = useParams();
  const usernameParam = params.username as string;
  const username = decodeURIComponent(usernameParam);
  const { firestore, user: currentUser, auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isFollowMutating, setIsFollowMutating] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  type ProfileTab = 'posts' | 'mutual' | 'zaps' | 'reposts' | 'tagged' | 'subnet' | 'about';
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const goToTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    setTimeout(() => document.getElementById('profile-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const [showNotFound, setShowNotFound] = useState(false);

  const userQuery = useMemoFirebase(
    () =>
      username
        ? query(
            collection(firestore, 'users'),
            or(
              where('username_lowercase', '==', username.toLowerCase()),
              where('username', '==', username),
            ),
            limit(1),
          )
        : null,
    [firestore, username]
  );
  const { data: users, isLoading: isLoadingUser } = useCollection<UserProfile>(userQuery);
  const userProfile = users?.[0];

  // Backfill username_lowercase for users found without it
  useEffect(() => {
    if (userProfile && !userProfile.username_lowercase && userProfile.id) {
      setDoc(doc(firestore, 'users', userProfile.id), { username_lowercase: userProfile.username.toLowerCase() }, { merge: true });
    }
  }, [firestore, userProfile]);

  const currentUserQuery = useMemoFirebase(
    () => currentUser?.uid
      ? query(collection(firestore, 'users'), where('id', '==', currentUser.uid), limit(1))
      : null,
    [firestore, currentUser?.uid]
  );
  const { data: currentUsers } = useCollection<UserProfile>(currentUserQuery);
  const currentUserProfile = currentUsers?.[0];

  const authoredQuery = useMemoFirebase(
    () => userProfile?.id
      ? query(collection(firestore, 'cybazone_posts'), where('authorId', '==', userProfile.id), orderBy('timestamp', 'desc'), limit(20))
      : null,
    [firestore, userProfile?.id]
  );
  const { data: authoredPosts, isLoading: isLoadingAuthored } = useCollection<CybazonePost>(authoredQuery);

  const repostedQuery = useMemoFirebase(
    () => userProfile?.id
      ? query(collection(firestore, 'cybazone_posts'), where('repostedBy', 'array-contains', userProfile.id), limit(20))
      : null,
    [firestore, userProfile?.id]
  );
  const { data: repostedPosts, isLoading: isLoadingReposts } = useCollection<CybazonePost>(repostedQuery);

  const isLoadingPosts = isLoadingAuthored || isLoadingReposts;

  // Mutual — people who follow BOTH the viewer and this profile's owner. Two array-contains
  // queries on `following` (people who follow the viewer, people who follow the profile owner),
  // intersected client-side by uid. Only meaningful when viewing someone else's profile.
  const viewerFollowersQuery = useMemoFirebase(
    () => (currentUser?.uid && userProfile?.id && currentUser.uid !== userProfile.id)
      ? query(collection(firestore, 'users'), where('following', 'array-contains', currentUser.uid))
      : null,
    [firestore, currentUser?.uid, userProfile?.id]
  );
  const { data: viewerFollowers } = useCollection<UserProfile>(viewerFollowersQuery);
  const profileFollowersQuery = useMemoFirebase(
    () => (currentUser?.uid && userProfile?.id && currentUser.uid !== userProfile.id)
      ? query(collection(firestore, 'users'), where('following', 'array-contains', userProfile.id))
      : null,
    [firestore, currentUser?.uid, userProfile?.id]
  );
  const { data: profileFollowers } = useCollection<UserProfile>(profileFollowersQuery);
  const mutualUsers = useMemo(() => {
    if (!viewerFollowers || !profileFollowers) return [];
    const profileFollowerIds = new Set(profileFollowers.map(u => u.id));
    return viewerFollowers.filter(u => profileFollowerIds.has(u.id));
  }, [viewerFollowers, profileFollowers]);

  // Tagged — posts that mentioned this user, resolved from their own (private) notifications
  // subcollection. Firestore rules only allow a user to read their own notifications, so this
  // is owner-only; visitors simply won't see anything here (the tab reflects that).
  const taggedNotifsQuery = useMemoFirebase(
    () => (currentUser?.uid && userProfile?.id && currentUser.uid === userProfile.id)
      ? query(collection(firestore, 'notifications', userProfile.id, 'items'), where('type', '==', 'mention'), orderBy('timestamp', 'desc'), limit(30))
      : null,
    [firestore, currentUser?.uid, userProfile?.id]
  );
  const { data: taggedNotifs, isLoading: isLoadingTagged } = useCollection<{ postId?: string }>(taggedNotifsQuery);
  const taggedPostIds = useMemo(
    () => Array.from(new Set((taggedNotifs ?? []).map(n => n.postId).filter((id): id is string => !!id))),
    [taggedNotifs]
  );
  const taggedPostsQuery = useMemoFirebase(
    () => taggedPostIds.length > 0
      ? query(collection(firestore, 'cybazone_posts'), where(documentId(), 'in', taggedPostIds.slice(0, 30).map(id => doc(firestore, 'cybazone_posts', id))))
      : null,
    [firestore, taggedPostIds]
  );
  const { data: taggedPosts } = useCollection<CybazonePost>(taggedPostsQuery);

  const zapsPosts = useMemo(
    () => (authoredPosts ?? []).filter(p => p.mediaType === 'video'),
    [authoredPosts]
  );

  // Hold-to-open Pulses menu on the profile picture — only meaningful when this profile
  // owner currently has an active (unexpired) Pulse.
  const pulsesQuery = useMemoFirebase(
    () => userProfile?.id ? query(collection(firestore, 'pulses'), where('authorId', '==', userProfile.id)) : null,
    [firestore, userProfile?.id]
  );
  const { data: rawProfilePulses } = useCollection<Pulse>(pulsesQuery);
  const activeProfilePulses = useMemo(() => {
    const now = Date.now();
    return (rawProfilePulses ?? [])
      .filter(p => { const ms = typeof p.expiresAt === 'number' ? p.expiresAt : p.expiresAt?.toMillis?.() ?? 0; return ms > now; })
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  }, [rawProfilePulses]);
  const [showPulseViewer, setShowPulseViewer] = useState(false);
  const [pulseShareTarget, setPulseShareTarget] = useState<Pulse | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAvatarHold = () => {
    if (activeProfilePulses.length === 0) return;
    holdTimerRef.current = setTimeout(() => setShowPulseViewer(true), 500);
  };
  const cancelAvatarHold = () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); };

  const levelCfgRef = useMemoFirebase(() => doc(firestore, 'settings', 'levelConfig'), [firestore]);
  const { data: rawLevelCfg } = useDoc<Partial<LevelThresholds>>(levelCfgRef);
  const levelThresholds: LevelThresholds = rawLevelCfg ? { ...DEFAULT_LEVEL_THRESHOLDS, ...rawLevelCfg } : DEFAULT_LEVEL_THRESHOLDS;

  const posts = useMemo(() => {
    const now = Date.now();
    const isVisible = (p: CybazonePost) => {
      if ((p as any).published !== false) return true;
      const scheduledAt = (p as any).scheduledAt;
      return scheduledAt && scheduledAt.toMillis() <= now;
    };
    const postMap = new Map<string, CybazonePost>();
    authoredPosts?.filter(isVisible).forEach(p => p.id && postMap.set(p.id, p));
    repostedPosts?.filter(isVisible).forEach(p => p.id && postMap.set(p.id, p));
    return Array.from(postMap.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [authoredPosts, repostedPosts]);

  useEffect(() => {
    if (!isLoadingUser && (!users || users.length === 0)) {
      const timer = setTimeout(() => setShowNotFound(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setShowNotFound(false);
    }
  }, [isLoadingUser, users]);

  if (showNotFound) nextNotFound();

  if (isLoadingUser || !userProfile) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleFollowToggle = async () => {
    if (!currentUser || !currentUserProfile) {
      router.push('/login?redirect=/u/' + encodeURIComponent(username));
      return;
    }
    setIsFollowMutating(true);
    try {
      const isFollowing = userProfile.followers?.includes(currentUser.uid);
      const currentUserRef = doc(firestore, 'users', currentUser.uid);
      const targetUserRef = doc(firestore, 'users', userProfile.id);
      if (isFollowing) {
        await Promise.all([
          updateDoc(currentUserRef, { following: arrayRemove(userProfile.id) }),
          updateDoc(targetUserRef, { followers: arrayRemove(currentUser.uid) }),
        ]);
      } else {
        await Promise.all([
          updateDoc(currentUserRef, { following: arrayUnion(userProfile.id) }),
          updateDoc(targetUserRef, { followers: arrayUnion(currentUser.uid) }),
        ]);
        createNotification(firestore, userProfile.id, {
          type: 'follow',
          actorId: currentUser.uid,
          actorUsername: currentUserProfile.username,
          actorProfilePictureUrl: currentUserProfile.profilePictureUrl ?? null,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFollowMutating(false);
    }
  };

  const handleSaveBio = async (bio: string) => {
    if (!currentUser || currentUser.uid !== userProfile.id) return;
    await updateDoc(doc(firestore, 'users', userProfile.id), { bio });
    toast({ title: 'Bio updated' });
  };

  const handleSaveLocation = async (location: string) => {
    if (!currentUser || currentUser.uid !== userProfile.id) return;
    await updateDoc(doc(firestore, 'users', userProfile.id), { location });
    toast({ title: 'Location updated' });
  };

  const handleMessage = async () => {
    if (!currentUser || !currentUserProfile) {
      router.push('/login?redirect=/u/' + encodeURIComponent(username));
      return;
    }
    setIsMessaging(true);
    try {
      const key = [currentUser.uid, userProfile.id].sort().join('_');
      const existing = await getDocs(query(
        collection(firestore, 'conversations'),
        where('participantKey', '==', key),
      ));
      if (!existing.empty) {
        router.push(`/messages/${existing.docs[0].id}`);
        return;
      }
      const mySnap = await getDoc(doc(firestore, 'users', currentUser.uid));
      const myData = mySnap.data() as any;
      const ref = await addDoc(collection(firestore, 'conversations'), {
        type: 'direct',
        participants: [currentUser.uid, userProfile.id],
        participantKey: key,
        participantInfo: {
          [currentUser.uid]: {
            username: myData?.username ?? currentUserProfile.username ?? 'Me',
            profilePictureUrl: myData?.profilePictureUrl ?? null,
            avatarConfig: myData?.avatarConfig ?? null,
          },
          [userProfile.id]: {
            username: userProfile.username,
            profilePictureUrl: userProfile.profilePictureUrl ?? null,
            avatarConfig: userProfile.avatarConfig ?? null,
          },
        },
        unreadCounts: { [currentUser.uid]: 0, [userProfile.id]: 0 },
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        lastMessageAt: serverTimestamp(),
        lastMessage: '',
        name: null,
      });
      router.push(`/messages/${ref.id}`);
    } catch (e) {
      console.error('Failed to open conversation:', e);
      toast({ variant: 'destructive', title: 'Could not open chat' });
    } finally {
      setIsMessaging(false);
    }
  };

  const followerCount = userProfile.followers?.length ?? 0;
  const followingCount = userProfile.following?.length ?? 0;
  const isFollowing = currentUser && userProfile.followers?.includes(currentUser.uid);
  const isSelf = currentUser?.uid === userProfile.id;

  const level = computeLevel(userProfile.postCount, userProfile.supportGiven, levelThresholds, userProfile.levelOverride);
  const levelConfig = LEVEL_CONFIG[level];
  const nextLevel = getNextLevel(level);
  const nextMinPosts = nextLevel ? (levelThresholds as Record<string, number>)[`${nextLevel}_posts`] : undefined;
  const nextMinSupport = nextLevel ? (levelThresholds as Record<string, number>)[`${nextLevel}_support`] : undefined;
  const postProgress = nextMinPosts ? Math.min(100, ((userProfile.postCount ?? 0) / nextMinPosts) * 100) : 100;
  const supportProgress = nextMinSupport ? Math.min(100, ((userProfile.supportGiven ?? 0) / nextMinSupport) * 100) : 100;

  const bgId = userProfile.profileBackground ?? 'default';
  const bgStyle: React.CSSProperties = bgId === 'custom' && userProfile.profileBackgroundUrl
    ? { backgroundImage: `url(${userProfile.profileBackgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : (PROFILE_BACKGROUNDS.find(b => b.id === bgId) ?? PROFILE_BACKGROUNDS[0]).style;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Full-width background banner */}
      <div className="relative w-full h-48 md:h-64 overflow-hidden" style={bgStyle}>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 max-w-3xl">
        {/* Centered profile photo — overlaps banner */}
        <div className="flex flex-col items-center -mt-20 relative z-10">
          <div
            className="relative select-none touch-manipulation"
            style={{ width: 160, height: 160 }}
            onMouseDown={startAvatarHold}
            onMouseUp={cancelAvatarHold}
            onMouseLeave={cancelAvatarHold}
            onTouchStart={startAvatarHold}
            onTouchEnd={cancelAvatarHold}
            title={activeProfilePulses.length > 0 ? 'Hold to view Pulses' : undefined}
          >
            {/* glow */}
            <div
              className="absolute -inset-2 rounded-full blur-md opacity-80 pointer-events-none"
              style={{ background: `linear-gradient(to right, ${levelConfig.gradientFrom}, ${levelConfig.gradientTo})` }}
            />
            {/* AvatarDisplay — no overflow-hidden wrapper so emoji bubble can escape */}
            <AvatarDisplay
              profilePictureUrl={userProfile.profilePictureUrl}
              avatarConfig={userProfile.avatarConfig}
              size={160}
              level={level}
            />
            {/* border ring as an overlay — doesn't clip anything */}
            <div className={cn(
              'absolute inset-0 rounded-full shadow-2xl pointer-events-none z-10',
              activeProfilePulses.length > 0 ? 'border-[3px] border-purple-400' : 'border-2 border-primary/40',
            )} />
          </div>

          {/* Username + level */}
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            <h1 className="text-3xl font-headline font-bold text-white">{userProfile.username}</h1>
            <LevelBadge level={level} size="lg" />
            {userProfile.membershipTier === 'pro' && (
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] shadow-[0_0_8px_rgba(168,85,247,0.4)]">PRO</Badge>
            )}
            {(userProfile as any).payoutEnrolled && (
              <span title="Payout Boost Member" className="text-2xl leading-none">🏦</span>
            )}
          </div>

          {/* Full name (if provided) */}
          {userProfile.fullName && (
            <p className="mt-1 text-base font-medium text-foreground/80">{userProfile.fullName}</p>
          )}

          {userProfile.leaderboardCybaName && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Award className="w-3.5 h-3.5 text-yellow-500" />
              {userProfile.leaderboardCybaName}
            </p>
          )}

          {/* Stats row: Posts | Supports | Followers | Following */}
          <div className="mt-3 flex items-center gap-4 sm:gap-6 text-sm flex-wrap justify-center">
            <div className="flex flex-col items-center">
              <strong className="text-foreground text-base">{(userProfile.postCount ?? 0).toLocaleString()}</strong>
              <span className="text-muted-foreground text-xs">Posts</span>
            </div>
            <div className="w-px h-6 bg-border/50" />
            <div className="flex flex-col items-center">
              <strong className="text-foreground text-base">{(userProfile.supportGiven ?? 0).toLocaleString()}</strong>
              <span className="text-muted-foreground text-xs">Supports</span>
            </div>
            <div className="w-px h-6 bg-border/50" />
            <div className="flex flex-col items-center">
              <strong className="text-foreground text-base">{followerCount}</strong>
              <span className="text-muted-foreground text-xs">Followers</span>
            </div>
            <div className="w-px h-6 bg-border/50" />
            <div className="flex flex-col items-center">
              <strong className="text-foreground text-base">{followingCount}</strong>
              <span className="text-muted-foreground text-xs">Following</span>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-3 text-center max-w-sm">
            {isSelf ? (
              <InlineEdit
                value={userProfile.bio ?? ''}
                placeholder="Add a bio..."
                onSave={handleSaveBio}
                multiline
              />
            ) : userProfile.bio ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{userProfile.bio}</p>
            ) : null}
          </div>

          {/* Location */}
          <div className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            {isSelf ? (
              <InlineEdit
                value={userProfile.location ?? ''}
                placeholder="Add your location..."
                onSave={handleSaveLocation}
              />
            ) : userProfile.location ? (
              <span>{userProfile.location}</span>
            ) : null}
          </div>

          {/* Follow / Message / Edit actions */}
          <div className="mt-4 flex items-center gap-3 flex-wrap justify-center">
            {!isSelf ? (
              <>
                <Button
                  size="sm"
                  variant={isFollowing ? 'outline' : 'default'}
                  className={`rounded-full px-6 ${!isFollowing ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white' : ''}`}
                  onClick={handleFollowToggle}
                  disabled={isFollowMutating || !currentUserProfile}
                >
                  {isFollowMutating && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {isFollowing
                    ? <><UserMinus className="w-3.5 h-3.5 mr-1.5" />Unfollow</>
                    : <><UserPlus className="w-3.5 h-3.5 mr-1.5" />Follow</>}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full px-6" onClick={() => goToTab('posts')}>
                  Posts
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-6"
                  onClick={handleMessage}
                  disabled={isMessaging}
                >
                  {isMessaging
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <MessageCircle className="w-3.5 h-3.5 mr-1.5" />}
                  Message
                </Button>
                <Button size="sm" variant="outline" className="rounded-full px-6" onClick={() => goToTab('about')}>
                  About
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" className="rounded-full px-6" onClick={() => router.push('/profile')}>
                  Edit Profile
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive text-xs" onClick={() => auth.signOut()}>
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />Sign Out
                </Button>
              </>
            )}
          </div>

          {/* CYBAZONE card — avatar + anthem */}
          {(userProfile.avatarConfig || userProfile.anthemUrl) && (
            <CybazoneCard
              username={userProfile.username}
              avatarConfig={userProfile.avatarConfig}
              anthemUrl={userProfile.anthemUrl}
              level={level}
            />
          )}

          {/* Self-only: level progress + coin balance */}
          {isSelf && (
            <div className="mt-6 w-full bg-card/40 border border-primary/20 rounded-2xl px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">{levelConfig.emoji} {levelConfig.name}</span>
                {nextLevel && <span>Next: {LEVEL_CONFIG[nextLevel].name}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Posts</span>
                    <span>{userProfile.postCount ?? 0}{nextMinPosts ? ` / ${nextMinPosts}` : ''}</span>
                  </div>
                  <Progress value={postProgress} className="h-1" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Support Given</span>
                    <span>{userProfile.supportGiven ?? 0}{nextMinSupport ? ` / ${nextMinSupport}` : ''}</span>
                  </div>
                  <Progress value={supportProgress} className="h-1" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm pt-1 border-t border-border/30">
                <Image src="/CCoin.png?v=2" alt="CC" width={14} height={14} />
                <span className="font-bold text-yellow-400 tabular-nums">{(userProfile.cybaCoinBalance ?? 0).toLocaleString()}</span>
                <span className="text-muted-foreground">CYBACOIN</span>
              </div>
            </div>
          )}
        </div>

        {/* My Store — owner-only, shown when Market Boost is active */}
        {isSelf && userProfile.marketBoost && (
          <div className="mt-10">
            <MyStore userId={userProfile.id} username={userProfile.username} />
          </div>
        )}

        {/* Content Tabs */}
        <div id="profile-tabs" className="mt-10 scroll-mt-16">
          <div className="sticky top-16 z-20 bg-background -mx-4 px-4 pt-2 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden bg-card/50 border border-primary/20 p-1 rounded-full max-w-full w-fit mx-auto">
              {([
                ['posts', 'Feed'],
                ['mutual', 'Mutual'],
                ['zaps', 'Zaps'],
                ['reposts', 'Reposts'],
                ...(isSelf ? [['tagged', 'Tagged']] as const : []),
                ['subnet', 'Subnet'],
                ['about', 'About'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all touch-manipulation select-none whitespace-nowrap',
                    activeTab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'posts' && (
            <div className="space-y-8">
              {isLoadingPosts ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
              ) : posts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {posts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              ) : (
                <div className="text-center p-16 border border-dashed border-primary/20 rounded-2xl bg-card/20">
                  <Users className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold font-headline mb-1">No Transmissions</h3>
                  <p className="text-muted-foreground text-sm">
                    {userProfile.username} hasn&apos;t posted yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mutual' && (
            <div className="space-y-8">
              {mutualUsers.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  {mutualUsers.map(u => (
                    <Link key={u.id} href={`/u/${u.username}`} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card/30 hover:border-primary/40 transition-colors">
                      <AvatarDisplay profilePictureUrl={u.profilePictureUrl} avatarConfig={u.avatarConfig} size={56} />
                      <span className="text-sm font-semibold truncate max-w-full">@{u.username}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center p-16 border border-dashed border-primary/20 rounded-2xl bg-card/20">
                  <Users className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold font-headline mb-1">No Mutuals Yet</h3>
                  <p className="text-muted-foreground text-sm">No one follows both you and {userProfile.username} yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'zaps' && (
            <div className="space-y-8">
              {isLoadingPosts ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
              ) : zapsPosts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {zapsPosts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              ) : (
                <div className="text-center p-16 border border-dashed border-primary/20 rounded-2xl bg-card/20">
                  <Users className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold font-headline mb-1">No Zaps Yet</h3>
                  <p className="text-muted-foreground text-sm">{userProfile.username} hasn&apos;t posted a video yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reposts' && (
            <div className="space-y-8">
              {isLoadingReposts ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
              ) : (repostedPosts?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {repostedPosts!.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              ) : (
                <div className="text-center p-16 border border-dashed border-primary/20 rounded-2xl bg-card/20">
                  <Repeat className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold font-headline mb-1">No Reposts Yet</h3>
                  <p className="text-muted-foreground text-sm">{userProfile.username} hasn&apos;t reposted anything yet.</p>
                </div>
              )}
            </div>
          )}

          {isSelf && activeTab === 'tagged' && (
            <div className="space-y-8">
              {isLoadingTagged ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
              ) : (taggedPosts?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {taggedPosts!.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              ) : (
                <div className="text-center p-16 border border-dashed border-primary/20 rounded-2xl bg-card/20">
                  <Tag className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold font-headline mb-1">No Tagged Posts</h3>
                  <p className="text-muted-foreground text-sm">Posts that @mention you will show up here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subnet' && (
            <div className="text-center text-foreground/60 p-16 border-dashed border-2 border-primary/20 bg-card/20 rounded-2xl max-w-2xl mx-auto">
              <Boxes className="w-10 h-10 mx-auto mb-3 text-primary/50" />
              <h3 className="text-xl font-bold font-headline mb-2">Subnet — Coming Soon</h3>
              <p>Paid CYBA communities are on the way. Stay tuned.</p>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4 max-w-xl mx-auto">
              {userProfile.fullName && (
                <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</h4>
                  <p className="text-sm">{userProfile.fullName}</p>
                </div>
              )}
              {(userProfile.bio || isSelf) && (
                <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio</h4>
                  {isSelf ? (
                    <InlineEdit value={userProfile.bio ?? ''} placeholder="Write a bio..." onSave={handleSaveBio} multiline />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{userProfile.bio}</p>
                  )}
                </div>
              )}
              {(userProfile.location || isSelf) && (
                <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location</h4>
                  {isSelf ? (
                    <InlineEdit value={userProfile.location ?? ''} placeholder="Where are you based?" onSave={handleSaveLocation} />
                  ) : (
                    <p className="text-sm">{userProfile.location}</p>
                  )}
                </div>
              )}
              {userProfile.emojiStatus && (
                <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
                  <p className="text-sm">{userProfile.emojiStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPulseViewer && activeProfilePulses.length > 0 && (
        <PulseViewer
          pulses={activeProfilePulses}
          currentUserId={currentUser?.uid}
          onClose={() => setShowPulseViewer(false)}
          onShare={(p) => setPulseShareTarget(p)}
        />
      )}
      {pulseShareTarget && (
        <ShareToDMDialog
          open={!!pulseShareTarget}
          onOpenChange={(v) => { if (!v) setPulseShareTarget(null); }}
          content={{
            kind: 'pulse',
            pulseId: pulseShareTarget.id,
            authorUsername: pulseShareTarget.authorUsername,
            authorProfilePictureUrl: pulseShareTarget.authorProfilePictureUrl,
            mediaUrl: pulseShareTarget.mediaUrl,
            mediaType: pulseShareTarget.mediaType,
          }}
        />
      )}
    </div>
  );
}

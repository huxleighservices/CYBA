'use client';

import { Suspense, useState, useEffect } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy, doc, addDoc,
  deleteDoc, serverTimestamp, limit, updateDoc, increment, Timestamp,
} from 'firebase/firestore';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, X, Check } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { AvatarConfig } from '@/lib/avatar-assets';
import type { CybazonePost } from '@/components/cybazone/PostCard';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';

type SponsoredItem = {
  id: string;
  type: 'post' | 'profile';
  userId: string;
  postId?: string;
  active: boolean;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
};

function getTimeRemaining(item: SponsoredItem): string {
  const exp = item.expiresAt?.toDate?.();
  if (!exp) return '';
  const ms = exp.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
}

function isExpired(item: SponsoredItem): boolean {
  const exp = item.expiresAt?.toDate?.();
  if (!exp) return false;
  return exp.getTime() < Date.now();
}

type UserProfile = {
  id: string;
  username?: string;
  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string;
  postCount?: number;
  supportGiven?: number;
  inventory?: {
    sponsored_post?: { quantity: number };
    sponsored_profile?: { quantity: number };
  };
};

function SponsorPageInner() {
  const { firestore, user, isUserLoading } = useFirebase();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const defaultTab = (searchParams.get('type') as 'post' | 'profile') ?? 'post';
  const [tab, setTab] = useState<'post' | 'profile'>(defaultTab);
  const [activating, setActivating] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const myPostsQuery = useMemoFirebase(
    () => user
      ? query(collection(firestore, 'cybazone_posts'), where('authorId', '==', user.uid), orderBy('timestamp', 'desc'), limit(20))
      : null,
    [firestore, user]
  );
  const { data: myPosts, isLoading: isLoadingPosts } = useCollection<CybazonePost>(myPostsQuery);

  const mySponsoredQuery = useMemoFirebase(
    () => user
      ? query(collection(firestore, 'sponsored_items'), where('userId', '==', user.uid), where('active', '==', true))
      : null,
    [firestore, user]
  );
  const { data: mySponsored } = useCollection<SponsoredItem>(mySponsoredQuery);

  // Auto-deactivate expired sponsored items
  useEffect(() => {
    if (!mySponsored) return;
    const expired = mySponsored.filter(isExpired);
    expired.forEach(item => {
      deleteDoc(doc(firestore, 'sponsored_items', item.id)).catch(console.error);
    });
  }, [mySponsored, firestore]);

  const postCredits = userProfile?.inventory?.sponsored_post?.quantity ?? 0;
  const profileCredits = userProfile?.inventory?.sponsored_profile?.quantity ?? 0;
  const activeSponsoredPostIds = new Set(mySponsored?.filter(s => s.type === 'post' && !isExpired(s)).map(s => s.postId) ?? []);
  const hasActiveSponsoredProfile = mySponsored?.some(s => s.type === 'profile' && !isExpired(s)) ?? false;

  const handleSponsorPost = async (post: CybazonePost) => {
    if (!user || postCredits < 1) return;
    setActivating(post.id);
    try {
      await addDoc(collection(firestore, 'sponsored_items'), {
        type: 'post',
        userId: user.uid,
        postId: post.id,
        postData: {
          authorId: post.authorId,
          authorUsername: post.authorUsername,
          authorAvatar: post.authorAvatar ?? null,
          authorProfilePictureUrl: post.authorProfilePictureUrl ?? null,
          authorLevel: post.authorLevel ?? null,
          authorPayoutEnrolled: post.authorPayoutEnrolled ?? false,
          authorSpotlightBoost: post.authorSpotlightBoost ?? false,
          authorIsCurator: post.authorIsCurator ?? false,
          content: post.content,
          imageUrl: post.imageUrl ?? null,
          mediaType: post.mediaType ?? null,
          timestamp: post.timestamp,
          likeCount: post.likeCount,
          likedBy: post.likedBy,
          commentCount: post.commentCount,
          repostCount: post.repostCount,
          repostedBy: post.repostedBy,
        },
        active: true,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      });
      await updateDoc(doc(firestore, 'users', user.uid), {
        'inventory.sponsored_post.quantity': increment(-1),
      });
      toast({ title: 'Post spotlighted!', description: 'Your post is now live in the global feed for 24 hours.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to activate.' });
    } finally {
      setActivating(null);
    }
  };

  const handleSponsorProfile = async () => {
    if (!user || profileCredits < 1) return;
    setActivating('profile');
    try {
      await addDoc(collection(firestore, 'sponsored_items'), {
        type: 'profile',
        userId: user.uid,
        active: true,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      });
      await updateDoc(doc(firestore, 'users', user.uid), {
        'inventory.sponsored_profile.quantity': increment(-1),
      });
      toast({ title: 'Profile spotlighted!', description: 'Your profile is now live in the global feed for 24 hours.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to activate.' });
    } finally {
      setActivating(null);
    }
  };

  const handleDeactivate = async (item: SponsoredItem) => {
    setDeactivating(item.id);
    try {
      await deleteDoc(doc(firestore, 'sponsored_items', item.id));
      toast({ title: 'Sponsorship removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove.' });
    } finally {
      setDeactivating(null);
    }
  };

  if (isUserLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Sign in to manage spotlight content.</p>
          <Button asChild><Link href="/login">Sign In</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes sp-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes sp-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .sp-ring { animation: sp-spin 5s linear infinite; }
        .sp-glow { animation: sp-pulse 2s ease-in-out infinite; }
      `}</style>

      <div className="container mx-auto px-4 pt-4 pb-16 max-w-3xl">
        <SectionHeader title="ACTIVATE SPOTLIGHT" description="Use a spotlight slot earned from the CYBAWHEEL." />

        {/* Credits display */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { label: 'Post Slots', credits: postCredits, icon: '📝' },
            { label: 'Profile Slots', credits: profileCredits, icon: '👤' },
          ].map(({ label, credits, icon }) => (
            <div key={label} className={`relative rounded-xl border p-4 text-center ${credits > 0 ? 'border-purple-500/40 bg-purple-950/20' : 'border-border bg-card/30 opacity-60'}`}>
              {credits > 0 && (
                <div className="absolute -inset-[1px] rounded-xl overflow-hidden pointer-events-none">
                  <div className="sp-ring absolute inset-[-100%]" style={{ background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed)' }} />
                </div>
              )}
              <div className="relative z-10">
                <span className="text-2xl">{icon}</span>
                <p className="text-2xl font-bold text-white mt-1">{credits}</p>
                <p className="text-xs text-muted-foreground">{label} Available</p>
              </div>
            </div>
          ))}
        </div>

        {/* No credits at all */}
        {postCredits === 0 && profileCredits === 0 && (
          <div className="text-center py-10 space-y-4 border border-dashed border-primary/20 rounded-2xl bg-card/20 mb-8">
            <p className="text-lg font-semibold">No spotlight slots</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Win a spotlight slot on the CYBAWHEEL, or buy one with CYBACOIN in Rewards.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline"><Link href="/winners-wheel">CYBAWHEEL</Link></Button>
              <Button asChild><Link href="/rewards">Rewards</Link></Button>
            </div>
          </div>
        )}

        {/* Active sponsorships */}
        {(mySponsored?.filter(s => !isExpired(s)).length ?? 0) > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Currently Live</h2>
            {mySponsored?.filter(s => !isExpired(s)).map(item => (
              <div key={item.id} className="relative rounded-xl overflow-hidden">
                <div className="absolute -inset-[1px] rounded-xl overflow-hidden pointer-events-none">
                  <div className="sp-ring absolute inset-[-100%]" style={{ background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #7c3aed)' }} />
                </div>
                <div className="relative z-10 flex items-center justify-between bg-card/80 backdrop-blur px-4 py-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.type === 'post' ? '📝' : '👤'}</span>
                    <div>
                      <p className="text-sm font-semibold capitalize">Spotlight {item.type}</p>
                      {item.type === 'post' && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {(item as any).postData?.content?.slice(0, 60)}…
                        </p>
                      )}
                      <p className="text-[10px] text-purple-400/70 mt-0.5">{getTimeRemaining(item)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="sp-glow text-[9px] font-black text-purple-400 uppercase tracking-widest">LIVE</span>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                      onClick={() => handleDeactivate(item)} disabled={deactivating === item.id}>
                      {deactivating === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Only show tabs if user has credits */}
        {(postCredits > 0 || profileCredits > 0) && (
          <>
            <div className="flex rounded-xl overflow-hidden border border-primary/20 mb-6">
              {[{ key: 'post', label: '📝 Spotlight a Post', credits: postCredits }, { key: 'profile', label: '👤 Spotlight Profile', credits: profileCredits }].map(({ key, label, credits }) => (
                <button key={key} onClick={() => setTab(key as 'post' | 'profile')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${tab === key ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : 'bg-card text-muted-foreground hover:text-foreground'} ${credits === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  disabled={credits === 0}
                >
                  {label}
                  {credits > 0 && <span className="bg-yellow-400 text-black text-[9px] font-black px-1.5 rounded-full">{credits}</span>}
                </button>
              ))}
            </div>

            {/* Post tab */}
            {tab === 'post' && postCredits > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Pick a post to sponsor. It will appear as a glowing purple card in the global feed.</p>
                {isLoadingPosts ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
                ) : !myPosts || myPosts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="mb-3">You haven't posted anything yet.</p>
                    <Button asChild><Link href="/create">Create a Post</Link></Button>
                  </div>
                ) : (
                  myPosts.map(post => {
                    const isActive = activeSponsoredPostIds.has(post.id);
                    const activeItem = mySponsored?.find(s => s.postId === post.id);
                    return (
                      <div key={post.id} className={`relative rounded-xl border p-4 flex items-start gap-4 transition-all ${isActive ? 'border-purple-500/60 bg-purple-950/20 shadow-[0_0_20px_rgba(139,92,246,0.2)]' : 'border-border bg-card/50 hover:border-primary/40'}`}>
                        {isActive && <div className="absolute top-2 right-2"><span className="sp-glow text-[8px] font-black text-purple-400 uppercase tracking-widest bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">LIVE</span></div>}
                        <AvatarDisplay profilePictureUrl={userProfile?.profilePictureUrl} avatarConfig={userProfile?.avatarConfig} size={40} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm text-foreground/90 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
                          {post.imageUrl && <img src={post.imageUrl} alt="" className="w-full max-h-32 object-cover rounded-lg" />}
                          <p className="text-[11px] text-muted-foreground">
                            {post.timestamp?.toDate ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'recently'} · ❤️ {post.likeCount}
                          </p>
                        </div>
                        <div className="shrink-0 pt-1">
                          {isActive ? (
                            <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:text-red-300 rounded-full px-4"
                              onClick={() => activeItem && handleDeactivate(activeItem)} disabled={deactivating === activeItem?.id}>
                              {deactivating === activeItem?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><X className="w-3.5 h-3.5 mr-1" />Remove</>}
                            </Button>
                          ) : (
                            <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-full px-4"
                              onClick={() => handleSponsorPost(post)} disabled={activating === post.id}>
                              {activating === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Zap className="w-3.5 h-3.5 mr-1" />Use Slot</>}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Profile tab */}
            {tab === 'profile' && profileCredits > 0 && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">Sponsor your profile to appear as a glowing card in the global feed with your avatar, bio, and recent posts.</p>
                {hasActiveSponsoredProfile ? (
                  <div className="flex items-center justify-between rounded-xl border border-purple-500/40 bg-purple-950/20 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-purple-300">Profile is live in the feed</span>
                    </div>
                    <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:text-red-300 rounded-full"
                      onClick={() => { const item = mySponsored?.find(s => s.type === 'profile'); if (item) handleDeactivate(item); }} disabled={!!deactivating}>
                      <X className="w-3.5 h-3.5 mr-1" />Remove
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white py-6 text-base font-semibold rounded-xl"
                    onClick={handleSponsorProfile} disabled={activating === 'profile'}>
                    {activating === 'profile' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                    Use Slot — Spotlight My Profile
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function SponsorPage() {
  return (
    <Suspense fallback={<div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SponsorPageInner />
    </Suspense>
  );
}

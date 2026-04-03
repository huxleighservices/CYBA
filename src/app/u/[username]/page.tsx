'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, notFound as nextNotFound, useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, or, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Loader2, MapPin, Users, Award, CalendarDays, UserPlus, UserMinus, LogOut } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { computeLevel, getNextLevel, LEVEL_CONFIG } from '@/lib/levels';
import { LevelBadge } from '@/components/LevelBadge';
import { AnthemPlayer } from '@/components/AnthemPlayer';

type UserProfile = {
  id: string;
  username: string;
  username_lowercase?: string;
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
  supportGiven?: number;
  anthemUrl?: string;
};

export default function UserPublicProfilePage() {
  const params = useParams();
  const usernameParam = params.username as string;
  const username = decodeURIComponent(usernameParam);
  const { firestore, user: currentUser, auth } = useFirebase();
  const router = useRouter();

  const [isFollowMutating, setIsFollowMutating] = useState(false);

  // Give a timeout for not found to avoid premature 404
  const [showNotFound, setShowNotFound] = useState(false);

  // 1. Find user by username
  const userQuery = useMemoFirebase(
    () =>
      username
        ? query(
            collection(firestore, 'users'),
            where('username_lowercase', '==', username.toLowerCase()),
            limit(1)
          )
        : null,
    [firestore, username]
  );
  
  const { data: users, isLoading: isLoadingUser } = useCollection<UserProfile>(userQuery);
  const userProfile = users?.[0];

  // We also need the current user's extended profile to know who they are following reliably
  const currentUserQuery = useMemoFirebase(
      () =>
        currentUser?.uid
          ? query(collection(firestore, 'users'), where('id', '==', currentUser.uid), limit(1))
          : null,
      [firestore, currentUser?.uid]
  );
  const { data: currentUsers } = useCollection<UserProfile>(currentUserQuery);
  const currentUserProfile = currentUsers?.[0];

  // 2a. Fetch authored posts
  const authoredQuery = useMemoFirebase(
    () =>
      userProfile?.id
        ? query(
            collection(firestore, 'cybazone_posts'),
            where('authorId', '==', userProfile.id),
            orderBy('timestamp', 'desc'),
            limit(20)
          )
        : null,
    [firestore, userProfile?.id]
  );
  const { data: authoredPosts, isLoading: isLoadingAuthored } = useCollection<CybazonePost>(authoredQuery);

  // 2b. Fetch reposted posts (without orderBy to avoid missing composite index error)
  const repostedQuery = useMemoFirebase(
    () =>
      userProfile?.id
        ? query(
            collection(firestore, 'cybazone_posts'),
            where('repostedBy', 'array-contains', userProfile.id),
            limit(20)
          )
        : null,
    [firestore, userProfile?.id]
  );
  const { data: repostedPosts, isLoading: isLoadingReposts } = useCollection<CybazonePost>(repostedQuery);

  const isLoadingPosts = isLoadingAuthored || isLoadingReposts;
  
  // Combine, deduplicate, and sort
  const posts = useMemo(() => {
    if (!authoredPosts && !repostedPosts) return [];
    
    const postMap = new Map<string, CybazonePost>();
    authoredPosts?.forEach(p => p.id && postMap.set(p.id, p));
    repostedPosts?.forEach(p => p.id && postMap.set(p.id, p));
    
    return Array.from(postMap.values()).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [authoredPosts, repostedPosts]);

  useEffect(() => {
    if (!isLoadingUser && (!users || users.length === 0)) {
       const timer = setTimeout(() => setShowNotFound(true), 1500); // 1.5s grace period
       return () => clearTimeout(timer);
    } else {
       setShowNotFound(false);
    }
  }, [isLoadingUser, users]);

  if (showNotFound) {
     nextNotFound();
  }

  // Handle loading state
  if (isLoadingUser || !userProfile) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleFollowToggle = async () => {
      if (!currentUser || !currentUserProfile || !userProfile) {
          router.push('/login?redirect=/u/' + encodeURIComponent(username));
          return;
      }

      setIsFollowMutating(true);
      try {
          const isFollowing = userProfile.followers?.includes(currentUser.uid);
          const currentUserId = currentUser.uid;
          const targetUserId = userProfile.id;

          const currentUserRef = doc(firestore, 'users', currentUserId);
          const targetUserRef = doc(firestore, 'users', targetUserId);

          if (isFollowing) {
              // Unfollow
              await Promise.all([
                  updateDoc(currentUserRef, { following: arrayRemove(targetUserId) }),
                  updateDoc(targetUserRef, { followers: arrayRemove(currentUserId) })
              ]);
          } else {
              // Follow
              await Promise.all([
                  updateDoc(currentUserRef, { following: arrayUnion(targetUserId) }),
                  updateDoc(targetUserRef, { followers: arrayUnion(currentUserId) })
              ]);
          }
      } catch (error) {
          console.error("Error toggling follow:", error);
      } finally {
          setIsFollowMutating(false);
      }
  };

  const followerCount = userProfile.followers?.length || 0;
  const followingCount = userProfile.following?.length || 0;
  const isFollowing = currentUser && userProfile.followers?.includes(currentUser.uid);
  const isSelf = currentUser?.uid === userProfile.id;

  const level = computeLevel(userProfile.postCount, userProfile.supportGiven);
  const levelConfig = LEVEL_CONFIG[level];
  const nextLevel = getNextLevel(level);
  const nextConfig = nextLevel ? LEVEL_CONFIG[nextLevel] : null;
  const postProgress = nextConfig ? Math.min(100, ((userProfile.postCount ?? 0) / nextConfig.minPosts) * 100) : 100;
  const supportProgress = nextConfig ? Math.min(100, ((userProfile.supportGiven ?? 0) / nextConfig.minSupport) * 100) : 100;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
        {/* Hero Section */}
        <div className="relative w-full h-64 md:h-80 bg-gradient-to-br from-violet-900 via-background to-black border-b border-primary/20 overflow-hidden">
             {/* Abstract grid pattern or similar could go here */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-24 md:-mt-32 relative z-10">
           <Card className="bg-card/40 backdrop-blur-xl border-primary/30 shadow-[0_0_30px_rgba(138,43,226,0.15)] overflow-hidden">
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start">

                  {/* ── Left: profile picture ── */}
                  <div className="relative group shrink-0 w-36 h-36 mx-auto md:mx-0">
                    <div className="absolute -inset-1 rounded-full blur opacity-60 group-hover:opacity-100 transition duration-500"
                      style={{ background: `linear-gradient(to right, ${levelConfig.gradientFrom}, ${levelConfig.gradientTo})` }} />
                    <div className="relative w-full h-full bg-background rounded-full flex items-center justify-center border border-primary/40 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
                      <AvatarDisplay profilePictureUrl={userProfile.profilePictureUrl} avatarConfig={userProfile.avatarConfig} size={144} />
                    </div>
                    {/* Status bubble rendered by AvatarDisplay internally — no duplicate needed */}
                  </div>

                  {/* ── Middle: all text info ── */}
                  <div className="flex-1 min-w-0 space-y-3 text-center md:text-left">
                    {/* Name + badges */}
                    <div>
                      <h1 className="text-3xl md:text-4xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-primary/80 flex items-center gap-2 justify-center md:justify-start flex-wrap">
                        {userProfile.username}
                        <LevelBadge level={level} size="lg" />
                      </h1>
                      {userProfile.leaderboardCybaName && (
                        <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-1 text-sm font-semibold mt-1">
                          <Award className="w-4 h-4 text-yellow-500" />
                          {userProfile.leaderboardCybaName}
                        </p>
                      )}
                    </div>

                    {/* Tier / coin badges */}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      {userProfile.membershipTier === 'pro' && (
                        <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                          PRO Member
                        </Badge>
                      )}
                      {(userProfile.cybaCoinBalance || 0) > 0 && (
                        <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 bg-cyan-950/30 flex gap-1 items-center">
                          <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={12} height={12} />
                          {(userProfile.cybaCoinBalance ?? 0).toLocaleString()}
                        </Badge>
                      )}
                    </div>

                    {/* Bio */}
                    {userProfile.bio && (
                      <p className="text-muted-foreground leading-relaxed text-sm max-w-xl">
                        {userProfile.bio}
                      </p>
                    )}

                    {/* Location / followers */}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground/80 font-medium">
                      {userProfile.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span>{userProfile.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-primary" />
                        <span><strong className="text-foreground">{followerCount}</strong> Followers</span>
                      </div>
                      <span><strong className="text-foreground">{followingCount}</strong> Following</span>
                    </div>

                    {/* Level progress */}
                    <div className="max-w-sm w-full mx-auto md:mx-0 space-y-1.5 pt-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <span>{levelConfig.emoji}</span>
                        {levelConfig.name}
                        {nextConfig && <span className="ml-auto normal-case font-normal">Next: {nextConfig.name}</span>}
                      </p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Posts</span>
                          <span>{userProfile.postCount ?? 0}{nextConfig ? ` / ${nextConfig.minPosts}` : ''}</span>
                        </div>
                        <Progress value={postProgress} className="h-1" />
                        <div className="flex justify-between mt-1">
                          <span>Support Given</span>
                          <span>{userProfile.supportGiven ?? 0}{nextConfig ? ` / ${nextConfig.minSupport}` : ''}</span>
                        </div>
                        <Progress value={supportProgress} className="h-1" />
                      </div>
                    </div>
                  </div>

                  {/* ── Right: cartoon avatar + jukebox + actions ── */}
                  <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
                    <AvatarDisplay avatarConfig={userProfile.avatarConfig} size={110} level={level} />
                    <AnthemPlayer anthemUrl={userProfile.anthemUrl} username={userProfile.username} />
                    <div className="flex flex-col gap-2 w-full mt-1">
                      {!isSelf && (
                        <Button
                          variant={isFollowing ? "outline" : "default"}
                          className={`rounded-full shadow-lg w-full ${!isFollowing && 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'}`}
                          onClick={handleFollowToggle}
                          disabled={isFollowMutating || !currentUserProfile}
                        >
                          {isFollowMutating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {isFollowing
                            ? <><UserMinus className="w-4 h-4 mr-2" />Unfollow</>
                            : <><UserPlus className="w-4 h-4 mr-2" />Follow</>}
                        </Button>
                      )}
                      {isSelf && (
                        <>
                          <Button variant="outline" className="rounded-full shadow-lg w-full" onClick={() => router.push('/profile')}>
                            Edit Profile
                          </Button>
                          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-destructive w-full" onClick={() => auth.signOut()}>
                            <LogOut className="w-4 h-4 mr-2" />Sign Out
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

              </CardContent>
           </Card>

           {/* Content Tabs */}
           <div className="mt-12 max-w-5xl mx-auto">
               <Tabs defaultValue="posts" className="w-full">
                  <TabsList className="w-full max-w-md mx-auto grid grid-cols-2 bg-card/50 border border-primary/20 p-1 mb-8 rounded-full">
                     <TabsTrigger value="posts" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        Feed
                     </TabsTrigger>
                     <TabsTrigger value="about" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        About
                     </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="posts" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                     {isLoadingPosts ? (
                        <div className="flex justify-center p-12">
                           <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                        </div>
                     ) : posts && posts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {posts.map((post) => (
                               <PostCard key={post.id} post={post} />
                           ))}
                        </div>
                     ) : (
                        <div className="text-center p-16 border border-dashed border-primary/20 rounded-2xl bg-card/20 backdrop-blur-sm">
                           <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Users className="w-8 h-8 text-primary/50" />
                           </div>
                           <h3 className="text-xl font-bold font-headline mb-2">No Transmissions</h3>
                           <p className="text-muted-foreground max-w-sm mx-auto">
                               {userProfile.username} is currently in stealth mode and hasn't posted anything to the Cybazone yet.
                           </p>
                        </div>
                     )}
                  </TabsContent>

                  <TabsContent value="about" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <Card className="bg-card/30 border-primary/10">
                          <CardHeader>
                             <CardTitle className="font-headline text-2xl">About {userProfile.username}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <div className="space-y-2 p-4 rounded-xl bg-background/50 border border-border/50">
                                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
                                      <p className="text-lg">{userProfile.emojiStatus || 'No status set'}</p>
                                  </div>
                                  <div className="space-y-2 p-4 rounded-xl bg-background/50 border border-border/50">
                                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Location</h4>
                                      <p className="text-lg">{userProfile.location || 'Unknown Sector'}</p>
                                  </div>
                              </div>
                              <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bio</h4>
                                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                                      {userProfile.bio || 'This user has not provided a biography yet.'}
                                  </p>
                              </div>
                          </CardContent>
                      </Card>
                  </TabsContent>
               </Tabs>
           </div>
        </div>
    </div>
  );
}

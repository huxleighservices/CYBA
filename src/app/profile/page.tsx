'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, setDocumentNonBlocking, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, LogOut, Save, Ban, User as UserIcon, Camera, X, TrendingUp } from 'lucide-react';
import { doc, collection, query, where, orderBy, updateDoc, deleteField, getDocs, writeBatch } from 'firebase/firestore';
import { computeLevel, getNextLevel, LEVEL_CONFIG, type Level } from '@/lib/levels';
import { LevelBadge } from '@/components/LevelBadge';
import { AnthemPlayer, extractYouTubeId } from '@/components/AnthemPlayer';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { avatarOptions, type AvatarConfig, type AvatarLayer, defaultAvatarConfig } from '@/lib/avatar-assets';
import { cn } from '@/lib/utils';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import Link from 'next/link';

// Extended UserProfile type
type UserProfile = {
  username: string;
  email: string;
  avatarConfig?: AvatarConfig;
  username_lowercase?: string;
  profilePictureUrl?: string;
  postCount?: number;
  supportGiven?: number;
  anthemUrl?: string;
};

async function batchUpdatePostsLevel(firestore: any, userId: string, level: Level) {
  const postsSnap = await getDocs(
    query(collection(firestore, 'cybazone_posts'), where('authorId', '==', userId))
  );
  for (let i = 0; i < postsSnap.docs.length; i += 500) {
    const chunk = postsSnap.docs.slice(i, i + 500);
    const batch = writeBatch(firestore);
    chunk.forEach((postDoc) => batch.update(postDoc.ref, { authorLevel: level }));
    await batch.commit();
  }
}

async function batchUpdatePostsProfilePicture(
  firestore: any,
  userId: string,
  imageUrl: string | null
) {
  const postsSnap = await getDocs(
    query(collection(firestore, 'cybazone_posts'), where('authorId', '==', userId))
  );
  // Firestore batch limit is 500 ops
  const chunkSize = 500;
  for (let i = 0; i < postsSnap.docs.length; i += chunkSize) {
    const chunk = postsSnap.docs.slice(i, i + chunkSize);
    const batch = writeBatch(firestore);
    chunk.forEach((postDoc) => {
      if (imageUrl) {
        batch.update(postDoc.ref, { authorProfilePictureUrl: imageUrl });
      } else {
        batch.update(postDoc.ref, { authorProfilePictureUrl: deleteField() });
      }
    });
    await batch.commit();
  }
}

function ProfilePictureUploader({
  userId,
  currentUrl,
  avatarConfig,
}: {
  userId: string;
  currentUrl?: string;
  avatarConfig?: AvatarConfig;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const hasSynced = useRef(false);

  const displayUrl = previewUrl || currentUrl;

  // Silently sync existing profile picture to any posts that are missing it
  useEffect(() => {
    if (!currentUrl || hasSynced.current) return;
    hasSynced.current = true;
    batchUpdatePostsProfilePicture(firestore, userId, currentUrl).catch(() => {});
  }, [currentUrl, firestore, userId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const fileDataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileDataUri, fileName: file.name, fileType: file.type }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.details || 'Upload failed');
      }

      const { imageUrl } = await response.json();
      await updateDoc(doc(firestore, 'users', userId), { profilePictureUrl: imageUrl });
      await batchUpdatePostsProfilePicture(firestore, userId, imageUrl);
      setPreviewUrl(null); // let Firestore real-time value take over
      toast({ title: 'Profile picture updated!', description: 'All your posts have been updated.' });
    } catch (error) {
      setPreviewUrl(null);
      toast({ variant: 'destructive', title: 'Upload failed', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      await updateDoc(doc(firestore, 'users', userId), { profilePictureUrl: deleteField() });
      await batchUpdatePostsProfilePicture(firestore, userId, null);
      setPreviewUrl(null);
      toast({ title: 'Profile picture removed.', description: 'All your posts have been updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not remove picture.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <AvatarDisplay
            avatarConfig={avatarConfig}
            profilePictureUrl={displayUrl}
            size={160}
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Camera className="w-4 h-4 mr-2" />
            {displayUrl ? 'Change Photo' : 'Upload Photo'}
          </Button>
          {displayUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {displayUrl
            ? 'Your profile picture is shown on your public profile and posts.'
            : 'Upload a photo to use instead of your avatar.'}
        </p>
      </div>
    </div>
  );
}

function AvatarEditor({ initialConfig, userId }: { initialConfig?: Partial<AvatarConfig>, userId: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [config, setConfig] = useState<AvatarConfig>({ ...defaultAvatarConfig, ...initialConfig });
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = (category: AvatarLayer, index: number) => {
    setConfig(prev => ({ ...prev, [category]: index }));
  };
  
  const handleEmojiSelect = (emoji: string) => {
      setConfig(prev => ({...prev, emojiStatus: emoji}));
  }

  const handleSave = () => {
    setIsSaving(true);
    const userDocRef = doc(firestore, 'users', userId);
    setDocumentNonBlocking(userDocRef, { avatarConfig: config }, { merge: true });
    toast({ title: "Avatar Saved!", description: "Your new look has been saved." });
    setIsSaving(false);
  };
  
  const emojiList = ['😀', '😎', '🔥', '🚀', '💯', 'CYBA_SWIRL', '🎵', '🎙️', '✨', '💻'];

  return (
    <div className="space-y-6">
      <div className="relative mx-auto w-fit mb-4">
        <AvatarDisplay avatarConfig={config} size={240} />
      </div>

      <Tabs defaultValue="skin" className="w-full">
        <TabsList className="h-auto flex-wrap justify-center gap-1 p-1 mb-6">
            <TabsTrigger value="skin">Skin</TabsTrigger>
            <TabsTrigger value="hat">Hat</TabsTrigger>
            <TabsTrigger value="shirt">Shirt</TabsTrigger>
            <TabsTrigger value="pants">Pants</TabsTrigger>
            <TabsTrigger value="shoes">Shoes</TabsTrigger>
            <TabsTrigger value="accessory">Accessory</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>
        
        {(Object.keys(avatarOptions) as AvatarLayer[]).map((category) => (
          <TabsContent key={category} value={category}>
            <Carousel opts={{ align: 'start', loop: false }} className="w-full">
              <CarouselContent>
                {avatarOptions[category].map((option, index) => {
                  const isNoneOption = option.name === 'None';
                  return (
                  <CarouselItem key={option.name} className="basis-1/3 md:basis-1/4">
                    <div className="p-1">
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-28 flex items-center justify-center p-2 flex-col gap-2",
                          config[category] === index && "ring-2 ring-primary"
                        )}
                        onClick={() => handleSelect(category, index)}
                      >
                        {isNoneOption ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-red-500">
                            <Ban className="w-10 h-10" />
                            <span className="text-xs font-semibold">None</span>
                          </div>
                        ) : (
                          <>
                            <Image src={option.url} alt={option.name} width={60} height={60} className="object-contain" data-ai-hint={option.hint} />
                            <span className="text-xs truncate">{option.name}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CarouselItem>
                )})}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </TabsContent>
        ))}

        <TabsContent value="status">
            <div className="p-4 border rounded-lg bg-background/50 space-y-4">
                <p className="text-sm text-center text-muted-foreground">Set a status emoji that appears on your avatar.</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {emojiList.map(emoji => (
                        <Button 
                            key={emoji} 
                            variant={config.emojiStatus === emoji ? 'default' : 'outline'}
                            size="icon"
                            className="text-xl"
                            onClick={() => handleEmojiSelect(emoji)}
                        >
                            {emoji === 'CYBA_SWIRL' ? (
                                <Image src="/cyblogo.png" alt="CYBA Swirl" width={24} height={24} className="animate-slow-spin" />
                            ) : (
                                emoji
                            )}
                        </Button>
                    ))}
                     <Button 
                        variant={!config.emojiStatus || config.emojiStatus === '' ? 'default' : 'outline'}
                        onClick={() => handleEmojiSelect('')}
                        className="text-sm"
                    >
                        None
                    </Button>
                </div>
            </div>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
        <span>Save Changes</span>
      </Button>
    </div>
  );
}

function AnthemEditor({ userId, currentUrl, username }: { userId: string; currentUrl?: string; username: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [url, setUrl] = useState(currentUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const videoId = extractYouTubeId(url);
  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  const handleSave = async () => {
    if (!videoId) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid YouTube link.' });
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), { anthemUrl: url.trim() });
      toast({ title: 'Anthem saved!', description: 'Your anthem is now live on your profile.' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), { anthemUrl: deleteField() });
      setUrl('');
      toast({ title: 'Anthem removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not remove anthem.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <AnthemPlayer anthemUrl={url || currentUrl} username={username} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">YouTube URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {thumbUrl && (
        <div className="rounded-lg overflow-hidden border border-border/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt="Video thumbnail" className="w-full object-cover" />
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving || !videoId} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Anthem
        </Button>
        {(currentUrl || url) && (
          <Button variant="ghost" onClick={handleRemove} disabled={isSaving} className="text-destructive hover:text-destructive">
            <X className="w-4 h-4 mr-2" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function MyPosts({ userId }: { userId: string }) {
  const { firestore } = useFirebase();

  const postsQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, 'cybazone_posts'),
        where('authorId', '==', userId),
        orderBy('timestamp', 'desc')
      ),
    [firestore, userId]
  );

  const { data: posts, isLoading } = useCollection<CybazonePost>(postsQuery);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8 mt-6">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center p-12 border-dashed border-2 rounded-lg mt-6 bg-card/50">
        <h3 className="text-xl font-bold">No Posts Yet</h3>
        <p className="text-muted-foreground mb-4">You haven't posted anything yet.</p>
        <Button asChild>
          <Link href="/create">Create your first post</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}


export default function ProfilePage() {
  const { firestore, auth, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const hasSyncedLevel = useRef(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login?redirect=/profile');
    }
  }, [isUserLoading, user, router]);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  // Backfill username_lowercase for existing users who visit their profile
  useEffect(() => {
    if (user && userProfile && userProfile.username && !userProfile.username_lowercase) {
      const userRef = doc(firestore, 'users', user.uid);
      setDocumentNonBlocking(userRef, { username_lowercase: userProfile.username.toLowerCase() }, { merge: true });
    }
  }, [user, userProfile, firestore]);

  // Auto-sync the user's current level to all their posts (runs once per session)
  useEffect(() => {
    if (!user || !userProfile || hasSyncedLevel.current) return;
    hasSyncedLevel.current = true;
    const level = computeLevel(userProfile.postCount, userProfile.supportGiven);
    batchUpdatePostsLevel(firestore, user.uid, level).catch(() => {});
  }, [user, userProfile, firestore]);

  if (isUserLoading || isProfileLoading || !user || !userProfile) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const level = computeLevel(userProfile?.postCount, userProfile?.supportGiven);
  const levelConfig = LEVEL_CONFIG[level];
  const nextLevel = getNextLevel(level);
  const nextConfig = nextLevel ? LEVEL_CONFIG[nextLevel] : null;
  const postProgress = nextConfig ? Math.min(100, ((userProfile?.postCount ?? 0) / nextConfig.minPosts) * 100) : 100;
  const supportProgress = nextConfig ? Math.min(100, ((userProfile?.supportGiven ?? 0) / nextConfig.minSupport) * 100) : 100;

  return (
    <div className="container mx-auto px-4 py-16">
        <Tabs defaultValue="posts" className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TabsList>
                    <TabsTrigger value="posts">My Posts</TabsTrigger>
                    <TabsTrigger value="edit">Edit Profile</TabsTrigger>
                </TabsList>
                 {userProfile?.username && (
                    <Button asChild variant="outline">
                        <Link href={`/u/${userProfile.username}`}>
                            <UserIcon />
                            View Public Profile
                        </Link>
                    </Button>
                 )}
            </div>

            <TabsContent value="posts">
                <MyPosts userId={user.uid} />
            </TabsContent>

            <TabsContent value="edit">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start mt-6">
                    {/* User Info Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                        <CardTitle>My Profile</CardTitle>
                        <CardDescription>Your account information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Username</p>
                            <p className="flex items-center gap-1.5">
                              {userProfile?.username ?? 'N/A'}
                              <LevelBadge level={level} />
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Email</p>
                            <p>{user.email}</p>
                        </div>

                        {/* Level progress */}
                        <div className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" />
                              <p className="text-sm font-semibold">
                                {levelConfig.emoji} {levelConfig.name}
                                {nextConfig && <span className="text-muted-foreground font-normal text-xs ml-2">→ {nextConfig.name}</span>}
                              </p>
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Posts</span>
                                <span>{userProfile?.postCount ?? 0}{nextConfig ? ` / ${nextConfig.minPosts}` : ' ✓'}</span>
                              </div>
                              <Progress value={postProgress} className="h-1.5" />
                              <div className="flex justify-between mt-0.5">
                                <span>Support Given</span>
                                <span>{userProfile?.supportGiven ?? 0}{nextConfig ? ` / ${nextConfig.minSupport}` : ' ✓'}</span>
                              </div>
                              <Progress value={supportProgress} className="h-1.5" />
                            </div>
                        </div>

                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => auth.signOut()}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                        </CardContent>
                    </Card>

                    {/* Profile Picture Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>Profile Picture</CardTitle>
                            <CardDescription>
                                Upload a photo to display instead of your avatar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProfilePictureUploader
                                userId={user.uid}
                                currentUrl={userProfile.profilePictureUrl}
                                avatarConfig={userProfile.avatarConfig}
                            />
                        </CardContent>
                    </Card>

                    {/* Avatar Editor Card */}
                    <Card className="md:col-span-2 xl:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>Customize Avatar</CardTitle>
                            <CardDescription>
                                Style your CYBAZONE avatar. Click save when you're done.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {userProfile && <AvatarEditor initialConfig={userProfile.avatarConfig} userId={user.uid} />}
                        </CardContent>
                    </Card>

                    {/* My Anthem Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>My Anthem</CardTitle>
                            <CardDescription>
                                Set a YouTube video that plays when visitors click your record player.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AnthemEditor
                                userId={user.uid}
                                currentUrl={userProfile.anthemUrl}
                                username={userProfile.username}
                            />
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}

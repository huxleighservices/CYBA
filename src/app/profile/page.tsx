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
import { Loader2, LogOut, Save, Ban, User as UserIcon, Camera, X, TrendingUp, Shield, Mail, EyeOff, Package, Users, Clock } from 'lucide-react';
import { doc, collection, query, where, orderBy, updateDoc, deleteField, getDocs, writeBatch, limit } from 'firebase/firestore';
import { verifyBeforeUpdateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { computeLevel, getNextLevel, LEVEL_CONFIG, DEFAULT_LEVEL_THRESHOLDS, type Level, type LevelThresholds } from '@/lib/levels';
import { LevelBadge } from '@/components/LevelBadge';
import { AnthemPlayer, extractYouTubeId } from '@/components/AnthemPlayer';
import { AnalyticsTab } from '@/components/AnalyticsTab';
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
import { MyStore } from '@/components/market/MyStore';
import Link from 'next/link';
import {
  PROFILE_BACKGROUNDS,
  isBackgroundUnlocked,
  getUnlockLabel,
} from '@/lib/profile-backgrounds';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// Extended UserProfile type
type UserProfile = {
  username: string;
  email: string;
  fullName?: string;
  avatarConfig?: AvatarConfig;
  username_lowercase?: string;
  profilePictureUrl?: string;
  postCount?: number;
  supportGiven?: number;
  anthemUrl?: string;
  cybaCoinBalance?: number;
  profileBackground?: string;
  profileBackgroundUrl?: string;
  unlockedBackgrounds?: string[];
  payoutPlatform?: 'cashapp' | 'venmo';
  payoutUsername?: string;
  leaderboardOptOut?: boolean;
  inventory?: {
    sponsored_post?: { quantity: number };
    sponsored_profile?: { quantity: number };
  };
  purchasedRewards?: string[];
  payoutBalance?: number;
  payoutEnrolled?: boolean;
  completedQuests?: string[];
  referralCount?: number;
  referralApplied?: boolean;
  referredBy?: string;
  marketBoost?: boolean;
  levelOverride?: string;
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

function RescheduleButton({ postId, currentScheduledAt }: { postId: string; currentScheduledAt?: import('firebase/firestore').Timestamp }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(() => {
    const d = currentScheduledAt?.toDate?.() ?? new Date(Date.now() + 3600000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!val) return;
    setSaving(true);
    try {
      const newDate = new Date(val);
      await updateDoc(doc(firestore, 'cybazone_posts', postId), {
        scheduledAt: newDate,
        timestamp: newDate,
      });
      toast({ title: 'Reschedule saved' });
      setOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not reschedule' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 hover:bg-black/80 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-sm transition-colors"
        >
          <Clock className="h-3 w-3" /> Reschedule
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reschedule Post</DialogTitle></DialogHeader>
        <input
          type="datetime-local"
          value={val}
          onChange={e => setVal(e.target.value)}
          min={(() => {
            const d = new Date(Date.now() + 60000);
            const p = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
          })()}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !val}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyPosts({ userId }: { userId: string }) {
  const { firestore } = useFirebase();

  const postsQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, 'cybazone_posts'),
        where('authorId', '==', userId)
      ),
    [firestore, userId]
  );

  const { data: rawPosts, isLoading } = useCollection<CybazonePost>(postsQuery);
  const posts = rawPosts
    ?.slice()
    .sort((a, b) => {
      const aIsScheduled = (a as any).published === false;
      const bIsScheduled = (b as any).published === false;
      // Published posts first (sorted by timestamp desc), then scheduled (sorted by scheduledAt asc)
      if (!aIsScheduled && bIsScheduled) return -1;
      if (aIsScheduled && !bIsScheduled) return 1;
      if (aIsScheduled && bIsScheduled) {
        return ((a as any).scheduledAt?.toMillis?.() ?? 0) - ((b as any).scheduledAt?.toMillis?.() ?? 0);
      }
      return ((b as any).timestamp?.toMillis?.() ?? 0) - ((a as any).timestamp?.toMillis?.() ?? 0);
    });

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
      {posts.map((post) => {
        const isScheduled = (post as any).published === false;
        const scheduledAt: import('firebase/firestore').Timestamp | undefined = (post as any).scheduledAt;
        return (
          <div key={post.id} className="relative">
            {isScheduled && (
              <>
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-sm">
                  <Clock className="h-3 w-3" />
                  {scheduledAt
                    ? `Scheduled · ${scheduledAt.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                    : 'Scheduled'}
                </div>
                <RescheduleButton postId={post.id} currentScheduledAt={scheduledAt} />
              </>
            )}
            <div className={isScheduled ? 'opacity-60' : undefined}>
              <PostCard post={post} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


function ZoneBuilder({ userId, referralCount }: { userId: string; referralCount?: number }) {
  const { firestore } = useFirebase();

  const referralsQuery = useMemoFirebase(
    () => query(collection(firestore, 'users', userId, 'referrals')),
    [firestore, userId]
  );

  const { data: referrals, isLoading } = useCollection<{ username: string; userId: string; joinedAt: any }>(referralsQuery);

  const sorted = referrals
    ? [...referrals].sort((a, b) => (b.joinedAt?.toMillis?.() ?? 0) - (a.joinedAt?.toMillis?.() ?? 0))
    : [];

  const count = referralCount ?? sorted.length;

  return (
    <div className="mt-6 space-y-4">
      <Card className="border-primary/20 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle>Zone Builder</CardTitle>
          </div>
          <CardDescription>People who joined CYBAZONE using your referral code. Only visible to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary mb-1">{count}</div>
          <p className="text-sm text-muted-foreground mb-3">{count === 1 ? 'referral' : 'referrals'} total</p>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 mb-4 text-xs text-muted-foreground leading-relaxed">
            You earn <span className="text-foreground font-semibold">$1 cash</span> added to your wallet and <span className="text-foreground font-semibold">1,000 CYBACOIN</span> for every person who signs up using your referral code.
          </div>

          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No referrals yet. Share your username and invite people to sign up!
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((ref) => (
                <div key={ref.userId} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                  <span className="font-medium text-sm">{ref.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {ref.joinedAt?.toDate ? ref.joinedAt.toDate().toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsernameEditor({ userId, currentUsername }: { userId: string; currentUsername: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  // Strip existing CYBA prefix (case-insensitive) so user only edits the suffix
  const initialSuffix = currentUsername.toUpperCase().startsWith('CYBA')
    ? currentUsername.slice(4)
    : currentUsername;
  const [suffix, setSuffix] = useState(initialSuffix);
  const [saving, setSaving] = useState(false);

  const fullUsername = 'CYBA' + suffix.trim();

  const handleSave = async () => {
    const trimmedSuffix = suffix.trim();
    if (!trimmedSuffix) return;
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(trimmedSuffix)) {
      toast({ variant: 'destructive', title: 'Invalid username', description: '1–20 characters after @CYBA: letters, numbers, underscores only.' });
      return;
    }
    const final = 'CYBA' + trimmedSuffix;
    if (final === currentUsername) return;
    setSaving(true);
    try {
      const snap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '==', final.toLowerCase()),
        limit(1)
      ));
      if (!snap.empty && snap.docs[0].id !== userId) {
        toast({ variant: 'destructive', title: 'Username taken', description: 'Please choose a different handle.' });
        return;
      }
      await updateDoc(doc(firestore, 'users', userId), {
        username: final,
        username_lowercase: final.toLowerCase(),
      });
      const postsSnap = await getDocs(query(collection(firestore, 'cybazone_posts'), where('authorId', '==', userId)));
      for (let i = 0; i < postsSnap.docs.length; i += 500) {
        const batch = writeBatch(firestore);
        postsSnap.docs.slice(i, i + 500).forEach(d => batch.update(d.ref, { authorUsername: final }));
        await batch.commit();
      }
      toast({ title: 'Username updated!', description: `You are now @${final}` });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center rounded-md border border-input overflow-hidden">
        <span className="bg-muted px-3 py-2 text-sm font-bold text-primary border-r border-input shrink-0 select-none">
          @CYBA
        </span>
        <input
          value={suffix}
          onChange={(e) => setSuffix(e.target.value)}
          maxLength={20}
          placeholder="YourName"
          className="flex-1 bg-background px-3 py-2 text-sm focus:outline-none"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Your handle: <span className="text-foreground font-semibold">@CYBA{suffix.trim() || '…'}</span>
        {' '}· 1–20 characters, letters / numbers / underscores.
      </p>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || !suffix.trim() || fullUsername === currentUsername}
        className="w-full"
      >
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Username
      </Button>
    </div>
  );
}

function FullNameEditor({ userId, currentFullName }: { userId: string; currentFullName?: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [value, setValue] = useState(currentFullName ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), {
        fullName: value.trim() ? value.trim() : deleteField(),
      });
      toast({ title: 'Name saved!' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={60}
        placeholder="Your full name (optional)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <p className="text-xs text-muted-foreground">
        Shown on your public profile alongside your username. Optional.
      </p>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || value.trim() === (currentFullName ?? '')}
        className="w-full"
      >
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Name
      </Button>
    </div>
  );
}

function EmailEditor({ userId, currentEmail }: { userId: string; currentEmail: string }) {
  const { firestore, auth } = useFirebase();
  const { toast } = useToast();
  const [email, setEmail] = useState(currentEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [password, setPassword] = useState('');

  // Sync auth email → Firestore when they differ (e.g. after user clicks verification link)
  useEffect(() => {
    const authEmail = auth.currentUser?.email;
    if (authEmail && authEmail !== currentEmail) {
      updateDoc(doc(firestore, 'users', userId), { email: authEmail }).catch(() => {});
    }
  }, [auth.currentUser?.email, currentEmail, firestore, userId]);

  const sendVerification = async (newEmail: string) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
    toast({
      title: 'Verification email sent!',
      description: `Check ${newEmail} and click the link to confirm. Your email here will update automatically once verified.`,
    });
    setNeedsReauth(false);
    setPassword('');
  };

  const handleSave = async () => {
    const trimmed = email.trim();
    if (!trimmed || trimmed === currentEmail) return;
    setSaving(true);
    try {
      await sendVerification(trimmed);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
      } else {
        toast({ variant: 'destructive', title: 'Could not update email', description: err.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReauth = async () => {
    const trimmed = email.trim();
    if (!password || !trimmed) return;
    setSaving(true);
    try {
      if (!auth.currentUser || !auth.currentUser.email) throw new Error('Not signed in');
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await sendVerification(trimmed);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Re-authentication failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="new@email.com"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {needsReauth && (
        <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-3">
          <p className="text-xs text-yellow-400 font-medium">Confirm your current password to continue</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={handleReauth} disabled={saving || !password} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Confirm & Send Verification
          </Button>
        </div>
      )}
      {!needsReauth && (
        <>
          <p className="text-xs text-muted-foreground">
            A verification link will be sent to your new address. Your email updates once you click it.
          </p>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !email.trim() || email.trim() === currentEmail}
            className="w-full"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Verification Email
          </Button>
        </>
      )}
    </div>
  );
}

function PayoutAccountEditor({
  userId,
  currentPlatform,
  currentUsername,
}: {
  userId: string;
  currentPlatform?: 'cashapp' | 'venmo';
  currentUsername?: string;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [platform, setPlatform] = useState<'cashapp' | 'venmo'>(currentPlatform ?? 'cashapp');
  const [username, setUsername] = useState(currentUsername ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), {
        payoutPlatform: platform,
        payoutUsername: username.trim().replace(/^[@$]/, ''),
      });
      toast({ title: 'Payout account saved!' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), {
        payoutPlatform: deleteField(),
        payoutUsername: deleteField(),
      });
      setUsername('');
      toast({ title: 'Payout account removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not remove.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Platform toggle */}
      <div className="flex rounded-lg overflow-hidden border border-input">
        {(['cashapp', 'venmo'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              platform === p
                ? p === 'cashapp'
                  ? 'bg-[#00C244] text-white'
                  : 'bg-[#3D95CE] text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            {p === 'cashapp' ? '$ Cash App' : '🅥 Venmo'}
          </button>
        ))}
      </div>

      {/* Username input */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm font-medium shrink-0">
          {platform === 'cashapp' ? '$' : '@'}
        </span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={50}
          placeholder={platform === 'cashapp' ? 'YourCashtag' : 'YourVenmo'}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !username.trim()} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
        {currentUsername && (
          <Button size="sm" variant="ghost" onClick={handleRemove} disabled={saving} className="text-destructive hover:text-destructive">
            <X className="w-4 h-4 mr-2" />
            Remove
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Used for CYBAZONE Payout Boost payouts. Never shown publicly.
      </p>
    </div>
  );
}

// ─── Background Image Crop Dialog ────────────────────────────────────────────
function ImageCropDialog({
  src,
  open,
  onClose,
  onApply,
}: {
  src: string;
  open: boolean;
  onClose: () => void;
  onApply: (croppedDataUrl: string) => void;
}) {
  const ASPECT = 16 / 5;
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [natW, setNatW] = useState(1);

  useEffect(() => {
    if (open) { setPos({ x: 0, y: 0 }); setZoom(1); }
  }, [open, src]);

  const onLoad = () => {
    if (!imgRef.current) return;
    setNatW(imgRef.current.naturalWidth);
  };

  const startDrag = (clientX: number, clientY: number) => {
    setDragging(true);
    setOrigin({ x: clientX - pos.x, y: clientY - pos.y });
  };
  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragging) return;
    setPos({ x: clientX - origin.x, y: clientY - origin.y });
  };
  const endDrag = () => setDragging(false);

  const handleApply = () => {
    if (!imgRef.current || !containerRef.current) return;
    const { width: cW, height: cH } = containerRef.current.getBoundingClientRect();
    const OUT_W = 1200;
    const OUT_H = Math.round(OUT_W / ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d')!;
    const scale = natW / (cW * zoom);
    ctx.drawImage(imgRef.current, -pos.x * scale, -pos.y * scale, cW * scale, cH * scale, 0, 0, OUT_W, OUT_H);
    onApply(canvas.toDataURL('image/jpeg', 0.92));
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop Background Image</DialogTitle>
          <DialogDescription>Drag to reposition · Slide to zoom</DialogDescription>
        </DialogHeader>

        {/* Crop viewport */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-xl border border-primary/30 bg-black/50 cursor-move select-none"
          style={{ aspectRatio: `${ASPECT}` }}
          onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
          onTouchMove={e => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }}
          onTouchEnd={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="crop preview"
            onLoad={onLoad}
            draggable={false}
            style={{
              position: 'absolute',
              width: `${zoom * 100}%`,
              height: 'auto',
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              maxWidth: 'none',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
          {/* Rule-of-thirds guide overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',
            backgroundSize: '33.3% 33.3%',
          }} />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground shrink-0">Zoom</span>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="text-xs tabular-nums w-8 text-right text-muted-foreground">{zoom.toFixed(1)}×</span>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Crop & Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileBackgroundPicker({
  userId,
  currentBgId,
  currentBgUrl,
  ownedIds,
  level,
}: {
  userId: string;
  currentBgId?: string;
  currentBgUrl?: string;
  ownedIds: string[];
  level: import('@/lib/levels').Level;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [selected, setSelected] = useState(currentBgId ?? 'default');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customPreview, setCustomPreview] = useState<string | undefined>(currentBgUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), { profileBackground: selected });
      toast({ title: 'Background saved!', description: 'Your profile background has been updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Open crop dialog when file is selected
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Called when user finishes cropping — upload the cropped dataURL
  const handleCropApply = async (croppedDataUrl: string) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setUploading(true);
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileDataUri: croppedDataUrl, fileName: 'background.jpg', fileType: 'image/jpeg' }),
      });
      if (!response.ok) throw new Error('Upload failed');
      const { imageUrl } = await response.json();
      await updateDoc(doc(firestore, 'users', userId), {
        profileBackground: 'custom',
        profileBackgroundUrl: imageUrl,
      });
      setCustomPreview(imageUrl);
      setSelected('custom');
      toast({ title: 'Custom background saved!' });
    } catch {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const selectedBg = PROFILE_BACKGROUNDS.find(b => b.id === selected);
  const previewStyle: React.CSSProperties = selected === 'custom' && customPreview
    ? { backgroundImage: `url(${customPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : (selectedBg?.style ?? {});
  const previewLabel = selected === 'custom' ? '🖼️ Custom Upload' : `${selectedBg?.emoji ?? ''} ${selectedBg?.name ?? 'Default'}`;

  return (
    <div className="space-y-4">
      {/* Preview strip */}
      <div
        className="w-full h-20 rounded-xl border border-primary/20 overflow-hidden transition-all duration-500"
        style={previewStyle}
      />

      <p className="text-xs text-muted-foreground text-center">
        Selected: <span className="text-foreground font-semibold">{previewLabel}</span>
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
        {PROFILE_BACKGROUNDS.map((bg) => {
          const unlocked = isBackgroundUnlocked(bg, level, ownedIds);
          const isActive = bg.id === selected;
          return (
            <button
              key={bg.id}
              onClick={() => unlocked && setSelected(bg.id)}
              className={cn(
                'relative rounded-lg overflow-hidden border-2 transition-all group aspect-video',
                isActive ? 'border-primary scale-105 shadow-[0_0_12px_rgba(138,43,226,0.5)]' : 'border-transparent hover:border-primary/40',
                !unlocked && 'cursor-not-allowed opacity-60',
              )}
              title={unlocked ? bg.name : `Locked: ${getUnlockLabel(bg)}`}
            >
              <div className="w-full h-full" style={bg.style} />
              {!unlocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-0.5 p-1">
                  <span className="text-xs">🔒</span>
                  <span className="text-[9px] text-white/80 text-center leading-tight">{getUnlockLabel(bg)}</span>
                </div>
              )}
              {unlocked && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[9px] text-white text-center truncate">{bg.emoji} {bg.name}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom upload */}
      <div className="border border-dashed border-primary/30 rounded-xl p-3 flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground text-center">Or upload your own background image</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
          {uploading ? 'Uploading…' : 'Upload Image'}
        </Button>
      </div>

      <Button onClick={handleSave} disabled={saving || selected === 'custom'} className="w-full" size="sm">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Background
      </Button>

      {/* Crop dialog */}
      {cropSrc && (
        <ImageCropDialog
          src={cropSrc}
          open={!!cropSrc}
          onClose={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
          onApply={handleCropApply}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Inventory Dialog
// ─────────────────────────────────────────────
function InventoryDialog({ open, onClose, profile }: {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
}) {
  const postSlots    = profile.inventory?.sponsored_post?.quantity ?? 0;
  const profileSlots = profile.inventory?.sponsored_profile?.quantity ?? 0;
  const unlockedBgs  = profile.unlockedBackgrounds ?? [];
  const purchasedRewards = profile.purchasedRewards ?? [];
  const completedQuests  = profile.completedQuests ?? [];
  const payoutBalance    = profile.payoutBalance ?? 0;
  const payoutEnrolled   = profile.payoutEnrolled ?? false;
  const coinBalance      = profile.cybaCoinBalance ?? 0;

  const isEmpty =
    postSlots === 0 &&
    profileSlots === 0 &&
    unlockedBgs.length === 0 &&
    purchasedRewards.length === 0 &&
    completedQuests.length === 0 &&
    coinBalance === 0;

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            My Inventory
          </DialogTitle>
        </DialogHeader>

        {isEmpty ? (
          <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
            <p className="text-3xl">📦</p>
            <p className="font-medium">Your inventory is empty.</p>
            <p className="text-xs">Complete quests, spin the wheel, and buy rewards to fill it up.</p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">

            {/* Balances */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/10 p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">CYBACOIN</p>
                <div className="flex items-center justify-center gap-1.5">
                  <Image src="/CCoin.png?v=2" alt="CC" width={18} height={18} />
                  <span className="text-xl font-bold text-yellow-400 tabular-nums">{coinBalance.toLocaleString()}</span>
                </div>
              </div>
              {payoutEnrolled && (
                <div className="rounded-xl border border-green-500/30 bg-green-950/10 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Cash Balance</p>
                  <span className="text-xl font-bold text-green-400 tabular-nums">${payoutBalance.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Sponsor slots */}
            {(postSlots > 0 || profileSlots > 0) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Spotlight Slots</p>
                <div className="space-y-2">
                  {postSlots > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-950/10 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📝</span>
                        <span className="text-sm font-medium">Spotlight Post</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{postSlots}x</Badge>
                        <Link href="/sponsor" onClick={onClose}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">Activate</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                  {profileSlots > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-950/10 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        <span className="text-sm font-medium">Spotlight Profile</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{profileSlots}x</Badge>
                        <Link href="/sponsor" onClick={onClose}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">Activate</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Unlocked backgrounds */}
            {unlockedBgs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Profile Backgrounds ({unlockedBgs.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {unlockedBgs.map(bgId => {
                    const bg = PROFILE_BACKGROUNDS.find(b => b.id === bgId);
                    return (
                      <div
                        key={bgId}
                        className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium"
                      >
                        <span>{bg?.emoji ?? '✨'}</span>
                        <span>{bg?.name ?? bgId}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed quests count */}
            {completedQuests.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗺️</span>
                  <span className="text-sm font-medium">Quests Completed</span>
                </div>
                <Badge variant="secondary">{completedQuests.length}</Badge>
              </div>
            )}

            {/* Purchased rewards */}
            {purchasedRewards.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Purchased Rewards ({purchasedRewards.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {purchasedRewards.map(id => (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium"
                    >
                      <span>🎁</span>
                      <span className="capitalize">{id.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 flex gap-2">
              <Link href="/wallet" onClick={onClose} className="flex-1">
                <Button variant="outline" className="w-full text-xs" size="sm">View Wallet</Button>
              </Link>
              <Link href="/rewards" onClick={onClose} className="flex-1">
                <Button variant="outline" className="w-full text-xs" size="sm">Browse Rewards</Button>
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { firestore, auth, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const hasSyncedLevel = useRef(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login?redirect=/profile');
    }
  }, [isUserLoading, user, router]);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const levelCfgRef = useMemoFirebase(() => doc(firestore, 'settings', 'levelConfig'), [firestore]);
  const { data: rawLevelCfg } = useDoc<Partial<LevelThresholds>>(levelCfgRef);
  const levelThresholds: LevelThresholds = rawLevelCfg ? { ...DEFAULT_LEVEL_THRESHOLDS, ...rawLevelCfg } : DEFAULT_LEVEL_THRESHOLDS;

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
    const level = computeLevel(userProfile.postCount, userProfile.supportGiven, levelThresholds, userProfile.levelOverride);
    batchUpdatePostsLevel(firestore, user.uid, level).catch(() => {});
  }, [user, userProfile, firestore]);

  if (isUserLoading || isProfileLoading || !user || !userProfile) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const level = computeLevel(userProfile?.postCount, userProfile?.supportGiven, levelThresholds, userProfile?.levelOverride);
  const levelConfig = LEVEL_CONFIG[level];
  const nextLevel = getNextLevel(level);
  const nextMinPosts = nextLevel ? (levelThresholds as Record<string, number>)[`${nextLevel}_posts`] : undefined;
  const nextMinSupport = nextLevel ? (levelThresholds as Record<string, number>)[`${nextLevel}_support`] : undefined;
  const postProgress = nextMinPosts ? Math.min(100, ((userProfile?.postCount ?? 0) / nextMinPosts) * 100) : 100;
  const supportProgress = nextMinSupport ? Math.min(100, ((userProfile?.supportGiven ?? 0) / nextMinSupport) * 100) : 100;

  return (
    <div className="container mx-auto px-4 pt-4 pb-16">
        <InventoryDialog
          open={inventoryOpen}
          onClose={() => setInventoryOpen(false)}
          profile={userProfile}
        />

        <Tabs defaultValue="posts" className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TabsList>
                    <TabsTrigger value="posts">My Posts</TabsTrigger>
                    <TabsTrigger value="zone">Zone Builder</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="edit">Edit Profile</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setInventoryOpen(true)}>
                        <Package className="mr-2 h-4 w-4" />
                        My Inventory
                    </Button>
                    {userProfile?.username && (
                        <Button asChild variant="outline">
                            <Link href={`/u/${userProfile.username}`}>
                                <UserIcon className="mr-2 h-4 w-4" />
                                View Public Profile
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="outline">
                        <Link href="/?tab=subnets&subnetView=mine">
                            🔒 My Subnet
                        </Link>
                    </Button>
                </div>
            </div>

            <TabsContent value="posts">
                {userProfile?.marketBoost && (
                    <div className="mb-8">
                        <MyStore userId={user.uid} username={userProfile.username} />
                    </div>
                )}
                <MyPosts userId={user.uid} />
            </TabsContent>

            <TabsContent value="zone">
                <ZoneBuilder userId={user.uid} referralCount={userProfile?.referralCount} />
            </TabsContent>

            <TabsContent value="analytics">
                <AnalyticsTab userId={user.uid} />
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
                                {nextLevel && <span className="text-muted-foreground font-normal text-xs ml-2">→ {LEVEL_CONFIG[nextLevel].name}</span>}
                              </p>
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Posts</span>
                                <span>{userProfile?.postCount ?? 0}{nextMinPosts ? ` / ${nextMinPosts}` : ' ✓'}</span>
                              </div>
                              <Progress value={postProgress} className="h-1.5" />
                              <div className="flex justify-between mt-0.5">
                                <span>Support Given</span>
                                <span>{userProfile?.supportGiven ?? 0}{nextMinSupport ? ` / ${nextMinSupport}` : ' ✓'}</span>
                              </div>
                              <Progress value={supportProgress} className="h-1.5" />
                            </div>
                        </div>

                        {['contactcyba@gmail.com', 'z1mmerman@yahoo.com'].includes(user.email ?? '') && (
                            <Button
                                asChild
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                            >
                                <Link href="/admin">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Admin Panel
                                </Link>
                            </Button>
                        )}

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

                    {/* Username Editor Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>Username</CardTitle>
                            <CardDescription>Your handle is always @CYBA + your unique name.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <UsernameEditor userId={user.uid} currentUsername={userProfile.username} />
                        </CardContent>
                    </Card>

                    {/* Full Name Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>Full Name</CardTitle>
                            <CardDescription>Optional real name shown on your public profile.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FullNameEditor userId={user.uid} currentFullName={userProfile.fullName} />
                        </CardContent>
                    </Card>

                    {/* Email Editor Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Email
                            </CardTitle>
                            <CardDescription>Update the email address on your account.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EmailEditor userId={user.uid} currentEmail={user.email ?? userProfile.email ?? ''} />
                        </CardContent>
                    </Card>

                    {/* Privacy Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <EyeOff className="w-4 h-4" /> Privacy
                            </CardTitle>
                            <CardDescription>Control your visibility on the site.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between gap-4 py-2">
                                <div>
                                    <p className="text-sm font-medium">Hide from Leaderboard</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Your scores won&apos;t appear in public rankings.
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        try {
                                            await updateDoc(doc(firestore, 'users', user.uid), {
                                                leaderboardOptOut: !userProfile.leaderboardOptOut,
                                            });
                                        } catch {
                                            // silent fail, firestore listener will update
                                        }
                                    }}
                                    className={cn(
                                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
                                        userProfile.leaderboardOptOut ? 'bg-primary' : 'bg-muted'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform',
                                            userProfile.leaderboardOptOut ? 'translate-x-5' : 'translate-x-0'
                                        )}
                                    />
                                </button>
                            </div>
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

                    {/* Payout Account Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>Payout Account</CardTitle>
                            <CardDescription>
                                Your Cash App or Venmo for CYBAZONE Payout Boost earnings. Optional &amp; private.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PayoutAccountEditor
                                userId={user.uid}
                                currentPlatform={(userProfile as any).payoutPlatform}
                                currentUsername={(userProfile as any).payoutUsername}
                            />
                        </CardContent>
                    </Card>

                    {/* Profile Background Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                            <CardTitle>Profile Background</CardTitle>
                            <CardDescription>
                                Unlock backgrounds with CYBACOIN or by levelling up.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProfileBackgroundPicker
                                userId={user.uid}
                                currentBgId={userProfile.profileBackground}
                                currentBgUrl={userProfile.profileBackgroundUrl}
                                ownedIds={userProfile.unlockedBackgrounds ?? []}
                                level={level}
                            />
                        </CardContent>
                    </Card>

                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}

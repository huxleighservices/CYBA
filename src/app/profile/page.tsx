'use client';

import { useEffect, useState } from 'react';
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
import { Loader2, LogOut, Save, Ban, User as UserIcon } from 'lucide-react';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
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
};

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

  // Redirect if not logged in
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login?redirect=/profile');
    }
  }, [isUserLoading, user, router]);
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  if (isUserLoading || isProfileLoading || !user || !userProfile) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mt-6">
                    {/* User Info Card */}
                    <Card className="md:col-span-1 border-primary/20 bg-card/50">
                        <CardHeader>
                        <CardTitle>My Profile</CardTitle>
                        <CardDescription>Your account information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Username</p>
                            <p>{userProfile?.username ?? 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Email</p>
                            <p>{user.email}</p>
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

                    {/* Avatar Editor Card */}
                    <Card className="md:col-span-2 border-primary/20 bg-card/50">
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
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}

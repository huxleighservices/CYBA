'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useFirebase,
  useDoc,
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking,
} from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  MapPin,
  Users,
  Smile,
  ImageIcon,
  VideoIcon,
  HelpCircle,
  Trophy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AvatarConfig,
  defaultAvatarConfig,
  defaultLayerOrder,
} from '@/lib/avatar-assets';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// --- Schemas and Types ---

const profileSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
  bio: z.string().max(150, 'Bio cannot be longer than 150 characters.').optional(),
  location: z.string().max(50, 'Location cannot be longer than 50 characters.').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type UserProfile = {
  username: string;
  email?: string;
  avatarConfig?: AvatarConfig;
  bio?: string;
  location?: string;
  emojiStatus?: string;
  followers?: string[];
  following?: string[];
  leaderboardCybaName?: string;
  cybaCoinBalance?: number;
};

type CybazonePost = {
  id: string;
  imageUrl?: string;
  content: string;
};

type LeaderboardEntry = {
  cybaName?: string;
  cybaCoin?: number;
};

const EMOJIS = ['😀', '😂', '😍', '🤔', '😎', '😢', '🔥', '🚀', '💯', '🎉', '🎶', '🎤', '😴', '💡', 'work'];

// --- Main Profile Page Component ---

export default function ProfilePage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const userPostsQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, 'cybazone_posts'),
            where('authorId', '==', user.uid),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, user]
  );
  const { data: userPosts, isLoading: arePostsLoading } =
    useCollection<CybazonePost>(userPostsQuery);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
      bio: '',
      location: '',
    },
  });

  // --- Data Fetching and State Management ---

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (userProfile) {
      form.reset({
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        location: userProfile.location || '',
      });
    }
  }, [userProfile, form]);
  
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/sheets');
        const data = await response.json();
        if (response.ok) {
          setLeaderboardData(data);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard for ranking', error);
      }
    };
    if (user) fetchLeaderboard();
  }, [user]);

  useEffect(() => {
    if (userProfile?.leaderboardCybaName && leaderboardData.length > 0) {
      const userRank = leaderboardData.findIndex(
        (entry) =>
          entry.cybaName?.toLowerCase() ===
          userProfile.leaderboardCybaName?.toLowerCase()
      );
      setRank(userRank !== -1 ? userRank + 1 : null);
    }
  }, [userProfile, leaderboardData]);


  // --- Event Handlers ---

  const onProfileSubmit = (values: ProfileFormValues) => {
    if (!userDocRef) return;
    setDocumentNonBlocking(userDocRef, values, { merge: true });
    toast({ title: 'Profile Saved', description: 'Your profile has been updated.' });
    setIsEditing(false);
  };

  const onEmojiSelect = (emoji: string) => {
    if (!userDocRef) return;
    const newEmoji = userProfile?.emojiStatus === emoji ? '' : emoji; // Toggle off if same emoji is clicked
    setDocumentNonBlocking(userDocRef, { emojiStatus: newEmoji }, { merge: true });
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    if (userProfile) {
      form.reset({
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        location: userProfile.location || '',
      });
    }
  };


  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
    // This can happen briefly after login before the user document is created/fetched
    return (
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <p>Loading profile...</p>
        </div>
    );
  }

  // --- Render ---

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onProfileSubmit)}>
          {/* Profile Header */}
          <section className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 mb-8">
            <AvatarDisplay
              avatarConfig={userProfile.avatarConfig}
              size={150}
              className="flex-shrink-0"
            />
            <div className="w-full space-y-3 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {isEditing ? (
                   <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input className="text-2xl font-bold" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <h1 className="text-2xl font-bold flex items-center gap-2 justify-center sm:justify-start">
                    {userProfile.username}
                    {userProfile.emojiStatus && <span className="text-lg">{userProfile.emojiStatus}</span>}
                  </h1>
                )}
                
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
                    <Button type="submit">Save</Button>
                  </div>
                ) : (
                  <Button type="button" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                )}
              </div>
              
              <div className="flex justify-center sm:justify-start gap-6 text-sm">
                <span className="font-semibold">{userPosts?.length || 0} <span className="text-muted-foreground font-normal">posts</span></span>
                <span className="font-semibold">{userProfile.followers?.length || 0} <span className="text-muted-foreground font-normal">followers</span></span>
                <span className="font-semibold">{userProfile.following?.length || 0} <span className="text-muted-foreground font-normal">following</span></span>
              </div>

              {isEditing ? (
                <div className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl><Textarea placeholder="Tell us about yourself..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                           <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Your location" className="pl-9" {...field} />
                           </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                        <FormLabel className="flex items-center gap-2">
                            <Smile className="h-4 w-4" />
                            Status Emoji
                        </FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal">
                                    {userProfile.emojiStatus ? `Current: ${userProfile.emojiStatus}` : 'Select an emoji'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                                <div className="grid grid-cols-5 gap-1">
                                    {EMOJIS.map(emoji => (
                                        <Button key={emoji} variant={userProfile.emojiStatus === emoji ? "default" : "ghost"} size="icon" onClick={() => onEmojiSelect(emoji)}>
                                            {emoji}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </FormItem>
                </div>
              ) : (
                <div>
                  <p className="text-sm">{userProfile.bio}</p>
                  {userProfile.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 justify-center sm:justify-start"><MapPin className="h-3 w-3" /> {userProfile.location}</p>}
                </div>
              )}
            </div>
          </section>
        </form>
      </Form>
      
      {/* Private Stats Section */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="CYBACOIN Balance" value={userProfile.cybaCoinBalance?.toLocaleString() || '0'} icon={<Image src="/CCoin.png?v=3" alt="CYBACOIN" width={24} height={24} />} />
            <StatCard title="Weekly CYBACOIN" value="+0" icon={<Image src="/CCoin.png?v=3" alt="CYBACOIN" width={24} height={24} />} tooltip="Weekly CYBACOIN tracking is coming soon!" />
            <StatCard title="Leaderboard Rank" value={rank ? `#${rank}` : 'N/A'} icon={<Trophy className="text-yellow-400" />} tooltip={!rank ? 'Link your CybaName in the admin panel to see your rank.' : `You are #${rank} on the leaderboard!`} />
        </div>
      </section>

      {/* Posts Grid */}
      <section>
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts"><Users className="mr-2 h-4 w-4" />Posts</TabsTrigger>
            <TabsTrigger value="saved" disabled>Saved (Coming Soon)</TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-4">
            {arePostsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
            ) : userPosts && userPosts.length > 0 ? (
                 <div className="grid grid-cols-3 gap-1">
                    {userPosts.map(post => (
                        <PostGridItem key={post.id} post={post} />
                    ))}
                 </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground">
                    <p>No posts yet.</p>
                    <Button variant="link" asChild><Link href="/cybazone">Create your first post</Link></Button>
                </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}


// --- Sub-components ---

function StatCard({ title, value, icon, tooltip }: { title: string; value: string | number; icon: React.ReactNode; tooltip?: string }) {
  const cardContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="w-full text-left">{cardContent}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}

function PostGridItem({ post }: { post: CybazonePost }) {
    const isVideo = post.imageUrl?.includes('.mp4') || post.imageUrl?.includes('.webm');
    
    return (
        <div className="group relative aspect-square w-full overflow-hidden bg-muted">
            {post.imageUrl ? (
                 <Image src={post.imageUrl} alt={post.content.substring(0, 50)} fill className="object-cover transition-transform group-hover:scale-105" />
            ) : (
                <div className="flex items-center justify-center h-full p-4 text-center text-xs text-muted-foreground">
                    <p>{post.content}</p>
                </div>
            )}
            <div className="absolute top-1 right-1 bg-background/70 p-1 rounded-full">
                {isVideo ? <VideoIcon className="h-3 w-3 text-white" /> : <ImageIcon className="h-3 w-3 text-white" />}
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                {/* Future: Could show likes and comments here on hover */}
            </div>
        </div>
    );
}
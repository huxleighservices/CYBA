'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, LogOut, Save } from 'lucide-react';
import { doc } from 'firebase/firestore';
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
  
  const emojiList = ['😀', '😎', '🔥', '🚀', '💯', 'CYBA', '🎵', '🎙️', '✨', '💻'];

  return (
    <div className="space-y-6">
      <div className="relative mx-auto w-fit">
        <AvatarDisplay avatarConfig={config} size={160} />
      </div>

      <Tabs defaultValue="skin" className="w-full">
        <TabsList className="grid w-full grid-cols-4 gap-1">
          <TabsTrigger value="skin">Skin</TabsTrigger>
          <TabsTrigger value="hat">Hat</TabsTrigger>
          <TabsTrigger value="shirt">Shirt</TabsTrigger>
          <TabsTrigger value="pants">Pants</TabsTrigger>
          <TabsTrigger value="shoes">Shoes</TabsTrigger>
          <TabsTrigger value="accessory">Accessory</TabsTrigger>
          <TabsTrigger value="status" className="col-span-2">Status</TabsTrigger>
        </TabsList>
        
        {(Object.keys(avatarOptions) as AvatarLayer[]).map((category) => (
          <TabsContent key={category} value={category}>
            <Carousel opts={{ align: 'start', loop: true }} className="w-full">
              <CarouselContent>
                {avatarOptions[category].map((option, index) => (
                  <CarouselItem key={option.name} className="basis-1/3 md:basis-1/4">
                    <div className="p-1">
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-24 flex items-center justify-center p-2 flex-col gap-2",
                          config[category] === index && "ring-2 ring-primary"
                        )}
                        onClick={() => handleSelect(category, index)}
                      >
                        <Image src={option.url} alt={option.name} width={60} height={60} className="object-contain" data-ai-hint={option.hint} />
                        <span className="text-xs truncate">{option.name}</span>
                      </Button>
                    </div>
                  </CarouselItem>
                ))}
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
                            {emoji}
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

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            
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
    </div>
  );
}

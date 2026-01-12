'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Avatar as AvatarPrimitive, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Loader2, Shield, ArrowLeft, ArrowRight, Dices } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { avatarOptions, AvatarConfig, defaultAvatarConfig } from '@/lib/avatar-assets';
import Image from 'next/image';


const profileSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
};

// --- Avatar Components ---

function AvatarDisplay({ avatarConfig, size = 128 }: { avatarConfig?: AvatarConfig, size?: number }) {
    const config = { ...defaultAvatarConfig, ...avatarConfig };

    const layers = [
        'skin',
        'shirt',
        'pants',
        'shoes',
        'accessory',
        'hat',
    ];

    return (
        <div className="relative bg-muted/30 rounded-lg" style={{ width: size, height: size }}>
            <Image
                src="/avatar-base.png"
                alt="Avatar Base"
                fill
                className="object-contain"
                priority
            />
            {layers.map((layer) => {
                const category = layer as keyof AvatarConfig;
                const index = config[category] || 0;
                const option = avatarOptions[category][index];
                if (!option || option.url.includes('transparent.png')) return null;
                
                return (
                    <Image
                        key={layer}
                        src={option.url}
                        alt={`${layer} ${index + 1}`}
                        fill
                        className="object-contain"
                        data-ai-hint={option.hint}
                    />
                );
            })}
        </div>
    );
}

function AvatarCustomizer({
    initialConfig,
    onSave,
}: {
    initialConfig?: AvatarConfig;
    onSave: (newConfig: AvatarConfig) => void;
}) {
    const [currentConfig, setCurrentConfig] = useState<AvatarConfig>(initialConfig || defaultAvatarConfig);

    const handleSelect = (category: keyof AvatarConfig, direction: 'next' | 'prev') => {
        const options = avatarOptions[category];
        const currentIndex = currentConfig[category] || 0;
        let nextIndex;

        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % options.length;
        } else {
            nextIndex = (currentIndex - 1 + options.length) % options.length;
        }

        setCurrentConfig(prev => ({ ...prev, [category]: nextIndex }));
    };

    const handleRandomize = () => {
        const randomConfig: AvatarConfig = {
            skin: Math.floor(Math.random() * avatarOptions.skin.length),
            hat: Math.floor(Math.random() * avatarOptions.hat.length),
            shirt: Math.floor(Math.random() * avatarOptions.shirt.length),
            pants: Math.floor(Math.random() * avatarOptions.pants.length),
            shoes: Math.floor(Math.random() * avatarOptions.shoes.length),
            accessory: Math.floor(Math.random() * avatarOptions.accessory.length),
        };
        setCurrentConfig(randomConfig);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col items-center gap-4">
                <h3 className="font-bold text-lg">Avatar Preview</h3>
                <AvatarDisplay avatarConfig={currentConfig} size={256} />
                <Button onClick={handleRandomize} variant="outline" size="sm">
                    <Dices className="mr-2" /> Randomize
                </Button>
            </div>
            <div className="space-y-4">
                {(Object.keys(avatarOptions) as Array<keyof AvatarConfig>).map(category => (
                    <div key={category}>
                        <FormLabel className="capitalize mb-2 block">{category}</FormLabel>
                        <div className="flex items-center justify-between gap-2 p-2 border rounded-md">
                            <Button variant="ghost" size="icon" onClick={() => handleSelect(category, 'prev')}>
                                <ArrowLeft />
                            </Button>
                            <span className="text-sm text-center w-24 truncate">
                                {avatarOptions[category][currentConfig[category] || 0]?.name || 'None'}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => handleSelect(category, 'next')}>
                                <ArrowRight />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            <DialogFooter className="md:col-span-2">
                 <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button onClick={() => onSave(currentConfig)}>Save Avatar</Button>
                </DialogClose>
            </DialogFooter>
        </div>
    );
}


// --- Main Profile Page ---

export default function ProfilePage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (userProfile) {
      form.reset({
        username: userProfile.username || '',
      });
    }
  }, [userProfile, form]);

  const onProfileSubmit = (values: ProfileFormValues) => {
    if (!userDocRef) return;
    
    setDocumentNonBlocking(userDocRef, values, { merge: true });

    toast({
      title: 'Profile Saved',
      description: 'Your username has been updated.',
    });
    setIsEditing(false);
  };
  
  const onAvatarSave = (newConfig: AvatarConfig) => {
    if (!userDocRef) return;
    
    setDocumentNonBlocking(userDocRef, { avatarConfig: newConfig }, { merge: true });
    
    toast({
        title: "Avatar Saved!",
        description: "Your new look has been saved."
    });
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-primary/20 bg-card/50">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onProfileSubmit)}>
            <CardHeader className="items-center text-center">
               <div className="mb-4">
                  <AvatarDisplay avatarConfig={userProfile.avatarConfig} size={96} />
               </div>
              <CardTitle className="text-2xl font-bold tracking-widest">
                {isEditing ? 'Edit Profile' : userProfile.username}
              </CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Your unique name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <div className="text-center">
                  {/* View mode content can go here if needed */}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
                 <div className="flex justify-between w-full">
                    <Button asChild variant="outline" className="mr-auto">
                        <Link href="/admin"><Shield className="mr-2 h-4 w-4"/>Admin</Link>
                    </Button>
                    {isEditing ? (
                        <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => {
                            setIsEditing(false);
                            form.reset({
                                username: userProfile.username,
                            });
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Save Name</Button>
                        </div>
                    ) : (
                        <Button type="button" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                    )}
                 </div>
                 
                 <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="secondary" className="w-full">Customize Avatar</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Customize Your Avatar</DialogTitle>
                            <DialogDescription>
                                Mix and match to create your unique look. Changes are saved automatically.
                            </DialogDescription>
                        </DialogHeader>
                        <AvatarCustomizer initialConfig={userProfile.avatarConfig} onSave={onAvatarSave} />
                    </DialogContent>
                 </Dialog>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

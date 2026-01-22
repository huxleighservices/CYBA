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
import { User as UserIcon, Loader2, Shield, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { avatarOptions, AvatarConfig, defaultAvatarConfig, AvatarLayer, defaultLayerOrder } from '@/lib/avatar-assets';
import { AvatarDisplay } from '@/components/AvatarDisplay';


const profileSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
};

// --- Avatar Components ---

function AvatarCustomizer({
    initialConfig,
    onSave,
}: {
    initialConfig: AvatarConfig;
    onSave: (newConfig: AvatarConfig) => void;
}) {
    const [currentConfig, setCurrentConfig] = useState<AvatarConfig>(initialConfig);
    const [layerOrder, setLayerOrder] = useState<AvatarLayer[]>(initialConfig.layerOrder);

    const handleSelect = (category: AvatarLayer, direction: 'next' | 'prev') => {
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

    const handleMoveLayer = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...layerOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newOrder.length) {
            return;
        }

        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        setLayerOrder(newOrder);
    };
    
    const handleSaveChanges = () => {
        onSave({
            ...currentConfig,
            layerOrder,
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col items-center gap-4">
                <AvatarDisplay avatarConfig={{...currentConfig, layerOrder}} size={256} />
            </div>

            <div className="lg:col-span-1 space-y-4">
                 <FormLabel>Items</FormLabel>
                {(Object.keys(avatarOptions) as AvatarLayer[]).map(category => (
                    <div key={category}>
                        <div className="flex items-center justify-between gap-2 p-2 border rounded-md">
                            <FormLabel className="capitalize w-16">{category}</FormLabel>
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

             <div className="lg:col-span-1 space-y-4">
                <FormLabel>Layer Order</FormLabel>
                <div className="space-y-2 rounded-lg border p-2 bg-background/50">
                    {layerOrder.map((layerKey, index) => (
                        <div key={layerKey} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                            <span className="font-medium capitalize">{layerKey}</span>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMoveLayer(index, 'up')}
                                    disabled={index === 0}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMoveLayer(index, 'down')}
                                    disabled={index === layerOrder.length - 1}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <DialogFooter className="lg:col-span-3">
                 <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button onClick={handleSaveChanges}>Save Avatar</Button>
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

  const initialConfigWithDefaults = useMemo(() => ({
    ...defaultAvatarConfig,
    ...userProfile?.avatarConfig,
    layerOrder: (userProfile?.avatarConfig?.layerOrder && userProfile.avatarConfig.layerOrder.length === defaultLayerOrder.length) 
                ? userProfile.avatarConfig.layerOrder 
                : defaultLayerOrder
  }), [userProfile]);

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
                    <DialogContent className="max-w-6xl">
                        <DialogHeader>
                            <DialogTitle>Customize Your Avatar</DialogTitle>
                            <DialogDescription>
                                Mix and match to create your unique look. Reorder layers to get it just right.
                            </DialogDescription>
                        </DialogHeader>
                        <AvatarCustomizer initialConfig={initialConfigWithDefaults} onSave={onAvatarSave} />
                    </DialogContent>
                 </Dialog>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

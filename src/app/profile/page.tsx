'use client';

import { useEffect, useState } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const profileSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
  photoURL: z.string().url('Please enter a valid URL.').or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<{ username: string; photoURL?: string }>(userDocRef);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
      photoURL: '',
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
        photoURL: userProfile.photoURL || '',
      });
    }
  }, [userProfile, form]);

  const onSubmit = (values: ProfileFormValues) => {
    if (!userDocRef) return;
    
    setDocumentNonBlocking(userDocRef, values, { merge: true });

    toast({
      title: 'Profile Saved',
      description: 'Your profile has been updated.',
    });
    setIsEditing(false);
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
    // This can briefly happen during signup while the user document is being created.
    // A loading state or a specific message for this case might be better.
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
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={form.watch('photoURL') || userProfile.photoURL} alt={userProfile.username} />
                <AvatarFallback>
                  <UserIcon className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
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
                  <FormField
                    control={form.control}
                    name="photoURL"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Picture URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/image.png" {...field} />
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
            <CardFooter className="flex justify-end gap-2">
              <Button asChild variant="outline" className="mr-auto">
                 <Link href="/admin"><Shield className="mr-2 h-4 w-4"/>Admin</Link>
              </Button>
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      form.reset({
                        username: userProfile.username,
                        photoURL: userProfile.photoURL || '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </>
              ) : (
                <Button type="button" onClick={() => setIsEditing(true)}>Edit Profile</Button>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

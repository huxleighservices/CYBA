'use client';

import { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import type { AvatarConfig } from '@/lib/avatar-assets';

// --- Types & Schemas ---
type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
};

const postSchema = z.object({
  content: z.string().min(1, 'Post cannot be empty.').max(500, 'Post is too long.'),
  image: z.custom<FileList>().optional(),
});
type PostFormValues = z.infer<typeof postSchema>;


// --- Create Post Form Component ---
function CreatePostForm({ user, userProfile }: { user: any; userProfile: UserProfile }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { content: '', image: undefined },
  });

  const onSubmit = async (values: PostFormValues) => {
    if (!user || !userProfile) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
        const imageFile = values.image?.[0];
        let uploadedUrl: string | null = null;

        if (imageFile) {
            setUploadProgress(10);
            const reader = new FileReader();
            
            const readAsDataURL = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });

            const fileDataUri = await readAsDataURL;
            setUploadProgress(30);

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                fileDataUri: fileDataUri,
                fileName: imageFile.name,
                fileType: imageFile.type,
                }),
            });
            
            setUploadProgress(70);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: 'Server returned non-JSON error.' }));
                throw new Error(errorData.details || 'Server failed to upload file.');
            }

            const { imageUrl } = await response.json();
            uploadedUrl = imageUrl;
            setUploadProgress(90);
        }

        await addDoc(collection(firestore, 'cybazone_posts'), {
            authorId: user.uid,
            authorUsername: userProfile.username,
            authorAvatar: userProfile.avatarConfig || {},
            content: values.content,
            imageUrl: uploadedUrl,
            timestamp: serverTimestamp(),
            likeCount: 0,
            likedBy: [],
        });
        
        setUploadProgress(100);
        toast({ title: 'Posted!', description: 'Your post is now live.' });
        router.push('/cybazone');

    } catch (error) {
      console.error('Error creating post:', error);
      toast({ variant: 'destructive', title: 'Post Error', description: error instanceof Error ? error.message : 'Could not create post. Please try again.' });
    } finally {
        setIsUploading(false);
        setUploadProgress(null);
    }
  };

  return (
    <Card className="w-full max-w-lg border-primary/20 bg-card/50">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-widest">Create Post</CardTitle>
        <CardDescription>Share something with the CYBAZONE community.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={`What's on your mind?`}
                      className="min-h-[120px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
                control={form.control}
                name="image"
                render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                    <FormLabel>Image or Video (Optional)</FormLabel>
                    <FormControl>
                        <Input 
                        type="file" 
                        accept="image/*,video/*"
                        onChange={(e) => onChange(e.target.files)}
                        className="text-sm" 
                        disabled={isUploading}
                        {...rest}
                        />
                    </FormControl>
                    <FormDescription>Max file size: 25MB</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />

            {isUploading && uploadProgress !== null && (
                <Progress value={uploadProgress} className="w-full h-2" />
            )}

            <Button type="submit" disabled={isUploading} className="w-full">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isUploading ? 'Posting...' : 'Create Post'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


// --- Main Page Component ---
export default function CreatePage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        if (!isUserLoading && !user) {
          router.push('/login?redirect=/create');
        }
    }, [isUserLoading, user, router]);

    if (isUserLoading || isProfileLoading || !user || !userProfile) {
        return (
          <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        );
    }
    
    return (
        <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16">
            <CreatePostForm user={user} userProfile={userProfile} />
        </div>
    )
}

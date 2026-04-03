'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { Loader2, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { computeLevel } from '@/lib/levels';

type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string;
  postCount?: number;
  supportGiven?: number;
};

const postSchema = z.object({
  content: z.string().min(1, 'Post cannot be empty.').max(500, 'Post is too long.'),
});
type PostFormValues = z.infer<typeof postSchema>;

// ─────────────────────────────────────────────
//  Image Crop Editor
// ─────────────────────────────────────────────
function ImageCropEditor({
  src,
  onCrop,
  onCancel,
}: {
  src: string;
  onCrop: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [natSize, setNatSize] = useState({ w: 1, h: 1 });
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 0 });

  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, bx: 0, by: 0 });
  const resizing = useRef(false);
  const resizeOrigin = useRef({ mx: 0, my: 0, initSize: 0 });

  // Measure container once mounted
  useEffect(() => {
    if (containerRef.current) {
      setDisplayW(containerRef.current.clientWidth);
    }
  }, []);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNatSize({ w: nw, h: nh });
    const w = containerRef.current?.clientWidth || displayW || 360;
    const h = w * (nh / nw);
    setImgH(h);
    const size = Math.min(w, h);
    setCropBox({ x: (w - size) / 2, y: (h - size) / 2, size });
  };

  // Drag the crop box
  const onBoxDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, bx: cropBox.x, by: cropBox.y };
  };
  const onBoxMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    setCropBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(displayW - prev.size, dragOrigin.current.bx + dx)),
      y: Math.max(0, Math.min(imgH - prev.size, dragOrigin.current.by + dy)),
    }));
  };
  const onBoxUp = () => { dragging.current = false; };

  // Resize via bottom-right corner
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizing.current = true;
    resizeOrigin.current = { mx: e.clientX, my: e.clientY, initSize: cropBox.size };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizing.current) return;
    const d = e.clientX - resizeOrigin.current.mx;
    const newSize = Math.max(60, Math.min(
      displayW - cropBox.x,
      imgH - cropBox.y,
      resizeOrigin.current.initSize + d
    ));
    setCropBox(prev => ({ ...prev, size: newSize }));
  };
  const onResizeUp = () => { resizing.current = false; };

  const applyCrop = () => {
    const img = new window.Image();
    img.onload = () => {
      const scale = img.naturalWidth / displayW;
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        img,
        cropBox.x * scale,
        cropBox.y * scale,
        cropBox.size * scale,
        cropBox.size * scale,
        0, 0, 1080, 1080
      );
      onCrop(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = src;
  };

  const gridSize = cropBox.size / 3;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-primary/30 rounded-2xl overflow-hidden shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-bold text-base">Crop Image</h3>
          <span className="text-xs text-muted-foreground">Drag to move · corner to resize</span>
        </div>

        {/* Crop area */}
        <div className="p-4">
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg bg-black w-full"
            style={{ height: imgH || 240 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Crop preview"
              onLoad={onImgLoad}
              style={{ width: displayW || '100%', height: imgH || 'auto', display: 'block' }}
              draggable={false}
            />

            {imgH > 0 && cropBox.size > 0 && (
              <>
                {/* Dark overlay — 4 panels */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute bg-black/65" style={{ left: 0, top: 0, right: 0, height: cropBox.y }} />
                  <div className="absolute bg-black/65" style={{ left: 0, top: cropBox.y + cropBox.size, right: 0, bottom: 0 }} />
                  <div className="absolute bg-black/65" style={{ left: 0, top: cropBox.y, width: cropBox.x, height: cropBox.size }} />
                  <div className="absolute bg-black/65" style={{ left: cropBox.x + cropBox.size, top: cropBox.y, right: 0, height: cropBox.size }} />
                </div>

                {/* Crop box */}
                <div
                  className="absolute border-2 border-white cursor-move select-none"
                  style={{
                    left: cropBox.x, top: cropBox.y,
                    width: cropBox.size, height: cropBox.size,
                    touchAction: 'none',
                  }}
                  onPointerDown={onBoxDown}
                  onPointerMove={onBoxMove}
                  onPointerUp={onBoxUp}
                >
                  {/* Rule of thirds grid */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
                      backgroundSize: `${gridSize}px ${gridSize}px`,
                    }}
                  />
                  {/* Corner handles (visual only) */}
                  <div className="absolute top-0 left-0 w-3 h-3 bg-white pointer-events-none" />
                  <div className="absolute top-0 right-0 w-3 h-3 bg-white pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 bg-white pointer-events-none" />
                  {/* Resize handle — bottom right */}
                  <div
                    className="absolute bottom-0 right-0 w-5 h-5 bg-white cursor-se-resize"
                    style={{ touchAction: 'none' }}
                    onPointerDown={onResizeDown}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeUp}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={applyCrop} disabled={imgH === 0} className="flex-1">Apply Crop</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Create Post Form
// ─────────────────────────────────────────────
function CreatePostForm({ user, userProfile }: { user: any; userProfile: UserProfile }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [rawImgSrc, setRawImgSrc] = useState<string | null>(null);      // shows crop editor
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null); // cropped result
  const [videoFile, setVideoFile] = useState<File | null>(null);         // videos skip crop

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { content: '' },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      setVideoFile(file);
      setCroppedDataUrl(null);
      return;
    }

    // Image — open crop editor
    const reader = new FileReader();
    reader.onloadend = () => setRawImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    setVideoFile(null);
  };

  const clearMedia = () => {
    setCroppedDataUrl(null);
    setVideoFile(null);
    setRawImgSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (values: PostFormValues) => {
    if (!user || !userProfile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let uploadedUrl: string | null = null;

      if (croppedDataUrl || videoFile) {
        setUploadProgress(10);

        let fileDataUri: string;
        let fileName: string;
        let fileType: string;

        if (croppedDataUrl) {
          fileDataUri = croppedDataUrl;
          fileName = 'post-image.jpg';
          fileType = 'image/jpeg';
        } else {
          const reader = new FileReader();
          fileDataUri = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(videoFile!);
          });
          fileName = videoFile!.name;
          fileType = videoFile!.type;
        }

        setUploadProgress(30);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileDataUri, fileName, fileType }),
        });

        setUploadProgress(70);

        if (!response.ok) {
          const err = await response.json().catch(() => ({ details: 'Upload failed.' }));
          throw new Error(err.details || 'Upload failed.');
        }

        const { imageUrl } = await response.json();
        uploadedUrl = imageUrl;
        setUploadProgress(90);
      }

      const extractedHashtags = Array.from(
        new Set(values.content.match(/#[\w]+/g)?.map(t => t.toLowerCase()) || [])
      );
      const authorLevel = computeLevel(userProfile.postCount, userProfile.supportGiven);

      await addDoc(collection(firestore, 'cybazone_posts'), {
        authorId: user.uid,
        authorUsername: userProfile.username,
        authorAvatar: userProfile.avatarConfig || {},
        authorProfilePictureUrl: userProfile.profilePictureUrl || null,
        authorLevel,
        content: values.content,
        imageUrl: uploadedUrl,
        timestamp: serverTimestamp(),
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        repostCount: 0,
        repostedBy: [],
        hashtags: extractedHashtags,
      });

      updateDoc(doc(firestore, 'users', user.uid), { postCount: increment(1) }).catch(() => {});

      setUploadProgress(100);
      toast({ title: 'Posted!', description: 'Your post is now live.' });
      router.push('/');
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        variant: 'destructive',
        title: 'Post Error',
        description: error instanceof Error ? error.message : 'Could not create post.',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const hasMedia = !!(croppedDataUrl || videoFile);

  return (
    <>
      {/* Crop editor overlay */}
      {rawImgSrc && (
        <ImageCropEditor
          src={rawImgSrc}
          onCrop={(dataUrl) => {
            setCroppedDataUrl(dataUrl);
            setRawImgSrc(null);
          }}
          onCancel={() => {
            setRawImgSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}

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
                        placeholder="What's on your mind?"
                        className="min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Media picker */}
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />

                {!hasMedia ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors py-8 text-muted-foreground"
                  >
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-sm font-medium">Add photo or video</span>
                    <span className="text-xs opacity-60">Images will be cropped to 1:1 square</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-square">
                    {croppedDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={croppedDataUrl} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    {videoFile && (
                      <video src={URL.createObjectURL(videoFile)} className="w-full h-full object-cover" muted />
                    )}
                    {/* Remove / change buttons */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="rounded-full bg-black/70 hover:bg-black/90 text-white text-xs px-3 py-1 font-medium transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={clearMedia}
                        disabled={isUploading}
                        className="rounded-full bg-black/70 hover:bg-black/90 text-white p-1 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isUploading && uploadProgress !== null && (
                <Progress value={uploadProgress} className="w-full h-2" />
              )}

              <Button type="submit" disabled={isUploading} className="w-full">
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? 'Posting...' : 'Create Post'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────
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
  );
}

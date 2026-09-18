'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, ImagePlus, X, Video, Clock, Scissors, ImageIcon, Camera } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { computeLevel } from '@/lib/levels';
import { getCCForPost, mergeWithDefaults, type CCRates } from '@/lib/cc-rewards';
import { logTransaction } from '@/lib/transactions';
import { MentionTextarea, extractMentions } from '@/components/MentionTextarea';
import { createNotification } from '@/lib/notifications';
import { createAutoShoutout } from '@/lib/shoutouts';
import { getDocs as _getDocs, query as _query, collection as _collection, where as _where, limit as _limit } from 'firebase/firestore';
import { getVideoDuration } from '@/lib/promo-blast-checkout';
import { createPulse } from '@/lib/pulses';
import { PulseComposeDialog, PulseCameraCapture } from '@/components/cybazone/PulsesRow';
import { applyGearMultiplier } from '@/lib/avatar-gear';

type UserProfile = {
  username: string;
  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string;
  postCount?: number;
  levelOverride?: string;
  equippedGear?: string[];
  supportGiven?: number;
  payoutEnrolled?: boolean;
  spotlightBoost?: boolean;
  isCurator?: boolean;
  followers?: string[];
};

// Scale limit: fans out to at most this many followers per post so a very popular account
// posting doesn't trigger an unbounded burst of notification writes (+ fire-and-forget emails).
const NEW_POST_NOTIFY_CAP = 200;

async function notifyFollowersOfNewPost(
  firestore: any,
  authorId: string,
  authorUsername: string,
  authorProfilePictureUrl: string | null | undefined,
  postId: string,
  followers: string[] | undefined,
) {
  const recipients = (followers ?? []).slice(0, NEW_POST_NOTIFY_CAP);
  await Promise.all(recipients.map(followerId =>
    createNotification(firestore, followerId, {
      type: 'new_post',
      actorId: authorId,
      actorUsername: authorUsername,
      actorProfilePictureUrl: authorProfilePictureUrl ?? null,
      postId,
      linkTo: `/?post=${postId}`,
    })
  ));
}

const postSchema = z.object({
  content: z.string().min(1, 'Post cannot be empty.').max(500, 'Post is too long.'),
});

/** Grabs a single frame from a video file at the given timestamp as a JPEG data URL — used
 *  for both the auto-captured default thumbnail and the "capture at current time" picker. */
function captureVideoFrame(videoUrl: string, atSeconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.05));
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    video.onerror = () => reject(new Error('Could not read video'));
  });
}
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
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const ccRatesRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'ccRates'),
    [firestore]
  );
  const { data: ccRatesRaw } = useDoc<Partial<CCRates>>(ccRatesRef);
  const ccRates = ccRatesRaw ? mergeWithDefaults(ccRatesRaw) : null;

  // Whether this user has set a Subnet rate yet — the "Subnet Only" toggle is only usable once they have.
  const mySubnetRef = useMemoFirebase(() => doc(firestore, 'subnets', user.uid), [firestore, user.uid]);
  const { data: mySubnet } = useDoc<{ weeklyRate?: number }>(mySubnetRef);
  const hasSubnet = !!mySubnet?.weeklyRate;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewUrl = useRef<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [rawImgSrc, setRawImgSrc] = useState<string | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [subnetOnly, setSubnetOnly] = useState(false);

  // Video trim (playback-only, never re-encoded) + custom thumbnail. Defaults to full-duration
  // + an auto-captured first frame so this never blocks posting if the member skips it.
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [showTrimEditor, setShowTrimEditor] = useState(false);
  const trimVideoRef = useRef<HTMLVideoElement>(null);

  // Multi-media mode — mutually exclusive with the single-media picker above. Kept simple
  // (no crop/trim editor per item) so the delicate single-media upload path stays untouched.
  const [multiMode, setMultiMode] = useState(false);
  const [multiItems, setMultiItems] = useState<{ file: File; previewUrl: string; type: 'image' | 'video' }[]>([]);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const MAX_MULTI_ITEMS = 6;

  // Publish mode — Post (default, full form below) / Zap (same form, video required) /
  // Pulse (a completely separate, minimal upload flow — see the early-return branch below).
  const [publishMode, setPublishMode] = useState<'post' | 'pulse' | 'zap'>('post');
  const [pulseUploading, setPulseUploading] = useState(false);
  const [pendingPulseFile, setPendingPulseFile] = useState<File | null>(null);
  const [showPulseCamera, setShowPulseCamera] = useState(false);
  const pulseCameraInputRef = useRef<HTMLInputElement>(null);
  const pulseLibraryInputRef = useRef<HTMLInputElement>(null);

  const handlePulseTakePhotoOrVideo = () => {
    // Fall back to the OS picker's capture hint on browsers without getUserMedia.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      pulseCameraInputRef.current?.click();
      return;
    }
    setShowPulseCamera(true);
  };

  const handlePulseFile = async (caption: string) => {
    if (!user || !userProfile || !pendingPulseFile) return;
    setPulseUploading(true);
    try {
      const level = computeLevel(userProfile.postCount, userProfile.supportGiven, undefined, userProfile.levelOverride);
      const { cc } = await createPulse(firestore, storage, {
        userId: user.uid,
        username: userProfile.username,
        profilePictureUrl: userProfile.profilePictureUrl,
        avatarConfig: userProfile.avatarConfig,
        file: pendingPulseFile,
        caption,
        level,
        ccRates,
      });
      toast({ title: '✨ Pulse posted!', description: `Visible to your followers for 24 hours. +${cc.toLocaleString()} CC` });
      router.push('/');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to post Pulse', description: err?.message });
    } finally {
      setPulseUploading(false);
      setPendingPulseFile(null);
      if (pulseCameraInputRef.current) pulseCameraInputRef.current.value = '';
      if (pulseLibraryInputRef.current) pulseLibraryInputRef.current.value = '';
    }
  };

  const handleMultiFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const room = MAX_MULTI_ITEMS - multiItems.length;
    const accepted = files.slice(0, room).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const items = accepted.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      type: (f.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
    }));
    setMultiItems(prev => [...prev, ...items]);
    if (multiFileInputRef.current) multiFileInputRef.current.value = '';
  };

  const removeMultiItem = (i: number) => {
    setMultiItems(prev => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { content: '' },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      // Revoke previous object URL to avoid memory leak
      if (videoPreviewUrl.current) URL.revokeObjectURL(videoPreviewUrl.current);
      const url = URL.createObjectURL(file);
      videoPreviewUrl.current = url;
      setVideoFile(file);
      setVideoPreview(url);
      setCroppedDataUrl(null);
      setRawImgSrc(null);
      setShowTrimEditor(false);

      // Default to full-duration trim + an auto-captured first frame, so posting is never
      // blocked on the member actually opening the trim/thumbnail editor.
      try {
        const duration = await getVideoDuration(file);
        setVideoDurationSeconds(duration);
        setTrimStart(0);
        setTrimEnd(duration);
        const frame = await captureVideoFrame(url, Math.min(0.1, duration));
        setThumbnailDataUrl(frame);
      } catch {
        setVideoDurationSeconds(null);
        setThumbnailDataUrl(null);
      }
      return;
    }

    // Image — open crop editor
    const reader = new FileReader();
    reader.onloadend = () => setRawImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    setVideoFile(null);
    setVideoPreview(null);
  };

  const clearMedia = () => {
    setCroppedDataUrl(null);
    if (videoPreviewUrl.current) { URL.revokeObjectURL(videoPreviewUrl.current); videoPreviewUrl.current = null; }
    setVideoDurationSeconds(null);
    setTrimStart(0);
    setTrimEnd(0);
    setThumbnailDataUrl(null);
    setShowTrimEditor(false);
    setVideoFile(null);
    setVideoPreview(null);
    setRawImgSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Upload a video directly to Firebase Storage with progress reporting */
  const uploadVideoToStorage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop() ?? 'mp4';
      const path = `cybazone_uploads/${uuidv4()}.${ext}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

      task.on(
        'state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 85);
          setUploadProgress(pct);
          const mb = (snap.bytesTransferred / 1024 / 1024).toFixed(1);
          const total = (snap.totalBytes / 1024 / 1024).toFixed(1);
          setUploadLabel(`Uploading video… ${mb} / ${total} MB`);
        },
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        },
      );
    });
  };

  /** Reads an image file to a data URL and uploads it via the /api/upload route (same path the
   *  single-media flow uses for its cropped image, minus the crop step). */
  const uploadImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileDataUri: reader.result, fileName: file.name, fileType: file.type }),
          });
          if (!res.ok) { reject(new Error('Upload failed.')); return; }
          const { imageUrl } = await res.json();
          resolve(imageUrl);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (values: PostFormValues) => {
    if (!user || !userProfile) return;

    if (publishMode === 'zap') {
      const allVideo = multiMode
        ? multiItems.length > 0 && multiItems.every(i => i.type === 'video')
        : !!videoFile;
      if (!allVideo) {
        toast({ variant: 'destructive', title: 'Zaps require a video', description: 'Select a video file to publish a Zap.' });
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (multiMode && multiItems.length > 0) {
        const mediaItems: { url: string; type: 'image' | 'video' }[] = [];
        for (let i = 0; i < multiItems.length; i++) {
          const item = multiItems[i];
          setUploadLabel(`Uploading ${i + 1} of ${multiItems.length}…`);
          setUploadProgress(Math.round((i / multiItems.length) * 90));
          const url = item.type === 'video' ? await uploadVideoToStorage(item.file) : await uploadImageFile(item.file);
          mediaItems.push({ url, type: item.type });
        }
        setUploadProgress(95);
        setUploadLabel('Saving post…');

        const extractedHashtags = Array.from(
          new Set(values.content.match(/#[\w]+/g)?.map(t => t.toLowerCase()) || [])
        );
        const authorLevel = computeLevel(userProfile.postCount, userProfile.supportGiven, undefined, userProfile.levelOverride);
        const newPostRef = await addDoc(collection(firestore, 'cybazone_posts'), {
          authorId: user.uid,
          authorUsername: userProfile.username,
          authorAvatar: userProfile.avatarConfig || {},
          authorProfilePictureUrl: userProfile.profilePictureUrl || null,
          authorLevel,
          authorPayoutEnrolled: userProfile.payoutEnrolled ?? false,
          authorSpotlightBoost: userProfile.spotlightBoost ?? false,
          authorIsCurator: userProfile.isCurator ?? false,
          content: values.content,
          imageUrl: mediaItems[0].url,
          mediaType: mediaItems[0].type,
          mediaItems,
          timestamp: serverTimestamp(),
          likeCount: 0,
          likedBy: [],
          commentCount: 0,
          repostCount: 0,
          repostedBy: [],
          hashtags: extractedHashtags,
          viewCount: 0,
          subnetOnly: hasSubnet && subnetOnly,
        });

        const cc = applyGearMultiplier(getCCForPost(mediaItems[0].type, authorLevel, ccRates), userProfile.equippedGear, 'post');
        const isFirstPost = (userProfile.postCount ?? 0) === 0;
        updateDoc(doc(firestore, 'users', user.uid), {
          postCount: increment(1),
          weeklyPostCount: increment(1),
          cybaCoinBalance: increment(cc),
        }).catch(() => {});
        if (isFirstPost) {
          createAutoShoutout(firestore, 'firstPost', { username: userProfile.username }).catch(() => {});
        }
        logTransaction(firestore, user.uid, {
          type: 'post_reward',
          amount: cc,
          description: `📸 ${mediaItems.length}-media post`,
        });

        const mentions = extractMentions(values.content);
        if (mentions.length) {
          const mentionSnap = await _getDocs(_query(
            _collection(firestore, 'users'),
            _where('username_lowercase', 'in', mentions.slice(0, 10)),
          ));
          mentionSnap.docs.forEach(d => {
            createNotification(firestore, d.id, {
              type: 'mention',
              actorId: user.uid,
              actorUsername: userProfile.username,
              actorProfilePictureUrl: userProfile.profilePictureUrl ?? null,
              postSnippet: values.content.slice(0, 80),
            });
          });
        }

        notifyFollowersOfNewPost(firestore, user.uid, userProfile.username, userProfile.profilePictureUrl, newPostRef.id, userProfile.followers).catch(() => {});

        setUploadProgress(100);
        toast({ title: 'Posted!', description: 'Your post is now live.' });
        multiItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
        setMultiItems([]);
        setMultiMode(false);
        form.reset({ content: '' });
        router.push('/');
        return;
      }

      let uploadedUrl: string | null = null;
      let mediaType: 'image' | 'video' | null = null;

      let thumbnailUrl: string | null = null;

      if (videoFile) {
        // ── Video: direct Firebase Storage upload ──
        setUploadLabel('Preparing video…');
        uploadedUrl = await uploadVideoToStorage(videoFile);
        mediaType = 'video';
        setUploadProgress(85);

        if (thumbnailDataUrl) {
          setUploadLabel('Uploading thumbnail…');
          const thumbRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileDataUri: thumbnailDataUrl,
              fileName: 'post-thumbnail.jpg',
              fileType: 'image/jpeg',
            }),
          });
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            thumbnailUrl = thumbData.imageUrl ?? null;
          }
        }
        setUploadProgress(90);
        setUploadLabel('Saving post…');
      } else if (croppedDataUrl) {
        // ── Image: API route (base64 is fine for images) ──
        setUploadLabel('Uploading image…');
        setUploadProgress(20);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileDataUri: croppedDataUrl,
            fileName: 'post-image.jpg',
            fileType: 'image/jpeg',
          }),
        });
        setUploadProgress(80);

        if (!response.ok) {
          const err = await response.json().catch(() => ({ details: 'Upload failed.' }));
          throw new Error(err.details || 'Upload failed.');
        }
        const { imageUrl } = await response.json();
        uploadedUrl = imageUrl;
        mediaType = 'image';
        setUploadProgress(90);
        setUploadLabel('Saving post…');
      }

      const extractedHashtags = Array.from(
        new Set(values.content.match(/#[\w]+/g)?.map(t => t.toLowerCase()) || [])
      );
      const authorLevel = computeLevel(userProfile.postCount, userProfile.supportGiven, undefined, userProfile.levelOverride);

      const isScheduled = scheduleEnabled && scheduledAt;
      const postData: Record<string, any> = {
        authorId: user.uid,
        authorUsername: userProfile.username,
        authorAvatar: userProfile.avatarConfig || {},
        authorProfilePictureUrl: userProfile.profilePictureUrl || null,
        authorLevel,
        authorPayoutEnrolled: userProfile.payoutEnrolled ?? false,
        authorSpotlightBoost: userProfile.spotlightBoost ?? false,
        authorIsCurator: userProfile.isCurator ?? false,
        content: values.content,
        imageUrl: uploadedUrl,
        mediaType: mediaType ?? null,
        timestamp: serverTimestamp(),
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        repostCount: 0,
        repostedBy: [],
        hashtags: extractedHashtags,
        viewCount: 0,
        subnetOnly: hasSubnet && subnetOnly,
        ...(mediaType === 'video' && videoDurationSeconds ? {
          videoDurationSeconds,
          trimStart,
          trimEnd: trimEnd || videoDurationSeconds,
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
        } : {}),
      };
      if (isScheduled) {
        const scheduledDate = new Date(scheduledAt);
        postData.published = false;
        postData.scheduledAt = Timestamp.fromDate(scheduledDate);
        // Overwrite timestamp so the post sorts correctly in the feed when it goes live
        postData.timestamp = Timestamp.fromDate(scheduledDate);
      }
      const newPostRef = await addDoc(collection(firestore, 'cybazone_posts'), postData);

      const postType: 'text' | 'image' | 'video' = mediaType ?? 'text';
      if (!isScheduled) {
        notifyFollowersOfNewPost(firestore, user.uid, userProfile.username, userProfile.profilePictureUrl, newPostRef.id, userProfile.followers).catch(() => {});
        const cc = applyGearMultiplier(getCCForPost(postType, authorLevel, ccRates), userProfile.equippedGear, 'post');
        const isFirstPost = (userProfile.postCount ?? 0) === 0;
        updateDoc(doc(firestore, 'users', user.uid), {
          postCount: increment(1),
          weeklyPostCount: increment(1),
          cybaCoinBalance: increment(cc),
        }).catch(() => {});
        if (isFirstPost) {
          createAutoShoutout(firestore, 'firstPost', { username: userProfile.username }).catch(() => {});
        }
        logTransaction(firestore, user.uid, {
          type: 'post_reward',
          amount: cc,
          description: `${postType === 'video' ? '🎬' : postType === 'image' ? '📸' : '📝'} ${postType.charAt(0).toUpperCase() + postType.slice(1)} post`,
        });
      }

      // Fire mention notifications
      const mentions = extractMentions(values.content);
      if (mentions.length) {
        const mentionSnap = await _getDocs(_query(
          _collection(firestore, 'users'),
          _where('username_lowercase', 'in', mentions.slice(0, 10)),
        ));
        mentionSnap.docs.forEach(d => {
          createNotification(firestore, d.id, {
            type: 'mention',
            actorId: user.uid,
            actorUsername: userProfile.username,
            actorProfilePictureUrl: userProfile.profilePictureUrl ?? null,
            postSnippet: values.content.slice(0, 80),
          });
        });
      }

      setUploadProgress(100);
      if (isScheduled) {
        toast({ title: '⏰ Scheduled!', description: `Post will go live at ${new Date(scheduledAt).toLocaleString()}.` });
      } else {
        toast({ title: 'Posted!', description: 'Your post is now live.' });
      }
      clearMedia();
      setScheduleEnabled(false);
      setScheduledAt('');
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
      setUploadLabel('');
    }
  };

  const hasMedia = !!(croppedDataUrl || videoPreview);

  const ModeSelector = (
    <div className="inline-flex rounded-xl border border-border/60 bg-card/60 p-1 gap-1 mb-4">
      {(['post', 'pulse', 'zap'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setPublishMode(m)}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all capitalize ${
            publishMode === m
              ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(138,43,226,0.4)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {m === 'post' ? 'Post' : m === 'pulse' ? '✨ Pulse' : '⚡ Zap'}
        </button>
      ))}
    </div>
  );

  // Pulse mode is a completely separate, minimal flow — publishes immediately on file select,
  // no caption/schedule/crop editor, reusing the same shared helper as the Pulses row's own-circle upload.
  if (publishMode === 'pulse') {
    return (
      <>
        {ModeSelector}
        <Card className="w-full max-w-lg border-primary/20 bg-card/50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-widest">✨ Post a Pulse</CardTitle>
            <CardDescription>Visible to your followers for 24 hours. Earns CYBACOIN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              ref={pulseCameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setPendingPulseFile(f); }}
            />
            <input
              ref={pulseLibraryInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setPendingPulseFile(f); }}
            />
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={pulseUploading}
              onClick={handlePulseTakePhotoOrVideo}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo or Video
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              disabled={pulseUploading}
              onClick={() => pulseLibraryInputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Choose from Library
            </Button>
          </CardContent>
        </Card>

        {showPulseCamera && (
          <PulseCameraCapture
            onCancel={() => setShowPulseCamera(false)}
            onCapture={(file) => { setShowPulseCamera(false); setPendingPulseFile(file); }}
          />
        )}

        {pendingPulseFile && (
          <PulseComposeDialog
            file={pendingPulseFile}
            uploading={pulseUploading}
            onCancel={() => {
              setPendingPulseFile(null);
              if (pulseCameraInputRef.current) pulseCameraInputRef.current.value = '';
              if (pulseLibraryInputRef.current) pulseLibraryInputRef.current.value = '';
            }}
            onPost={handlePulseFile}
          />
        )}
      </>
    );
  }

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

      {ModeSelector}

      <Card className="w-full max-w-lg border-primary/20 bg-card/50">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-widest">
            {publishMode === 'zap' ? '⚡ Create Zap' : 'Create Post'}
          </CardTitle>
          <CardDescription>
            {publishMode === 'zap' ? 'Short-form video for the Zaps feed.' : 'Share something with the Zone.'}
          </CardDescription>
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
                      <MentionTextarea
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="What's on your mind? Use @ to mention someone."
                        disabled={isUploading}
                        minHeight={120}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Multi-media picker — mutually exclusive with the single-media picker below */}
              {multiMode ? (
                <div className="space-y-3">
                  <input
                    ref={multiFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleMultiFilesChange}
                    disabled={isUploading}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {multiItems.map((item, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-black">
                        {item.type === 'video' ? (
                          <video src={item.previewUrl} className="w-full h-full object-cover" muted />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                        )}
                        {!isUploading && (
                          <button type="button" onClick={() => removeMultiItem(i)}
                            className="absolute top-1 right-1 rounded-full bg-black/70 hover:bg-black/90 text-white p-1 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {multiItems.length < MAX_MULTI_ITEMS && !isUploading && (
                      <button
                        type="button"
                        onClick={() => multiFileInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground"
                      >
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[10px]">Add</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{multiItems.length}/{MAX_MULTI_ITEMS} added</span>
                    <button
                      type="button"
                      onClick={() => { multiItems.forEach(item => URL.revokeObjectURL(item.previewUrl)); setMultiItems([]); setMultiMode(false); }}
                      disabled={isUploading}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Switch to single photo/video
                    </button>
                  </div>
                </div>
              ) : (
              /* Media picker */
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
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors py-8 text-muted-foreground"
                    >
                      <div className="flex gap-3">
                        <ImagePlus className="w-7 h-7" />
                        <Video className="w-7 h-7" />
                      </div>
                      <span className="text-sm font-medium">Add photo or video</span>
                      <span className="text-xs opacity-60">Images cropped to 1:1 · Videos uploaded directly</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMultiMode(true)}
                      disabled={isUploading}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Or add multiple photos/videos (up to {MAX_MULTI_ITEMS})
                    </button>
                  </div>
                ) : (
                  <div className={`relative rounded-xl overflow-hidden border border-border bg-black ${videoFile ? 'aspect-video' : 'aspect-square'}`}>
                    {croppedDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={croppedDataUrl} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    {videoFile && videoPreview && (
                      <video
                        ref={trimVideoRef}
                        src={videoPreview}
                        className="w-full h-full object-contain"
                        controls
                        preload="metadata"
                      />
                    )}
                    {/* Remove / change buttons — hidden while uploading */}
                    {!isUploading && (
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        {videoFile && videoDurationSeconds != null && (
                          <button
                            type="button"
                            onClick={() => setShowTrimEditor(v => !v)}
                            className="rounded-full bg-black/70 hover:bg-black/90 text-white text-xs px-3 py-1 font-medium transition-colors flex items-center gap-1"
                          >
                            <Scissors className="w-3 h-3" /> Trim &amp; Thumbnail
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-full bg-black/70 hover:bg-black/90 text-white text-xs px-3 py-1 font-medium transition-colors"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={clearMedia}
                          className="rounded-full bg-black/70 hover:bg-black/90 text-white p-1 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {/* Upload overlay */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 px-6">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                        <p className="text-white text-sm font-medium text-center">{uploadLabel}</p>
                        {uploadProgress !== null && (
                          <div className="w-full bg-white/20 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {videoFile && showTrimEditor && videoDurationSeconds != null && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Start: {trimStart.toFixed(1)}s</span>
                        <span>End: {trimEnd.toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min={0} max={videoDurationSeconds} step={0.1}
                          value={trimStart}
                          onChange={e => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 0.1))}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">to</span>
                        <input
                          type="range" min={0} max={videoDurationSeconds} step={0.1}
                          value={trimEnd}
                          onChange={e => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart + 0.1))}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Only this range plays in the feed. The uploaded file itself isn&apos;t cut — playback just stays inside these bounds.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {thumbnailDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnailDataUrl} alt="Thumbnail" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const t = trimVideoRef.current?.currentTime ?? 0;
                          const url = videoPreview;
                          if (!url) return;
                          try {
                            const frame = await captureVideoFrame(url, t);
                            setThumbnailDataUrl(frame);
                          } catch {}
                        }}
                      >
                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Use Current Frame as Thumbnail
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Play/scrub the video above to the frame you want, then tap the button.
                    </p>
                  </div>
                )}
              </div>
              )}

              {isUploading && !hasMedia && uploadProgress !== null && (
                <Progress value={uploadProgress} className="w-full h-2" />
              )}

              {/* Schedule toggle — single-media posts only; multi-media always posts immediately */}
              {!multiMode && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Schedule Post</p>
                        <p className="text-xs text-muted-foreground">Go live at a specific time</p>
                      </div>
                    </div>
                    <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} disabled={isUploading} />
                  </div>
                  {scheduleEnabled && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      min={(() => {
                        const d = new Date(Date.now() + 60000);
                        const p = (n: number) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
                      })()}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={isUploading}
                    />
                  )}
                </div>
              )}

              {/* Subnet-only toggle — requires the member to have set a Subnet rate first */}
              <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <div>
                    <p className="text-sm font-medium">Subnet Only</p>
                    <p className="text-xs text-muted-foreground">
                      {hasSubnet ? 'Visible only to your Subnet members' : 'Set a Subnet rate on your profile first'}
                    </p>
                  </div>
                </div>
                <Switch checked={subnetOnly} onCheckedChange={setSubnetOnly} disabled={isUploading || !hasSubnet} />
              </div>

              <Button type="submit" disabled={isUploading || (!multiMode && scheduleEnabled && !scheduledAt) || (multiMode && multiItems.length === 0)} className="w-full">
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? (scheduleEnabled && !multiMode ? 'Scheduling...' : 'Posting...') : scheduleEnabled && !multiMode ? '⏰ Schedule Post' : 'Create Post'}
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
    <div className="container mx-auto flex flex-col min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16">
      <CreatePostForm user={user} userProfile={userProfile} />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, updateDoc, doc, arrayUnion,
} from 'firebase/firestore';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { ShareToDMDialog } from '@/components/cybazone/ShareToDMDialog';
import { Loader2, Plus, X, Send, ChevronLeft, ChevronRight, Eye, Camera, Image as ImageIcon, Trash2, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { computeLevel } from '@/lib/levels';
import { createPulse, deletePulse, PULSE_LIFETIME_MS } from '@/lib/pulses';
import type { CCRates } from '@/lib/cc-rewards';

const IMAGE_DISPLAY_MS = 5000;

export type Pulse = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorProfilePictureUrl?: string | null;
  authorAvatarConfig?: AvatarConfig | null;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string | null;
  createdAt: any;
  expiresAt: any;
  viewedBy: string[];
};

function millisOf(ts: any): number {
  if (!ts) return 0;
  return typeof ts === 'number' ? ts : ts.toMillis?.() ?? 0;
}

export function PulsesRow({
  currentUserId,
  currentUsername,
  currentUserProfilePictureUrl,
  currentUserAvatarConfig,
  currentUserPostCount,
  currentUserSupportGiven,
  currentUserLevelOverride,
  ccRates,
  followingList,
}: {
  currentUserId?: string;
  currentUsername?: string;
  currentUserProfilePictureUrl?: string | null;
  currentUserAvatarConfig?: AvatarConfig | null;
  currentUserPostCount?: number;
  currentUserSupportGiven?: number;
  currentUserLevelOverride?: string;
  ccRates?: CCRates | null;
  followingList: string[];
}) {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [viewerAuthorId, setViewerAuthorId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<Pulse | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleTakePhotoOrVideo = () => {
    setShowSourceMenu(false);
    // Fall back to the OS picker's capture hint on browsers without getUserMedia — old Safari
    // versions and a handful of embedded webviews.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    setShowCamera(true);
  };

  const now = Date.now();
  const pulsesQuery = useMemoFirebase(
    () => query(collection(firestore, 'pulses'), where('expiresAt', '>', new Date(now - 5 * 60 * 1000))),
    [firestore],
  );
  const { data: rawPulses } = useCollection<Pulse>(pulsesQuery);

  const activePulses = useMemo(
    () => (rawPulses ?? []).filter(p => millisOf(p.expiresAt) > Date.now()),
    [rawPulses],
  );

  // Group by author, sorted oldest-first within each group (story-viewer order).
  const groups = useMemo(() => {
    const map = new Map<string, Pulse[]>();
    activePulses.forEach(p => {
      const arr = map.get(p.authorId) ?? [];
      arr.push(p);
      map.set(p.authorId, arr);
    });
    map.forEach(arr => arr.sort((a, b) => millisOf(a.createdAt) - millisOf(b.createdAt)));
    return map;
  }, [activePulses]);

  const followingSet = useMemo(() => new Set(followingList), [followingList]);
  const orderedAuthorIds = useMemo(() => {
    const ids = Array.from(groups.keys()).filter(id => id !== currentUserId);
    const followed = ids.filter(id => followingSet.has(id));
    // Most-recent-pulse-first among followed CYBAs (own circle is always rendered separately, first).
    const latestOf = (id: string) => Math.max(...groups.get(id)!.map(p => millisOf(p.createdAt)));
    return followed.sort((a, b) => latestOf(b) - latestOf(a));
  }, [groups, followingSet, currentUserId]);

  const myPulses = currentUserId ? (groups.get(currentUserId) ?? []) : [];

  const handlePostPulse = async (caption: string) => {
    if (!currentUserId || !currentUsername || !pendingFile) return;
    setUploading(true);
    try {
      const level = computeLevel(currentUserPostCount, currentUserSupportGiven, undefined, currentUserLevelOverride);
      const { cc } = await createPulse(firestore, storage, {
        userId: currentUserId,
        username: currentUsername,
        profilePictureUrl: currentUserProfilePictureUrl,
        avatarConfig: currentUserAvatarConfig,
        file: pendingFile,
        caption,
        level,
        ccRates,
      });
      toast({ title: '✨ Pulse posted!', description: `Visible to your followers for 24 hours. +${cc.toLocaleString()} CC` });
      setPendingFile(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to post Pulse', description: err?.message !== 'Upload an image or a video.' ? undefined : err.message });
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (libraryInputRef.current) libraryInputRef.current.value = '';
    }
  };

  // Tapping the avatar itself opens the viewer if you already have active Pulses, or starts
  // the add flow if you don't. The small "+" badge (below) always starts the add flow, even
  // when you already have Pulses, so you can post another on top of an existing one.
  const handleOwnCircleClick = () => {
    if (myPulses.length > 0) setViewerAuthorId(currentUserId!);
    else setShowSourceMenu(true);
  };

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { setShowSourceMenu(false); setPendingFile(f); } }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { setShowSourceMenu(false); setPendingFile(f); } }}
      />
      <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {currentUserId && (
          <div className="relative flex flex-col items-center gap-1 shrink-0">
            <div className="relative h-14 w-14">
              <button
                type="button"
                onClick={handleOwnCircleClick}
                disabled={uploading}
                className={cn(
                  'h-14 w-14 rounded-full flex items-center justify-center transition-transform hover:scale-105',
                  myPulses.length > 0 && myPulses.some(p => !p.viewedBy?.includes(currentUserId))
                    ? 'ring-2 ring-offset-2 ring-offset-background ring-purple-500'
                    : myPulses.length > 0 ? 'ring-2 ring-offset-2 ring-offset-background ring-muted-foreground/30' : '',
                )}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <AvatarDisplay profilePictureUrl={currentUserProfilePictureUrl ?? undefined} avatarConfig={currentUserAvatarConfig ?? undefined} size={52} />
                )}
              </button>
              {/* Always opens the add flow, even when you already have active Pulses. */}
              <button
                type="button"
                onClick={() => setShowSourceMenu(true)}
                disabled={uploading}
                className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background hover:scale-110 transition-transform"
                title="Add a Pulse"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">Your Pulse</span>

            {/* Portaled to document.body — this row scrolls horizontally (overflow-x-auto),
                which clips any absolutely-positioned child that isn't escaped via a portal,
                cutting the menu off on some mobile browsers (notably Android Chrome). */}
            {mounted && showSourceMenu && createPortal(
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center bg-black/70" onClick={() => setShowSourceMenu(false)}>
                <div
                  className="w-full sm:w-72 rounded-t-2xl sm:rounded-2xl border border-primary/20 bg-card shadow-xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleTakePhotoOrVideo}
                    className="w-full flex items-center gap-3 px-4 py-4 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <Camera className="h-5 w-5 text-primary" /> Take Photo or Video
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSourceMenu(false); libraryInputRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-4 text-sm font-medium hover:bg-muted transition-colors text-left border-t border-border/50"
                  >
                    <ImageIcon className="h-5 w-5 text-primary" /> Choose from Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSourceMenu(false)}
                    className="w-full px-4 py-4 text-sm font-semibold text-center hover:bg-muted transition-colors border-t border-border/50 text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>,
              document.body,
            )}
          </div>
        )}

        {orderedAuthorIds.map(authorId => {
          const pulses = groups.get(authorId)!;
          const first = pulses[0];
          const unseen = pulses.some(p => !p.viewedBy?.includes(currentUserId ?? ''));
          return (
            <button
              key={authorId}
              type="button"
              onClick={() => setViewerAuthorId(authorId)}
              className="flex flex-col items-center gap-1 shrink-0 transition-transform hover:scale-105"
            >
              <div className={cn(
                'h-14 w-14 rounded-full flex items-center justify-center',
                unseen ? 'ring-2 ring-offset-2 ring-offset-background ring-purple-500' : 'ring-2 ring-offset-2 ring-offset-background ring-muted-foreground/30',
              )}>
                <AvatarDisplay profilePictureUrl={first.authorProfilePictureUrl ?? undefined} avatarConfig={first.authorAvatarConfig ?? undefined} size={52} />
              </div>
              <span className="text-[10px] text-muted-foreground truncate max-w-[56px]">{first.authorUsername}</span>
            </button>
          );
        })}

        {orderedAuthorIds.length === 0 && !currentUserId && (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="h-14 w-14 rounded-full border-2 border-dashed border-primary/25 bg-card/30" />
              <span className="text-[10px] text-muted-foreground/50">Pulse</span>
            </div>
          ))
        )}
      </div>

      {viewerAuthorId && groups.get(viewerAuthorId) && (
        <PulseViewer
          pulses={groups.get(viewerAuthorId)!}
          currentUserId={currentUserId}
          onClose={() => setViewerAuthorId(null)}
          onShare={(p) => setShareTarget(p)}
          onDeleted={() => setViewerAuthorId(null)}
        />
      )}

      {shareTarget && (
        <ShareToDMDialog
          open={!!shareTarget}
          onOpenChange={(v) => { if (!v) setShareTarget(null); }}
          content={{
            kind: 'pulse',
            pulseId: shareTarget.id,
            authorUsername: shareTarget.authorUsername,
            authorProfilePictureUrl: shareTarget.authorProfilePictureUrl,
            mediaUrl: shareTarget.mediaUrl,
            mediaType: shareTarget.mediaType,
          }}
        />
      )}

      {showCamera && (
        <PulseCameraCapture
          onCancel={() => setShowCamera(false)}
          onCapture={(file) => { setShowCamera(false); setPendingFile(file); }}
        />
      )}

      {pendingFile && (
        <PulseComposeDialog
          file={pendingFile}
          uploading={uploading}
          onCancel={() => {
            setPendingFile(null);
            if (cameraInputRef.current) cameraInputRef.current.value = '';
            if (libraryInputRef.current) libraryInputRef.current.value = '';
          }}
          onPost={handlePostPulse}
        />
      )}
    </div>
  );
}

/** Full-screen compose step shown after picking a photo/video (from camera or library) — lets
 *  the user preview what they're about to post and add an optional caption before it goes live. */
export function PulseComposeDialog({
  file,
  uploading,
  onCancel,
  onPost,
}: {
  file: File;
  uploading: boolean;
  onCancel: () => void;
  onPost: (caption: string) => void;
}) {
  const [caption, setCaption] = useState('');
  const [muted, setMuted] = useState(true);
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const isVideo = file.type.startsWith('video/');

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onCancel} disabled={uploading} className="text-white/80 hover:text-white p-1.5 disabled:opacity-40">
          <X className="h-6 w-6" />
        </button>
        <span className="text-sm font-semibold text-white">New Pulse</span>
        <button
          onClick={() => onPost(caption)}
          disabled={uploading}
          className="text-sm font-bold text-primary hover:text-primary/80 disabled:opacity-40 flex items-center gap-1.5"
        >
          {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {uploading ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
        {isVideo ? (
          <>
            {/* Starts muted so autoplay is never blocked by the browser — tap the speaker to
                confirm the recording actually has audio before posting. */}
            <video src={previewUrl} className="max-h-full max-w-full rounded-lg" autoPlay muted={muted} loop playsInline />
            <button
              onClick={() => setMuted(m => !m)}
              className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        )}
      </div>

      <div className="p-4 shrink-0">
        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={200}
          placeholder="Add a caption…"
          disabled={uploading}
          className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
      </div>
    </div>
  );
}

const MAX_RECORD_MS = 15000;

/**
 * A real in-page camera view (getUserMedia + canvas snapshot for photos, MediaRecorder for
 * video) — used instead of `<input type="file" capture>` because `capture` is only ever a
 * *hint*; most browsers (all of Android Chrome, and desktop Chrome/Firefox entirely) ignore it
 * and just open the same file/gallery picker regardless, which made "Take Photo or Video" and
 * "Choose from Library" behave identically. This works the same everywhere getUserMedia is
 * supported — mobile and desktop.
 */
export function PulseCameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noMic, setNoMic] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    stopStream();
    // Ask for camera+mic together first (one combined permission prompt on most browsers). If
    // that's refused specifically because of the mic (some browsers reject the whole call rather
    // than silently dropping the audio constraint), retry video-only so photo/video capture still
    // works — just flagged as silent, rather than failing the whole camera view.
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode }, audio: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode } }))
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setNoMic(stream.getAudioTracks().length === 0);
        setError(null);
      })
      .catch(() => setError('Camera access denied or unavailable. Check your browser permissions.'));
    return () => { cancelled = true; stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);

  const handleClose = () => { stopStream(); onCancel(); };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      stopStream();
      onCapture(new File([blob], `pulse-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || isRecording) return;
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) ?? '';
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        stopStream();
        onCapture(new File([blob], `pulse-${Date.now()}.${ext}`, { type: blob.type }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => {
          if (s + 1 >= MAX_RECORD_MS / 1000) { stopRecording(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Video recording is not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    recorderRef.current?.stop();
    setIsRecording(false);
    if (recordIntervalRef.current) { clearInterval(recordIntervalRef.current); recordIntervalRef.current = null; }
  };

  // Tap = photo. Press-and-hold (>350ms) = start recording; releasing then stops it.
  const handleShutterDown = () => {
    holdTimerRef.current = setTimeout(startRecording, 350);
  };
  const handleShutterUp = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (isRecording) stopRecording();
    else takePhoto();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={handleClose} className="text-white/80 hover:text-white p-1.5">
          <X className="h-6 w-6" />
        </button>
        {isRecording && (
          <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> {recordSeconds}s
          </span>
        )}
        <button onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')} disabled={isRecording} className="text-white/80 hover:text-white p-1.5 disabled:opacity-30">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <p className="text-white/70 text-sm text-center px-8">{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn('max-h-full max-w-full', facingMode === 'user' && '-scale-x-100')}
          />
        )}
        {!error && noMic && (
          <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-amber-300 bg-black/60 rounded-full px-3 py-1">
            ⚠ No microphone access — video will be silent
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 py-8 shrink-0">
        <button
          onPointerDown={handleShutterDown}
          onPointerUp={handleShutterUp}
          onPointerLeave={() => { if (isRecording) stopRecording(); }}
          disabled={!!error}
          className={cn(
            'h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-transform disabled:opacity-30',
            isRecording ? 'bg-red-500 scale-110' : 'bg-white/20',
          )}
        >
          <span className={cn('bg-white transition-all', isRecording ? 'h-6 w-6 rounded-md' : 'h-12 w-12 rounded-full')} />
        </button>
        <p className="text-white/50 text-xs">Tap for photo · Hold for video</p>
      </div>
    </div>
  );
}

export function PulseViewer({
  pulses,
  currentUserId,
  onClose,
  onShare,
  onDeleted,
}: {
  pulses: Pulse[];
  currentUserId?: string;
  onClose: () => void;
  onShare: (pulse: Pulse) => void;
  /** Called after a successful delete — the caller should close the viewer, since the passed-in
   *  `pulses` array is a fixed snapshot and won't reflect the deletion on its own. */
  onDeleted?: () => void;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  // Starts muted — unmuted `autoPlay` is blocked outright by most browsers' autoplay policy,
  // which meant video Pulses could silently fail to play at all, not just play without sound.
  const [muted, setMuted] = useState(true);
  const current = pulses[index];
  const markedRef = useRef<Set<string>>(new Set());

  const advance = () => {
    if (index < pulses.length - 1) setIndex(i => i + 1);
    else onClose();
  };
  const back = () => {
    if (index > 0) setIndex(i => i - 1);
  };

  const handleDelete = async () => {
    if (!current || deleting) return;
    if (!confirm('Delete this Pulse? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deletePulse(firestore, current.id);
      toast({ title: 'Pulse deleted' });
      onDeleted?.();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete Pulse' });
      setDeleting(false);
    }
  };

  // Mark the currently-viewed pulse as seen.
  useEffect(() => {
    if (!current || !currentUserId) return;
    if (current.viewedBy?.includes(currentUserId)) return;
    if (markedRef.current.has(current.id)) return;
    markedRef.current.add(current.id);
    updateDoc(doc(firestore, 'pulses', current.id), { viewedBy: arrayUnion(currentUserId) }).catch(() => {});
  }, [current, currentUserId, firestore]);

  // Auto-advance timer for image pulses (videos advance via onEnded instead).
  useEffect(() => {
    if (!current || current.mediaType !== 'image') return;
    const t = setTimeout(advance, IMAGE_DISPLAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
      <style>{`
        @keyframes pulse-progress-fill { from { width: 0% } to { width: 100% } }
        .pulse-progress-active { animation: pulse-progress-fill ${current.mediaType === 'video' ? 15 : IMAGE_DISPLAY_MS / 1000}s linear forwards; }
      `}</style>
      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
        {pulses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div className={cn('h-full bg-white', i < index ? 'w-full' : i === index ? 'pulse-progress-active' : 'w-0')} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-3 right-3 flex items-center justify-between z-10">
        <Link href={`/u/${current.authorUsername}`} className="flex items-center gap-2 text-white">
          <AvatarDisplay profilePictureUrl={current.authorProfilePictureUrl ?? undefined} avatarConfig={current.authorAvatarConfig ?? undefined} size={28} />
          <span className="text-sm font-semibold">@{current.authorUsername}</span>
          {current.authorId === currentUserId && (current.viewedBy?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Eye className="h-3.5 w-3.5" /> {current.viewedBy.length.toLocaleString()}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          {current.mediaType === 'video' && (
            <button onClick={() => setMuted(m => !m)} className="text-white/80 hover:text-white p-1.5" title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          )}
          {current.authorId === currentUserId && (
            <button onClick={handleDelete} disabled={deleting} className="text-white/80 hover:text-red-400 p-1.5 disabled:opacity-40">
              {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
            </button>
          )}
          <button onClick={() => onShare(current)} className="text-white/80 hover:text-white p-1.5">
            <Send className="h-5 w-5" />
          </button>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1.5">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="relative w-full h-full max-w-md mx-auto flex items-center justify-center">
        {current.mediaType === 'video' ? (
          <video src={current.mediaUrl} className="max-h-full max-w-full" autoPlay muted={muted} playsInline onEnded={advance} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}

        {/* Tap zones */}
        <button onClick={back} className="absolute left-0 top-0 h-full w-1/3" aria-label="Previous" />
        <button onClick={advance} className="absolute right-0 top-0 h-full w-1/3" aria-label="Next" />

        {current.caption && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-5 pointer-events-none">
            <p className="text-sm text-white/95 text-center break-words">{current.caption}</p>
          </div>
        )}
      </div>

      {index > 0 && (
        <ChevronLeft className="hidden sm:block absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 text-white/40" />
      )}
      {index < pulses.length - 1 && (
        <ChevronRight className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-white/40" />
      )}
    </div>
  );
}

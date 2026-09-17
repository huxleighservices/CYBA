'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, updateDoc, doc, arrayUnion,
} from 'firebase/firestore';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { ShareToDMDialog } from '@/components/cybazone/ShareToDMDialog';
import { Loader2, Plus, X, Send, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AvatarConfig } from '@/lib/avatar-assets';
import { computeLevel } from '@/lib/levels';
import { createPulse, PULSE_LIFETIME_MS } from '@/lib/pulses';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [viewerAuthorId, setViewerAuthorId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<Pulse | null>(null);

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

  const handleUploadFile = async (file: File) => {
    if (!currentUserId || !currentUsername) return;
    setUploading(true);
    try {
      const level = computeLevel(currentUserPostCount, currentUserSupportGiven, undefined, currentUserLevelOverride);
      const { cc } = await createPulse(firestore, storage, {
        userId: currentUserId,
        username: currentUsername,
        profilePictureUrl: currentUserProfilePictureUrl,
        avatarConfig: currentUserAvatarConfig,
        file,
        level,
        ccRates,
      });
      toast({ title: '✨ Pulse posted!', description: `Visible to your followers for 24 hours. +${cc.toLocaleString()} CC` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to post Pulse', description: err?.message !== 'Upload an image or a video.' ? undefined : err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOwnCircleClick = () => {
    if (myPulses.length > 0) setViewerAuthorId(currentUserId!);
    else fileInputRef.current?.click();
  };

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }}
      />
      <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {currentUserId && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleOwnCircleClick}
              disabled={uploading}
              className={cn(
                'relative h-14 w-14 rounded-full flex items-center justify-center transition-transform hover:scale-105',
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
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background">
                <Plus className="h-2.5 w-2.5" />
              </span>
            </button>
            <span className="text-[10px] text-muted-foreground">Your Pulse</span>
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
    </div>
  );
}

export function PulseViewer({
  pulses,
  currentUserId,
  onClose,
  onShare,
}: {
  pulses: Pulse[];
  currentUserId?: string;
  onClose: () => void;
  onShare: (pulse: Pulse) => void;
}) {
  const { firestore } = useFirebase();
  const [index, setIndex] = useState(0);
  const current = pulses[index];
  const markedRef = useRef<Set<string>>(new Set());

  const advance = () => {
    if (index < pulses.length - 1) setIndex(i => i + 1);
    else onClose();
  };
  const back = () => {
    if (index > 0) setIndex(i => i - 1);
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
          <video src={current.mediaUrl} className="max-h-full max-w-full" autoPlay playsInline onEnded={advance} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}

        {/* Tap zones */}
        <button onClick={back} className="absolute left-0 top-0 h-full w-1/3" aria-label="Previous" />
        <button onClick={advance} className="absolute right-0 top-0 h-full w-1/3" aria-label="Next" />
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

'use client';

import { useState, useRef, useMemo } from 'react';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import {
  doc, updateDoc, arrayUnion, increment, collection, query,
  where, addDoc, serverTimestamp, limit, orderBy, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { logTransaction, logCashTransaction } from '@/lib/transactions';
import {
  QUESTS,
  getQuestStatus,
  getQuestProgress,
  type Quest,
  type UserStats,
  type CustomQuest,
  type QuestSubmission,
} from '@/lib/quests';
import { createAutoShoutout } from '@/lib/shoutouts';
import { computeLevel, LEVELS_IN_ORDER, type Level } from '@/lib/levels';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Upload, ImagePlus, Video, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────
//  CYBERPUNK CITY BACKGROUND
// ─────────────────────────────────────────────
const BUILDINGS = [
  { x: 0,    w: 68,  h: 260 },
  { x: 63,   w: 44,  h: 175 },
  { x: 103,  w: 82,  h: 320 },
  { x: 181,  w: 54,  h: 195 },
  { x: 231,  w: 88,  h: 275 },
  { x: 315,  w: 38,  h: 155 },
  { x: 349,  w: 74,  h: 355 },
  { x: 419,  w: 52,  h: 215 },
  { x: 467,  w: 98,  h: 298 },
  { x: 561,  w: 50,  h: 185 },
  { x: 607,  w: 84,  h: 385 },
  { x: 687,  w: 44,  h: 165 },
  { x: 727,  w: 70,  h: 288 },
  { x: 793,  w: 54,  h: 238 },
  { x: 843,  w: 94,  h: 362 },
  { x: 933,  w: 38,  h: 148 },
  { x: 967,  w: 80,  h: 308 },
  { x: 1043, w: 58,  h: 198 },
  { x: 1097, w: 74,  h: 268 },
  { x: 1167, w: 50,  h: 318 },
  { x: 1213, w: 88,  h: 248 },
  { x: 1297, w: 54,  h: 188 },
  { x: 1347, w: 93,  h: 398 },
];

type WindowData = { x: number; y: number; lit: boolean; purple: boolean };

function buildingWindows(b: (typeof BUILDINGS)[0], bi: number): WindowData[] {
  const windows: WindowData[] = [];
  const cols = Math.floor(b.w / 14);
  const rows = Math.floor(b.h / 18);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (bi * 37 + r * 13 + c * 7) % 100;
      windows.push({
        x: b.x + 5 + c * 14,
        y: 400 - b.h + 8 + r * 18,
        lit: seed < 45,
        purple: seed < 12,
      });
    }
  }
  return windows;
}

function CityBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#07000f] to-[#0e001f]" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <svg
        viewBox="0 0 1440 400"
        preserveAspectRatio="xMidYMax slice"
        className="absolute bottom-0 left-0 w-full"
        style={{ height: '58vh', minHeight: 280 }}
      >
        <defs>
          <filter id="cg">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#18002e" />
            <stop offset="100%" stopColor="#08000d" />
          </linearGradient>
        </defs>
        {BUILDINGS.map((b, bi) => (
          <g key={bi}>
            <rect x={b.x} y={400 - b.h} width={b.w} height={b.h} fill="url(#bldg)" stroke="rgba(139,92,246,0.13)" strokeWidth="1" />
            {bi % 4 === 0 && <rect x={b.x} y={400 - b.h} width="2" height={b.h} fill="#a855f7" opacity="0.45" filter="url(#cg)" />}
            {bi % 7 === 0 && <rect x={b.x + b.w - 2} y={400 - b.h} width="2" height={b.h} fill="#7c3aed" opacity="0.3" filter="url(#cg)" />}
            {b.h > 250 && (
              <>
                <rect x={b.x + b.w / 2 - 1} y={400 - b.h - 22} width="2" height="22" fill="#6d28d9" opacity="0.65" />
                <rect x={b.x + b.w / 2 - 1} y={400 - b.h - 24} width="2" height="3" fill="#a855f7" opacity="0.9" filter="url(#cg)" />
              </>
            )}
            {buildingWindows(b, bi).map((win, wi) => (
              <rect
                key={wi} x={win.x} y={win.y} width="8" height="10" rx="1"
                fill={!win.lit ? 'rgba(0,0,0,0.6)' : win.purple ? 'rgba(168,85,247,0.75)' : 'rgba(251,191,36,0.45)'}
              />
            ))}
          </g>
        ))}
        <rect x="0" y="397" width="1440" height="3" fill="#a855f7" opacity="0.6" filter="url(#cg)" />
        <rect x="0" y="398" width="1440" height="2" fill="#7c3aed" opacity="0.9" />
        <ellipse cx="720" cy="400" rx="600" ry="70" fill="#6d28d9" opacity="0.1" />
        <ellipse cx="720" cy="400" rx="300" ry="28" fill="#a855f7" opacity="0.1" />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 h-52 bg-gradient-to-t from-[#07000f] to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────
//  DIFFICULTY BADGE
// ─────────────────────────────────────────────
const DIFF_STYLES: Record<Quest['difficulty'], string> = {
  easy:      'bg-green-950/60  text-green-400  border-green-500/30',
  medium:    'bg-yellow-950/60 text-yellow-400 border-yellow-500/30',
  hard:      'bg-orange-950/60 text-orange-400 border-orange-500/30',
  legendary: 'bg-red-950/60   text-red-400    border-red-500/30',
};

const DIFF_LABELS: Record<Quest['difficulty'], string> = {
  easy:      'SPARK',
  medium:    'CHARGE',
  hard:      'SURGE',
  legendary: 'STORM',
};

// ─────────────────────────────────────────────
//  STANDARD QUEST CARD
// ─────────────────────────────────────────────
function QuestCard({
  quest,
  completedIds,
  userStats,
  onClaim,
  isClaiming,
}: {
  quest: Quest;
  completedIds: string[];
  userStats: UserStats;
  onClaim: (quest: Quest) => void;
  isClaiming: boolean;
}) {
  const status = getQuestStatus(quest, completedIds, userStats);
  const progress = getQuestProgress(quest, userStats);

  const isLocked    = status === 'locked';
  const isCompleted = status === 'completed';
  const isClaimable = status === 'claimable';

  return (
    <div
      className={cn(
        'relative rounded-2xl border flex flex-col gap-4 p-5 transition-all duration-300',
        'backdrop-blur-md bg-white/[0.04]',
        isLocked     && 'border-zinc-800/50 opacity-55',
        isCompleted  && 'border-green-500/25 bg-green-950/10',
        isClaimable  && 'border-yellow-400/50 bg-yellow-950/10 shadow-[0_0_30px_rgba(234,179,8,0.1)]',
        !isLocked && !isCompleted && !isClaimable && 'border-purple-500/25 hover:border-purple-400/40',
      )}
    >
      {isCompleted && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-green-500 to-transparent" />}
      {isClaimable && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />}
      {!isLocked && !isCompleted && !isClaimable && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-purple-500/70 to-transparent" />}

      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{isLocked ? '🔒' : quest.nodeEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-sm text-white leading-tight">{quest.title}</h3>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none', DIFF_STYLES[quest.difficulty])}>
              {DIFF_LABELS[quest.difficulty]}
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{quest.description}</p>
        </div>
        <span className={cn(
          'shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border leading-none mt-0.5',
          isCompleted            && 'bg-green-950/60 text-green-400 border-green-500/30',
          isClaimable            && 'bg-yellow-950/60 text-yellow-300 border-yellow-400/50 animate-pulse',
          status === 'in-progress' && 'bg-purple-950/60 text-purple-300 border-purple-500/30',
          status === 'available'   && 'bg-zinc-900 text-zinc-400 border-zinc-700',
          isLocked               && 'bg-zinc-900/60 text-zinc-600 border-zinc-800',
        )}>
          {isCompleted && '✓ Done'}
          {isClaimable && '★ Claim'}
          {status === 'in-progress' && 'Active'}
          {status === 'available'   && 'Open'}
          {isLocked               && 'Locked'}
        </span>
      </div>

      <div className="space-y-3">
        {progress.map((p, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-zinc-300">
                {p.pct >= 100
                  ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  : <span className="w-3.5 h-3.5 rounded-sm border border-zinc-600 shrink-0 inline-block" />
                }
                <span className={cn(p.pct >= 100 && 'line-through text-zinc-500')}>
                  {p.icon} {p.label}
                </span>
              </div>
              <span className={cn('tabular-nums font-medium', p.pct >= 100 ? 'text-green-400' : 'text-zinc-400')}>
                {p.current.toLocaleString()} / {p.target.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', p.pct >= 100 ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-violet-600 to-purple-400')}
                style={{ width: `${p.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-white/[0.06] flex-wrap">
        <div className="flex items-center gap-1.5">
          <Image src="/CCoin.png?v=2" alt="CC" width={14} height={14} />
          <span className="text-xs font-bold text-yellow-400">+{quest.reward.coins.toLocaleString()}</span>
          <span className="text-[10px] text-zinc-500">CYBACOIN</span>
        </div>
        {quest.reward.title && <span className="text-[11px] text-purple-400">🏅 {quest.reward.title}</span>}
        {quest.reward.badge && <span className="text-[11px] text-blue-400">🎖 {quest.reward.badge}</span>}
      </div>

      {isClaimable && (
        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-black font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)]"
          onClick={() => onClaim(quest)}
          disabled={isClaiming}
        >
          {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : '★ Claim Reward'}
        </Button>
      )}
      {isLocked && <p className="text-center text-[11px] text-zinc-600">Complete previous quests to unlock</p>}
      {isCompleted && <p className="text-center text-[11px] text-green-500/70">✓ Quest completed</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MEDIA QUEST CARD
// ─────────────────────────────────────────────
function MediaQuestCard({
  quest,
  submission,
  onSubmit,
  slotsUsed = 0,
  userLevel,
  isUnlocked,
}: {
  quest: CustomQuest;
  submission?: QuestSubmission;
  onSubmit: (quest: CustomQuest) => void;
  slotsUsed?: number;
  userLevel?: Level;
  isUnlocked?: boolean;
}) {
  const status = submission?.status;
  const isPending  = status === 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const hasSubmission = !!submission;

  // Level gate — explicit requiredLevel overrides difficulty-based default
  const DIFF_TO_LEVEL: Record<CustomQuest['difficulty'], Level | null> = {
    easy: null, medium: 'charge', hard: 'surge', legendary: 'storm',
  };
  const effectiveRequiredLevel = quest.requiredLevel ?? DIFF_TO_LEVEL[quest.difficulty] ?? null;
  const requiredLevelIdx = effectiveRequiredLevel ? LEVELS_IN_ORDER.indexOf(effectiveRequiredLevel) : -1;
  const userLevelIdx = userLevel ? LEVELS_IN_ORDER.indexOf(userLevel) : 0;
  const isLevelLocked = requiredLevelIdx > userLevelIdx;

  // Slot gate (only when weeklySlots > 0 and not approved/pending already)
  const maxSlots = quest.weeklySlots ?? 0;
  const isFull = maxSlots > 0 && slotsUsed >= maxSlots && !hasSubmission;
  const slotsLeft = maxSlots > 0 ? Math.max(0, maxSlots - slotsUsed) : null;

  // Unlock gate (level met but needs CC unlock)
  const needsUnlock = !isUnlocked && !!quest.unlockPrice;

  return (
    <div
      className={cn(
        'relative rounded-2xl border flex flex-col gap-4 p-5 transition-all duration-300',
        'backdrop-blur-md bg-white/[0.04]',
        isLevelLocked && 'border-zinc-800/50 opacity-55',
        isApproved && !isLevelLocked && 'border-green-500/25 bg-green-950/10',
        isPending  && !isLevelLocked && 'border-blue-500/25 bg-blue-950/10',
        isRejected && !isLevelLocked && 'border-red-500/25 bg-red-950/10',
        isFull && !hasSubmission && !isLevelLocked && 'border-zinc-700/50 opacity-70',
        !hasSubmission && !isLevelLocked && !isFull && 'border-purple-500/25 hover:border-purple-400/40',
      )}
    >
      {isApproved && !isLevelLocked && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-green-500 to-transparent" />}
      {isPending  && !isLevelLocked && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-blue-500 to-transparent" />}
      {isRejected && !isLevelLocked && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-red-500 to-transparent" />}
      {!hasSubmission && !isLevelLocked && !isFull && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-purple-500/70 to-transparent" />}

      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{isLevelLocked ? '🔒' : quest.nodeEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-sm text-white leading-tight">{quest.title}</h3>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none', DIFF_STYLES[quest.difficulty])}>
              {DIFF_LABELS[quest.difficulty]}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none bg-blue-950/60 text-blue-400 border-blue-500/30">
              📸 Media Quest
            </span>
            {slotsLeft !== null && !isLevelLocked && !hasSubmission && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none',
                slotsLeft === 0 ? 'bg-red-950/60 text-red-400 border-red-500/30' : 'bg-zinc-900 text-zinc-400 border-zinc-700',
              )}>
                {slotsLeft === 0 ? '🔴 Full' : `🎯 ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left`}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{quest.description}</p>
          {isLevelLocked && effectiveRequiredLevel && (
            <p className="text-[11px] text-amber-400/80 mt-1">
              🔒 Reach {effectiveRequiredLevel.charAt(0).toUpperCase() + effectiveRequiredLevel.slice(1)} level to access
            </p>
          )}
        </div>
        <span className={cn(
          'shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border leading-none mt-0.5',
          isLevelLocked && 'bg-zinc-900/60 text-zinc-600 border-zinc-800',
          isApproved  && !isLevelLocked && 'bg-green-950/60 text-green-400 border-green-500/30',
          isPending   && !isLevelLocked && 'bg-blue-950/60 text-blue-300 border-blue-400/50 animate-pulse',
          isRejected  && !isLevelLocked && 'bg-red-950/60 text-red-400 border-red-500/30',
          isFull && !hasSubmission && !isLevelLocked && 'bg-zinc-900/60 text-zinc-500 border-zinc-700',
          !hasSubmission && !isLevelLocked && !isFull && 'bg-zinc-900 text-zinc-400 border-zinc-700',
        )}>
          {isLevelLocked && 'Locked'}
          {!isLevelLocked && isApproved  && '✓ Done'}
          {!isLevelLocked && isPending   && '⏳ Review'}
          {!isLevelLocked && isRejected  && '✕ Rejected'}
          {!isLevelLocked && isFull && !hasSubmission && 'Full'}
          {!isLevelLocked && !hasSubmission && !isFull && 'Open'}
        </span>
      </div>

      {/* Payout reward row */}
      <div className="flex items-center gap-3 pt-1 border-t border-white/[0.06] flex-wrap">
        {quest.payout.type === 'cybacoin' ? (
          <div className="flex items-center gap-1.5">
            <Image src="/CCoin.png?v=2" alt="CC" width={14} height={14} />
            <span className="text-xs font-bold text-yellow-400">+{quest.payout.amount.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-500">CYBACOIN</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-green-400">+${quest.payout.amount.toFixed(2)}</span>
            <span className="text-[10px] text-zinc-500">CASH</span>
          </div>
        )}
        <span className="text-[10px] text-zinc-500">· Upon admin approval</span>
      </div>

      {/* Review note if rejected */}
      {isRejected && submission?.reviewNote && (
        <p className="text-xs text-red-400/80 bg-red-950/30 rounded-lg px-3 py-2 border border-red-500/20">
          Admin note: {submission.reviewNote}
        </p>
      )}

      {/* CTA */}
      {isLevelLocked && effectiveRequiredLevel && (
        <p className="text-center text-[11px] text-amber-500/60">Level up to {effectiveRequiredLevel} to unlock this quest</p>
      )}
      {!isLevelLocked && isApproved && <p className="text-center text-[11px] text-green-500/70">✓ Approved — reward issued</p>}
      {!isLevelLocked && isPending && <p className="text-center text-[11px] text-blue-400/70">Your submission is under review</p>}
      {!isLevelLocked && isRejected && (
        <Button size="sm" className="w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold" onClick={() => onSubmit(quest)}>
          <Upload className="h-4 w-4 mr-2" /> Resubmit
        </Button>
      )}
      {!isLevelLocked && !hasSubmission && isFull && (
        <p className="text-center text-[11px] text-zinc-500">Weekly slots are full — check back next week</p>
      )}
      {!isLevelLocked && !hasSubmission && !isFull && needsUnlock && (
        <p className="text-center text-[11px] text-purple-400/70">Go to Rewards to unlock this quest</p>
      )}
      {!isLevelLocked && !hasSubmission && !isFull && !needsUnlock && (
        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold"
          onClick={() => onSubmit(quest)}
        >
          <Upload className="h-4 w-4 mr-2" /> Submit Media
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MEDIA SUBMISSION DIALOG
// ─────────────────────────────────────────────
function MediaSubmitDialog({
  quest,
  userId,
  username,
  onClose,
  onSuccess,
}: {
  quest: CustomQuest | null;
  userId: string;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { storage, firestore } = useFirebase();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!quest || !file || !userId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `quest_submissions/${userId}/${uuidv4()}.${ext}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        );
      });

      const mediaUrl = await getDownloadURL(task.snapshot.ref);
      const isVideo = file.type.startsWith('video/');

      await addDoc(collection(firestore, 'quest_submissions'), {
        submissionType: 'quest',
        questId: quest.id,
        questTitle: quest.title,
        userId,
        username,
        mediaUrl,
        mediaType: isVideo ? 'video' : 'image',
        status: 'pending',
        submittedAt: serverTimestamp(),
        payout: quest.payout,
      });

      toast({ title: 'Submitted!', description: 'Your media is under review. You\'ll be notified when approved.' });
      onSuccess();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!quest) return null;

  const isVideo = file?.type.startsWith('video/');

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{quest.nodeEmoji} {quest.title}</DialogTitle>
          <DialogDescription>{quest.mediaInstructions}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payout badge */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Reward on approval:</span>
            {quest.payout.type === 'cybacoin' ? (
              <span className="font-bold text-yellow-400 flex items-center gap-1">
                <Image src="/CCoin.png?v=2" alt="" width={14} height={14} />
                {quest.payout.amount.toLocaleString()} CYBACOIN
              </span>
            ) : (
              <span className="font-bold text-green-400">${quest.payout.amount.toFixed(2)} Cash</span>
            )}
          </div>

          {/* File picker */}
          {!file ? (
            <div
              className="border-2 border-dashed border-purple-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400/50 hover:bg-purple-950/10 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <div className="flex justify-center gap-4 mb-3 text-purple-400">
                <ImagePlus className="w-8 h-8" />
                <Video className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-zinc-300">Click to select a photo or video</p>
              <p className="text-xs text-zinc-500 mt-1">Supports JPG, PNG, GIF, MP4, MOV</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-purple-500/30">
              {isVideo ? (
                <video src={preview ?? ''} controls className="w-full max-h-64 object-contain bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview ?? ''} alt="preview" className="w-full max-h-64 object-contain bg-black" />
              )}
              <button
                onClick={clearFile}
                className="absolute top-2 right-2 bg-black/70 rounded-full p-1 hover:bg-black/90 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="px-3 py-2 bg-black/50 text-xs text-zinc-400 truncate">{file.name}</div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={uploading}>Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="bg-gradient-to-r from-blue-600 to-violet-600 text-white"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Submit for Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
//  REGULAR CUSTOM QUEST CARD (instant claim)
// ─────────────────────────────────────────────
function RegularCustomQuestCard({
  quest,
  completed,
  onClaim,
  isClaiming,
  promoClicks,
}: {
  quest: CustomQuest;
  completed: boolean;
  onClaim: (quest: CustomQuest) => void;
  isClaiming: boolean;
  /** All-time PROMO BLAST click-throughs for the current user — only relevant for milestoneType quests. */
  promoClicks: number;
}) {
  const isMilestone = quest.milestoneType === 'promo_clicks';
  const threshold = quest.milestoneThreshold ?? 0;
  const milestoneMet = !isMilestone || promoClicks >= threshold;

  return (
    <div
      className={cn(
        'relative rounded-2xl border flex flex-col gap-4 p-5 transition-all duration-300',
        'backdrop-blur-md bg-white/[0.04]',
        completed && 'border-green-500/25 bg-green-950/10',
        !completed && 'border-yellow-500/25 hover:border-yellow-400/40',
      )}
    >
      {completed && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-green-500 to-transparent" />}
      {!completed && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-yellow-500/70 to-transparent" />}

      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{quest.nodeEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-sm text-white leading-tight">{quest.title}</h3>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none', DIFF_STYLES[quest.difficulty])}>
              {DIFF_LABELS[quest.difficulty]}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none bg-yellow-950/60 text-yellow-400 border-yellow-500/30">
              ⭐ Quest
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{quest.description}</p>
          {quest.flavorText && <p className="text-[11px] text-zinc-600 italic mt-1">{quest.flavorText}</p>}
        </div>
        <span className={cn(
          'shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border leading-none mt-0.5',
          completed ? 'bg-green-950/60 text-green-400 border-green-500/30' : 'bg-yellow-950/60 text-yellow-300 border-yellow-400/50',
        )}>
          {completed ? '✓ Done' : '★ Claim'}
        </span>
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-white/[0.06] flex-wrap">
        {quest.payout.type === 'cybacoin' ? (
          <div className="flex items-center gap-1.5">
            <Image src="/CCoin.png?v=2" alt="CC" width={14} height={14} />
            <span className="text-xs font-bold text-yellow-400">+{quest.payout.amount.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-500">CYBACOIN</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-green-400">+${quest.payout.amount.toFixed(2)}</span>
            <span className="text-[10px] text-zinc-500">CASH</span>
          </div>
        )}
      </div>

      {!completed && isMilestone && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Promo click-throughs</span>
            <span>{Math.min(promoClicks, threshold).toLocaleString()} / {threshold.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
              style={{ width: `${threshold ? Math.min(100, (promoClicks / threshold) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {!completed ? (
        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-black font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)]"
          onClick={() => onClaim(quest)}
          disabled={isClaiming || !milestoneMet}
        >
          {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : !milestoneMet ? 'Not There Yet' : '★ Claim Reward'}
        </Button>
      ) : (
        <p className="text-center text-[11px] text-green-500/70">✓ Quest completed</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────
interface UserQuestData {
  postCount?: number;
  supportGiven?: number;
  cybaCoinBalance?: number;
  completedQuests?: string[];
  completedCustomQuests?: string[];
  unlockedQuests?: string[];
  profilePictureUrl?: string;
  bio?: string;
  username?: string;
  payoutEnrolled?: boolean;
}

export default function CYBAQuestsPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimingCustom, setIsClaimingCustom] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [submitQuest, setSubmitQuest] = useState<CustomQuest | null>(null);
  const [questFilter, setQuestFilter] = useState<'all' | 'media' | 'completed'>('all');

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc<UserQuestData>(userDocRef);

  // Load admin-configured overrides for standard quests
  const questConfigRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'questConfig'),
    [firestore]
  );
  const { data: questConfig } = useDoc<{
    overrides: Record<string, {
      requirementTargets?: number[];
      rewardCoins?: number;
      rewardBadge?: string;
      rewardTitle?: string;
      title?: string;
      description?: string;
      flavorText?: string;
      nodeEmoji?: string;
      difficulty?: Quest['difficulty'];
    }>;
  }>(questConfigRef);

  // Load custom (media) quests from Firestore
  const customQuestsQuery = useMemoFirebase(
    () => query(collection(firestore, 'custom_quests'), where('active', '==', true)),
    [firestore]
  );
  const { data: customQuestsRaw } = useCollection<CustomQuest>(customQuestsQuery);
  const customQuests = customQuestsRaw ?? [];

  // All-time PROMO BLAST click-throughs across every ad this member has ever run — powers
  // milestoneType:'promo_clicks' custom quest progress/claim-gating below.
  const myAdsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, 'ads'), where('userId', '==', user.uid)) : null),
    [firestore, user]
  );
  const { data: myAds } = useCollection<{ clickCount?: number }>(myAdsQuery);
  const totalPromoClicks = (myAds ?? []).reduce((sum, ad) => sum + (ad.clickCount ?? 0), 0);

  // Load this user's quest submissions
  const submissionsQuery = useMemoFirebase(
    () => user
      ? query(collection(firestore, 'quest_submissions'), where('userId', '==', user.uid))
      : null,
    [firestore, user]
  );
  const { data: submissionsRaw } = useCollection<QuestSubmission>(submissionsQuery);

  // Load all submissions since last Sunday midnight for weekly slot counting
  const weekStartTs = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // back to Sunday
    start.setHours(0, 0, 0, 0);
    return Timestamp.fromMillis(start.getTime());
  }, []);
  const weeklySubsQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'quest_submissions'),
      where('submittedAt', '>=', weekStartTs),
      orderBy('submittedAt', 'desc'),
      limit(1000),
    ),
    [firestore, weekStartTs]
  );
  const { data: weeklySubsRaw } = useCollection<QuestSubmission>(weeklySubsQuery);

  // Map questId → latest submission for this user (quest submissions only)
  const submissionByQuestId = (submissionsRaw ?? []).reduce<Record<string, QuestSubmission>>((acc, s) => {
    if (!s.questId) return acc;
    // Keep most recent if there are multiple (e.g., resubmit after rejection)
    if (!acc[s.questId] || (s.submittedAt?.toMillis?.() ?? 0) > (acc[s.questId].submittedAt?.toMillis?.() ?? 0)) {
      acc[s.questId] = s;
    }
    return acc;
  }, {});

  // Count this-week slot usage per questId (pending + approved count against slots)
  const weeklySlotUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    (weeklySubsRaw ?? []).forEach(s => {
      if (s.submissionType !== 'quest' || !s.questId || s.status === 'rejected') return;
      counts[s.questId] = (counts[s.questId] ?? 0) + 1;
    });
    return counts;
  }, [weeklySubsRaw]);

  // Merge admin overrides into base QUESTS
  const activeQuests: Quest[] = QUESTS.map(q => {
    const ov = questConfig?.overrides?.[q.id];
    if (!ov) return q;
    return {
      ...q,
      title:       ov.title       ?? q.title,
      description: ov.description ?? q.description,
      flavorText:  ov.flavorText  ?? q.flavorText,
      nodeEmoji:   ov.nodeEmoji   ?? q.nodeEmoji,
      difficulty:  ov.difficulty  ?? q.difficulty,
      requirements: q.requirements.map((r, i) => ({
        ...r,
        target: ov.requirementTargets?.[i] ?? r.target,
      })),
      reward: {
        ...q.reward,
        coins: ov.rewardCoins ?? q.reward.coins,
        badge: ov.rewardBadge !== undefined ? (ov.rewardBadge || undefined) : q.reward.badge,
        title: ov.rewardTitle !== undefined ? (ov.rewardTitle || undefined) : q.reward.title,
      },
    };
  });

  const userStats: UserStats = {
    posts: userData?.postCount ?? 0,
    supportGiven: userData?.supportGiven ?? 0,
    profilePictureSet: userData?.profilePictureUrl ? 1 : 0,
    bioSet: userData?.bio ? 1 : 0,
  };
  const completedQuestIds = userData?.completedQuests ?? [];
  const completedCustomQuestIds = userData?.completedCustomQuests ?? [];
  const unlockedQuestIds = userData?.unlockedQuests ?? [];
  const userLevel = computeLevel(userData?.postCount, userData?.supportGiven);

  // Show all active custom quests — level/unlock state handled per-card
  const mediaCustomQuests = customQuests.filter(q => q.isMediaQuest !== false);
  const regularCustomQuests = customQuests.filter(q => q.isMediaQuest === false && (!q.unlockPrice || unlockedQuestIds.includes(q.id)));

  const totalCompleted = completedQuestIds.filter(id => activeQuests.some(q => q.id === id)).length
    + (submissionsRaw ?? []).filter(s => s.status === 'approved').length
    + completedCustomQuestIds.length;
  const totalQuests = activeQuests.length + mediaCustomQuests.length + regularCustomQuests.length;

  const handleClaimCustomQuest = async (quest: CustomQuest) => {
    if (!user) return;
    if (quest.milestoneType === 'promo_clicks' && totalPromoClicks < (quest.milestoneThreshold ?? Infinity)) return;
    setIsClaimingCustom(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        completedCustomQuests: arrayUnion(quest.id),
        ...(quest.payout.type === 'cybacoin' && { cybaCoinBalance: increment(quest.payout.amount) }),
      });
      if (quest.payout.type === 'cybacoin') {
        await logTransaction(firestore, user.uid, {
          type: 'quest_reward',
          amount: quest.payout.amount,
          description: `Quest Complete: ${quest.nodeEmoji} ${quest.title}`,
        });
      } else {
        await logCashTransaction(firestore, user.uid, {
          type: 'quest_payout',
          amount: quest.payout.amount,
          description: `Quest Cash Reward: ${quest.nodeEmoji} ${quest.title}`,
        });
      }
      createAutoShoutout(firestore, 'questComplete', { username: userData?.username ?? 'Someone', emoji: quest.nodeEmoji, title: quest.title }).catch(() => {});
      const label = quest.payout.type === 'cybacoin'
        ? `+${quest.payout.amount.toLocaleString()} CYBACOIN`
        : `+$${quest.payout.amount.toFixed(2)} cash`;
      setClaimSuccess(`${label} earned!`);
      setTimeout(() => setClaimSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to claim custom quest:', err);
    } finally {
      setIsClaimingCustom(false);
    }
  };

  const handleClaim = async (quest: Quest) => {
    if (!user) return;
    setIsClaiming(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        completedQuests: arrayUnion(quest.id),
        cybaCoinBalance: increment(quest.reward.coins),
      });
      await logTransaction(firestore, user.uid, {
        type: 'quest_reward',
        amount: quest.reward.coins,
        description: `Quest Complete: ${quest.nodeEmoji} ${quest.title}`,
      });
      createAutoShoutout(firestore, 'questComplete', { username: userData?.username ?? 'Someone', emoji: quest.nodeEmoji, title: quest.title }).catch(() => {});
      setClaimSuccess(`+${quest.reward.coins.toLocaleString()} CYBACOIN earned!`);
      setTimeout(() => setClaimSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to claim quest:', err);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="min-h-screen">
      <CityBackground />

      {submitQuest && user && (
        <MediaSubmitDialog
          quest={submitQuest}
          userId={user.uid}
          username={userData?.username ?? ''}
          onClose={() => setSubmitQuest(null)}
          onSuccess={() => setSubmitQuest(null)}
        />
      )}

      <div className="relative z-10 container mx-auto px-4 pt-4 pb-12 max-w-4xl">

        {/* Page header */}
        <div className="mb-10">
          <h1
            className="text-2xl md:text-3xl font-headline font-bold text-white mb-2 tracking-widest"
            style={{ textShadow: '0 0 50px rgba(168,85,247,0.7), 0 0 100px rgba(109,40,217,0.4)' }}
          >
            CYBAQUESTS
          </h1>
          <p className="text-xs text-zinc-500 tracking-widest uppercase mb-7">
            Complete Quests · Earn CYBACOIN &amp; Cash · Become a Legend
          </p>

          <div className="max-w-xs">
            <div className="flex justify-between text-[11px] text-zinc-500 mb-1.5">
              <span>Overall Progress</span>
              <span>{totalCompleted} / {totalQuests} quests</span>
            </div>
            <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-700 via-purple-500 to-fuchsia-400 transition-all duration-700"
                style={{ width: `${totalQuests ? (totalCompleted / totalQuests) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Not signed in banner */}
        {!user && !isUserLoading && (
          <div className="backdrop-blur-md bg-white/[0.04] border border-purple-500/25 rounded-2xl p-8 text-center mb-10">
            <div className="text-4xl mb-3">🎮</div>
            <p className="text-white font-semibold mb-1">Sign in to track your progress</p>
            <p className="text-sm text-zinc-400 mb-5">Quest completions and rewards are saved to your account.</p>
            <div className="flex gap-3 justify-center">
              <Button asChild size="sm"><Link href="/login">Sign In</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/signup">Sign Up</Link></Button>
            </div>
          </div>
        )}

        {/* Claim success toast */}
        {claimSuccess && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 text-sm font-bold px-6 py-3 rounded-xl shadow-2xl border-2 border-yellow-300 animate-in slide-in-from-top-2 fade-in duration-300 whitespace-nowrap">
            ★ {claimSuccess}
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 justify-center mb-8 flex-wrap">
          {([['all', 'All Quests'], ['media', '📸 Media'], ['completed', '✓ Completed']] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setQuestFilter(val as typeof questFilter)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-semibold border transition-all',
                questFilter === val
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-transparent border-zinc-700 text-zinc-400 hover:border-purple-500/50 hover:text-zinc-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Unified quest grid ── */}
        {(() => {
          const standardItems = activeQuests.map(q => ({
            type: 'standard' as const, id: q.id, order: q.level, quest: q,
          }));
          const mediaItems = mediaCustomQuests.map(q => ({
            type: 'media' as const, id: q.id, order: q.order ?? 999, quest: q as CustomQuest,
          }));
          const regularItems = regularCustomQuests.map(q => ({
            type: 'regular-custom' as const, id: q.id, order: q.order ?? 999, quest: q as CustomQuest,
          }));
          const allItems = [...standardItems, ...mediaItems, ...regularItems].sort((a, b) => a.order - b.order);

          const visible = allItems.filter(item => {
            if (questFilter === 'media') return item.type === 'media';
            if (questFilter === 'completed') {
              if (item.type === 'standard') return completedQuestIds.includes(item.id);
              if (item.type === 'regular-custom') return completedCustomQuestIds.includes(item.id);
              return (submissionsRaw ?? []).some(s => s.questId === item.id && s.status === 'approved');
            }
            return true;
          });

          if (visible.length === 0) {
            return <p className="text-center text-zinc-500 text-sm py-12">No quests to show.</p>;
          }

          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map(item => {
                if (item.type === 'standard') {
                  return (
                    <QuestCard
                      key={item.id}
                      quest={item.quest}
                      completedIds={completedQuestIds}
                      userStats={userStats}
                      onClaim={handleClaim}
                      isClaiming={isClaiming}
                    />
                  );
                }
                if (item.type === 'regular-custom') {
                  return (
                    <RegularCustomQuestCard
                      key={item.id}
                      quest={item.quest}
                      completed={completedCustomQuestIds.includes(item.id)}
                      onClaim={handleClaimCustomQuest}
                      isClaiming={isClaimingCustom}
                      promoClicks={totalPromoClicks}
                    />
                  );
                }
                return (
                  <MediaQuestCard
                    key={item.id}
                    quest={item.quest}
                    submission={submissionByQuestId[item.id]}
                    onSubmit={setSubmitQuest}
                    slotsUsed={weeklySlotUsage[item.id] ?? 0}
                    userLevel={userLevel}
                    isUnlocked={!item.quest.unlockPrice || unlockedQuestIds.includes(item.id)}
                  />
                );
              })}
            </div>
          );
        })()}

      </div>
    </div>
  );
}

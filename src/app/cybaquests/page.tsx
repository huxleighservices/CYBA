'use client';

import { useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import {
  QUESTS,
  WORLD_THEMES,
  getQuestStatus,
  getQuestProgress,
  getWorldProgress,
  type Quest,
  type QuestStatus,
} from '@/lib/quests';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { sfxQuestSelect, sfxQuestOpen, sfxQuestClaim, sfxLocked } from '@/lib/sfx';

// ─────────────────────────────────────────────
//  PIXEL CHARACTER (CSS grid sprite)
// ─────────────────────────────────────────────
const PX = 3; // px per sprite-pixel

const SPRITE_COLORS: Record<string, string | null> = {
  H: '#78350f', // hat/hair
  S: '#fbbf24', // skin
  E: '#0c0a09', // eyes
  B: '#2563eb', // body blue
  D: '#1d4ed8', // dark blue (legs/shoes)
  W: '#ffffff', // white
  _: null,
};

const IDLE_FRAME: string[][] = [
  ['_', '_', 'H', 'H', 'H', 'H', '_', '_'],
  ['_', 'H', 'H', 'H', 'H', 'H', 'H', '_'],
  ['_', 'H', 'S', 'S', 'S', 'S', 'H', '_'],
  ['_', 'H', 'E', 'S', 'S', 'E', 'H', '_'],
  ['_', 'H', 'S', 'S', 'S', 'S', 'H', '_'],
  ['_', '_', 'B', 'B', 'B', 'B', '_', '_'],
  ['_', 'B', 'B', 'B', 'B', 'B', 'B', '_'],
  ['_', 'B', 'D', 'B', 'B', 'D', 'B', '_'],
  ['_', '_', 'D', '_', '_', 'D', '_', '_'],
  ['_', '_', 'D', 'D', 'D', 'D', '_', '_'],
];

function PixelCharacter() {
  return (
    <div className="flex flex-col" style={{ gap: 0 }}>
      {IDLE_FRAME.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: 0 }}>
          {row.map((pixel, ci) => (
            <div
              key={ci}
              style={{
                width: PX,
                height: PX,
                backgroundColor: SPRITE_COLORS[pixel] ?? 'transparent',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  SVG MAP BACKGROUND + PATH
// ─────────────────────────────────────────────
function MapBackground() {
  // Build the winding path through all quest nodes
  let pathD = '';
  QUESTS.forEach((q, i) => {
    if (i === 0) {
      pathD += `M ${q.position.x} ${q.position.y}`;
    } else {
      const prev = QUESTS[i - 1].position;
      const cx1 = prev.x + (q.position.x - prev.x) * 0.5;
      const cy1 = prev.y;
      const cx2 = prev.x + (q.position.x - prev.x) * 0.5;
      const cy2 = q.position.y;
      pathD += ` C ${cx1} ${cy1} ${cx2} ${cy2} ${q.position.x} ${q.position.y}`;
    }
  });

  // Deterministic "random" stars seeded by index
  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: ((i * 23 + 7) % 90) + 2,
    y: ((i * 17 + 3) % 22) + 1,
    size: i % 5 === 0 ? 0.8 : 0.4,
    opacity: i % 3 === 0 ? 0.9 : 0.4,
  }));

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
    >
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14532d" />
          <stop offset="100%" stopColor="#052e16" />
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b0764" />
          <stop offset="100%" stopColor="#1a0533" />
        </linearGradient>
        <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c0a09" />
          <stop offset="100%" stopColor="#1a0000" />
        </linearGradient>
        <filter id="pathGlow">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* World zone backgrounds */}
      <rect x="0" y="60" width="100" height="40" fill="url(#g1)" />
      <rect x="0" y="25" width="100" height="35" fill="url(#g2)" />
      <rect x="0" y="0" width="100" height="25" fill="url(#g3)" />

      {/* Zone dividers */}
      <line x1="0" y1="60" x2="100" y2="60" stroke="#22c55e" strokeWidth="0.25" strokeOpacity="0.35" strokeDasharray="2,2" />
      <line x1="0" y1="25" x2="100" y2="25" stroke="#a855f7" strokeWidth="0.25" strokeOpacity="0.35" strokeDasharray="2,2" />

      {/* Pixel terrain decorations – World 1 (trees) */}
      {[8, 20, 44, 65, 82, 90].map((x, i) => (
        <g key={`tree${i}`} transform={`translate(${x}, 95)`}>
          <rect x="-0.3" y="-3" width="0.6" height="3" fill="#713f12" />
          <rect x="-1.2" y="-5" width="2.4" height="2.4" fill="#16a34a" />
          <rect x="-0.8" y="-7" width="1.6" height="2" fill="#15803d" />
        </g>
      ))}

      {/* Pixel mountains – World 2 */}
      {[10, 40, 70, 88].map((x, i) => (
        <g key={`mtn${i}`}>
          <polygon
            points={`${x - 4},60 ${x},50 ${x + 4},60`}
            fill="#4c1d95"
            opacity="0.6"
          />
          <polygon
            points={`${x - 1.5},53 ${x},50 ${x + 1.5},53`}
            fill="white"
            opacity="0.4"
          />
        </g>
      ))}

      {/* Pixel "tower" top – World 3 */}
      <g transform="translate(50, 2)">
        <rect x="-5" y="0" width="10" height="6" fill="#450a0a" stroke="#dc2626" strokeWidth="0.3" opacity="0.7" />
        <rect x="-1.5" y="-2" width="3" height="2.5" fill="#7f1d1d" opacity="0.8" />
        {/* battlements */}
        {[-4, -2, 0, 2].map(bx => (
          <rect key={bx} x={bx} y="-1" width="1.2" height="1.2" fill="#991b1b" opacity="0.8" />
        ))}
      </g>

      {/* Twinkling stars in World 3 */}
      {stars.map((star, i) => (
        <rect
          key={i}
          x={star.x}
          y={star.y}
          width={star.size}
          height={star.size}
          fill="white"
          opacity={star.opacity}
        />
      ))}

      {/* Path shadow */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(0,0,0,0.6)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Main quest path – golden dashed */}
      <path
        d={pathD}
        fill="none"
        stroke="#fbbf24"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeDasharray="2,1.5"
        opacity="0.65"
        filter="url(#pathGlow)"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
//  QUEST NODE
// ─────────────────────────────────────────────
const NODE_STYLES: Record<QuestStatus, string> = {
  locked: 'bg-zinc-900 border-zinc-700 text-zinc-600 cursor-not-allowed opacity-50',
  available: 'bg-zinc-900 border-primary/70 text-primary shadow-[0_0_10px_rgba(139,92,246,0.4)] hover:scale-110',
  'in-progress': 'bg-zinc-900 border-yellow-500 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.4)] hover:scale-110',
  claimable: 'bg-yellow-950 border-yellow-400 text-yellow-200 shadow-[0_0_18px_rgba(234,179,8,0.8)] hover:scale-110',
  completed: 'bg-green-950 border-green-500 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.4)] hover:scale-110',
};

function QuestNode({
  quest,
  status,
  isSelected,
  onClick,
}: {
  quest: Quest;
  status: QuestStatus;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={status === 'locked'}
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2',
        'w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl',
        'transition-all duration-200',
        NODE_STYLES[status],
        isSelected && 'ring-2 ring-white/50 scale-110',
        status === 'claimable' && 'animate-[pulse_1.5s_ease-in-out_infinite]',
      )}
      style={{ left: `${quest.position.x}%`, top: `${quest.position.y}%`, zIndex: isSelected ? 20 : 10 }}
    >
      {status === 'locked' ? '🔒' : quest.nodeEmoji}

      {/* Claimable "!" badge */}
      {status === 'claimable' && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-yellow-900 rounded-full text-[9px] font-black flex items-center justify-center animate-bounce">
          !
        </span>
      )}

      {/* Level number */}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[7px] text-zinc-500 whitespace-nowrap pixel-font">
        {quest.world}-{quest.level}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────
//  QUEST DETAIL PANEL (slides in from right)
// ─────────────────────────────────────────────
const DIFF_COLOR: Record<Quest['difficulty'], string> = {
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-orange-400',
  legendary: 'text-red-400',
};

function QuestPanel({
  quest,
  status,
  progress,
  onClose,
  onClaim,
  isClaiming,
}: {
  quest: Quest | null;
  status: QuestStatus;
  progress: ReturnType<typeof getQuestProgress>;
  onClose: () => void;
  onClaim: () => void;
  isClaiming: boolean;
}) {
  if (!quest) return null;

  const theme = WORLD_THEMES[quest.world];

  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 sm:w-72 bg-black/95 border-l border-zinc-800 flex flex-col z-30 overflow-y-auto pixel-font">
      {/* Header */}
      <div className="flex items-start gap-2 p-4 border-b border-zinc-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[8px]" style={{ color: theme.accent }}>
              {theme.emoji} {theme.name}
            </span>
            <span className={cn('text-[8px] uppercase', DIFF_COLOR[quest.difficulty])}>
              [{quest.difficulty}]
            </span>
          </div>
          <h2 className="text-[11px] text-white leading-tight">{quest.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white text-lg leading-none shrink-0 mt-0.5"
        >
          ×
        </button>
      </div>

      {/* Status */}
      <div className="px-4 pt-3">
        <span
          className={cn(
            'inline-block text-[8px] px-2 py-1 rounded border',
            status === 'completed' && 'border-green-500 text-green-400 bg-green-950/60',
            status === 'claimable' && 'border-yellow-400 text-yellow-300 bg-yellow-950/60',
            status === 'in-progress' && 'border-yellow-600 text-yellow-500 bg-zinc-900',
            status === 'available' && 'border-primary/60 text-primary bg-zinc-900',
            status === 'locked' && 'border-zinc-700 text-zinc-500 bg-zinc-900',
          )}
        >
          {status === 'completed' && '✓ COMPLETE'}
          {status === 'claimable' && '★ READY TO CLAIM'}
          {status === 'in-progress' && '► IN PROGRESS'}
          {status === 'available' && '○ AVAILABLE'}
          {status === 'locked' && '⊗ LOCKED'}
        </span>
      </div>

      {/* Description */}
      <div className="p-4">
        <p className="text-[9px] text-zinc-300 leading-relaxed mb-3">{quest.description}</p>
        <p className="text-[8px] text-zinc-500 italic leading-relaxed border-l-2 border-zinc-700 pl-2">
          {quest.flavorText}
        </p>
      </div>

      {/* Objectives */}
      <div className="px-4 pb-4 border-b border-zinc-800">
        <p className="text-[8px] text-zinc-500 uppercase mb-3 tracking-widest">OBJECTIVES</p>
        <div className="space-y-3">
          {progress.map((p, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] text-zinc-300">
                  {p.icon} {p.label}
                </span>
                <span
                  className={cn(
                    'text-[8px]',
                    p.pct >= 100 ? 'text-green-400' : 'text-zinc-400'
                  )}
                >
                  {p.current}/{p.target}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-none border border-zinc-700 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-700',
                    p.pct >= 100 ? 'bg-green-500' : 'bg-primary'
                  )}
                  style={{ width: `${p.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reward */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-[8px] text-zinc-500 uppercase mb-2 tracking-widest">REWARDS</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={14} height={14} />
            <span className="text-[9px] text-yellow-400">+{quest.reward.coins.toLocaleString()} CYBACOIN</span>
          </div>
          {quest.reward.title && (
            <div className="text-[8px] text-purple-400">🏅 Title: {quest.reward.title}</div>
          )}
          {quest.reward.badge && (
            <div className="text-[8px] text-blue-400">🎖 Badge: {quest.reward.badge}</div>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="p-4">
        {status === 'claimable' && (
          <button
            onClick={onClaim}
            disabled={isClaiming}
            className="w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-black text-[9px] py-3 border-2 border-yellow-300 hover:border-yellow-200 disabled:opacity-50 transition-all rounded"
          >
            {isClaiming ? 'CLAIMING...' : '★ CLAIM REWARD ★'}
          </button>
        )}
        {status === 'completed' && (
          <p className="text-center text-[8px] text-green-400">✓ QUEST COMPLETED</p>
        )}
        {status === 'locked' && (
          <p className="text-center text-[8px] text-zinc-500">🔒 COMPLETE PREVIOUS QUESTS FIRST</p>
        )}
        {(status === 'available' || status === 'in-progress') && (
          <Link
            href="/"
            className="block text-center text-[8px] text-primary hover:text-primary/80 transition-colors"
          >
            ► GO TO FEED TO PROGRESS
          </Link>
        )}
      </div>
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
}

export default function CYBAQuestsPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc<UserQuestData>(userDocRef);

  const userStats = { posts: userData?.postCount ?? 0, supportGiven: userData?.supportGiven ?? 0 };
  const completedQuestIds = userData?.completedQuests ?? [];

  const selectedQuest = QUESTS.find(q => q.id === selectedQuestId) ?? null;
  const selectedStatus = selectedQuest
    ? getQuestStatus(selectedQuest, completedQuestIds, userStats)
    : 'locked';
  const selectedProgress = selectedQuest
    ? getQuestProgress(selectedQuest, userStats)
    : [];

  // Character sits on the last completed quest, or the first quest
  const lastCompletedQuest = [...QUESTS].reverse().find(q => completedQuestIds.includes(q.id));
  const characterPos = lastCompletedQuest?.position ?? QUESTS[0].position;

  const totalCoinsEarned = completedQuestIds.reduce(
    (sum, id) => sum + (QUESTS.find(q => q.id === id)?.reward.coins ?? 0),
    0
  );

  const handleClaim = async () => {
    if (!selectedQuest || !user || selectedStatus !== 'claimable') return;
    setIsClaiming(true);
    sfxQuestClaim();
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        completedQuests: arrayUnion(selectedQuest.id),
        cybaCoinBalance: increment(selectedQuest.reward.coins),
      });
      setClaimSuccess(`+${selectedQuest.reward.coins.toLocaleString()} CYBACOIN EARNED!`);
      setTimeout(() => setClaimSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to claim quest:', err);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .pixel-font { font-family: 'Press Start 2P', 'Courier New', monospace; }
        @keyframes char-bob {
          0%, 100% { transform: translate(-50%, -100%) translateY(0px); }
          50%       { transform: translate(-50%, -100%) translateY(-5px); }
        }
        @keyframes claim-flash {
          0%   { opacity: 0; transform: translateY(8px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-8px); }
        }
        .char-bob  { animation: char-bob 1.2s ease-in-out infinite; }
        .claim-flash { animation: claim-flash 3s ease-in-out forwards; }
      `}</style>

      <div className="container mx-auto py-6 px-4 max-w-5xl">

        {/* ── Page header ── */}
        <div className="pixel-font mb-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h1 className="text-base sm:text-lg text-primary tracking-wide">CYBAQUESTS</h1>
            <span className="text-[9px] text-zinc-500">
              {completedQuestIds.filter(id => QUESTS.some(q => q.id === id)).length}/{QUESTS.length} COMPLETE
            </span>
          </div>
          <p className="text-[8px] text-zinc-500 mt-1">
            COMPLETE QUESTS · EARN CYBACOIN · BECOME A LEGEND
          </p>
        </div>

        {/* ── Player HUD (logged-in only) ── */}
        {user && (
          <div className="pixel-font grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'POSTS', value: userStats.posts, icon: '📝', color: 'text-blue-400' },
              { label: 'SUPPORT', value: userStats.supportGiven, icon: '🤝', color: 'text-yellow-400' },
              { label: 'COINS EARNED', value: totalCoinsEarned, icon: '💰', color: 'text-green-400' },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-black/70 border border-zinc-800 rounded-lg p-3 text-center"
              >
                <div className="text-lg mb-1">{stat.icon}</div>
                <div className={cn('text-xs font-bold tabular-nums', stat.color)}>
                  {stat.value.toLocaleString()}
                </div>
                <div className="text-[7px] text-zinc-600 mt-1 tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── World progress bars ── */}
        <div className="pixel-font grid grid-cols-3 gap-2 mb-4">
          {([1, 2, 3] as const).map(world => {
            const theme = WORLD_THEMES[world];
            const { completed, total, pct } = getWorldProgress(world, completedQuestIds);
            return (
              <div key={world} className="bg-black/70 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-2 overflow-hidden">
                  <span className="text-sm">{theme.emoji}</span>
                  <span className="text-[7px] text-zinc-400 truncate">{theme.name}</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-none border border-zinc-700 overflow-hidden">
                  <div
                    className="h-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: theme.accent }}
                  />
                </div>
                <div className="text-[7px] text-zinc-500 mt-1">{completed}/{total} quests</div>
              </div>
            );
          })}
        </div>

        {/* ── THE MAP ── */}
        <div
          className="relative w-full rounded-xl overflow-hidden border border-zinc-800"
          style={{ height: 600, background: '#060606' }}
        >
          {/* SVG background + path */}
          <MapBackground />

          {/* World zone labels */}
          {([1, 2, 3] as const).map(world => {
            const theme = WORLD_THEMES[world];
            const labelY = world === 1 ? '89%' : world === 2 ? '57%' : '21%';
            return (
              <div
                key={world}
                className="absolute left-2 pixel-font text-[7px] opacity-40 pointer-events-none"
                style={{ top: labelY, color: theme.accent }}
              >
                {theme.emoji} {theme.name}
              </div>
            );
          })}

          {/* Quest nodes */}
          {QUESTS.map(quest => {
            const status = getQuestStatus(quest, completedQuestIds, userStats);
            return (
              <QuestNode
                key={quest.id}
                quest={quest}
                status={status}
                isSelected={quest.id === selectedQuestId}
                onClick={() => {
                  if (status === 'locked') { sfxLocked(); return; }
                  const isOpening = selectedQuestId !== quest.id;
                  setSelectedQuestId(prev => (prev === quest.id ? null : quest.id));
                  if (isOpening) {
                    sfxQuestSelect();
                    setTimeout(sfxQuestOpen, 80);
                  }
                }}
              />
            );
          })}

          {/* Pixel character */}
          <div
            className="absolute char-bob pointer-events-none"
            style={{
              left: `${characterPos.x}%`,
              top: `${characterPos.y}%`,
              transform: 'translate(-50%, -100%)',
              marginTop: -18,
              zIndex: 15,
            }}
          >
            <PixelCharacter />
          </div>

          {/* Claim success toast */}
          {claimSuccess && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 claim-flash">
              <div className="pixel-font bg-yellow-400 text-yellow-900 text-[9px] px-4 py-2 rounded border-2 border-yellow-300 shadow-xl">
                {claimSuccess}
              </div>
            </div>
          )}

          {/* Not logged in overlay */}
          {!user && !isUserLoading && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-40">
              <div className="pixel-font text-center px-8 py-10">
                <div className="text-5xl mb-4">🎮</div>
                <p className="text-sm text-white mb-2">INSERT COIN</p>
                <p className="text-[9px] text-zinc-400 mb-6 leading-relaxed">
                  Sign in to start your quest
                  <br />and track your progress
                </p>
                <div className="flex gap-3 justify-center">
                  <Link href="/login">
                    <Button size="sm" className="pixel-font text-[8px] h-9">SIGN IN</Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" variant="outline" className="pixel-font text-[8px] h-9">
                      SIGN UP
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Quest detail panel */}
          <QuestPanel
            quest={selectedQuest}
            status={selectedStatus}
            progress={selectedProgress}
            onClose={() => setSelectedQuestId(null)}
            onClaim={handleClaim}
            isClaiming={isClaiming}
          />
        </div>

        {/* ── Legend ── */}
        <div className="pixel-font mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[7px] text-zinc-500">
          {[
            { icon: '🔒', label: 'LOCKED' },
            { icon: '○', label: 'AVAILABLE', color: 'text-primary' },
            { icon: '►', label: 'IN PROGRESS', color: 'text-yellow-500' },
            { icon: '★', label: 'CLAIMABLE', color: 'text-yellow-400' },
            { icon: '✓', label: 'COMPLETED', color: 'text-green-500' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <span className={item.color ?? ''}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

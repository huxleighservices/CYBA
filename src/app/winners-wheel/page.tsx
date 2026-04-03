'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import {
  WHEEL_PRIZES,
  BOOST_INFO,
  DEFAULT_INVENTORY,
  canSpinDaily,
  nextSpinAt,
  randomPrizeIndex,
  type WheelPrize,
  type BoostType,
  type UserInventory,
} from '@/lib/wheel';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { sfxWheelSpin, sfxWheelStop, sfxWinCoins, sfxWinBig, sfxBoostActivate } from '@/lib/sfx';

// ─────────────────────────────────────────────
//  SVG WHEEL
// ─────────────────────────────────────────────
const W = 300;
const CX = W / 2;
const CY = W / 2;
const R = W / 2 - 14;
const LABEL_R = R * 0.63;
const N = WHEEL_PRIZES.length;

function segPath(i: number): string {
  const a0 = (i / N) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
  const x1 = (CX + R * Math.cos(a0)).toFixed(2);
  const y1 = (CY + R * Math.sin(a0)).toFixed(2);
  const x2 = (CX + R * Math.cos(a1)).toFixed(2);
  const y2 = (CY + R * Math.sin(a1)).toFixed(2);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

function labelTransform(i: number): string {
  const mid = ((i + 0.5) / N) * 2 * Math.PI - Math.PI / 2;
  const lx = (CX + LABEL_R * Math.cos(mid)).toFixed(2);
  const ly = (CY + LABEL_R * Math.sin(mid)).toFixed(2);
  const deg = ((i + 0.5) / N) * 360;
  return `translate(${lx},${ly}) rotate(${deg})`;
}

function SpinWheel({
  angle,
  spinning,
  onTransitionEnd,
}: {
  angle: number;
  spinning: boolean;
  onTransitionEnd: () => void;
}) {
  const studs = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const sr = W / 2 + 8;
    return { cx: CX + sr * Math.cos(a), cy: CY + sr * Math.sin(a) };
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: W + 40, height: W + 40 }}>
      {/* Outer decorative ring */}
      <svg
        width={W + 36}
        height={W + 36}
        viewBox={`0 0 ${W + 36} ${W + 36}`}
        className="absolute inset-0 pointer-events-none"
      >
        <circle
          cx={(W + 36) / 2}
          cy={(W + 36) / 2}
          r={(W + 36) / 2 - 4}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2.5"
          strokeDasharray="6 3"
          opacity="0.6"
        />
        {studs.map((s, i) => (
          <rect
            key={i}
            x={s.cx + 36 / 2 - 3}
            y={s.cy + 36 / 2 - 3}
            width="6"
            height="6"
            rx="1"
            fill={i % 2 === 0 ? '#fbbf24' : '#d97706'}
            opacity="0.85"
          />
        ))}
      </svg>

      {/* Fixed pointer arrow */}
      <div className="absolute pointer-events-none" style={{ top: 2, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <svg width="22" height="18" viewBox="0 0 22 18">
          <polygon points="11,18 0,0 22,0" fill="#fbbf24" />
          <polygon points="11,14 3,2 19,2" fill="#92400e" opacity="0.4" />
        </svg>
      </div>

      {/* Spinning wheel */}
      <svg
        width={W}
        height={W}
        viewBox={`0 0 ${W} ${W}`}
        style={{
          transform: `rotate(${angle}deg)`,
          transition: spinning
            ? 'transform 4.5s cubic-bezier(0.05, 0.85, 0.15, 1)'
            : 'none',
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {/* Segments */}
        {WHEEL_PRIZES.map((prize, i) => (
          <path key={prize.id} d={segPath(i)} fill={prize.color} stroke="#000" strokeWidth="1.5" />
        ))}

        {/* Segment dividers */}
        {WHEEL_PRIZES.map((_, i) => {
          const a = (i / N) * 2 * Math.PI - Math.PI / 2;
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={(CX + R * Math.cos(a)).toFixed(2)}
              y2={(CY + R * Math.sin(a)).toFixed(2)}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Labels */}
        {WHEEL_PRIZES.map((prize, i) => (
          <g key={`lbl-${prize.id}`} transform={labelTransform(i)}>
            <text textAnchor="middle" dominantBaseline="auto" fontSize="15" y="-5">
              {prize.emoji}
            </text>
            <text
              textAnchor="middle"
              dominantBaseline="hanging"
              fontSize="8"
              fontFamily="'Press Start 2P', monospace"
              fill={prize.textColor}
              y="7"
            >
              {prize.label}
            </text>
          </g>
        ))}

        {/* Hub */}
        <circle cx={CX} cy={CY} r={22} fill="#0a0a0a" stroke="#fbbf24" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={16} fill="#111" />
        <circle cx={CX} cy={CY} r={5} fill="#fbbf24" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
//  COUNTDOWN TIMER
// ─────────────────────────────────────────────
function Countdown({ until }: { until: number }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, until - Date.now());
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  return (
    <div className="pixel-font text-center">
      <p className="text-[8px] text-zinc-500 mb-1 tracking-widest">NEXT FREE SPIN IN</p>
      <p className="text-2xl text-primary tabular-nums tracking-wider">{display}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
//  PRIZE MODAL
// ─────────────────────────────────────────────
function PrizeModal({ prize, onClose }: { prize: WheelPrize | null; onClose: () => void }) {
  if (!prize) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="pixel-font bg-black border-2 border-yellow-400 rounded-xl p-8 w-full max-w-xs text-center shadow-[0_0_40px_rgba(234,179,8,0.3)]">
        <div className="text-6xl mb-4 animate-bounce">{prize.emoji}</div>
        <p className="text-[8px] text-yellow-400 tracking-widest mb-3">★ YOU WON ★</p>
        <h2 className="text-[11px] text-white leading-relaxed mb-4">{prize.description}</h2>

        {prize.type === 'coins' && (
          <div className="flex items-center justify-center gap-2 my-3 bg-yellow-950/50 border border-yellow-800 rounded-lg p-3">
            <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={22} height={22} />
            <span className="text-sm text-yellow-300 font-bold">+{prize.value} CYBACOIN</span>
          </div>
        )}
        {(prize.type === 'multiplier' || prize.type === 'sponsored_post' || prize.type === 'sponsored_profile') && (
          <div className="my-3 bg-purple-950/50 border border-purple-800 rounded-lg p-3">
            <p className="text-[8px] text-purple-300">ADDED TO YOUR INVENTORY</p>
          </div>
        )}
        {prize.type === 'bonus_spin' && (
          <div className="my-3 bg-green-950/50 border border-green-800 rounded-lg p-3">
            <p className="text-[8px] text-green-300">BONUS SPIN ADDED!</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-2 w-full bg-yellow-400 hover:bg-yellow-300 text-black text-[9px] py-3 rounded border-2 border-yellow-300 transition-all"
        >
          AWESOME! ★
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  INVENTORY CARD
// ─────────────────────────────────────────────
function InventoryCard({
  boostType,
  slot,
  onActivate,
}: {
  boostType: BoostType;
  slot: { quantity: number; expiresAt?: number };
  onActivate: () => void;
}) {
  const info = BOOST_INFO[boostType];
  const has = slot.quantity > 0;
  const isExpired = slot.expiresAt ? slot.expiresAt < Date.now() : false;
  const isActive = slot.expiresAt && slot.expiresAt > Date.now();

  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      const ms = Math.max(0, slot.expiresAt! - Date.now());
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, slot.expiresAt]);

  return (
    <div
      className={cn(
        'pixel-font border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200',
        isActive
          ? 'border-yellow-500 bg-yellow-950/20 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
          : has
          ? 'border-primary/50 bg-primary/5'
          : 'border-zinc-800 bg-zinc-950 opacity-50',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0">{info.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-white leading-snug mb-1">{info.label}</p>
          <p className="text-[7px] text-zinc-500 leading-relaxed">{info.description}</p>
        </div>
        <span
          className={cn(
            'shrink-0 text-[8px] px-2 py-1 rounded border',
            isActive
              ? 'border-yellow-500 text-yellow-400 bg-yellow-950/60'
              : has
              ? 'border-green-600 text-green-400 bg-green-950/60'
              : 'border-zinc-700 text-zinc-600 bg-zinc-900',
          )}
        >
          {isActive ? 'ACTIVE' : has ? 'x1' : 'EMPTY'}
        </span>
      </div>

      {/* Active countdown */}
      {isActive && (
        <div className="flex items-center gap-2 bg-yellow-950/40 border border-yellow-900 rounded-lg px-3 py-2">
          <span className="text-yellow-400 text-[8px]">⏱</span>
          <span className="text-yellow-300 text-[8px] tabular-nums">{timeLeft} remaining</span>
        </div>
      )}

      {/* Activate button */}
      {has && !isActive && !isExpired && (
        <button
          onClick={onActivate}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-[8px] py-2.5 rounded border border-primary/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          ► {info.activateLabel}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────
interface UserWheelData {
  lastWheelSpin?: number;
  bonusSpinsAvailable?: number;
  inventory?: Partial<UserInventory>;
  cybaCoinBalance?: number;
}

export default function WinnersWheelPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<WheelPrize | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Capture spin context so the transition callback is always fresh
  const pendingRef = useRef<{
    prize: WheelPrize;
    usedBonus: boolean;
    inventorySnapshot: Partial<UserInventory>;
  } | null>(null);
  const sfxStopRef = useRef<(() => void) | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc<UserWheelData>(userDocRef);

  useEffect(() => { setInitialized(true); }, []);

  const inventory: UserInventory = {
    ...DEFAULT_INVENTORY,
    ...(userData?.inventory ?? {}),
  };

  const lastSpin = userData?.lastWheelSpin ?? null;
  const bonusSpins = userData?.bonusSpinsAvailable ?? 0;
  const dailyAvailable = canSpinDaily(lastSpin);
  const canSpin = (dailyAvailable || bonusSpins > 0) && !spinning;

  // ── Spin ──
  const handleSpin = () => {
    if (!user || !canSpin) return;

    const idx = randomPrizeIndex();
    const prize = WHEEL_PRIZES[idx];
    const usedBonus = !dailyAvailable && bonusSpins > 0;

    // Snapshot inventory at spin time for conflict resolution
    pendingRef.current = {
      prize,
      usedBonus,
      inventorySnapshot: { ...inventory },
    };

    // Compute landing angle
    const segDeg = 360 / N;
    const targetNorm = ((360 - (idx + 0.5) * segDeg) % 360 + 360) % 360;
    const currentNorm = ((spinAngle % 360) + 360) % 360;
    let delta = targetNorm - currentNorm;
    if (delta < 0) delta += 360;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    setSpinAngle(spinAngle + delta + 360 * fullSpins);
    setSpinning(true);
    sfxStopRef.current = sfxWheelSpin(4.5);
  };

  // ── After wheel stops ──
  const handleTransitionEnd = useCallback(async () => {
    const ctx = pendingRef.current;
    if (!ctx || !user) return;
    pendingRef.current = null;

    const { prize, usedBonus, inventorySnapshot } = ctx;
    const updates: Record<string, unknown> = {};

    // Deduct spin token
    if (usedBonus) {
      updates.bonusSpinsAvailable = increment(-1);
    } else {
      updates.lastWheelSpin = Date.now();
    }

    // Apply prize
    if (prize.type === 'coins') {
      updates.cybaCoinBalance = increment(prize.value!);
    } else if (prize.type === 'bonus_spin') {
      updates.bonusSpinsAvailable = increment(1);
    } else if (prize.type === 'multiplier') {
      const key: BoostType = prize.value === 2 ? 'multiplier_2x' : 'multiplier_3x';
      const alreadyHas = (inventorySnapshot[key]?.quantity ?? 0) > 0;
      if (alreadyHas) {
        // Consolation: give 10 coins instead
        updates.cybaCoinBalance = increment(10);
      } else {
        updates[`inventory.${key}.quantity`] = 1;
      }
    } else if (prize.type === 'sponsored_post') {
      const alreadyHas = (inventorySnapshot.sponsored_post?.quantity ?? 0) > 0;
      if (alreadyHas) {
        updates.cybaCoinBalance = increment(10);
      } else {
        updates['inventory.sponsored_post.quantity'] = 1;
      }
    } else if (prize.type === 'sponsored_profile') {
      const alreadyHas = (inventorySnapshot.sponsored_profile?.quantity ?? 0) > 0;
      if (alreadyHas) {
        updates.cybaCoinBalance = increment(10);
      } else {
        updates['inventory.sponsored_profile.quantity'] = 1;
      }
    }

    try {
      await updateDoc(doc(firestore, 'users', user.uid), updates);
    } catch (e) {
      console.error('Wheel update failed:', e);
    }

    sfxStopRef.current?.();
    sfxStopRef.current = null;
    sfxWheelStop();

    // Play win sound after brief pause
    setTimeout(() => {
      if (prize.type === 'coins' && (prize.value ?? 0) <= 20) {
        sfxWinCoins();
      } else {
        sfxWinBig();
      }
    }, 300);

    setSpinning(false);
    setWonPrize(prize);
  }, [user, firestore]);

  // ── Activate boost ──
  const handleActivate = async (boostType: BoostType) => {
    if (!user) return;
    sfxBoostActivate();
    const updates: Record<string, unknown> = {
      [`inventory.${boostType}.quantity`]: 0,
    };
    if (boostType === 'multiplier_2x' || boostType === 'multiplier_3x') {
      const rate = boostType === 'multiplier_2x' ? 2 : 3;
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      updates[`inventory.${boostType}.expiresAt`] = expiresAt;
      updates['activeMultiplier'] = { rate, expiresAt };
    } else if (boostType === 'sponsored_post') {
      updates['sponsoredPost'] = true;
    } else if (boostType === 'sponsored_profile') {
      updates['sponsoredProfile'] = true;
    }
    await updateDoc(doc(firestore, 'users', user.uid), updates);
  };

  const hasAnyInventory = Object.values(inventory).some(s => s.quantity > 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .pixel-font { font-family: 'Press Start 2P', 'Courier New', monospace; }
        @keyframes spin-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(234,179,8,0.4); }
          50%       { box-shadow: 0 0 40px rgba(234,179,8,0.8); }
        }
        .spin-btn-idle { animation: spin-glow 2s ease-in-out infinite; }
      `}</style>

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {/* Header */}
        <div className="pixel-font mb-6">
          <h1 className="text-base sm:text-lg text-primary mb-1">WINNER&apos;S WHEEL</h1>
          <p className="text-[8px] text-zinc-500">SPIN ONCE DAILY · WIN PRIZES · BUILD YOUR ARSENAL</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ── LEFT: Wheel ── */}
          <div className="flex flex-col items-center gap-5 mx-auto lg:mx-0 shrink-0">
            <SpinWheel angle={spinAngle} spinning={spinning} onTransitionEnd={handleTransitionEnd} />

            {/* Controls */}
            {!user && initialized && !isUserLoading && (
              <div className="pixel-font text-center">
                <p className="text-[8px] text-zinc-500 mb-3">SIGN IN TO SPIN</p>
                <div className="flex gap-3">
                  <Link href="/login">
                    <Button size="sm" className="pixel-font text-[8px]">SIGN IN</Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" variant="outline" className="pixel-font text-[8px]">SIGN UP</Button>
                  </Link>
                </div>
              </div>
            )}

            {user && canSpin && (
              <div className="text-center space-y-2">
                <button
                  onClick={handleSpin}
                  className="pixel-font spin-btn-idle bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-black text-[10px] px-8 py-4 rounded-xl border-2 border-yellow-300 transition-all hover:scale-105 active:scale-95"
                >
                  ★ SPIN THE WHEEL ★
                </button>
                {!dailyAvailable && bonusSpins > 0 && (
                  <p className="text-[7px] text-yellow-400">
                    USING BONUS SPIN ({bonusSpins} LEFT)
                  </p>
                )}
                {dailyAvailable && bonusSpins > 0 && (
                  <p className="text-[7px] text-green-400">
                    +{bonusSpins} BONUS SPIN{bonusSpins > 1 ? 'S' : ''} AVAILABLE AFTER
                  </p>
                )}
              </div>
            )}

            {user && spinning && (
              <p className="pixel-font text-[8px] text-zinc-400 animate-pulse">SPINNING...</p>
            )}

            {user && !canSpin && !spinning && lastSpin && (
              <Countdown until={nextSpinAt(lastSpin)} />
            )}

            {/* Prize legend */}
            <div className="w-full max-w-[300px] pixel-font">
              <p className="text-[7px] text-zinc-600 mb-2 text-center tracking-widest">PRIZE TABLE</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {WHEEL_PRIZES.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 text-[7px]">
                    <span className="text-sm">{p.emoji}</span>
                    <span style={{ color: p.textColor }}>{p.description.split('\n')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Inventory ── */}
          <div className="flex-1 w-full min-w-0">
            <div className="pixel-font flex items-baseline justify-between mb-4">
              <h2 className="text-[10px] text-primary">YOUR INVENTORY</h2>
              <span className="text-[7px] text-zinc-600">MAX 1 PER SLOT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {(Object.keys(BOOST_INFO) as BoostType[]).map(bt => (
                <InventoryCard
                  key={bt}
                  boostType={bt}
                  slot={inventory[bt] ?? { quantity: 0 }}
                  onActivate={() => handleActivate(bt)}
                />
              ))}
            </div>

            {/* Rules */}
            <div className="pixel-font p-4 border border-zinc-800 rounded-xl bg-black/40 mb-4">
              <p className="text-[8px] text-zinc-500 mb-3 tracking-widest">RULES</p>
              <ul className="space-y-2 text-[7px] text-zinc-600 leading-loose">
                <li>► Free spin resets every 24 hours.</li>
                <li>► Each inventory slot holds a maximum of 1 boost.</li>
                <li>► Winning a boost you already own awards 10 CYBACOIN instead.</li>
                <li>► Multipliers start the moment you activate them and last 24 hours.</li>
                <li>► Sponsored boosts apply to your next eligible post or profile.</li>
                <li>► Bonus spins carry over — they don&apos;t expire.</li>
              </ul>
            </div>

            {/* CYBACOIN balance */}
            {user && (
              <div className="pixel-font flex items-center gap-3 p-4 border border-zinc-800 rounded-xl bg-black/40">
                <Image src="/CCoin.png?v=2" alt="CYBACOIN" width={24} height={24} />
                <div>
                  <p className="text-[7px] text-zinc-500 mb-0.5">CYBACOIN BALANCE</p>
                  <p className="text-base text-yellow-400 font-bold tabular-nums">
                    {(userData?.cybaCoinBalance ?? 0).toLocaleString()}
                  </p>
                </div>
                {bonusSpins > 0 && (
                  <div className="ml-auto text-center">
                    <p className="text-[7px] text-zinc-500 mb-0.5">BONUS SPINS</p>
                    <p className="text-base text-green-400 font-bold">{bonusSpins}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prize result modal */}
      <PrizeModal prize={wonPrize} onClose={() => setWonPrize(null)} />
    </>
  );
}

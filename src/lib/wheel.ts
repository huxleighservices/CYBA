export type PrizeType = 'coins' | 'multiplier' | 'bonus_spin' | 'free_quest_entry' | 'spotlight_boost_24h';
export type BoostType = 'multiplier_2x' | 'multiplier_3x' | 'spotlight_boost_24h';

export interface WheelPrize {
  id: string;
  type: PrizeType;
  label: string;       // short text shown on the wheel segment
  description: string; // full prize description
  emoji: string;
  value?: number;      // coin amount or multiplier rate
  color: string;       // segment fill color
  textColor: string;   // label text color
  /** Relative selection weight — higher = more common. Used by weightedRandomPrizeIndex(). */
  weight: number;
}

// CYBAWHEEL — 10 segments in the exact order/rarity spec'd: 3x Multiplier, the 5,000 CC
// jackpot, and the 24hr Spotlight Boost are the three "Rare" wedges with the lowest weights.
export const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: 'coins_500',
    type: 'coins',
    label: '500',
    description: '500 CYBACOIN',
    emoji: '🪙',
    value: 500,
    color: '#78350f',
    textColor: '#fcd34d',
    weight: 20,
  },
  {
    id: 'free_quest_entry',
    type: 'free_quest_entry',
    label: 'QUEST',
    description: 'Free CYBAQUEST Entry',
    emoji: '🗺️',
    color: '#14532d',
    textColor: '#86efac',
    weight: 15,
  },
  {
    id: 'coins_1000_a',
    type: 'coins',
    label: '1,000',
    description: '1,000 CYBACOIN',
    emoji: '🏆',
    value: 1000,
    color: '#7c2d12',
    textColor: '#fed7aa',
    weight: 15,
  },
  {
    id: 'spotlight_boost_24h',
    type: 'spotlight_boost_24h',
    label: 'SPOTLIGHT',
    description: '24hr Spotlight Boost',
    emoji: '🌟',
    color: '#1e1b4b',
    textColor: '#a5b4fc',
    weight: 3,
  },
  {
    id: 'coins_2500',
    type: 'coins',
    label: '2,500',
    description: '2,500 CYBACOIN',
    emoji: '🪙',
    value: 2500,
    color: '#92400e',
    textColor: '#fde68a',
    weight: 10,
  },
  {
    id: 'mult_3x',
    type: 'multiplier',
    label: '3x',
    description: '3x CYBACOIN Multiplier (24 hrs)',
    emoji: '💫',
    value: 3,
    color: '#3b0764',
    textColor: '#e9d5ff',
    weight: 2,
  },
  {
    id: 'coins_1000_b',
    type: 'coins',
    label: '1,000',
    description: '1,000 CYBACOIN',
    emoji: '🏆',
    value: 1000,
    color: '#713f12',
    textColor: '#fef08a',
    weight: 15,
  },
  {
    id: 'mult_2x',
    type: 'multiplier',
    label: '2x',
    description: 'Double CYBACOIN (24 hrs)',
    emoji: '⚡',
    value: 2,
    color: '#4c1d95',
    textColor: '#c4b5fd',
    weight: 15,
  },
  {
    id: 'coins_5000',
    type: 'coins',
    label: '5,000',
    description: '5,000 CYBACOIN — Jackpot!',
    emoji: '💎',
    value: 5000,
    color: '#7f1d1d',
    textColor: '#fca5a5',
    weight: 1,
  },
  {
    id: 'bonus_spin',
    type: 'bonus_spin',
    label: 'BONUS!',
    description: 'Bonus Free Spin!',
    emoji: '🎰',
    color: '#1e3a8a',
    textColor: '#93c5fd',
    weight: 4,
  },
];

export interface InventorySlot {
  quantity: number;          // 0 or 1
  expiresAt?: number;        // ms timestamp (multipliers only)
}

export interface UserInventory {
  multiplier_2x: InventorySlot;
  multiplier_3x: InventorySlot;
  spotlight_boost_24h: InventorySlot;
  free_quest_entry: InventorySlot;
}

export const DEFAULT_INVENTORY: UserInventory = {
  multiplier_2x: { quantity: 0 },
  multiplier_3x: { quantity: 0 },
  spotlight_boost_24h: { quantity: 0 },
  free_quest_entry: { quantity: 0 },
};

export const BOOST_INFO: Record<BoostType, {
  label: string;
  description: string;
  emoji: string;
  activateLabel: string;
}> = {
  multiplier_2x: {
    label: '2x CYBACOIN Multiplier',
    description: 'Doubles your CYBACOIN earnings for 24 hours.',
    emoji: '⚡',
    activateLabel: 'ACTIVATE 2x BOOST',
  },
  multiplier_3x: {
    label: '3x CYBACOIN Multiplier',
    description: 'Triples your CYBACOIN earnings for 24 hours.',
    emoji: '💫',
    activateLabel: 'ACTIVATE 3x BOOST',
  },
  spotlight_boost_24h: {
    label: '24hr Spotlight Boost',
    description: 'Glows your posts for 24 hours, like the weekly Spotlight Boost subscription.',
    emoji: '🌟',
    activateLabel: 'ACTIVATE 24HR SPOTLIGHT',
  },
};

export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours — kept for the nextSpinAt display estimate below

/** @deprecated CYBAWHEEL eligibility is now purely calendar-day-based (see canSpinToday) —
 *  kept only so any stale callers don't break; no longer used by the spin page itself. */
export function canSpinDaily(lastSpinMs: number | null | undefined): boolean {
  if (!lastSpinMs) return true;
  return Date.now() - lastSpinMs >= SPIN_COOLDOWN_MS;
}

/** One spin per calendar day (not a rolling 24h window) — resets at local midnight. */
export function canSpinToday(lastSpinMs: number | null | undefined): boolean {
  if (!lastSpinMs) return true;
  const last = new Date(lastSpinMs);
  const now = new Date();
  return last.getFullYear() !== now.getFullYear()
    || last.getMonth() !== now.getMonth()
    || last.getDate() !== now.getDate();
}

export function nextSpinAt(lastSpinMs: number): number {
  return lastSpinMs + SPIN_COOLDOWN_MS;
}

/** Uniform-random selection — kept for compatibility, but the wheel uses the weighted
 *  version below so rare prizes (jackpot, 3x multiplier, spotlight boosts) land less often. */
export function randomPrizeIndex(): number {
  return Math.floor(Math.random() * WHEEL_PRIZES.length);
}

export function weightedRandomPrizeIndex(): number {
  const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    roll -= WHEEL_PRIZES[i].weight;
    if (roll <= 0) return i;
  }
  return WHEEL_PRIZES.length - 1;
}

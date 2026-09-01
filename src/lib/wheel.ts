export type PrizeType = 'coins' | 'multiplier' | 'sponsored_post' | 'sponsored_profile' | 'bonus_spin';
export type BoostType = 'multiplier_2x' | 'multiplier_3x' | 'sponsored_post' | 'sponsored_profile';

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

// 10 segments, weighted so small CC payouts are common and the big prizes (3x Multiplier,
// 5,000 CC jackpot, Spotlight boosts) are rare.
export const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: 'coins_10',
    type: 'coins',
    label: '10',
    description: '10 CYBACOIN',
    emoji: '🪙',
    value: 10,
    color: '#78350f',
    textColor: '#fcd34d',
    weight: 22,
  },
  {
    id: 'coins_25',
    type: 'coins',
    label: '25',
    description: '25 CYBACOIN',
    emoji: '🪙',
    value: 25,
    color: '#92400e',
    textColor: '#fde68a',
    weight: 18,
  },
  {
    id: 'mult_2x',
    type: 'multiplier',
    label: '2x',
    description: '2x CybaCoin Multiplier (24 hrs)',
    emoji: '⚡',
    value: 2,
    color: '#4c1d95',
    textColor: '#c4b5fd',
    weight: 15,
  },
  {
    id: 'coins_50',
    type: 'coins',
    label: '50',
    description: '50 CYBACOIN',
    emoji: '🪙',
    value: 50,
    color: '#713f12',
    textColor: '#fef08a',
    weight: 14,
  },
  {
    id: 'bonus_spin',
    type: 'bonus_spin',
    label: 'BONUS!',
    description: 'Bonus Free Spin!',
    emoji: '🎰',
    color: '#14532d',
    textColor: '#86efac',
    weight: 12,
  },
  {
    id: 'coins_100',
    type: 'coins',
    label: '100',
    description: '100 CYBACOIN',
    emoji: '🏆',
    value: 100,
    color: '#7c2d12',
    textColor: '#fed7aa',
    weight: 9,
  },
  {
    id: 'sponsored_post',
    type: 'sponsored_post',
    label: 'POST',
    description: 'Spotlight Post on Global Feed',
    emoji: '📢',
    color: '#1e3a8a',
    textColor: '#93c5fd',
    weight: 5,
  },
  {
    id: 'sponsored_profile',
    type: 'sponsored_profile',
    label: 'PROFILE',
    description: 'Spotlight Profile on Global Feed',
    emoji: '🌟',
    color: '#1e1b4b',
    textColor: '#a5b4fc',
    weight: 3,
  },
  {
    id: 'mult_3x',
    type: 'multiplier',
    label: '3x',
    description: '3x CybaCoin Multiplier (24 hrs)',
    emoji: '💫',
    value: 3,
    color: '#3b0764',
    textColor: '#e9d5ff',
    weight: 2,
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
];

export interface InventorySlot {
  quantity: number;          // 0 or 1
  expiresAt?: number;        // ms timestamp (multipliers only)
}

export interface UserInventory {
  multiplier_2x: InventorySlot;
  multiplier_3x: InventorySlot;
  sponsored_post: InventorySlot;
  sponsored_profile: InventorySlot;
}

export const DEFAULT_INVENTORY: UserInventory = {
  multiplier_2x: { quantity: 0 },
  multiplier_3x: { quantity: 0 },
  sponsored_post: { quantity: 0 },
  sponsored_profile: { quantity: 0 },
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
  sponsored_post: {
    label: 'Spotlight Post',
    description: 'Pins your next post to the top of the Global Feed.',
    emoji: '📢',
    activateLabel: 'ACTIVATE SPOTLIGHT POST',
  },
  sponsored_profile: {
    label: 'Spotlight Profile',
    description: 'Features your profile at the top of the Global Feed.',
    emoji: '🌟',
    activateLabel: 'ACTIVATE SPOTLIGHT PROFILE',
  },
};

export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export function canSpinDaily(lastSpinMs: number | null | undefined): boolean {
  if (!lastSpinMs) return true;
  return Date.now() - lastSpinMs >= SPIN_COOLDOWN_MS;
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

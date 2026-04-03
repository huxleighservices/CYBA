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
}

// 10 segments, alternating coins ↔ boosts for visual variety
export const WHEEL_PRIZES: WheelPrize[] = [
  {
    id: 'coins_5',
    type: 'coins',
    label: '5',
    description: '5 CYBACOIN',
    emoji: '🪙',
    value: 5,
    color: '#78350f',
    textColor: '#fcd34d',
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
  },
  {
    id: 'coins_10',
    type: 'coins',
    label: '10',
    description: '10 CYBACOIN',
    emoji: '🪙',
    value: 10,
    color: '#92400e',
    textColor: '#fde68a',
  },
  {
    id: 'sponsored_post',
    type: 'sponsored_post',
    label: 'POST',
    description: 'Sponsored Post on Global Feed',
    emoji: '📢',
    color: '#1e3a8a',
    textColor: '#93c5fd',
  },
  {
    id: 'coins_15',
    type: 'coins',
    label: '15',
    description: '15 CYBACOIN',
    emoji: '🪙',
    value: 15,
    color: '#713f12',
    textColor: '#fef08a',
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
  },
  {
    id: 'coins_20',
    type: 'coins',
    label: '20',
    description: '20 CYBACOIN',
    emoji: '🪙',
    value: 20,
    color: '#7c2d12',
    textColor: '#fed7aa',
  },
  {
    id: 'sponsored_profile',
    type: 'sponsored_profile',
    label: 'PROFILE',
    description: 'Sponsored Profile on Global Feed',
    emoji: '🌟',
    color: '#1e1b4b',
    textColor: '#a5b4fc',
  },
  {
    id: 'coins_30',
    type: 'coins',
    label: '30',
    description: '30 CYBACOIN',
    emoji: '🏆',
    value: 30,
    color: '#7f1d1d',
    textColor: '#fca5a5',
  },
  {
    id: 'bonus_spin',
    type: 'bonus_spin',
    label: 'BONUS!',
    description: 'Bonus Free Spin!',
    emoji: '🎰',
    color: '#14532d',
    textColor: '#86efac',
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
    label: 'Sponsored Post',
    description: 'Pins your next post to the top of the Global Feed.',
    emoji: '📢',
    activateLabel: 'ACTIVATE SPONSORED POST',
  },
  sponsored_profile: {
    label: 'Sponsored Profile',
    description: 'Features your profile at the top of the Global Feed.',
    emoji: '🌟',
    activateLabel: 'ACTIVATE SPONSORED PROFILE',
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

export function randomPrizeIndex(): number {
  return Math.floor(Math.random() * WHEEL_PRIZES.length);
}

import type { Level } from './levels';

export type UnlockType = 'free' | 'coins' | 'level' | 'coins_and_level';

export interface ProfileBackground {
  id: string;
  name: string;
  description: string;
  emoji: string;
  unlockType: UnlockType;
  coinCost?: number;
  requiredLevel?: Level;
  /** React inline style object for the hero div */
  style: React.CSSProperties;
  /** Simple gradient string for the small picker swatch */
  preview: string;
}

export const PROFILE_BACKGROUNDS: ProfileBackground[] = [
  // ── FREE ───────────────────────────────────────────────────────────────────
  {
    id: 'default',
    name: 'Violet Grid',
    description: 'The classic CYBAZONE look.',
    emoji: '🟣',
    unlockType: 'free',
    style: {
      backgroundColor: '#1a0033',
      backgroundImage: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 35%, #1e0050 65%, #0d0020 100%)',
    },
    preview: 'linear-gradient(135deg,#6d28d9,#4c1d95,#0d0020)',
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep space midnight vibes.',
    emoji: '🌌',
    unlockType: 'free',
    style: {
      backgroundColor: '#0a0a2e',
      backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 40%, #1e1b4b 70%, #0f0a2e 100%)',
    },
    preview: 'linear-gradient(135deg,#1e3a8a,#312e81,#0f0a2e)',
  },
  {
    id: 'carbon',
    name: 'Carbon Black',
    description: 'Sleek carbon fiber aesthetic.',
    emoji: '⬛',
    unlockType: 'free',
    style: {
      backgroundColor: '#111',
      backgroundImage:
        'repeating-linear-gradient(45deg, #222 0px, #222 2px, transparent 2px, transparent 10px), repeating-linear-gradient(-45deg, #222 0px, #222 2px, transparent 2px, transparent 10px)',
    },
    preview: 'repeating-linear-gradient(45deg,#111 0,#222 4px,#111 4px,#111 10px)',
  },
  {
    id: 'forest_night',
    name: 'Forest Night',
    description: 'Dark emerald woods at midnight.',
    emoji: '🌲',
    unlockType: 'free',
    style: {
      backgroundColor: '#052e16',
      backgroundImage:
        'radial-gradient(ellipse at 25% 75%, #16a34a 0%, #166534 30%, transparent 60%), radial-gradient(ellipse at 75% 25%, #15803d 0%, #14532d 30%, transparent 55%), linear-gradient(160deg, #052e16 0%, #064e24 50%, #052e16 100%)',
    },
    preview: 'linear-gradient(160deg,#052e16,#16a34a,#052e16)',
  },
  {
    id: 'crimson_dusk',
    name: 'Crimson Dusk',
    description: 'Blood-red horizon at sundown.',
    emoji: '🌅',
    unlockType: 'free',
    style: {
      backgroundColor: '#450a0a',
      backgroundImage:
        'radial-gradient(ellipse at 50% 90%, #ef4444 0%, #b91c1c 25%, transparent 60%), linear-gradient(180deg, #1c0505 0%, #450a0a 40%, #7f1d1d 70%, #450a0a 100%)',
    },
    preview: 'linear-gradient(180deg,#1c0505,#7f1d1d,#450a0a)',
  },
  {
    id: 'steel_grid',
    name: 'Steel Grid',
    description: 'Industrial metal plate vibes.',
    emoji: '🔩',
    unlockType: 'free',
    style: {
      backgroundColor: '#1e293b',
      backgroundImage:
        'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      backgroundSize: '40px 40px, 40px 40px, 100% 100%',
    },
    preview: 'linear-gradient(135deg,#0f172a,#1e293b,#0f172a)',
  },
  {
    id: 'cyber_teal',
    name: 'Cyber Teal',
    description: 'Hacker terminal green.',
    emoji: '💻',
    unlockType: 'free',
    style: {
      backgroundColor: '#022c22',
      backgroundImage:
        'repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(16,185,129,0.12) 38px, rgba(16,185,129,0.12) 39px), repeating-linear-gradient(90deg, transparent, transparent 38px, rgba(16,185,129,0.08) 38px, rgba(16,185,129,0.08) 39px), linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
    },
    preview: 'linear-gradient(135deg,#022c22,#065f46,#022c22)',
  },

  // ── COIN PURCHASE (Rewards shop) ──────────────────────────────────────────
  {
    id: 'neon_city',
    name: 'Neon City',
    description: 'Cyberpunk skyline glow.',
    emoji: '🌆',
    unlockType: 'coins',
    coinCost: 150,
    style: {
      backgroundColor: '#0d0221',
      backgroundImage:
        'radial-gradient(ellipse at 20% 80%, #7c3aed 0%, #4c1d95 30%, transparent 55%), radial-gradient(ellipse at 80% 20%, #0891b2 0%, #0e7490 30%, transparent 55%), radial-gradient(ellipse at 50% 50%, #db2777 0%, transparent 40%), linear-gradient(180deg, #0d0221 0%, #1a0533 100%)',
    },
    preview: 'linear-gradient(135deg,#7c3aed,#0891b2,#db2777)',
  },
  {
    id: 'gold_rush',
    name: 'Gold Rush',
    description: 'For the coin collectors.',
    emoji: '💰',
    unlockType: 'coins',
    coinCost: 300,
    style: {
      backgroundColor: '#451a03',
      backgroundImage:
        'radial-gradient(ellipse at 50% 50%, #d97706 0%, #b45309 30%, transparent 60%), linear-gradient(135deg, #1c0a00 0%, #451a03 35%, #92400e 60%, #451a03 80%, #1c0a00 100%)',
    },
    preview: 'linear-gradient(135deg,#1c0a00,#d97706,#451a03)',
  },
  {
    id: 'deep_ocean',
    name: 'Deep Ocean',
    description: 'Abyssal pressure vibes.',
    emoji: '🌊',
    unlockType: 'coins',
    coinCost: 500,
    style: {
      backgroundColor: '#0c2a4a',
      backgroundImage:
        'radial-gradient(ellipse at 20% 80%, #0ea5e9 0%, #0284c7 25%, transparent 55%), radial-gradient(ellipse at 80% 20%, #3b82f6 0%, #1d4ed8 25%, transparent 50%), linear-gradient(180deg, #030d1a 0%, #0c2a4a 50%, #0a1f38 100%)',
    },
    preview: 'linear-gradient(180deg,#030d1a,#0ea5e9,#0c2a4a)',
  },
  {
    id: 'lava',
    name: 'Lava Flow',
    description: 'Molten heat under your feet.',
    emoji: '🌋',
    unlockType: 'coins',
    coinCost: 750,
    style: {
      backgroundColor: '#431407',
      backgroundImage:
        'radial-gradient(ellipse at 50% 90%, #f97316 0%, #ea580c 30%, transparent 60%), radial-gradient(ellipse at 25% 50%, #dc2626 0%, #b91c1c 25%, transparent 50%), linear-gradient(160deg, #1c0500 0%, #431407 35%, #7c2d12 60%, #431407 80%, #1c0500 100%)',
    },
    preview: 'linear-gradient(160deg,#1c0500,#f97316,#431407)',
  },
  {
    id: 'galaxy',
    name: 'Galaxy Brain',
    description: 'Lost in the cosmos.',
    emoji: '🌠',
    unlockType: 'coins',
    coinCost: 1200,
    style: {
      backgroundColor: '#0c0520',
      backgroundImage:
        'radial-gradient(ellipse at 15% 40%, #7c3aed 0%, #5b21b6 30%, transparent 55%), radial-gradient(ellipse at 85% 60%, #1d4ed8 0%, #1e40af 30%, transparent 55%), radial-gradient(ellipse at 50% 20%, #a21caf 0%, #86198f 25%, transparent 45%), linear-gradient(135deg, #060010 0%, #0c0520 100%)',
    },
    preview: 'radial-gradient(ellipse at 30% 50%,#7c3aed,#1d4ed8,#060010)',
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'Northern lights on your profile.',
    emoji: '🌈',
    unlockType: 'coins',
    coinCost: 2000,
    style: {
      backgroundColor: '#022c22',
      backgroundImage:
        'radial-gradient(ellipse at 25% 60%, #10b981 0%, #059669 30%, transparent 55%), radial-gradient(ellipse at 70% 30%, #8b5cf6 0%, #7c3aed 25%, transparent 50%), radial-gradient(ellipse at 50% 80%, #06b6d4 0%, #0891b2 25%, transparent 45%), linear-gradient(160deg, #000d1a 0%, #022c22 50%, #0d001a 100%)',
    },
    preview: 'linear-gradient(160deg,#10b981,#8b5cf6,#06b6d4)',
  },

  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Retro neon sunset vibes.',
    emoji: '🌸',
    unlockType: 'coins',
    coinCost: 400,
    style: {
      backgroundColor: '#1a0030',
      backgroundImage:
        'radial-gradient(ellipse at 50% 100%, #f472b6 0%, #db2777 20%, transparent 55%), radial-gradient(ellipse at 20% 50%, #7c3aed 0%, #6d28d9 25%, transparent 50%), radial-gradient(ellipse at 80% 30%, #06b6d4 0%, #0891b2 20%, transparent 45%), linear-gradient(180deg, #0a0018 0%, #1a0030 50%, #2d0050 100%)',
    },
    preview: 'linear-gradient(135deg,#f472b6,#7c3aed,#06b6d4)',
  },
  {
    id: 'blood_moon',
    name: 'Blood Moon',
    description: 'Lunar crimson in the dark sky.',
    emoji: '🌕',
    unlockType: 'coins',
    coinCost: 800,
    style: {
      backgroundColor: '#1c0000',
      backgroundImage:
        'radial-gradient(circle at 75% 25%, #dc2626 0%, #991b1b 20%, #450a0a 40%, transparent 65%), radial-gradient(ellipse at 30% 80%, #7f1d1d 0%, transparent 45%), linear-gradient(160deg, #000 0%, #1c0000 40%, #3b0000 70%, #1c0000 100%)',
    },
    preview: 'radial-gradient(circle at 70% 30%,#dc2626,#450a0a,#000)',
  },
  {
    id: 'digital_rain',
    name: 'Digital Rain',
    description: 'Enter the matrix.',
    emoji: '🟩',
    unlockType: 'coins',
    coinCost: 1500,
    style: {
      backgroundColor: '#000',
      backgroundImage:
        'repeating-linear-gradient(180deg, transparent 0px, transparent 4px, rgba(0,255,70,0.07) 4px, rgba(0,255,70,0.07) 5px), repeating-linear-gradient(90deg, transparent 0px, transparent 18px, rgba(0,255,70,0.04) 18px, rgba(0,255,70,0.04) 19px), radial-gradient(ellipse at 50% 40%, rgba(0,200,50,0.25) 0%, transparent 55%), linear-gradient(180deg, #000 0%, #001a00 50%, #000 100%)',
    },
    preview: 'linear-gradient(180deg,#000,#003300,#000)',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    description: 'Born from stardust.',
    emoji: '✨',
    unlockType: 'coins',
    coinCost: 2500,
    style: {
      backgroundColor: '#05001a',
      backgroundImage:
        'radial-gradient(ellipse at 20% 50%, #7c3aed 0%, #5b21b6 20%, transparent 45%), radial-gradient(ellipse at 80% 20%, #ec4899 0%, #be185d 20%, transparent 40%), radial-gradient(ellipse at 60% 80%, #f97316 0%, #ea580c 15%, transparent 40%), radial-gradient(ellipse at 40% 30%, #06b6d4 0%, #0891b2 15%, transparent 35%), linear-gradient(135deg, #05001a 0%, #0a0030 100%)',
    },
    preview: 'radial-gradient(ellipse at 30% 40%,#7c3aed,#ec4899,#f97316)',
  },

  // ── LEVEL UNLOCKS ──────────────────────────────────────────────────────────
  {
    id: 'charge_pulse',
    name: 'Charge Pulse',
    description: 'Electric blue for Charge members.',
    emoji: '🔋',
    unlockType: 'level',
    requiredLevel: 'charge',
    style: {
      backgroundColor: '#1e3a8a',
      backgroundImage:
        'repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(59,130,246,0.15) 38px, rgba(59,130,246,0.15) 39px), repeating-linear-gradient(90deg, transparent, transparent 38px, rgba(59,130,246,0.15) 38px, rgba(59,130,246,0.15) 39px), radial-gradient(ellipse at 50% 50%, #3b82f6 0%, #1d4ed8 30%, transparent 65%), linear-gradient(135deg, #0a1628 0%, #1e3a8a 50%, #0a1628 100%)',
    },
    preview: 'linear-gradient(135deg,#0a1628,#3b82f6,#0a1628)',
  },
  {
    id: 'surge_wave',
    name: 'Surge Wave',
    description: 'Purple surge for Surge members.',
    emoji: '🌊',
    unlockType: 'level',
    requiredLevel: 'surge',
    style: {
      backgroundColor: '#3b0764',
      backgroundImage:
        'radial-gradient(ellipse at 30% 70%, #a855f7 0%, #9333ea 25%, transparent 55%), radial-gradient(ellipse at 70% 30%, #7c3aed 0%, #6d28d9 25%, transparent 50%), linear-gradient(135deg, #150025 0%, #3b0764 40%, #5b21b6 65%, #3b0764 85%, #150025 100%)',
    },
    preview: 'linear-gradient(135deg,#150025,#a855f7,#3b0764)',
  },
  {
    id: 'storm_wrath',
    name: "Storm's Wrath",
    description: 'Elite status. Earned, not bought.',
    emoji: '⛈️',
    unlockType: 'level',
    requiredLevel: 'storm',
    style: {
      backgroundColor: '#450a0a',
      backgroundImage:
        'radial-gradient(ellipse at 40% 30%, #ef4444 0%, #b91c1c 25%, transparent 55%), radial-gradient(ellipse at 65% 70%, #f97316 0%, #ea580c 25%, transparent 50%), linear-gradient(140deg, #0a0000 0%, #450a0a 30%, #7f1d1d 55%, #450a0a 75%, #0a0000 100%)',
    },
    preview: 'linear-gradient(140deg,#0a0000,#ef4444,#f97316)',
  },

  // ── COINS + LEVEL ──────────────────────────────────────────────────────────
  {
    id: 'holographic',
    name: 'Holographic',
    description: 'Iridescent flex. Charge + 1,000 coins.',
    emoji: '💎',
    unlockType: 'coins_and_level',
    coinCost: 1000,
    requiredLevel: 'charge',
    style: {
      backgroundColor: '#0d1117',
      backgroundImage:
        'radial-gradient(ellipse at 0% 50%, #06b6d4 0%, transparent 40%), radial-gradient(ellipse at 100% 50%, #ec4899 0%, transparent 40%), radial-gradient(ellipse at 50% 0%, #a855f7 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, #10b981 0%, transparent 45%), linear-gradient(135deg, #0d1117 0%, #1e1b4b 50%, #0d1117 100%)',
    },
    preview: 'linear-gradient(135deg,#06b6d4,#a855f7,#ec4899,#10b981)',
  },
  {
    id: 'void_storm',
    name: 'Void Storm',
    description: 'Absolute power. Storm + 3,000 coins.',
    emoji: '🕳️',
    unlockType: 'coins_and_level',
    coinCost: 3000,
    requiredLevel: 'storm',
    style: {
      backgroundColor: '#030006',
      backgroundImage:
        'radial-gradient(ellipse at 20% 30%, #7c3aed 0%, #5b21b6 20%, transparent 45%), radial-gradient(ellipse at 80% 70%, #db2777 0%, #be185d 20%, transparent 45%), radial-gradient(ellipse at 50% 90%, #1d4ed8 0%, #1e40af 20%, transparent 40%), radial-gradient(ellipse at 50% 50%, #4c1d95 0%, transparent 60%), linear-gradient(135deg, #000 0%, #030006 100%)',
    },
    preview: 'radial-gradient(ellipse at 30% 40%,#7c3aed,#db2777,#030006)',
  },
];

export function isBackgroundUnlocked(
  bg: ProfileBackground,
  level: Level,
  ownedIds: string[],
): boolean {
  const LEVEL_ORDER: Level[] = ['spark', 'charge', 'surge', 'storm'];
  const userLevelIdx = LEVEL_ORDER.indexOf(level);
  const reqLevelIdx = bg.requiredLevel ? LEVEL_ORDER.indexOf(bg.requiredLevel) : 0;

  switch (bg.unlockType) {
    case 'free':
      return true;
    case 'coins':
      return ownedIds.includes(bg.id);
    case 'level':
      return userLevelIdx >= reqLevelIdx;
    case 'coins_and_level':
      return ownedIds.includes(bg.id) && userLevelIdx >= reqLevelIdx;
  }
}

/** Returns only backgrounds purchasable with CYBACOIN (shown in Rewards shop) */
export const PURCHASABLE_BACKGROUNDS = PROFILE_BACKGROUNDS.filter(
  b => b.unlockType === 'coins' || b.unlockType === 'coins_and_level'
);

export function getUnlockLabel(bg: ProfileBackground): string {
  switch (bg.unlockType) {
    case 'free':
      return 'Free';
    case 'coins':
      return `${bg.coinCost?.toLocaleString()} CYBACOIN`;
    case 'level':
      return `${bg.requiredLevel} level`;
    case 'coins_and_level':
      return `${bg.requiredLevel} level + ${bg.coinCost?.toLocaleString()} coins`;
  }
}

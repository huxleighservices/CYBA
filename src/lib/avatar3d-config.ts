import type { Level } from '@/lib/levels';

export type SkinTone = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';

export const SKIN_TONES: Record<SkinTone, { base: string; shadow: string; highlight: string; label: string; swatch: string }> = {
  'light':        { base: '#FFE4C4', shadow: '#C8956A', highlight: '#FFF5EA', label: 'Light',        swatch: '#FFD9B4' },
  'medium-light': { base: '#F0B27A', shadow: '#B06A30', highlight: '#F8C898', label: 'Medium Light', swatch: '#F4A460' },
  'medium':       { base: '#C68642', shadow: '#8B5A1F', highlight: '#D4985C', label: 'Medium',       swatch: '#C68642' },
  'medium-dark':  { base: '#8D5524', shadow: '#5A2E0A', highlight: '#A87040', label: 'Medium Dark',  swatch: '#8D5524' },
  'dark':         { base: '#4A2912', shadow: '#1F0A00', highlight: '#6B3A20', label: 'Dark',         swatch: '#4A2912' },
};

export type HairStyle = 'short' | 'medium' | 'long' | 'curly' | 'bun' | 'afro' | 'cap' | 'devil-horns' | 'beanie' | 'none';
export type ShirtStyle = 'tshirt' | 'tank' | 'hoodie' | 'button-down' | 'pittsburgh' | 'cyba';
export type PantsStyle = 'jeans' | 'cargo' | 'shorts' | 'skirt' | 'ripped' | 'sweats';
export type ShoeStyle  = 'boots' | 'sneakers' | 'slippers' | 'heels';
export type AccessoryStyle = 'none' | 'skateboard' | 'boombox' | 'angel-wings' | 'devil-wings' | 'gold-chain' | 'dragon';

export type Avatar3DConfig = {
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: string;
  shirtStyle: ShirtStyle;
  shirtColor: string;
  pantsStyle: PantsStyle;
  pantsColor: string;
  shoeStyle: ShoeStyle;
  shoeColor: string;
  accessory: AccessoryStyle;
};

export const DEFAULT_AVATAR_3D: Avatar3DConfig = {
  skinTone: 'medium-light',
  hairStyle: 'short',
  hairColor: '#4A2912',
  shirtStyle: 'tshirt',
  shirtColor: '#6B7280',
  pantsStyle: 'jeans',
  pantsColor: '#1E3A5F',
  shoeStyle: 'sneakers',
  shoeColor: '#E5E7EB',
  accessory: 'none',
};

export const HAIR_OPTIONS: { value: HairStyle; label: string; emoji: string; isHat: boolean }[] = [
  { value: 'short',       label: 'Short',        emoji: '✂️', isHat: false },
  { value: 'medium',      label: 'Medium',       emoji: '💇', isHat: false },
  { value: 'long',        label: 'Long',         emoji: '🌊', isHat: false },
  { value: 'curly',       label: 'Curly',        emoji: '🌀', isHat: false },
  { value: 'bun',         label: 'Bun',          emoji: '🎀', isHat: false },
  { value: 'afro',        label: 'Afro',         emoji: '✨', isHat: false },
  { value: 'cap',         label: 'Baseball Cap', emoji: '🧢', isHat: true  },
  { value: 'devil-horns', label: 'Devil Horns',  emoji: '😈', isHat: true  },
  { value: 'beanie',      label: 'Beanie',       emoji: '🎩', isHat: true  },
  { value: 'none',        label: 'Bald',         emoji: '🥚', isHat: false },
];

export const SHIRT_OPTIONS: { value: ShirtStyle; label: string; emoji: string; colorable: boolean }[] = [
  { value: 'tshirt',      label: 'T-Shirt',        emoji: '👕', colorable: true  },
  { value: 'tank',        label: 'Tank Top',       emoji: '🎽', colorable: true  },
  { value: 'hoodie',      label: 'Hoodie',         emoji: '🧥', colorable: true  },
  { value: 'button-down', label: 'Button Down',    emoji: '👔', colorable: true  },
  { value: 'pittsburgh',  label: 'Pittsburgh Tee', emoji: '🏙️', colorable: false },
  { value: 'cyba',        label: 'I ❤️ CYBA',     emoji: '💜', colorable: false },
];

export const PANTS_OPTIONS: { value: PantsStyle; label: string; emoji: string }[] = [
  { value: 'jeans',   label: 'Jeans',             emoji: '👖' },
  { value: 'cargo',   label: 'Cargo Pants',       emoji: '🪖' },
  { value: 'shorts',  label: 'Basketball Shorts', emoji: '🏀' },
  { value: 'skirt',   label: 'Skirt',             emoji: '👗' },
  { value: 'ripped',  label: 'Ripped Jeans',      emoji: '⚡' },
  { value: 'sweats',  label: 'Sweat Pants',       emoji: '🏃' },
];

export const SHOE_OPTIONS: { value: ShoeStyle; label: string; emoji: string }[] = [
  { value: 'boots',    label: 'Boots',           emoji: '🥾' },
  { value: 'sneakers', label: 'Sneakers',        emoji: '👟' },
  { value: 'slippers', label: 'Fuzzy Slippers',  emoji: '🥿' },
  { value: 'heels',    label: 'High Heels',      emoji: '👠' },
];

export const ACCESSORY_OPTIONS: { value: AccessoryStyle; label: string; emoji: string }[] = [
  { value: 'none',        label: 'None',        emoji: '✖️' },
  { value: 'skateboard',  label: 'Skateboard',  emoji: '🛹' },
  { value: 'boombox',     label: 'Boombox',     emoji: '📻' },
  { value: 'angel-wings', label: 'Angel Wings', emoji: '👼' },
  { value: 'devil-wings', label: 'Devil Wings', emoji: '😈' },
  { value: 'gold-chain',  label: 'Gold Chain',  emoji: '⛓️' },
  { value: 'dragon',      label: 'Pet Dragon',  emoji: '🐉' },
];

export type AccessoryUnlock = {
  type: 'free' | 'level' | 'coins';
  requiredLevel?: Level;
  ccCost?: number;
};

export const ACCESSORY_DEFAULTS: Record<AccessoryStyle, AccessoryUnlock> = {
  'none':        { type: 'free' },
  'gold-chain':  { type: 'free' },
  'skateboard':  { type: 'free' },
  'boombox':     { type: 'level', requiredLevel: 'charge' },
  'angel-wings': { type: 'level', requiredLevel: 'surge' },
  'devil-wings': { type: 'level', requiredLevel: 'surge' },
  'dragon':      { type: 'level', requiredLevel: 'storm' },
};

import type { AvatarLayer } from '@/lib/avatar-assets';

export type GearAction = 'like' | 'comment' | 'share' | 'post';

export interface AvatarGearItem {
  id: string;
  name: string;
  emoji: string;
  slot: AvatarLayer;
  price: number; // CYBACOIN
  /** Passive earning bonus — e.g. { post: 0.1 } grants +10% CC on every post while equipped. */
  bonus: Partial<Record<GearAction, number>>;
}

// PLACEHOLDER catalog + pricing — confirm before launch.
export const GEAR_CATALOG: AvatarGearItem[] = [
  { id: 'gear_cap_hustle', name: 'Hustle Cap', emoji: '🧢', slot: 'hat', price: 5000, bonus: { post: 0.05 } },
  { id: 'gear_shirt_glow', name: 'Glow Tee', emoji: '👕', slot: 'shirt', price: 5000, bonus: { like: 0.1 } },
  { id: 'gear_shoes_zoomers', name: 'Zoomers', emoji: '👟', slot: 'shoes', price: 7500, bonus: { comment: 0.1 } },
  { id: 'gear_chain_cyba', name: 'CYBA Chain', emoji: '📿', slot: 'accessory', price: 10000, bonus: { share: 0.15 } },
  { id: 'gear_crown_zone', name: 'Zone Crown', emoji: '👑', slot: 'hat', price: 25000, bonus: { post: 0.1, like: 0.1, comment: 0.1, share: 0.1 } },
];

export function getGearItem(id: string): AvatarGearItem | undefined {
  return GEAR_CATALOG.find(g => g.id === id);
}

/** Applies the equipped gear's combined bonus (additive) for a given action, e.g. two +10% items
 *  equipped for 'post' scales the base reward by 1.2x total. */
export function applyGearMultiplier(baseCC: number, equippedGear: string[] | undefined, action: GearAction): number {
  if (!equippedGear || equippedGear.length === 0) return baseCC;
  const totalBonus = equippedGear.reduce((sum, id) => sum + (getGearItem(id)?.bonus[action] ?? 0), 0);
  return Math.round(baseCC * (1 + totalBonus));
}

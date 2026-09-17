export type AdStatus = 'pending_payment' | 'active' | 'expired';

export type AdMediaType = 'image' | 'video';

export type AdTierKey = 'day7' | 'day14' | 'day30';

export interface AdDoc {
  userId: string;
  username: string;
  mediaUrl: string;
  mediaType: AdMediaType;
  buttonText: string;
  buttonLink: string;
  status: AdStatus;
  tier: AdTierKey;
  durationDays: number;
  videoDurationSeconds?: number;
  unskippable?: boolean;
  wantsMediaQuest?: boolean;
  /** Buyer's answer to "What do you want members to do?" — only set when wantsMediaQuest is true. */
  questInstructions?: string;
  viewCount?: number;
  clickCount?: number;
  totalWatchSeconds?: number;
  /** Set once the 3-day-before-expiry notification has been sent, so the cron doesn't resend it daily. */
  expiryWarningSent?: boolean;
  /** Free-promo voucher redemption — set when this slot was activated for $0 via a voucher. */
  redeemedWithVoucher?: boolean;
}

export interface AdTierConfig {
  priceLabel: string;
  buttonLink: string;
  days: number;
}

export interface AdUpsellConfig {
  priceLabel: string;
  buttonLink: string;
  description: string;
}

/** Parses a "$4.99" price label into a numeric USD amount, for wallet-cash balance payments. */
export function parsePriceLabel(label: string): number {
  const n = parseFloat(label.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface AdDropConfig {
  tiers: Record<AdTierKey, AdTierConfig>;
  unskippable: AdUpsellConfig;
  mediaQuest: AdUpsellConfig;
  skipCostCC: number;
  /** CYBACOIN granted for watching an ad to completion. PLACEHOLDER — confirm before launch. */
  watchRewardCC: number;
  /** USD -> CYBACOIN rate used for boost/reward conversions. PLACEHOLDER — confirm before launch. */
  usdToCcRate: number;
}

export type AdUpsellKey = 'unskippable' | 'mediaQuest';

/** Add-ons bundled FREE with each tier — Premium (day30) includes both, Standard (day14)
 *  includes CYBAQUEST only, Value (day7) includes none. Any add-on not in this list for a
 *  tier is still offered, but as a paid extra. */
export const AD_TIER_INCLUDED_UPSELLS: Record<AdTierKey, AdUpsellKey[]> = {
  day7: [],
  day14: ['mediaQuest'],
  day30: ['unskippable', 'mediaQuest'],
};

const ALL_UPSELL_KEYS: AdUpsellKey[] = ['unskippable', 'mediaQuest'];

/** Add-ons offered as paid extras for a tier — everything not already bundled free. */
export function getSelectableUpsells(tier: AdTierKey): AdUpsellKey[] {
  const included = new Set(AD_TIER_INCLUDED_UPSELLS[tier]);
  return ALL_UPSELL_KEYS.filter(k => !included.has(k));
}

export const AD_TIER_ORDER: AdTierKey[] = ['day7', 'day14', 'day30'];

export const AD_TIER_LABELS: Record<AdTierKey, string> = {
  day7: '7 Days',
  day14: '14 Days',
  day30: '30 Days',
};

/** Max promo video length per tier, in seconds. Longer uploads are auto-capped, not rejected. */
export const AD_TIER_MAX_VIDEO_SECONDS: Record<AdTierKey, number> = {
  day7: 15,
  day14: 15,
  day30: 30,
};

export const DEFAULT_AD_DROP_CONFIG: AdDropConfig = {
  tiers: {
    day7: { priceLabel: '$24.99', buttonLink: '', days: 7 },
    day14: { priceLabel: '$124.99', buttonLink: '', days: 14 },
    day30: { priceLabel: '$624.99', buttonLink: '', days: 30 },
  },
  unskippable: { priceLabel: '$2.99', buttonLink: '', description: 'Your promo plays in full with no skip option.' },
  mediaQuest: { priceLabel: '$9.99', buttonLink: '', description: 'A CYBAQUEST is created prompting CYBAs to purchase your product or service.' },
  skipCostCC: 1000,
  watchRewardCC: 5, // PLACEHOLDER — confirm before launch
  usdToCcRate: 100, // PLACEHOLDER — confirm before launch (100 CC per $1)
};

/** Renewal bonus paid as CYBACOIN (via usdToCcRate) when purchasing a new promo slot while
 *  another slot is still active — 15% of the base tier price (upsells excluded). Matches the
 *  published Terms of Use exactly — do not change without updating that copy too. */
export const OVERLAP_RENEWAL_BONUS_PCT = 0.15;

export type FreePromoTier = AdTierKey;
export type FreePromoVouchers = Record<FreePromoTier, number>;

export type BoostSubscriptionType = 'payout' | 'market' | 'radio' | 'spotlight' | 'adFree';

export type BoostSubscriptionRates = Record<BoostSubscriptionType, number>;

export type BoostSubscriptionDescriptions = Partial<Record<BoostSubscriptionType, string>>;

// PLACEHOLDER weekly CYBACOIN rates — pricing to be confirmed before launch.
export const DEFAULT_BOOST_SUBSCRIPTION_RATES: BoostSubscriptionRates = {
  payout: 2000,
  market: 750,
  radio: 500,
  spotlight: 1500,
  adFree: 300,
};

export const BOOST_SUBSCRIPTION_TYPES: BoostSubscriptionType[] = ['payout', 'market', 'radio', 'spotlight', 'adFree'];

// Market Boost item-listing tiers — the base `market` weekly rate above covers the Base tier;
// Mid/Top cost more per week and raise the listing cap. Enforced client-side in MyStore.tsx.
export type MarketBoostTier = 'base' | 'mid' | 'top';
export const MARKET_TIER_ITEM_CAP: Record<MarketBoostTier, number> = {
  base: 3,
  mid: 7,
  top: Infinity,
};
// PLACEHOLDER weekly CYBACOIN rates for Mid/Top — Base uses the `market` rate above.
export const MARKET_TIER_EXTRA_RATE: Record<MarketBoostTier, number> = {
  base: 0,
  mid: 500,
  top: 1500,
};

// Field on users/{uid} that reflects the actual granted state (what the rest
// of the app already checks — PostCard glow, market "My Store", radio widget,
// payout eligibility, AdDropPopup suppression).
export const BOOST_FLAG_FIELD: Record<BoostSubscriptionType, string> = {
  payout: 'payoutEnrolled',
  market: 'marketBoost',
  radio: 'radioBoost',
  spotlight: 'spotlightBoost',
  adFree: 'adFreeBoost',
};

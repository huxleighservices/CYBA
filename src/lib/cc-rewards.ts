import { type Level } from '@/lib/levels';

export type CCRatesByLevel = Record<Level, number>;

export interface CCRates {
  post: {
    text:  CCRatesByLevel;
    image: CCRatesByLevel;
    video: CCRatesByLevel;
  };
  engagement: {
    like:    CCRatesByLevel;
    comment: CCRatesByLevel;
    share:   CCRatesByLevel;
  };
}

// ─────────────────────────────────────────────
//  Hardcoded defaults — used as fallback when
//  no override exists in Firestore
// ─────────────────────────────────────────────
export const DEFAULT_CC_RATES: CCRates = {
  post: {
    text:  { spark: 100, charge: 300, surge: 500,  storm: 1000 },
    image: { spark: 150, charge: 450, surge: 750,  storm: 1500 },
    video: { spark: 200, charge: 600, surge: 1000, storm: 2000 },
  },
  engagement: {
    like:    { spark: 50,  charge: 100, surge: 200, storm: 400 },
    comment: { spark: 75,  charge: 150, surge: 300, storm: 600 },
    share:   { spark: 100, charge: 200, surge: 400, storm: 800 },
  },
};

// Merge a partial Firestore override with the defaults so missing keys
// always fall back gracefully.
export function mergeWithDefaults(partial: Partial<CCRates>): CCRates {
  return {
    post: {
      text:  { ...DEFAULT_CC_RATES.post.text,  ...(partial.post?.text  ?? {}) },
      image: { ...DEFAULT_CC_RATES.post.image, ...(partial.post?.image ?? {}) },
      video: { ...DEFAULT_CC_RATES.post.video, ...(partial.post?.video ?? {}) },
    },
    engagement: {
      like:    { ...DEFAULT_CC_RATES.engagement.like,    ...(partial.engagement?.like    ?? {}) },
      comment: { ...DEFAULT_CC_RATES.engagement.comment, ...(partial.engagement?.comment ?? {}) },
      share:   { ...DEFAULT_CC_RATES.engagement.share,   ...(partial.engagement?.share   ?? {}) },
    },
  };
}

export function getCCForPost(
  mediaType: 'text' | 'image' | 'video',
  level: Level,
  rates?: CCRates | null,
): number {
  return (rates ?? DEFAULT_CC_RATES).post[mediaType][level];
}

export function getCCForEngagement(
  action: 'like' | 'comment' | 'share',
  level: Level,
  rates?: CCRates | null,
): number {
  return (rates ?? DEFAULT_CC_RATES).engagement[action][level];
}

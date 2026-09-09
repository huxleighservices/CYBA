export type Level = 'spark' | 'charge' | 'surge' | 'storm';

export const LEVEL_CONFIG = {
  spark: {
    name: 'Spark',
    emoji: '⚡',
    minPosts: 0,
    minSupport: 0,
    // Tailwind ring/glow classes (must be full strings for purge safety)
    ringClass: '',
    gradientFrom: '#ca8a04',
    gradientTo: '#fbbf24',
    description: 'Entry level creator',
  },
  charge: {
    name: 'Charge',
    emoji: '🔋',
    minPosts: 30,
    minSupport: 300,
    ringClass: 'ring-2 ring-blue-400/70',
    gradientFrom: '#2563eb',
    gradientTo: '#06b6d4',
    description: '30 posts · 300 support',
  },
  surge: {
    name: 'Surge',
    emoji: '🌊',
    minPosts: 100,
    minSupport: 1200,
    ringClass: 'ring-2 ring-purple-500/70',
    gradientFrom: '#7c3aed',
    gradientTo: '#a855f7',
    description: '100 posts · 1,200 support',
  },
  storm: {
    name: 'Storm',
    emoji: '⛈️',
    minPosts: 300,
    minSupport: 3500,
    ringClass: 'ring-2 ring-red-500/70',
    gradientFrom: '#dc2626',
    gradientTo: '#f97316',
    description: '300 posts · 3,500 support',
  },
} as const;

export type LevelThresholds = {
  charge_posts: number; charge_support: number;
  surge_posts: number; surge_support: number;
  storm_posts: number; storm_support: number;
};

export const DEFAULT_LEVEL_THRESHOLDS: LevelThresholds = {
  charge_posts: 30, charge_support: 300,
  surge_posts: 100, surge_support: 1200,
  storm_posts: 300, storm_support: 3500,
};

const VALID_LEVELS: readonly string[] = ['spark', 'charge', 'surge', 'storm'];

export function computeLevel(
  postCount: number = 0,
  supportGiven: number = 0,
  cfg?: Partial<LevelThresholds>,
  // Admin-set manual override (users/{uid}.levelOverride) — a distinct concept from
  // membershipTier ("Tier", Zone Pass). When set to a valid Level, it wins outright.
  levelOverride?: string,
): Level {
  if (levelOverride && VALID_LEVELS.includes(levelOverride)) {
    return levelOverride as Level;
  }
  const t = { ...DEFAULT_LEVEL_THRESHOLDS, ...cfg };
  if (postCount >= t.storm_posts && supportGiven >= t.storm_support) return 'storm';
  if (postCount >= t.surge_posts && supportGiven >= t.surge_support) return 'surge';
  if (postCount >= t.charge_posts && supportGiven >= t.charge_support) return 'charge';
  return 'spark';
}

export const LEVELS_IN_ORDER: Level[] = ['spark', 'charge', 'surge', 'storm'];

export function getNextLevel(level: Level): Level | null {
  const idx = LEVELS_IN_ORDER.indexOf(level);
  return idx < LEVELS_IN_ORDER.length - 1 ? LEVELS_IN_ORDER[idx + 1] : null;
}

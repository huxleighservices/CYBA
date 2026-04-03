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

export function computeLevel(postCount: number = 0, supportGiven: number = 0): Level {
  if (postCount >= 300 && supportGiven >= 3500) return 'storm';
  if (postCount >= 100 && supportGiven >= 1200) return 'surge';
  if (postCount >= 30 && supportGiven >= 300) return 'charge';
  return 'spark';
}

export const LEVELS_IN_ORDER: Level[] = ['spark', 'charge', 'surge', 'storm'];

export function getNextLevel(level: Level): Level | null {
  const idx = LEVELS_IN_ORDER.indexOf(level);
  return idx < LEVELS_IN_ORDER.length - 1 ? LEVELS_IN_ORDER[idx + 1] : null;
}

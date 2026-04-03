export type QuestRequirementType = 'posts' | 'supportGiven';

export interface QuestRequirement {
  type: QuestRequirementType;
  label: string;
  target: number;
  icon: string;
}

export interface Quest {
  id: string;
  world: 1 | 2 | 3;
  level: number;
  title: string;
  description: string;
  flavorText: string;
  nodeEmoji: string;
  requirements: QuestRequirement[];
  reward: { coins: number; badge?: string; title?: string };
  position: { x: number; y: number }; // 0–100 percentage on the map
  prerequisiteIds: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
}

export const WORLD_THEMES = {
  1: {
    name: 'THE SOCIAL PLAINS',
    accent: '#22c55e',
    emoji: '🌿',
    svgGradient: ['#14532d', '#052e16'],
    yRange: [60, 100],
  },
  2: {
    name: 'CREATOR MOUNTAINS',
    accent: '#a855f7',
    emoji: '⛰️',
    svgGradient: ['#3b0764', '#1a0533'],
    yRange: [25, 60],
  },
  3: {
    name: "LEGEND'S TOWER",
    accent: '#ef4444',
    emoji: '🔥',
    svgGradient: ['#1a0000', '#0c0a09'],
    yRange: [0, 25],
  },
} as const;

export const QUESTS: Quest[] = [
  // ── World 1: The Social Plains ──
  {
    id: 'w1q1',
    world: 1,
    level: 1,
    title: 'FIRST NOTE',
    description: 'Drop your first post in the CYBAZONE. Every legend starts somewhere.',
    flavorText: '"A journey of a thousand bars begins with a single post."',
    nodeEmoji: '🎵',
    requirements: [{ type: 'posts', label: 'Posts Made', target: 1, icon: '📝' }],
    reward: { coins: 50, title: 'Newcomer' },
    position: { x: 13, y: 82 },
    prerequisiteIds: [],
    difficulty: 'easy',
  },
  {
    id: 'w1q2',
    world: 1,
    level: 2,
    title: 'SPREAD LOVE',
    description: 'Support 5 fellow artists. Real ones lift each other up.',
    flavorText: '"Support the wave and the wave will carry you."',
    nodeEmoji: '💛',
    requirements: [{ type: 'supportGiven', label: 'Artists Supported', target: 5, icon: '🤝' }],
    reward: { coins: 75 },
    position: { x: 33, y: 74 },
    prerequisiteIds: ['w1q1'],
    difficulty: 'easy',
  },
  {
    id: 'w1q3',
    world: 1,
    level: 3,
    title: 'SOCIAL BUTTERFLY',
    description: 'Post regularly and keep supporting the community.',
    flavorText: '"Consistency is the cheat code."',
    nodeEmoji: '🦋',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 5, icon: '📝' },
      { type: 'supportGiven', label: 'Artists Supported', target: 15, icon: '🤝' },
    ],
    reward: { coins: 150, title: 'Social Butterfly' },
    position: { x: 57, y: 66 },
    prerequisiteIds: ['w1q2'],
    difficulty: 'easy',
  },

  // ── World 2: Creator Mountains ──
  {
    id: 'w2q1',
    world: 2,
    level: 1,
    title: 'CONTENT DROPS',
    description: "Keep creating. The mountain isn't climbed in a day.",
    flavorText: '"The grind is the glory."',
    nodeEmoji: '⚡',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 10, icon: '📝' },
      { type: 'supportGiven', label: 'Artists Supported', target: 25, icon: '🤝' },
    ],
    reward: { coins: 250 },
    position: { x: 76, y: 55 },
    prerequisiteIds: ['w1q3'],
    difficulty: 'medium',
  },
  {
    id: 'w2q2',
    world: 2,
    level: 2,
    title: 'PILLAR OF CYBA',
    description: "You're becoming essential to this community. Keep going.",
    flavorText: '"They know your name now."',
    nodeEmoji: '🏛️',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 20, icon: '📝' },
      { type: 'supportGiven', label: 'Artists Supported', target: 50, icon: '🤝' },
    ],
    reward: { coins: 400, title: 'Pillar of CYBA' },
    position: { x: 52, y: 46 },
    prerequisiteIds: ['w2q1'],
    difficulty: 'medium',
  },
  {
    id: 'w2q3',
    world: 2,
    level: 3,
    title: 'MOUNTAIN KING',
    description: "You've conquered the Creator Mountains. The tower awaits.",
    flavorText: '"The view from the top hits different."',
    nodeEmoji: '👑',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 30, icon: '📝' },
      { type: 'supportGiven', label: 'Artists Supported', target: 80, icon: '🤝' },
    ],
    reward: { coins: 600, badge: 'Mountain Crown', title: 'Mountain King' },
    position: { x: 27, y: 38 },
    prerequisiteIds: ['w2q2'],
    difficulty: 'hard',
  },

  // ── World 3: Legend's Tower ──
  {
    id: 'w3q1',
    world: 3,
    level: 1,
    title: 'HALL OF FAME',
    description: "You've entered the realm of legends. Almost there.",
    flavorText: '"History remembers those who showed up every day."',
    nodeEmoji: '🌟',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 50, icon: '📝' },
      { type: 'supportGiven', label: 'Artists Supported', target: 125, icon: '🤝' },
    ],
    reward: { coins: 1000, title: 'Hall of Famer' },
    position: { x: 50, y: 20 },
    prerequisiteIds: ['w2q3'],
    difficulty: 'hard',
  },
  {
    id: 'w3q2',
    world: 3,
    level: 2,
    title: 'CYBA LEGEND',
    description: 'The pinnacle. There is no higher. You ARE the CYBAZONE.',
    flavorText: '"PRESS START TO CLAIM YOUR LEGACY."',
    nodeEmoji: '💎',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 100, icon: '📝' },
      { type: 'supportGiven', label: 'Artists Supported', target: 250, icon: '🤝' },
    ],
    reward: { coins: 5000, badge: 'CYBA Legend', title: 'CYBA LEGEND' },
    position: { x: 50, y: 8 },
    prerequisiteIds: ['w3q1'],
    difficulty: 'legendary',
  },
];

export type QuestStatus = 'locked' | 'available' | 'in-progress' | 'claimable' | 'completed';

export function getQuestStatus(
  quest: Quest,
  completedQuestIds: string[],
  userStats: { posts: number; supportGiven: number }
): QuestStatus {
  if (completedQuestIds.includes(quest.id)) return 'completed';
  const prereqsMet = quest.prerequisiteIds.every(id => completedQuestIds.includes(id));
  if (!prereqsMet) return 'locked';
  const allMet = quest.requirements.every(req => (userStats[req.type] ?? 0) >= req.target);
  if (allMet) return 'claimable';
  const hasProgress = quest.requirements.some(req => (userStats[req.type] ?? 0) > 0);
  return hasProgress ? 'in-progress' : 'available';
}

export function getQuestProgress(
  quest: Quest,
  userStats: { posts: number; supportGiven: number }
) {
  return quest.requirements.map(req => ({
    label: req.label,
    icon: req.icon,
    current: Math.min(userStats[req.type] ?? 0, req.target),
    target: req.target,
    pct: Math.min(100, Math.round(((userStats[req.type] ?? 0) / req.target) * 100)),
  }));
}

export function getWorldProgress(world: 1 | 2 | 3, completedQuestIds: string[]) {
  const worldQuests = QUESTS.filter(q => q.world === world);
  const completed = worldQuests.filter(q => completedQuestIds.includes(q.id)).length;
  return { completed, total: worldQuests.length, pct: Math.round((completed / worldQuests.length) * 100) };
}

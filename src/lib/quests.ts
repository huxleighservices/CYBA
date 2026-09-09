export type QuestRequirementType = 'posts' | 'supportGiven' | 'profilePictureSet' | 'bioSet' | 'subnetMembers';

export interface QuestRequirement {
  type: QuestRequirementType;
  label: string;
  target: number;
  icon: string;
}

export interface Quest {
  id: string;
  level: number;
  title: string;
  description: string;
  flavorText: string;
  nodeEmoji: string;
  requirements: QuestRequirement[];
  reward: { coins: number; badge?: string; title?: string };
  prerequisiteIds: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
}

export type UserStats = {
  posts: number;
  supportGiven: number;
  profilePictureSet: number; // 0 or 1
  bioSet: number;            // 0 or 1
  subnetMembers: number;     // active Subnet member count (subnets/{uid}.memberCount)
};

export const QUESTS: Quest[] = [
  {
    id: 'tut_pfp',
    level: 1,
    title: 'SHOW YOUR FACE',
    description: 'Upload a profile picture so the CYBAZONE knows who you are.',
    flavorText: '"First impressions run the zone."',
    nodeEmoji: '📸',
    requirements: [{ type: 'profilePictureSet', label: 'Profile picture uploaded', target: 1, icon: '📸' }],
    reward: { coins: 50 },
    prerequisiteIds: [],
    difficulty: 'easy',
  },
  {
    id: 'tut_bio',
    level: 2,
    title: 'SAY WHO YOU ARE',
    description: 'Write your bio. Tell the world what you\'re about.',
    flavorText: '"Your story starts here."',
    nodeEmoji: '✍️',
    requirements: [{ type: 'bioSet', label: 'Bio written', target: 1, icon: '✍️' }],
    reward: { coins: 50 },
    prerequisiteIds: [],
    difficulty: 'easy',
  },
  {
    id: 'tut_post',
    level: 3,
    title: 'DROP YOUR FIRST',
    description: 'Make your first post on the CYBAZONE feed.',
    flavorText: '"The zone was waiting for you."',
    nodeEmoji: '🎤',
    requirements: [{ type: 'posts', label: 'Posts made', target: 1, icon: '📝' }],
    reward: { coins: 100, title: 'Posted Up' },
    prerequisiteIds: [],
    difficulty: 'easy',
  },
  {
    id: 'tut_support',
    level: 4,
    title: 'SHOW THE LOVE',
    description: 'Like, comment, or share someone else\'s post on the feed.',
    flavorText: '"Real ones support the wave."',
    nodeEmoji: '💙',
    requirements: [{ type: 'supportGiven', label: 'Creators supported', target: 1, icon: '🤝' }],
    reward: { coins: 75 },
    prerequisiteIds: [],
    difficulty: 'easy',
  },
  {
    id: 'just_landed',
    level: 4.5,
    title: 'JUST LANDED',
    description: 'Welcome to the Zone. Finish setting up your profile and drop your first post to complete onboarding.',
    flavorText: '"Every legend starts with a landing."',
    nodeEmoji: '🗺️',
    requirements: [{ type: 'posts', label: 'First post made', target: 1, icon: '📝' }],
    reward: { coins: 100, title: 'Just Landed' },
    prerequisiteIds: ['tut_pfp', 'tut_bio'],
    difficulty: 'easy',
  },
  {
    id: 'w1q1',
    level: 5,
    title: 'FIRST NOTE',
    description: 'Drop your first post in the CYBAZONE. Every legend starts somewhere.',
    flavorText: '"A journey of a thousand posts begins with a single drop."',
    nodeEmoji: '🎵',
    requirements: [{ type: 'posts', label: 'Posts Made', target: 1, icon: '📝' }],
    reward: { coins: 50, title: 'Newcomer' },
    prerequisiteIds: [],
    difficulty: 'easy',
  },
  {
    id: 'w1q2',
    level: 6,
    title: 'SPREAD LOVE',
    description: 'Support 5 fellow creators. Real ones lift each other up.',
    flavorText: '"Support the wave and the wave will carry you."',
    nodeEmoji: '💛',
    requirements: [{ type: 'supportGiven', label: 'Creators Supported', target: 5, icon: '🤝' }],
    reward: { coins: 75 },
    prerequisiteIds: ['w1q1'],
    difficulty: 'easy',
  },
  {
    id: 'w1q3',
    level: 7,
    title: 'SOCIAL BUTTERFLY',
    description: 'Post regularly and keep supporting the community.',
    flavorText: '"Consistency is the cheat code."',
    nodeEmoji: '🦋',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 5, icon: '📝' },
      { type: 'supportGiven', label: 'Creators Supported', target: 15, icon: '🤝' },
    ],
    reward: { coins: 150, title: 'Social Butterfly' },
    prerequisiteIds: ['w1q2'],
    difficulty: 'easy',
  },
  {
    id: 'w2q1',
    level: 8,
    title: 'CONTENT DROPS',
    description: "Keep creating. The grind is the glory.",
    flavorText: '"The grind is the glory."',
    nodeEmoji: '⚡',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 10, icon: '📝' },
      { type: 'supportGiven', label: 'Creators Supported', target: 25, icon: '🤝' },
    ],
    reward: { coins: 250 },
    prerequisiteIds: ['w1q3'],
    difficulty: 'medium',
  },
  {
    id: 'w2q2',
    level: 9,
    title: 'PILLAR OF CYBA',
    description: "You're becoming essential to this community. Keep going.",
    flavorText: '"They know your name now."',
    nodeEmoji: '🏛️',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 20, icon: '📝' },
      { type: 'supportGiven', label: 'Creators Supported', target: 50, icon: '🤝' },
    ],
    reward: { coins: 400, title: 'Pillar of CYBA' },
    prerequisiteIds: ['w2q1'],
    difficulty: 'medium',
  },
  {
    id: 'w2q3',
    level: 10,
    title: 'MOUNTAIN KING',
    description: "You've hit new heights. The top is in sight.",
    flavorText: '"The view from the top hits different."',
    nodeEmoji: '👑',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 30, icon: '📝' },
      { type: 'supportGiven', label: 'Creators Supported', target: 80, icon: '🤝' },
    ],
    reward: { coins: 600, badge: 'Mountain Crown', title: 'Mountain King' },
    prerequisiteIds: ['w2q2'],
    difficulty: 'hard',
  },
  {
    id: 'w3q1',
    level: 11,
    title: 'HALL OF FAME',
    description: "You've entered the realm of legends. Almost there.",
    flavorText: '"History remembers those who showed up every day."',
    nodeEmoji: '🌟',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 50, icon: '📝' },
      { type: 'supportGiven', label: 'Creators Supported', target: 125, icon: '🤝' },
    ],
    reward: { coins: 1000, title: 'Hall of Famer' },
    prerequisiteIds: ['w2q3'],
    difficulty: 'hard',
  },
  {
    id: 'w3q2',
    level: 12,
    title: 'CYBA LEGEND',
    description: 'The pinnacle. There is no higher. You ARE the CYBAZONE.',
    flavorText: '"PRESS START TO CLAIM YOUR LEGACY."',
    nodeEmoji: '💎',
    requirements: [
      { type: 'posts', label: 'Posts Made', target: 100, icon: '📝' },
      { type: 'supportGiven', label: 'Creators Supported', target: 250, icon: '🤝' },
    ],
    reward: { coins: 5000, badge: 'CYBA Legend', title: 'CYBA LEGEND' },
    prerequisiteIds: ['w3q1'],
    difficulty: 'legendary',
  },
  {
    id: 'subnet_10',
    level: 13,
    title: 'BUILD YOUR SUBNET',
    description: 'Get 10 CYBAs to join your Subnet.',
    flavorText: '"Your own paid corner of the Zone."',
    nodeEmoji: '🔒',
    requirements: [{ type: 'subnetMembers', label: 'Subnet Members', target: 10, icon: '🔒' }],
    reward: { coins: 2500, title: 'Subnet Builder' },
    prerequisiteIds: [],
    difficulty: 'hard',
  },
];

// ─── Custom (admin-created) quests ───────────────────────────────────────────

export interface CustomQuest {
  id: string;
  title: string;
  description: string;
  flavorText: string;
  nodeEmoji: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  order?: number;
  isMediaQuest?: boolean;
  mediaInstructions?: string;
  payout: {
    type: 'cybacoin' | 'cash';
    amount: number;
  };
  unlockPrice?: { currency: 'cc' | 'cash'; amount: number } | null;
  showOnRewardsPage?: boolean;
  active: boolean;
  createdAt?: any;
  // Weekly slot limits (media quests only)
  weeklySlots?: number;   // 0 or undefined = unlimited
  slotResetDay?: number;  // 0=Sun, 1=Mon, … 6=Sat (default 0)
  // Level gate
  requiredLevel?: 'spark' | 'charge' | 'surge' | 'storm';
  // Auto-tracked milestone (non-media quests only) — claimable once the member's live counter
  // meets milestoneThreshold. Currently only 'promo_clicks' exists (all-time PROMO BLAST
  // click-throughs, summed across every ad the member has ever run).
  milestoneType?: 'promo_clicks';
  milestoneThreshold?: number;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface QuestSubmission {
  id: string;
  submissionType?: 'quest' | 'reward';
  // Quest-specific (submissionType === 'quest')
  questId?: string;
  questTitle?: string;
  // Reward-specific
  rewardId?: string;
  rewardName?: string;
  // Payout
  payout?: { type: 'cybacoin' | 'cash'; amount: number } | null;
  // Common
  userId: string;
  username: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  status: SubmissionStatus;
  submittedAt?: any;
  reviewedAt?: any;
  reviewNote?: string;
}

export type QuestStatus = 'locked' | 'available' | 'in-progress' | 'claimable' | 'completed';

export function getQuestStatus(
  quest: Quest,
  completedQuestIds: string[],
  userStats: UserStats,
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
  userStats: UserStats,
) {
  return quest.requirements.map(req => ({
    label: req.label,
    icon: req.icon,
    current: Math.min(userStats[req.type] ?? 0, req.target),
    target: req.target,
    pct: Math.min(100, Math.round(((userStats[req.type] ?? 0) / req.target) * 100)),
  }));
}

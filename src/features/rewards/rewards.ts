export type RewardEvent = "profile_complete" | "github_connected" | "forum_post" | "helpful_reply" | "accepted_answer" | "daily_login" | "streak" | "follow";

export const REWARD_XP: Record<RewardEvent, number> = {
  profile_complete: 20,
  github_connected: 50,
  forum_post: 10,
  helpful_reply: 5,
  accepted_answer: 10,
  daily_login: 5,
  streak: 10,
  follow: 1,
};

export const REWARD_DAILY_CAPS: Partial<Record<RewardEvent, number>> = {
  forum_post: 50,
  helpful_reply: 50,
  follow: 10,
};

export function getLevelForXp(xp: number) {
  if (xp < 100) return 1;
  return Math.floor(Math.sqrt(xp / 25)) + 1;
}

export function getLevelProgress(xp: number) {
  const level = getLevelForXp(xp);
  const currentFloor = level <= 1 ? 0 : 25 * (level - 1) ** 2;
  const nextFloor = 25 * level ** 2;
  const range = Math.max(1, nextFloor - currentFloor);
  return { level, currentXp: xp - currentFloor, requiredXp: range, percent: Math.min(100, Math.round(((xp - currentFloor) / range) * 100)) };
}

export const BADGES = [
  { id: "first-post", name: "First Post", description: "Published your first community post." },
  { id: "github-connected", name: "GitHub Connected", description: "Connected a GitHub account." },
  { id: "helpful-member", name: "Helpful Member", description: "Made a contribution marked helpful." },
  { id: "seven-day-streak", name: "7 Day Streak", description: "Stayed active for seven consecutive days." },
  { id: "community-builder", name: "Community Builder", description: "Consistently helped the Omix community." },
] as const;

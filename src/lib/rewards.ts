export type RewardEvent =
  | "profile_complete"
  | "github_connected"
  | "forum_post"
  | "helpful_reply"
  | "accepted_answer"
  | "daily_login"
  | "streak"
  | "follow"
  | "project_created";

export const REWARD_XP: Record<RewardEvent, number> = {
  profile_complete: 20,
  github_connected: 50,
  forum_post: 10,
  helpful_reply: 5,
  accepted_answer: 10,
  daily_login: 5,
  streak: 10,
  follow: 1,
  project_created: 20,
};

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, 10000];

export function getLevel(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getLevelProgress(xp: number) {
  const level = getLevel(xp);
  const current = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? current + 2500;
  return { level, current, next, earned: xp - current, required: next - current };
}

export function getRewardXp(event: RewardEvent) {
  return REWARD_XP[event];
}

/**
 * Moderation service (client) — reports, queue, member actions, audit log.
 * Thin typed wrappers over the worker endpoints; no local state beyond caches.
 */
import { api } from "@/lib/api";

export interface Report {
  id: string;
  serverId: string;
  reporterId: string;
  targetType: "message" | "user" | "thread";
  targetId: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
}

export interface ModerationActionRecord {
  id: string;
  serverId: string;
  actorId: string;
  targetUserId: string;
  action: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ModerationQueue {
  reports: Report[];
  recentActions: ModerationActionRecord[];
}

export interface MemberInfo {
  userId: string;
  name: string;
  avatar: string;
  role: string;
  joinedAt: string;
  mutedUntil: string | null;
}

export type ModAction = "warn" | "mute" | "unmute" | "timeout" | "kick" | "ban" | "unban";

export const moderationService = {
  report(
    serverId: string,
    targetType: "message" | "user" | "thread",
    targetId: string,
    reason: string
  ) {
    return api.moderation.report(serverId, targetType, targetId, reason);
  },

  async queue(): Promise<ModerationQueue> {
    try {
      const res = await api.moderation.queue();
      return {
        reports: res.reports.map((r) => ({
          ...r,
          targetType: r.targetType as Report["targetType"],
          status: r.status as Report["status"],
        })),
        recentActions: res.recentActions,
      };
    } catch {
      return { reports: [], recentActions: [] };
    }
  },

  act(
    serverId: string,
    targetUserId: string,
    action: ModAction,
    reason?: string,
    durationMinutes?: number
  ) {
    return api.moderation.act(serverId, targetUserId, action, reason, durationMinutes);
  },

  resolveReport(reportId: string, status: "resolved" | "dismissed") {
    return api.moderation.resolveReport(reportId, status);
  },

  async members(serverId: string): Promise<MemberInfo[]> {
    try {
      return await api.moderation.members(serverId);
    } catch {
      return [];
    }
  },

  async auditLog(serverId: string, limit = 100) {
    try {
      return await api.moderation.auditLog(serverId, limit);
    } catch {
      return [];
    }
  },
};

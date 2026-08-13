"use client";

/**
 * Moderation panel — reports queue, member actions and audit log for staff.
 *
 * The server enforces every action authoritatively (workers/omix-api); this
 * panel only renders actions the current user's role permits. Non-staff see a
 * friendly "not allowed" state instead of the controls.
 */
import { useState, useEffect, useCallback } from "react";
import { Store } from "@/lib/store";
import { hasCapability, normalizeRole } from "@/lib/services/permissions";
import type { MemberInfo, ModAction } from "@/lib/services/moderation";
import { useToast } from "@/components/ui/Toast";
import { Shield, X, Flag, AlertCircle, Ban, UserMinus, Clock, MessageSquareWarning } from "@/components/ui/icons";

const ACTIONS = [
  { action: "warn", label: "Warn", icon: MessageSquareWarning, cap: "MANAGE_MODERATION" as const },
  { action: "mute", label: "Mute", icon: Clock, cap: "TIMEOUT_MEMBERS" as const },
  { action: "timeout", label: "Timeout", icon: Clock, cap: "TIMEOUT_MEMBERS" as const },
  { action: "kick", label: "Kick", icon: UserMinus, cap: "KICK_MEMBERS" as const },
  { action: "ban", label: "Ban", icon: Ban, cap: "BAN_MEMBERS" as const },
];

interface ReportItem {
  id: string;
  serverId: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export function ModerationPanel({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [audit, setAudit] = useState<{ action: string; actorName: string; reason: string; createdAt: string }[]>([]);
  const [myRole, setMyRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reports" | "members" | "audit">("reports");
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    const [memberRows, queue] = await Promise.all([
      Store.moderation.members(serverId),
      Store.moderation.queue().catch(() => ({ reports: [], recentActions: [] })),
    ]);
    setMembers(memberRows);
    setReports(queue.reports.filter((r) => r.serverId === serverId && r.status === "open"));
    const me = memberRows.find((m) => m.userId === Store.sessionId);
    setMyRole(me ? me.role : "member");
    if (hasCapability(normalizeRole(me?.role), "VIEW_AUDIT_LOG")) {
      const log = await Store.moderation.auditLog(serverId, 50);
      setAudit(log as { action: string; actorName: string; reason: string; createdAt: string }[]);
    }
    setLoading(false);
  }, [serverId]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const staff = hasCapability(normalizeRole(myRole), "MANAGE_MODERATION");

  const act = useCallback(
    async (userId: string, action: string, label: string) => {
      const reason = window.prompt(`Reason for ${label.toLowerCase()} (optional):`) || "";
      if (reason === null) return;
      try {
        await Store.moderation.act(serverId, userId, action as ModAction, reason, 60);
        toast(`${label} applied`, "success");
        void refresh();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        toast(
          code === "forbidden" ? "You don't have permission for that" : "Action failed",
          "error"
        );
      }
    },
    [serverId, refresh, toast]
  );

  const resolveReport = useCallback(
    async (reportId: string, status: "resolved" | "dismissed") => {
      try {
        await Store.moderation.resolveReport(reportId, status);
        toast(status === "resolved" ? "Report resolved" : "Report dismissed", "success");
        void refresh();
      } catch {
        toast("Couldn't update the report", "error");
      }
    },
    [refresh, toast]
  );

  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] z-[9996] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Moderation"
    >
      <div className="w-full max-w-lg max-h-[85vh] bg-[var(--color-bg-dark)] rounded-[20px] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden">
        <div className="h-12 px-4 border-b border-[var(--color-border)] flex items-center gap-2 shrink-0">
          <Shield size={17} className="text-[var(--color-pri)]" />
          <span className="font-bold text-sm text-[var(--color-txt)]">Moderation</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]" aria-label="Close moderation panel">
            <X size={16} className="text-[var(--color-txt-muted)]" />
          </button>
        </div>

        {!staff && !loading ? (
          <div className="p-8 text-center">
            <AlertCircle size={28} className="mx-auto text-[var(--color-txt-muted)] mb-3" />
            <p className="text-sm text-[var(--color-txt-muted)]">
              Only moderators, admins and owners can use this panel.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 px-3 pt-2 shrink-0">
              {(["reports", "members", "audit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${
                    tab === t
                      ? "bg-[var(--color-pri-muted)] text-[var(--color-pri)] font-semibold"
                      : "text-[var(--color-txt-muted)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                >
                  {t}
                  {t === "reports" && reports.length > 0 && ` (${reports.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-12 w-full" />
                  ))}
                </div>
              ) : tab === "reports" ? (
                reports.length === 0 ? (
                  <p className="text-xs text-[var(--color-txt-muted)] text-center py-8">
                    No open reports. Nice and quiet in here.
                  </p>
                ) : (
                  reports.map((r) => (
                    <div key={r.id} className="p-3 rounded-[12px] border border-[var(--color-border)] mb-2">
                      <div className="flex items-center gap-2">
                        <Flag size={13} className="text-amber-400 shrink-0" />
                        <span className="text-xs font-semibold text-[var(--color-txt)]">
                          {r.targetType}: {r.targetId.slice(0, 12)}…
                        </span>
                        <span className="ml-auto text-[10px] text-[var(--color-txt-muted)]">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {r.reason && <p className="text-xs text-[var(--color-txt-muted)] mt-1">{r.reason}</p>}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => resolveReport(r.id, "resolved")}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => resolveReport(r.id, "dismissed")}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)]"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : tab === "members" ? (
                members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 p-2.5 rounded-[12px] hover:bg-[var(--color-bg-hover)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-mid)] overflow-hidden flex items-center justify-center shrink-0">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-[var(--color-txt-muted)]">
                          {(m.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--color-txt)] truncate">{m.name}</div>
                      <div className="text-[10px] text-[var(--color-pri)] capitalize">{m.role}</div>
                    </div>
                    {m.userId === Store.sessionId ? (
                      <span className="text-[10px] text-[var(--color-txt-muted)]">you</span>
                    ) : (
                      <div className="flex gap-1">
                        {ACTIONS.filter((a) => hasCapability(normalizeRole(myRole), a.cap)).map((a) => {
                          const Icon = a.icon;
                          return (
                            <button
                              key={a.action}
                              onClick={() => act(m.userId, a.action, a.label)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-txt-muted)] hover:text-red-400 transition-colors"
                              title={a.label}
                              aria-label={`${a.label} ${m.name}`}
                            >
                              <Icon size={13} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                audit.slice(0, 50).map((entry, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-xs py-1.5 border-b border-[var(--color-border)] last:border-0">
                    <span className="text-[var(--color-txt)] font-medium shrink-0">{entry.action}</span>
                    <span className="text-[var(--color-txt-muted)] truncate">
                      by {entry.actorName || "unknown"}
                      {entry.reason ? ` — ${entry.reason}` : ""}
                    </span>
                    <span className="ml-auto text-[10px] text-[var(--color-txt-muted)] shrink-0">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { Mso } from "@/components/ui/icons";
import type { Message, User } from "@/lib/types";

function parseDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === "object" && ts !== null && "toDate" in ts)
    return (ts as { toDate: () => Date }).toDate();
  return new Date(String(ts));
}

function timeAgo(ts: unknown): string {
  const diff = Date.now() - parseDate(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusDotColor(status: User["status"] | undefined): string {
  switch (status) {
    case "idle":
      return "#fbbf24";
    case "dnd":
      return "#f87171";
    case "offline":
      return "var(--color-outline)";
    default:
      return "var(--color-secondary)";
  }
}

export function RightSidebar({
  pins,
  onlineUsers,
  channelName,
}: {
  pins: Message[];
  onlineUsers: User[];
  channelName: string;
}) {
  const online = onlineUsers.filter((u) => u.online !== false);
  const offline = onlineUsers.filter((u) => u.online === false);

  return (
    <aside
      className="hidden lg:flex flex-col w-[260px] shrink-0 border-l border-outline-variant bg-surface-container-low overflow-y-auto no-scrollbar"
      role="complementary"
      aria-label="Members and pinned updates"
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Pinned Updates widget */}
        <section className="glass-panel rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-surface-container-high to-surface-container flex items-center gap-2">
            <Mso name="push_pin" size={16} className="text-secondary" fill />
            <h3 className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider">
              Pinned Updates
            </h3>
          </div>
          {pins.length === 0 ? (
            <p className="px-4 py-4 font-body-sm text-body-sm text-on-surface-variant">
              No pinned messages in #{channelName} yet.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/20">
              {pins.slice(0, 3).map((pin) => (
                <li key={pin.id} className="px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-code-md shrink-0"
                      style={{ background: pin.color || "#2d3449" }}
                    >
                      {(pin.author || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
                      {pin.author}
                    </span>
                    <span className="font-body-sm text-body-sm text-[10px] text-on-surface-variant ml-auto shrink-0">
                      {timeAgo(pin.timestamp)}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 whitespace-pre-line">
                    {pin.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Members list */}
        <section>
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-2 px-1">
            <Mso name="group" size={16} />
            Members — {onlineUsers.length}
          </h3>

          {online.length > 0 && (
            <div className="mb-2">
              <p className="font-label-caps text-label-caps text-[10px] text-on-surface-variant/70 uppercase tracking-wider px-1 mb-1">
                Online — {online.length}
              </p>
              <ul className="flex flex-col gap-0.5">
                {online.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-container-high transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: u.color || "#a078ff" }}
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          u.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-container-low" style={{ backgroundColor: statusDotColor(u.status) }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-body-sm text-body-sm text-on-surface truncate">
                        {u.name}
                      </span>
                      {u.customStatus && (
                        <span className="font-body-sm text-[10px] text-on-surface-variant truncate">
                          {u.customStatus}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {offline.length > 0 && (
            <div>
              <p className="font-label-caps text-label-caps text-[10px] text-on-surface-variant/70 uppercase tracking-wider px-1 mb-1">
                Offline — {offline.length}
              </p>
              <ul className="flex flex-col gap-0.5">
                {offline.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-container-high transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs opacity-60"
                        style={{ backgroundColor: u.color || "#2d3449" }}
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          u.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-outline rounded-full border-2 border-surface-container-low" />
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {u.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onlineUsers.length === 0 && (
            <p className="px-1 font-body-sm text-body-sm text-on-surface-variant">
              No members online right now.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}

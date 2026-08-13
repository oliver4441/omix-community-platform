/**
 * Global search — messages, threads, users, communities, channels, files, events.
 *
 * Architecture: the `SearchService` interface decouples the route handler from
 * the ranking engine. Today the implementation is SQL LIKE over D1 (fast and
 * dependency-free); a semantic/AI ranker can be added later by implementing
 * `SearchService.rank()` without touching the API shape.
 *
 * Filters: `from:`, `in:`, `before:`, `after:`, `has:image|file|link|reply|pinned`
 */
import type { Env } from "./env";
import { json, now } from "./util";
import type { SessionUser } from "./util";
import { likePattern, parseFilters, type SearchFilters } from "./search-util";

export type { SearchFilters };

export interface SearchResult {
  id: string;
  kind: "message" | "thread" | "user" | "server" | "channel" | "file" | "event";
  title: string;
  snippet?: string;
  /** Author / owner display info. */
  by?: string;
  /** Context ids for client navigation. */
  context?: { serverId?: string; channelId?: string; messageId?: string };
  timestamp?: string;
}

export interface SearchService {
  query(q: string, filters: SearchFilters, limit: number): Promise<SearchResult[]>;
}

const HAS_IMAGE = ["png", "jpg", "jpeg", "gif", "webp", "image"];

export class D1SearchService implements SearchService {
  constructor(
    private env: Env,
    private user: SessionUser
  ) {}

  /** Channels the caller may see: member servers + their own DMs. */
  private async visibleScope(): Promise<{
    channelIds: string[];
    serverIds: string[];
  }> {
    const { results: members } = await this.env.DB.prepare(
      "SELECT server_id FROM server_members WHERE user_id = ? AND banned = 0"
    )
      .bind(this.user.id)
      .all<{ server_id: string }>();
    const serverIds = (members || []).map((m) => m.server_id);
    let channelIds: string[] = [];
    if (serverIds.length > 0) {
      const placeholders = serverIds.map(() => "?").join(",");
      const { results: channels } = await this.env.DB.prepare(
        `SELECT id FROM channels WHERE server_id IN (${placeholders})`
      )
        .bind(...serverIds)
        .all<{ id: string }>();
      channelIds = (channels || []).map((c) => c.id);
    }
    const { results: dms } = await this.env.DB.prepare(
      "SELECT id, participants FROM dm_channels"
    ).all<Record<string, unknown>>();
    for (const dm of dms || []) {
      try {
        const parts = JSON.parse((dm.participants as string) || "[]") as string[];
        if (parts.includes(this.user.id)) channelIds.push(dm.id as string);
      } catch {
        /* ignore malformed row */
      }
    }
    return { channelIds, serverIds };
  }

  private async findUserIdByName(name: string): Promise<string[]> {
    const { results } = await this.env.DB.prepare(
      "SELECT id FROM users WHERE full_name LIKE ? ESCAPE '\\' LIMIT 5"
    )
      .bind(likePattern(name))
      .all<{ id: string }>();
    return (results || []).map((r) => r.id);
  }

  async query(q: string, filters: SearchFilters, limit: number): Promise<SearchResult[]> {
    const { channelIds, serverIds } = await this.visibleScope();
    const results: SearchResult[] = [];
    const push = (r: SearchResult) => {
      if (results.length < limit) results.push(r);
    };
    const timeRange = (field: string) => {
      const parts: string[] = [];
      const binds: unknown[] = [];
      if (filters.after) {
        parts.push(`${field} >= ?`);
        binds.push(filters.after);
      }
      if (filters.before) {
        parts.push(`${field} <= ?`);
        binds.push(filters.before);
      }
      return { parts, binds };
    };

    // ── Messages (channels + DMs), filtered by visibility ──
    if (q || filters.has?.length || filters.from || filters.in) {
      const fromIds = filters.from ? await this.findUserIdByName(filters.from) : null;
      const channelClause =
        channelIds.length > 0
          ? `channel_id IN (${channelIds.map(() => "?").join(",")})`
          : "1 = 0";
      const dmClause =
        channelIds.length > 0
          ? `dm_channel_id IN (${channelIds.map(() => "?").join(",")})`
          : "1 = 0";

      for (const [table, col] of [
        ["messages", "channel_id"],
        ["dm_messages", "dm_channel_id"],
      ] as const) {
        const parts: string[] = ["deleted = 0"];
        const binds: unknown[] = [];
        if (table === "messages") parts.push(channelClause);
        else parts.push(dmClause);
        binds.push(...channelIds);
        if (q) {
          parts.push("text LIKE ? ESCAPE '\\'");
          binds.push(likePattern(q));
        }
        if (filters.in) {
          parts.push(
            `(${col} IN (SELECT id FROM channels WHERE name LIKE ? ESCAPE '\\'))`
          );
          binds.push(likePattern(filters.in));
        }
        if (filters.from) {
          if (fromIds && fromIds.length > 0) {
            parts.push(`author_id IN (${fromIds.map(() => "?").join(",")})`);
            binds.push(...fromIds);
          } else {
            parts.push("author LIKE ? ESCAPE '\\'");
            binds.push(likePattern(filters.from));
          }
        }
        const range = timeRange("timestamp");
        parts.push(...range.parts);
        binds.push(...range.binds);
        if (filters.has?.includes("image")) {
          parts.push("(file_type LIKE 'image/%' OR lower(file_name) GLOB '*.png' OR lower(file_name) GLOB '*.jpg' OR lower(file_name) GLOB '*.gif' OR lower(file_name) GLOB '*.webp')");
        } else if (filters.has?.includes("file")) {
          parts.push("file_url IS NOT NULL AND file_url != ''");
        }
        if (filters.has?.includes("link")) {
          parts.push("(text LIKE '%http://%' OR text LIKE '%https://%')");
        }
        if (filters.has?.includes("reply")) {
          parts.push("reply_to IS NOT NULL AND reply_to != ''");
        }
        if (filters.has?.includes("pinned")) {
          parts.push("pinned = 1");
        }
        const sql = `SELECT * FROM ${table} WHERE ${parts.join(" AND ")}
                     ORDER BY timestamp DESC LIMIT ?`;
        const { results: rows } = await this.env.DB.prepare(sql)
          .bind(...binds, limit)
          .all<Record<string, unknown>>();
        for (const row of rows || []) {
          const isFile = Boolean(row.file_url);
          const isImage = String(row.file_type || "").startsWith("image/") ||
            HAS_IMAGE.some((ext) => String(row.file_name || "").toLowerCase().endsWith(`.${ext}`));
          push({
            id: row.id as string,
            kind: isImage ? "file" : isFile ? "file" : "message",
            title: (row.text as string) || (row.file_name as string) || "(attachment)",
            by: (row.author as string) || "Anonymous",
            context: {
              channelId: (row.channel_id as string) || (row.dm_channel_id as string) || "",
              messageId: row.id as string,
            },
            timestamp: row.timestamp as string,
          });
        }
      }
    }

    // ── Users ──
    if (q && !filters.has?.length && !filters.from && !filters.in) {
      const { results: users } = await this.env.DB.prepare(
        `SELECT id, full_name, avatar_url FROM users
         WHERE full_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' LIMIT ?`
      )
        .bind(likePattern(q), likePattern(q), limit)
        .all<Record<string, unknown>>();
      for (const u of users || []) {
        push({
          id: u.id as string,
          kind: "user",
          title: (u.full_name as string) || "Unknown",
          snippet: "",
        });
      }
    }

    // ── Communities (servers) ──
    if (q && !filters.has?.length) {
      const { results: servers } = await this.env.DB.prepare(
        "SELECT id, name, description, privacy FROM servers WHERE name LIKE ? ESCAPE '\\' LIMIT ?"
      )
        .bind(likePattern(q), limit)
        .all<Record<string, unknown>>();
      for (const s of servers || []) {
        if (
          s.privacy === "public" ||
          serverIds.includes(s.id as string) ||
          (s.created_by as string) === this.user.id
        ) {
          push({
            id: s.id as string,
            kind: "server",
            title: (s.name as string) || "",
            snippet: (s.description as string) || "",
            context: { serverId: s.id as string },
          });
        }
      }
    }

    // ── Channels (visible servers only) ──
    if (q && !filters.has?.length && serverIds.length > 0) {
      const { results: channels } = await this.env.DB.prepare(
        `SELECT id, server_id, name, topic FROM channels
         WHERE server_id IN (${serverIds.map(() => "?").join(",")})
           AND name LIKE ? ESCAPE '\\' LIMIT ?`
      )
        .bind(...serverIds, likePattern(q), limit)
        .all<Record<string, unknown>>();
      for (const ch of channels || []) {
        push({
          id: ch.id as string,
          kind: "channel",
          title: `#${ch.name || ""}`,
          snippet: (ch.topic as string) || "",
          context: { serverId: ch.server_id as string, channelId: ch.id as string },
        });
      }
    }

    // ── Events (visible servers) ──
    if (q && serverIds.length > 0) {
      const { results: events } = await this.env.DB.prepare(
        `SELECT id, server_id, title, description, starts_at FROM events
         WHERE server_id IN (${serverIds.map(() => "?").join(",")})
           AND title LIKE ? ESCAPE '\\' ORDER BY starts_at DESC LIMIT ?`
      )
        .bind(...serverIds, likePattern(q), limit)
        .all<Record<string, unknown>>();
      for (const e of events || []) {
        push({
          id: e.id as string,
          kind: "event",
          title: (e.title as string) || "",
          snippet: (e.description as string) || "",
          context: { serverId: e.server_id as string },
          timestamp: e.starts_at as string,
        });
      }
    }

    return results;
  }
}

export async function handleSearch(
  env: Env,
  request: Request,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/search" || request.method !== "GET") return null;

  const { q, filters } = parseFilters(url.searchParams);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 100);

  if (!q && !filters.has?.length && !filters.from && !filters.in) {
    return json({ results: [], filters }, 200, env);
  }

  const service: SearchService = new D1SearchService(env, user);
  const results = await service.query(q, filters, limit);
  return json({ results, filters, at: now() }, 200, env);
}

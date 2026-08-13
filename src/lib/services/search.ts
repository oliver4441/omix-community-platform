/**
 * Search service (client) — talks to the worker's global /search endpoint.
 * Filter grammar: `from:`, `in:`, `before:`, `after:`, `has:image|file|link|reply|pinned`
 */
import { api } from "@/lib/api";

export interface SearchFilters {
  from?: string;
  in?: string;
  before?: string;
  after?: string;
  has?: string[];
}

export interface SearchResultItem {
  id: string;
  kind: "message" | "thread" | "user" | "server" | "channel" | "file" | "event";
  title: string;
  snippet?: string;
  by?: string;
  context?: { serverId?: string; channelId?: string; messageId?: string };
  timestamp?: string;
}

export interface SearchResponse {
  results: SearchResultItem[];
  filters: SearchFilters;
  at: string;
}

/** Parse a raw query string into free text + filters. */
export function parseSearchQuery(raw: string): { q: string; filters: SearchFilters } {
  const tokens = raw.trim().split(/\s+/);
  const filters: SearchFilters = { has: [] };
  const qTokens: string[] = [];
  for (const token of tokens) {
    const m = token.match(/^(from|in|before|after|has):(.+)$/);
    if (m) {
      const [, key, value] = m;
      if (key === "from") filters.from = value;
      else if (key === "in") filters.in = value;
      else if (key === "before") filters.before = value;
      else if (key === "after") filters.after = value;
      else filters.has = [...(filters.has || []), value.toLowerCase()];
    } else {
      qTokens.push(token);
    }
  }
  return { q: qTokens.join(" "), filters };
}

export async function search(rawQuery: string, limit = 30): Promise<SearchResponse> {
  const { q, filters } = parseSearchQuery(rawQuery);
  if (!q && !filters.has?.length && !filters.from && !filters.in) {
    return { results: [], filters, at: new Date().toISOString() };
  }
  try {
    const res = await api.search(q, filters, limit);
    return {
      results: res.results.map((r) => ({
        ...r,
        kind: r.kind as SearchResultItem["kind"],
      })),
      filters,
      at: res.at,
    };
  } catch (err) {
    // Offline / unconfigured — surface a friendly error rather than throwing.
    const code = (err as { code?: string })?.code;
    throw new Error(
      code === "api_not_configured"
        ? "Global search needs the omix-api backend"
        : "Search is unavailable right now"
    );
  }
}

/**
 * Pure search helpers (no env/DB imports) — shared by the search service and
 * by unit tests without dragging Cloudflare bindings into other typechecks.
 */

export interface SearchFilters {
  from?: string;
  in?: string;
  before?: string;
  after?: string;
  has?: string[];
}

/** Escape LIKE wildcards so user input is matched literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Parse a raw query string into free text + filters (from:/in:/before:/after:/has:). */
export function parseFilters(params: URLSearchParams): { q: string; filters: SearchFilters } {
  const raw = (params.get("q") || "").trim().slice(0, 200);
  const tokens = raw.split(/\s+/);
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

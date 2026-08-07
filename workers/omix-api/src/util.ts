import type { Env } from "./env";

export const JSON_HEADERS = { "Content-Type": "application/json" };

export function corsHeaders(env: Env): Record<string, string> {
  const origin = env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(env) },
  });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

export function now(): string {
  return new Date().toISOString();
}

export function genToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function genId(): string {
  return crypto.randomUUID();
}

/** PBKDF2-SHA256 password hashing (Web Crypto — no deps). */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 60_000, hash: "SHA-256" },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getBearer(request: Request): string | null {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  emailConfirmedAt: string | null;
  githubUsername: string;
  isAdmin: boolean;
}

export async function getAdminSettings(env: Env): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare(`SELECT data FROM config WHERE id = 'settings'`).first<{
    data: string;
  }>();
  try {
    return JSON.parse(row?.data || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Resolve the caller from the Authorization header; null = unauthenticated. */
export async function getSessionUser(env: Env, request: Request): Promise<SessionUser | null> {
  const token = getBearer(request);
  if (!token) return null;
  const row = await env.DB
    .prepare(
      `SELECT s.expires_at, u.id, u.email, u.full_name, u.avatar_url,
              u.email_confirmed_at, u.github_username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .bind(token)
    .first<Record<string, unknown>>();
  if (!row) return null;
  if (new Date(row.expires_at as string).getTime() < Date.now()) return null;
  const admin = await getAdminSettings(env);
  return {
    id: row.id as string,
    email: row.email as string,
    fullName: (row.full_name as string) || "",
    avatarUrl: (row.avatar_url as string) || "",
    emailConfirmedAt: (row.email_confirmed_at as string) || null,
    githubUsername: (row.github_username as string) || "",
    isAdmin: row.email === admin.adminEmail || row.id === admin.adminUid,
  };
}

/** Require a session; otherwise returns a 401 Response. */
export async function requireUser(
  env: Env,
  request: Request
): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getSessionUser(env, request);
  if (!user) return { response: json({ error: "unauthorized" }, 401, env) };
  return { user };
}

export function appOrigin(env: Env, request: Request): string {
  return env.APP_ORIGIN || new URL(request.url).origin;
}

export function workerOrigin(request: Request): string {
  return new URL(request.url).origin;
}

// ── JSON helpers (DB stores JSON as TEXT) ──
export function parseJson<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

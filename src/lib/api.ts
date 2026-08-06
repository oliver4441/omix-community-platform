/**
 * omix-api client — talks to the Cloudflare Workers backend.
 *
 * Set NEXT_PUBLIC_API_BASE_URL at build time to point the app at a deployed
 * worker (e.g. https://omix-api.<your-subdomain>.workers.dev). Until then the
 * base URL is empty and every helper degrades gracefully (returns null/false)
 * so the app keeps using its legacy client-side implementations.
 */
export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "";

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Ably authUrl — when set, the Ably client uses it instead of the hardcoded key. */
export function getAblyAuthUrl(): string | null {
  return API_BASE_URL ? `${API_BASE_URL}/ably/token` : null;
}

/** Secure admin-password check via the worker (service role). null = worker unavailable. */
export async function verifyAdminPasswordViaApi(password: string): Promise<boolean | null> {
  const res = await fetchApi<{ valid: boolean }>("/admin/verify-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return res === null ? null : res.valid;
}

/** Queue a push notification through the worker (inserts into the notifications table). */
export async function queuePushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const res = await fetchApi<{ ok: boolean }>("/notifications/queue", {
    method: "POST",
    body: JSON.stringify({ userId, title, body, data }),
  });
  return res?.ok ?? false;
}

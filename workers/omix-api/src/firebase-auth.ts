import type { Env } from "./env";
import { json, readJson, now, genId, genToken } from "./util";

const FIREBASE_WEB_API_KEY = "AIzaSyAs7C-OegYfoPxj8LOYNagZgcMi9yo45Zg";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface FirebaseLookupUser {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoUrl?: string;
  providerUserInfo?: Array<{ providerId?: string; federatedId?: string; displayName?: string }>;
}

async function issueSession(env: Env, userId: string): Promise<string> {
  const token = genToken(32);
  const ts = now();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, userId, ts, new Date(Date.now() + SESSION_TTL_MS).toISOString())
    .run();
  return token;
}

export async function handleFirebaseAuth(path: string, request: Request, env: Env): Promise<Response | null> {
  if (path !== "/auth/firebase/session" || request.method !== "POST") return null;

  const { idToken, displayName, photoURL } = await readJson<{
    idToken?: string;
    displayName?: string;
    photoURL?: string;
  }>(request);

  if (!idToken) return json({ error: "firebase_token_required" }, 400, env);

  const key = env.FIREBASE_WEB_API_KEY || FIREBASE_WEB_API_KEY;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) return json({ error: "invalid_firebase_token" }, 401, env);

  const payload = (await response.json()) as { users?: FirebaseLookupUser[] };
  const fbUser = payload.users?.[0];
  if (!fbUser?.localId || !fbUser.email) return json({ error: "firebase_profile_incomplete" }, 400, env);

  const email = fbUser.email.toLowerCase();
  const ts = now();
  const name = displayName || fbUser.displayName || email.split("@")[0] || "User";
  const avatar = photoURL || fbUser.photoUrl || "";

  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<Record<string, unknown>>();

  if (!user) {
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_confirmed_at, full_name, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, fbUser.emailVerified ? ts : null, name, avatar, ts, ts)
      .run();
    user = { id, email, full_name: name, avatar_url: avatar, github_username: "", email_confirmed_at: fbUser.emailVerified ? ts : null };
  } else {
    await env.DB.prepare(
      `UPDATE users SET full_name = ?, avatar_url = ?,
       email_confirmed_at = CASE WHEN ? = 1 THEN COALESCE(email_confirmed_at, ?) ELSE email_confirmed_at END,
       updated_at = ? WHERE id = ?`
    )
      .bind(name, avatar || (user.avatar_url as string) || "", fbUser.emailVerified ? 1 : 0, ts, ts, user.id)
      .run();
  }

  const token = await issueSession(env, user.id as string);
  return json(
    {
      ok: true,
      token,
      user: {
        id: user.id,
        email,
        fullName: name,
        avatarUrl: avatar || (user.avatar_url as string) || "",
        githubUsername: (user.github_username as string) || "",
        emailConfirmedAt: fbUser.emailVerified ? ts : (user.email_confirmed_at as string) || null,
      },
    },
    200,
    env
  );
}

import type { Env } from "./env";
import {
  json,
  readJson,
  now,
  genToken,
  genId,
  hashPassword,
  appOrigin,
  workerOrigin,
} from "./util";
import { sendEmail } from "./email";
import { getSessionUser, getBearer } from "./util";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function toUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || "",
    avatarUrl: row.avatar_url || "",
    githubUsername: row.github_username || "",
    emailConfirmedAt: row.email_confirmed_at || null,
  };
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

async function createAndSendToken(env: Env, userId: string, email: string, type: "verify" | "reset") {
  const token = genToken(24);
  const ts = now();
  await env.DB.prepare(
    "INSERT INTO email_tokens (token, user_id, type, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)"
  )
    .bind(token, userId, type, ts, new Date(Date.now() + TOKEN_TTL_MS).toISOString())
    .run();

  const origin = env.APP_ORIGIN || "https://omix.app";
  const link = `${origin}/?token=${token}&type=${type}`;
  const subject =
    type === "verify" ? "Verify your Omix email" : "Reset your Omix password";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0b1326;color:#dae2fd;border-radius:12px">
      <h2 style="margin:0 0 12px;color:#d0bcff">Omix Community</h2>
      <p style="line-height:1.6">${type === "verify" ? "Confirm your email to activate your account." : "Click below to set a new password. This link expires in 24 hours."}</p>
      <a href="${link}" style="display:inline-block;margin:16px 0;padding:10px 18px;background:#5516be;color:#fff;border-radius:6px;text-decoration:none">${type === "verify" ? "Verify email" : "Reset password"}</a>
      <p style="color:#958ea0;font-size:12px">Or paste this link: ${link}</p>
    </div>`;
  await sendEmail(env, email, subject, html);
}

export async function handleAuth(path: string, request: Request, env: Env): Promise<Response | null> {
  switch (path) {
    case "/auth/signup":
      return signup(env, request);
    case "/auth/verify":
      return verifyEmail(env, request);
    case "/auth/login":
      return login(env, request);
    case "/auth/forgot":
      return forgot(env, request);
    case "/auth/reset":
      return reset(env, request);
    case "/auth/resend-verification":
      return resendVerification(env, request);
    case "/auth/github/login":
      return githubLogin(env, request);
    case "/auth/github/callback":
      return githubCallback(env, request);
    case "/auth/change-password":
      return changePassword(env, request);
    case "/auth/account":
      return deleteAccount(env, request);
    default:
      return null;
  }
}

/** Change password from the settings screen (requires the current password). */
async function changePassword(env: Env, request: Request): Promise<Response> {
  const user = await getSessionUser(env, request);
  if (!user) return json({ error: "unauthorized" }, 401, env);
  const { currentPassword, newPassword } = await readJson<{
    currentPassword?: string;
    newPassword?: string;
  }>(request);
  if (!newPassword || newPassword.length < 6)
    return json({ error: "password_too_short" }, 400, env);

  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt FROM users WHERE id = ?"
  )
    .bind(user.id)
    .first<Record<string, unknown>>();
  // GitHub-only accounts have no password — reject rather than guessing.
  if (!row || !row.password_hash) return json({ error: "no_password" }, 400, env);
  const hash = await hashPassword(currentPassword || "", row.password_salt as string);
  if (hash !== row.password_hash) return json({ error: "wrong_password" }, 403, env);

  const salt = genToken(16);
  const newHash = await hashPassword(newPassword, salt);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?")
      .bind(newHash, salt, now(), user.id),
    // Keep the current session, revoke all others.
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?")
      .bind(user.id, getBearer(request) || ""),
  ]);
  return json({ ok: true }, 200, env);
}

/** Permanently delete the account and its data (requires the password). */
async function deleteAccount(env: Env, request: Request): Promise<Response> {
  const user = await getSessionUser(env, request);
  if (!user) return json({ error: "unauthorized" }, 401, env);
  const { password } = await readJson<{ password?: string }>(request);

  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt FROM users WHERE id = ?"
  )
    .bind(user.id)
    .first<Record<string, unknown>>();
  if (row?.password_hash) {
    const hash = await hashPassword(password || "", row.password_salt as string);
    if (hash !== row.password_hash) return json({ error: "wrong_password" }, 403, env);
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM email_tokens WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM profiles WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM presence WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM stats WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM typing WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM fcm_tokens WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM notification_settings WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM board_votes WHERE session_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM server_members WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM call_log WHERE caller_id = ? OR callee_id = ?").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM dm_messages WHERE author_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM dm_channels WHERE participants LIKE ?").bind(`%${user.id}%`),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  return json({ ok: true }, 200, env);
}

async function signup(env: Env, request: Request): Promise<Response> {
  const { email, password, displayName } = await readJson<{
    email?: string;
    password?: string;
    displayName?: string;
  }>(request);
  const em = (email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(em)) return json({ error: "invalid_email" }, 400, env);
  if (!password || password.length < 6) return json({ error: "password_too_short" }, 400, env);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(em).first();
  if (existing) return json({ error: "email_taken" }, 409, env);

  const salt = genToken(16);
  const hash = await hashPassword(password, salt);
  const id = genId();
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, password_salt, full_name, email_confirmed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, em, hash, salt, (displayName || em.split("@")[0]).trim(), ts, ts, ts)
    .run();

  // Verification is disabled — accounts are usable immediately.
  return json({ ok: true, needsVerification: false }, 200, env);
}

async function verifyEmail(env: Env, request: Request): Promise<Response> {
  const { token } = await readJson<{ token?: string }>(request);
  const row = await env.DB.prepare(
    "SELECT * FROM email_tokens WHERE token = ? AND type = 'verify' AND used = 0"
  )
    .bind(token || "")
    .first<Record<string, unknown>>();
  if (!row) return json({ error: "invalid_token" }, 400, env);
  if (new Date(row.expires_at as string).getTime() < Date.now())
    return json({ error: "expired_token" }, 400, env);

  await env.DB.batch([
    env.DB.prepare("UPDATE email_tokens SET used = 1 WHERE token = ?").bind(token),
    env.DB.prepare("UPDATE users SET email_confirmed_at = ? WHERE id = ?").bind(now(), row.user_id),
  ]);
  return json({ ok: true }, 200, env);
}

async function login(env: Env, request: Request): Promise<Response> {
  const { email, password } = await readJson<{ email?: string; password?: string }>(request);
  const em = (email || "").trim().toLowerCase();
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first<
    Record<string, unknown>
  >();
  if (!user || !user.password_hash) return json({ error: "invalid_credentials" }, 401, env);

  const hash = await hashPassword(password || "", user.password_salt as string);
  if (hash !== user.password_hash) return json({ error: "invalid_credentials" }, 401, env);

  const token = await issueSession(env, user.id as string);
  await env.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?")
    .bind(now(), user.id)
    .run();
  return json({ ok: true, token, user: toUser(user) }, 200, env);
}

async function forgot(env: Env, request: Request): Promise<Response> {
  const { email } = await readJson<{ email?: string }>(request);
  const em = (email || "").trim().toLowerCase();
  const user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(em).first<{
    id: string;
    email: string;
  }>();
  // Don't reveal whether the email exists.
  if (user) await createAndSendToken(env, user.id, user.email, "reset");
  return json({ ok: true }, 200, env);
}

async function reset(env: Env, request: Request): Promise<Response> {
  const { token, password } = await readJson<{ token?: string; password?: string }>(request);
  if (!password || password.length < 6) return json({ error: "password_too_short" }, 400, env);
  const row = await env.DB.prepare(
    "SELECT * FROM email_tokens WHERE token = ? AND type = 'reset' AND used = 0"
  )
    .bind(token || "")
    .first<Record<string, unknown>>();
  if (!row) return json({ error: "invalid_token" }, 400, env);
  if (new Date(row.expires_at as string).getTime() < Date.now())
    return json({ error: "expired_token" }, 400, env);

  const salt = genToken(16);
  const hash = await hashPassword(password, salt);
  await env.DB.batch([
    env.DB.prepare("UPDATE email_tokens SET used = 1 WHERE token = ?").bind(token),
    env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(
      hash,
      salt,
      row.user_id
    ),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
  ]);
  return json({ ok: true }, 200, env);
}

async function resendVerification(env: Env, request: Request): Promise<Response> {
  const { email } = await readJson<{ email?: string }>(request);
  const em = (email || "").trim().toLowerCase();
  const user = await env.DB.prepare(
    "SELECT id, email FROM users WHERE email = ? AND email_confirmed_at IS NULL"
  )
    .bind(em)
    .first<{ id: string; email: string }>();
  if (user) await createAndSendToken(env, user.id, user.email, "verify");
  return json({ ok: true }, 200, env);
}

async function githubLogin(env: Env, request: Request): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID) return json({ error: "github_not_configured" }, 503, env);
  const state = genToken(16);
  const cb = `${workerOrigin(request)}/auth/github/callback`;
  const url =
    `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(cb)}&scope=read:user user:email&state=${state}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Set-Cookie": `gh_state=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function githubCallback(env: Env, request: Request): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json({ error: "github_not_configured" }, 503, env);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("Cookie") || "";
  const stateMatch = cookies.match(/gh_state=([^;]+)/);
  if (!code || !state || !stateMatch || stateMatch[1] !== state) {
    return json({ error: "invalid_state" }, 400, env);
  }

  const tokRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = (await tokRes.json()) as { access_token?: string };
  if (!access_token) return json({ error: "oauth_failed" }, 400, env);

  const ghUser = (await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "omix" },
  }).then((r) => r.json())) as {
    id: number;
    login: string;
    name?: string;
    email?: string | null;
    avatar_url?: string;
  };

  // GitHub's public email may be hidden — fetch the verified list if needed.
  let email = ghUser.email || null;
  if (!email) {
    const emails = (await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "omix" },
    }).then((r) => r.json())) as Array<{ email: string; primary: boolean; verified: boolean }>;
    email = emails.find((e) => e.primary && e.verified)?.email || emails[0]?.email || null;
  }
  if (!email) return json({ error: "no_email" }, 400, env);

  const em = email.toLowerCase();
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first<
    Record<string, unknown>
  >();
  const ts = now();
  if (!user) {
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_confirmed_at, full_name, avatar_url, github_username, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        em,
        ts,
        ghUser.name || ghUser.login || em.split("@")[0],
        ghUser.avatar_url || "",
        ghUser.login,
        ts,
        ts
      )
      .run();
    user = { id } as Record<string, unknown>;
  } else {
    await env.DB.prepare(
      `UPDATE users SET github_username = ?, avatar_url = ?, full_name = ?,
              email_confirmed_at = COALESCE(email_confirmed_at, ?), updated_at = ?
       WHERE id = ?`
    )
      .bind(ghUser.login, ghUser.avatar_url || (user.avatar_url as string) || "", ghUser.name || (user.full_name as string) || "", ts, ts, user.id)
      .run();
  }

  const session = await issueSession(env, user.id as string);
  const origin = appOrigin(env, request);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/#session=${session}&github=1`,
      "Set-Cookie": `gh_state=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0`,
    },
  });
}

/**
 * Web Push for Omix — VAPID authentication + RFC 8291 ("aes128gcm")
 * message encryption, implemented entirely on Web Crypto so it runs on
 * Cloudflare Workers with no Node dependencies.
 *
 * Flow:
 *   browser ──(permission + subscribe)──▶ PUT /push/subscription
 *   worker  ──(encrypt + POST)──────────▶ browser push service
 *   browser ──(decrypts internally)─────▶ sw.js `push` event
 *
 * The worker derives the VAPID public key from the private key, so only
 * one secret (VAPID_PRIVATE_KEY) needs to be provisioned.
 */
import { now, genId, parseJson, stringifyJson } from "./util";

/**
 * Minimal env surface this module needs — satisfied structurally by both
 * the gateway's Env and omix-cron's narrower Env (which also runs deliverPending).
 */
interface PushEnv {
  DB: D1Database;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ── base64url helpers ──
function b64uToBuf(s: string): ArrayBuffer {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function bufToB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...parts: (Uint8Array | ArrayBuffer)[]): Uint8Array {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function hmac(keyBytes: ArrayBuffer | Uint8Array, data: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    (keyBytes instanceof Uint8Array ? keyBytes.buffer : keyBytes) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, data);
}

/**
 * HKDF-SHA256(ikm, salt, info, L) with a single expand block (L <= 32).
 * Implemented via raw HMAC so it works identically on Workers and Node.
 */
async function hkdf(
  ikm: ArrayBuffer,
  salt: ArrayBuffer,
  info: Uint8Array,
  length: number
): Promise<ArrayBuffer> {
  // HKDF-Extract: PRK = HMAC(salt, ikm) — empty salt becomes 32 zero bytes.
  const prk = await hmac(salt.byteLength ? salt : new Uint8Array(32), new Uint8Array(ikm));
  // HKDF-Expand: T(1) = HMAC(PRK, info || 0x01); take the first L bytes.
  const t1 = await hmac(prk, concatBytes(info, new Uint8Array([1])));
  return t1.slice(0, length);
}

// ── RFC 8291 encryption ──

const KEY_INFO_PREFIX = new TextEncoder().encode("WebPush: info\u0000");
const CEK_INFO = new TextEncoder().encode("Content-Encoding: aes128gcm\u0000");
const NONCE_INFO = new TextEncoder().encode("Content-Encoding: nonce\u0000");
const RECORD_SIZE = 4096;

interface EncryptInput {
  /** Subscription p256dh (65-byte uncompressed point, base64url). */
  uaPublic: string;
  /** Subscription auth secret (16 bytes, base64url). */
  uaAuth: string;
  /** Fresh ephemeral server ECDH keypair (per message). */
  asKeyPair: CryptoKeyPair;
  /** 16 random bytes. */
  salt: Uint8Array;
  plaintext: Uint8Array;
}

/**
 * Encrypt a push payload per RFC 8291 and return the complete
 * aes128gcm content-coding body (header || ciphertext).
 */
async function encryptPayload(input: EncryptInput): Promise<Uint8Array> {
  const { uaPublic, uaAuth, asKeyPair, salt, plaintext } = input;
  // workers-types types exportKey("raw") as ArrayBuffer | JsonWebKey.
  const asPublicRaw = (await crypto.subtle.exportKey("raw", asKeyPair.publicKey)) as ArrayBuffer;
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    b64uToBuf(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ecdh_secret = ECDH(as_private, ua_public)
  // workers-types doesn't export EcdhKeyDeriveParams, so derive the algorithm
  // type from the API itself.
  const ecdhSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey } as Parameters<typeof crypto.subtle.deriveBits>[0],
    asKeyPair.privateKey,
    256
  );

  // PRK_key = HKDF-Extract(auth_secret, ecdh_secret)
  // IKM     = HKDF-Expand(PRK_key, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = concatBytes(KEY_INFO_PREFIX, new Uint8Array(b64uToBuf(uaPublic)), asPublicRaw);
  const ikm = await hkdf(ecdhSecret, b64uToBuf(uaAuth), keyInfo, 32);

  // PRK = HKDF-Extract(salt, IKM) — extract only, used directly as the
  // HMAC key for the RFC 8188 expand steps below.
  const prk = await hmac(salt.buffer as ArrayBuffer, new Uint8Array(ikm));
  // CEK   = HKDF-Expand(PRK, "Content-Encoding: aes128gcm" || 0x00, 16)
  // NONCE = HKDF-Expand(PRK, "Content-Encoding: nonce" || 0x00, 12)
  const cek = (await hmac(prk, concatBytes(CEK_INFO, new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concatBytes(NONCE_INFO, new Uint8Array([1])))).slice(0, 12);

  // Single record: plaintext || padding delimiter (0x02).
  // RFC 8291 Appendix A: "the padding delimiter octet (0x02) appended".
  const record = concatBytes(plaintext, new Uint8Array([2]));

  // aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid(65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = 65;
  header.set(new Uint8Array(asPublicRaw), 21);

  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: header },
    cekKey,
    record
  );

  return concatBytes(header, new Uint8Array(ciphertext));
}

// ── VAPID (ES256 JWT) ──

let vapidCache: { privateKey: CryptoKey; publicRaw: ArrayBuffer } | null = null;

async function getVapid(env: PushEnv): Promise<{ privateKey: CryptoKey; publicRaw: ArrayBuffer }> {
  if (vapidCache) return vapidCache;
  if (!env.VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY not set");
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64uToBuf(env.VAPID_PRIVATE_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  // Derive the raw public point from the private key's JWK (x, y).
  const jwk = (await crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey;
  const x = new Uint8Array(b64uToBuf(jwk.x! as string));
  const y = new Uint8Array(b64uToBuf(jwk.y! as string));
  const publicRaw = new Uint8Array(65);
  publicRaw[0] = 4;
  publicRaw.set(x, 1);
  publicRaw.set(y, 33);
  vapidCache = { privateKey, publicRaw: publicRaw.buffer };
  return vapidCache;
}

/** VAPID public key (base64url, raw 65-byte point) for the PWA to subscribe with. */
export async function getVapidPublicKey(env: PushEnv): Promise<string> {
  const { publicRaw } = await getVapid(env);
  return bufToB64u(publicRaw);
}

/** Convert a raw r||s ECDSA signature into a DER SEQUENCE for JWT. */
function rawSigToDer(sig: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(sig);
  const encInt = (b: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let out: Uint8Array = b.slice(i);
    if (out[0] & 0x80) out = concatBytes(new Uint8Array([0]), out);
    const der = new Uint8Array(out.length + 2);
    der[0] = 0x02;
    der[1] = out.length;
    der.set(out, 2);
    return der;
  };
  const body = concatBytes(encInt(bytes.slice(0, 32)), encInt(bytes.slice(32)));
  const seq = new Uint8Array(body.length + 2);
  seq[0] = 0x30;
  seq[1] = body.length;
  seq.set(body, 2);
  return seq;
}

/** ES256 VAPID token for the given push-service audience. */
async function createVapidToken(env: PushEnv, audience: string): Promise<string> {
  const { privateKey } = await getVapid(env);
  const enc = (o: unknown) => bufToB64u(new TextEncoder().encode(JSON.stringify(o)));
  const header = enc({ typ: "JWT", alg: "ES256" });
  const payload = enc({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || "mailto:admin@omix.app",
  });
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${bufToB64u(rawSigToDer(sig))}`;
}

// ── Sending ──

/** Encrypt + POST a payload to one subscription's push service. */
async function sendPush(env: PushEnv, sub: PushSubscriptionRow, payload: Uint8Array): Promise<Response> {
  // Same trick as deriveBits: workers-types lacks EcKeyGenParams.
  const asKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" } as Parameters<typeof crypto.subtle.generateKey>[0],
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const body = await encryptPayload({
    uaPublic: sub.p256dh,
    uaAuth: sub.auth,
    asKeyPair,
    salt,
    plaintext: payload,
  });
  const token = await createVapidToken(env, new URL(sub.endpoint).origin);
  const { publicRaw } = await getVapid(env);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: `vapid t=${token}, k=${bufToB64u(publicRaw)}`,
    },
    body,
  });
}

// ── Subscription CRUD ──

export interface PushSubscriptionInput {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  userAgent?: string;
}

export async function saveSubscription(env: PushEnv, userId: string, sub: PushSubscriptionInput): Promise<void> {
  if (!sub.endpoint || !sub.p256dh || !sub.auth) {
    throw new Error("invalid subscription");
  }
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
       user_agent = excluded.user_agent, updated_at = excluded.updated_at`
  )
    .bind(genId(), userId, sub.endpoint, sub.p256dh, sub.auth, sub.userAgent || "", ts, ts)
    .run();
}

export async function deleteSubscription(env: PushEnv, endpoint: string): Promise<void> {
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
}

export async function hasPushSubscriptions(env: PushEnv, userId: string): Promise<boolean> {
  const row = await env.DB
    .prepare("SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first();
  return Boolean(row);
}

async function listSubscriptions(env: PushEnv, userId: string): Promise<PushSubscriptionRow[]> {
  const { results } = await env.DB
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .bind(userId)
    .all<PushSubscriptionRow>();
  return results || [];
}

async function countSubscriptions(env: PushEnv, userId: string): Promise<number> {
  const row = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?")
    .bind(userId)
    .first<{ n: number }>();
  return row?.n || 0;
}

// ── Queueing + delivery ──

/** Best-effort insert into the notifications queue (read by deliverPending). */
export async function queueNotification(
  env: PushEnv,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO notifications (id, target_user_id, title, body, data, sent, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
    )
      .bind(genId(), userId, title, body, stringifyJson(data), now())
      .run();
  } catch (err) {
    console.warn("[push] queueNotification failed", err);
  }
}

/**
 * Sweep undelivered notifications and push them to every subscription the
 * target user has. Runs from omix-cron (every 5 min) and POST /push/send.
 */
export async function deliverPending(env: PushEnv): Promise<{ delivered: number; failed: number }> {
  const { results } = await env.DB
    .prepare(
      "SELECT id, target_user_id, title, body, data, attempts FROM notifications WHERE sent = 0 ORDER BY created_at ASC LIMIT 100"
    )
    .all<Record<string, unknown>>();

  let delivered = 0;
  let failed = 0;

  for (const n of results || []) {
    const userId = n.target_user_id as string;
    const payload = new TextEncoder().encode(
      JSON.stringify({
        title: n.title,
        body: n.body || "",
        data: parseJson<Record<string, unknown>>(n.data as string, {}),
      })
    );

    const subs = await listSubscriptions(env, userId);
    let anySent = false;
    for (const sub of subs) {
      try {
        const res = await sendPush(env, sub, payload);
        if (res.status === 404 || res.status === 410) {
          // Subscription no longer valid — drop it and move on.
          await deleteSubscription(env, sub.endpoint);
          continue;
        }
        if (res.ok) {
          anySent = true;
        } else if (res.status === 400 || res.status === 401) {
          // VAPID misconfiguration — retrying won't help.
          anySent = true;
          console.warn("[push] push service rejected message", res.status, sub.endpoint);
        } else {
          console.warn("[push] push service error", res.status, sub.endpoint);
        }
      } catch (err) {
        console.warn("[push] delivery error", err);
      }
    }

    const remaining = await countSubscriptions(env, userId);
    const attempts = (n.attempts as number) || 0;
    if (anySent || remaining === 0) {
      await markSent(env, n.id as string);
      delivered++;
    } else if (attempts >= 2) {
      // Give up after 3 tries so a flaky service can't wedge the queue.
      await markSent(env, n.id as string);
      delivered++;
    } else {
      await markAttempt(env, n.id as string, attempts + 1);
      failed++;
    }
  }
  return { delivered, failed };
}

async function markSent(env: PushEnv, id: string): Promise<void> {
  await env.DB.prepare("UPDATE notifications SET sent = 1 WHERE id = ?").bind(id).run();
}

async function markAttempt(env: PushEnv, id: string, attempts: number): Promise<void> {
  await env.DB.prepare("UPDATE notifications SET attempts = ? WHERE id = ?")
    .bind(attempts, id)
    .run();
}

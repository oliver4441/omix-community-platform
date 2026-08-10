#!/usr/bin/env node
/**
 * Validates the Web Push encryption algorithm used in
 * workers/omix-api/src/push.ts against the official test vector from
 * RFC 8291 Section 5 / Appendix A, plus a VAPID ES256 JWT round-trip.
 *
 * This script mirrors push.ts (same Web Crypto primitives) so any
 * deviation in the RFC's expected output points to a bug in the shared
 * algorithm. Run:  node scripts/test-push-crypto.js
 */
"use strict";

const { webcrypto } = require("crypto");
const crypto = webcrypto;

// ── helpers (mirror of push.ts) ──
function b64uToBuf(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function bufToB64u(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concatBytes(...parts) {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes instanceof Uint8Array ? keyBytes.buffer : keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, data);
}
async function hkdf(ikm, salt, info, length) {
  const prk = await hmac(salt.byteLength ? salt : new Uint8Array(32), new Uint8Array(ikm));
  const t1 = await hmac(prk, concatBytes(info, new Uint8Array([1])));
  return t1.slice(0, length);
}

// ── RFC 8291 Section 5 test vector ──
const VECTOR = {
  plaintext: "When I grow up, I want to be a watermelon",
  senderPub: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  senderPriv: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  receiverPub: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  receiverPriv: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  // Header from RFC App A: "salt, record size of 4096, and application server
  // public key produce an 86-octet header" (base64url, 115 chars).
  expectedHeader: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  // Ciphertext from RFC App A: "AES-GCM, which emits ciphertext of"
  expectedCiphertext: "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};

async function encryptVector() {
  // Sender: build JWK from the RFC's public point (x,y) + private scalar (d).
  const senderPubBytes = new Uint8Array(b64uToBuf(VECTOR.senderPub));
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bufToB64u(senderPubBytes.slice(1, 33).buffer),
    y: bufToB64u(senderPubBytes.slice(33, 65).buffer),
    d: VECTOR.senderPriv,
  };
  const asKeyPair = {
    privateKey: await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]),
    publicKey: await crypto.subtle.importKey("raw", b64uToBuf(VECTOR.senderPub), { name: "ECDH", namedCurve: "P-256" }, true, []),
  };

  const salt = new Uint8Array(b64uToBuf(VECTOR.salt));
  const plaintext = new TextEncoder().encode(VECTOR.plaintext);

  const asPublicRaw = await crypto.subtle.exportKey("raw", asKeyPair.publicKey);
  const uaPubKey = await crypto.subtle.importKey("raw", b64uToBuf(VECTOR.receiverPub), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: uaPubKey }, asKeyPair.privateKey, 256);

  const KEY_INFO_PREFIX = new TextEncoder().encode("WebPush: info\u0000");
  const CEK_INFO = new TextEncoder().encode("Content-Encoding: aes128gcm\u0000");
  const NONCE_INFO = new TextEncoder().encode("Content-Encoding: nonce\u0000");

  const keyInfo = concatBytes(KEY_INFO_PREFIX, new Uint8Array(b64uToBuf(VECTOR.receiverPub)), asPublicRaw);
  const ikm = await hkdf(ecdhSecret, b64uToBuf(VECTOR.auth), keyInfo, 32);
  const prk = await hmac(salt.buffer, new Uint8Array(ikm));
  const cek = (await hmac(prk, concatBytes(CEK_INFO, new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concatBytes(NONCE_INFO, new Uint8Array([1])))).slice(0, 12);

  const record = concatBytes(plaintext, new Uint8Array([2])); // padding delimiter (0x02) per RFC
  const header = new Uint8Array(86);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(new Uint8Array(asPublicRaw), 21);

  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: header }, cekKey, record);
  return bufToB64u(concatBytes(header, new Uint8Array(ciphertext)).buffer);
}

// ── VAPID JWT round-trip (ES256, raw→DER signature) ──
function rawSigToDer(sig) {
  const bytes = new Uint8Array(sig);
  const encInt = (b) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let out = b.slice(i);
    if (out[0] & 0x80) out = concatBytes(new Uint8Array([0]), out);
    const der = new Uint8Array(out.length + 2);
    der[0] = 0x02; der[1] = out.length; der.set(out, 2);
    return der;
  };
  const body = concatBytes(encInt(bytes.slice(0, 32)), encInt(bytes.slice(32)));
  const seq = new Uint8Array(body.length + 2);
  seq[0] = 0x30; seq[1] = body.length; seq.set(body, 2);
  return seq;
}
function derSigToRaw(der) {
  // Parse SEQUENCE { INTEGER r, INTEGER s } — minimal parser for test only.
  let i = 2;
  const readInt = () => {
    if (der[i] !== 0x02) throw new Error("bad DER");
    const len = der[i + 1];
    const bytes = der.subarray(i + 2, i + 2 + len);
    i = i + 2 + len;
    return bytes.length > 32 ? bytes.subarray(bytes.length - 32) : concatBytes(new Uint8Array(32 - bytes.length), bytes);
  };
  const r = readInt();
  const s = readInt();
  return concatBytes(r, s);
}

async function testVapidJwt() {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const enc = (o) => bufToB64u(new TextEncoder().encode(JSON.stringify(o)));
  const header = enc({ typ: "JWT", alg: "ES256" });
  const payload = enc({ aud: "https://fcm.googleapis.com", exp: Math.floor(Date.now() / 1000) + 3600, sub: "mailto:admin@omix.app" });
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${bufToB64u(rawSigToDer(sig))}`;

  const [h, p, s] = jwt.split(".");
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.publicKey,
    derSigToRaw(new Uint8Array(b64uToBuf(s))),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!verified) throw new Error("VAPID JWT signature did not verify");
  return jwt;
}

async function main() {
  const actual = await encryptVector();
  const expected = VECTOR.expectedHeader + VECTOR.expectedCiphertext;
  if (actual !== expected) {
    console.error("✗ RFC 8291 vector mismatch");
    console.error("  expected:", expected);
    console.error("  actual:  ", actual);
    console.log("  header match:", actual.slice(0, 115) === expected.slice(0, 115));
    console.log("  ciphertext match:", actual.slice(115) === expected.slice(115));
    process.exit(1);
  }
  console.log("✓ RFC 8291 encryption vector matches");

  const jwt = await testVapidJwt();
  console.log("✓ VAPID ES256 JWT signs and verifies (", jwt.slice(0, 40) + "... )");
}

main().catch((err) => {
  console.error("✗ test failed:", err);
  process.exit(1);
});

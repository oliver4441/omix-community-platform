#!/usr/bin/env node
/**
 * Generate a Web Push VAPID keypair (RFC 8291) for the omix workers.
 *
 *   node scripts/generate-vapid.js
 *
 * Then provision (twice — omix-api delivers, omix-cron sweeps):
 *   npx wrangler secret put VAPID_PRIVATE_KEY --config workers/omix-api/wrangler.toml
 *   npx wrangler secret put VAPID_PRIVATE_KEY --config workers/omix-cron/wrangler.toml
 *   (optional) npx wrangler secret put VAPID_SUBJECT --config workers/omix-api/wrangler.toml
 *   (optional) npx wrangler secret put VAPID_SUBJECT --config workers/omix-cron/wrangler.toml
 *
 * The public key is derived from the private key by the worker and served at
 * GET /push/vapid-public-key, so only the private key needs to be stored.
 */
const { generateKeyPairSync } = require("crypto");

function b64u(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

// SPKI DER ends with the 65-byte uncompressed point — that's the public key.
const publicRaw = publicKey.export({ type: "spki", format: "der" }).subarray(-65);
const privatePkcs8 = privateKey.export({ type: "pkcs8", format: "der" });

console.log("VAPID_PRIVATE_KEY=" + b64u(privatePkcs8));
console.log("VAPID_PUBLIC_KEY =" + b64u(publicRaw));
console.log("");
console.log("VAPID_SUBJECT (optional, e.g. mailto:admin@yourdomain.com)");

/**
 * uploads — file uploads (KV) and public asset serving.
 *
 * Extracted from the former crud.ts monolith.
 */
import type { Env } from "../../shared/env";
import { json, genToken, workerOrigin } from "../../shared/util";

export async function handleUploads(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  if (p === "/upload" && method === "POST") {
    const kind = (url.searchParams.get("kind") || "files").replace(/[^a-z-]/g, "");
    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "application/json": "json",
      "audio/mpeg": "mp3",
      "video/mp4": "mp4",
    };
    const ctype = request.headers.get("Content-Type") || "application/octet-stream";
    const ext = extMap[ctype.split(";")[0]] || "bin";
    const key = `${kind}/${Date.now()}_${genToken(4)}.${ext}`;
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 25 * 1024 * 1024) return json({ error: "file_too_large" }, 413, env);
    await env.ASSETS.put(key, buf, { metadata: { contentType: ctype } });
    return json({ url: `${workerOrigin(request)}/assets/${key}` }, 200, env);
  }

  return null;
}

/** Serve an uploaded file. Called from the router BEFORE the auth gate so
 *  images/files are publicly readable (browsers don't send Authorization). */
export async function serveAsset(env: Env, key: string): Promise<Response | null> {
  const { value, metadata } = await env.ASSETS.getWithMetadata(key, { type: "arrayBuffer" });
  if (value === null) return null;
  const meta = (metadata || {}) as { contentType?: string };
  const headers = new Headers();
  headers.set("Content-Type", meta.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  return new Response(value, { headers });
}

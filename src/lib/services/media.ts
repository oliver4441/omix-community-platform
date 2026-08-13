/**
 * Media service — uploads with progress, size and type validation.
 *
 * Uses XMLHttpRequest so upload progress can be surfaced in the composer.
 * Validation mirrors the worker allowlist (workers/omix-api/src/crud.ts).
 */
import { API_BASE_URL, getToken, ApiError } from "@/lib/api";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB for chat files
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB for icons/avatars

const ALLOWED_UPLOAD_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
  "application/pdf", "text/plain", "application/json", "application/zip",
];

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type UploadKind = "uploads" | "icons" | "avatars" | "channel-icons";

export function validateUpload(file: File, kind: UploadKind): void {
  const maxBytes = kind === "uploads" ? MAX_UPLOAD_BYTES : MAX_IMAGE_BYTES;
  const allowed = kind === "uploads" ? ALLOWED_UPLOAD_TYPES : ALLOWED_IMAGE_TYPES;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    throw new UploadValidationError(`File too large (max ${mb}MB)`);
  }
  if (!allowed.includes(file.type)) {
    throw new UploadValidationError(
      "This file type isn't supported (images, video, audio, PDF and text are)"
    );
  }
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export function uploadWithProgress(
  file: File,
  kind: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) {
      reject(new ApiError("api_not_configured", 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/upload?kind=${encodeURIComponent(kind)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${getToken() || ""}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response?.url) {
        resolve(xhr.response.url as string);
      } else {
        const code = xhr.response?.error || "upload_failed";
        reject(new ApiError(code, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("upload_failed", 0));
    xhr.ontimeout = () => reject(new ApiError("upload_timeout", 0));
    xhr.send(file);
  });
}

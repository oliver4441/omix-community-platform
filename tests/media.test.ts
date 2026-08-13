import { describe, it, expect } from "vitest";
import { validateUpload, UploadValidationError } from "@/lib/services/media";

function fakeFile(type: string, size: number): File {
  return new File(["x".repeat(size)], "file.bin", { type });
}

describe("upload validation", () => {
  it("rejects files over 20MB for chat uploads", () => {
    expect(() => validateUpload(fakeFile("image/png", 21 * 1024 * 1024), "uploads")).toThrow(
      UploadValidationError
    );
  });

  it("rejects SVG (active content)", () => {
    expect(() => validateUpload(fakeFile("image/svg+xml", 1000), "uploads")).toThrow(
      UploadValidationError
    );
  });

  it("rejects HTML and executables", () => {
    expect(() => validateUpload(fakeFile("text/html", 1000), "uploads")).toThrow();
    expect(() => validateUpload(fakeFile("application/x-msdownload", 1000), "uploads")).toThrow();
  });

  it("accepts png / mp4 / pdf within limits", () => {
    expect(() => validateUpload(fakeFile("image/png", 1000), "uploads")).not.toThrow();
    expect(() => validateUpload(fakeFile("video/mp4", 5 * 1024 * 1024), "uploads")).not.toThrow();
    expect(() => validateUpload(fakeFile("application/pdf", 1000), "uploads")).not.toThrow();
  });

  it("icons/avatars are limited to 2MB and images only", () => {
    expect(() => validateUpload(fakeFile("image/png", 3 * 1024 * 1024), "avatars")).toThrow();
    expect(() => validateUpload(fakeFile("application/pdf", 100), "avatars")).toThrow();
    expect(() => validateUpload(fakeFile("image/png", 100), "icons")).not.toThrow();
  });
});

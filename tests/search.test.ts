import { describe, it, expect } from "vitest";
import { parseSearchQuery } from "@/lib/services/search";
import { likePattern, parseFilters } from "../workers/omix-api/src/search-util";

describe("search query parsing", () => {
  it("extracts free text and filters (client)", () => {
    const { q, filters } = parseSearchQuery("hello from:alice in:general has:image");
    expect(q).toBe("hello");
    expect(filters.from).toBe("alice");
    expect(filters.in).toBe("general");
    expect(filters.has).toEqual(["image"]);
  });

  it("treats plain text with colons as free text", () => {
    const { q, filters } = parseSearchQuery("what time is 3:30pm?");
    expect(q).toBe("what time is 3:30pm?");
    expect(filters.has).toEqual([]);
  });

  it("worker parser matches client behavior", () => {
    const params = new URLSearchParams();
    params.set("q", "deploy from:alice before:2026-01-01 has:link");
    const { q, filters } = parseFilters(params);
    expect(q).toBe("deploy");
    expect(filters.from).toBe("alice");
    expect(filters.before).toBe("2026-01-01");
    expect(filters.has).toEqual(["link"]);
  });

  it("escapes LIKE wildcards so user input matches literally", () => {
    expect(likePattern("100%_done")).toBe("%100\\%\\_done%");
  });
});

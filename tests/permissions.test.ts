import { describe, it, expect } from "vitest";
import {
  hasCapability,
  canModerate,
  normalizeRole,
  ROLE_ORDER,
} from "@/lib/services/permissions";
import {
  hasCapability as workerHasCapability,
  canModerate as workerCanModerate,
  normalizeRole as workerNormalizeRole,
} from "../workers/omix-api/src/permissions";

describe("permissions matrix (client)", () => {
  it("members can send messages but cannot manage them", () => {
    expect(hasCapability("member", "SEND_MESSAGES")).toBe(true);
    expect(hasCapability("member", "MANAGE_MESSAGES")).toBe(false);
    expect(hasCapability("member", "BAN_MEMBERS")).toBe(false);
  });

  it("moderators can manage messages and time out, but not ban or manage the server", () => {
    expect(hasCapability("moderator", "MANAGE_MESSAGES")).toBe(true);
    expect(hasCapability("moderator", "TIMEOUT_MEMBERS")).toBe(true);
    expect(hasCapability("moderator", "BAN_MEMBERS")).toBe(false);
    expect(hasCapability("moderator", "MANAGE_SERVER")).toBe(false);
  });

  it("owners hold the full set", () => {
    expect(hasCapability("owner", "MANAGE_SERVER")).toBe(true);
    expect(hasCapability("owner", "BAN_MEMBERS")).toBe(true);
    expect(hasCapability("owner", "VIEW_AUDIT_LOG")).toBe(true);
  });

  it("guests can view but never write", () => {
    expect(hasCapability("guest", "VIEW_CHANNEL")).toBe(true);
    expect(hasCapability("guest", "SEND_MESSAGES")).toBe(false);
    expect(hasCapability("guest", "ADD_REACTIONS")).toBe(false);
  });

  it("channel overrides can deny and re-allow capabilities", () => {
    const overrides = [
      { scope: "role" as const, scopeId: "member", allow: [], deny: ["SEND_MESSAGES"] },
    ];
    expect(hasCapability("member", "SEND_MESSAGES", overrides)).toBe(false);
    const allow = [
      { scope: "member" as const, scopeId: "user-1", allow: ["SEND_MESSAGES"], deny: [] },
    ];
    expect(hasCapability("member", "SEND_MESSAGES", [...overrides, ...allow])).toBe(true);
  });

  it("canModerate respects role hierarchy", () => {
    expect(canModerate("moderator", "member")).toBe(true);
    expect(canModerate("moderator", "moderator")).toBe(false);
    expect(canModerate("admin", "moderator")).toBe(true);
    expect(canModerate("owner", "admin")).toBe(true);
    expect(canModerate("owner", "owner")).toBe(false);
  });

  it("normalizeRole maps legacy/unknown values to member", () => {
    expect(normalizeRole("member")).toBe("member");
    expect(normalizeRole("nonsense")).toBe("member");
    expect(normalizeRole(undefined)).toBe("member");
  });

  it("role ordering is monotonic", () => {
    expect(ROLE_ORDER.owner).toBeGreaterThan(ROLE_ORDER.admin);
    expect(ROLE_ORDER.admin).toBeGreaterThan(ROLE_ORDER.moderator);
    expect(ROLE_ORDER.moderator).toBeGreaterThan(ROLE_ORDER.member);
    expect(ROLE_ORDER.member).toBeGreaterThan(ROLE_ORDER.guest);
  });
});

describe("permissions parity (worker)", () => {
  // The client mirror must agree with the server on every role/capability pair.
  const roles = ["owner", "admin", "moderator", "manager", "member", "guest", "bot"] as const;
  const caps = [
    "VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES", "ADD_REACTIONS",
    "ATTACH_FILES", "EMBED_LINKS", "USE_THREADS", "MANAGE_MESSAGES",
    "PIN_MESSAGES", "MENTION_EVERYONE", "CREATE_CHANNELS", "MANAGE_CHANNELS",
    "CREATE_INVITE", "MANAGE_EVENTS", "KICK_MEMBERS", "TIMEOUT_MEMBERS",
    "BAN_MEMBERS", "MANAGE_ROLES", "MANAGE_SERVER", "VIEW_AUDIT_LOG",
    "MANAGE_MODERATION",
  ] as const;

  it("agrees with the server matrix for every pair", () => {
    for (const role of roles) {
      for (const cap of caps) {
        expect(
          hasCapability(role, cap),
          `${role} / ${cap}`
        ).toBe(workerHasCapability(role, cap));
      }
    }
  });

  it("agrees on moderation hierarchy", () => {
    for (const actor of roles) {
      for (const target of roles) {
        expect(canModerate(actor, target)).toBe(workerCanModerate(actor, target));
      }
    }
  });

  it("agrees on role normalization", () => {
    expect(workerNormalizeRole("nonsense")).toBe(normalizeRole("nonsense"));
  });
});

/**
 * Client mirror of the worker's RBAC matrix (workers/omix-api/src/permissions.ts).
 * Used for UI gating only — the server enforces everything authoritatively.
 */

export type ServerRole =
  | "owner"
  | "admin"
  | "moderator"
  | "manager"
  | "member"
  | "guest"
  | "bot";

export const ROLE_ORDER: Record<ServerRole, number> = {
  guest: 0,
  bot: 0,
  member: 1,
  manager: 2,
  moderator: 3,
  admin: 4,
  owner: 5,
};

export function normalizeRole(role: unknown): ServerRole {
  if (typeof role === "string" && role in ROLE_ORDER) return role as ServerRole;
  return "member";
}

export const CAPABILITIES = [
  "VIEW_CHANNEL",
  "READ_MESSAGE_HISTORY",
  "SEND_MESSAGES",
  "ADD_REACTIONS",
  "ATTACH_FILES",
  "EMBED_LINKS",
  "USE_THREADS",
  "MANAGE_MESSAGES",
  "PIN_MESSAGES",
  "MENTION_EVERYONE",
  "CREATE_CHANNELS",
  "MANAGE_CHANNELS",
  "CREATE_INVITE",
  "MANAGE_EVENTS",
  "KICK_MEMBERS",
  "TIMEOUT_MEMBERS",
  "BAN_MEMBERS",
  "MANAGE_ROLES",
  "MANAGE_SERVER",
  "VIEW_AUDIT_LOG",
  "MANAGE_MODERATION",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const BASE_CAPABILITIES: Capability[] = [
  "VIEW_CHANNEL",
  "READ_MESSAGE_HISTORY",
  "SEND_MESSAGES",
  "ADD_REACTIONS",
  "ATTACH_FILES",
  "EMBED_LINKS",
  "USE_THREADS",
];

const ROLE_CAPABILITIES: Record<ServerRole, Capability[]> = {
  guest: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
  bot: [...BASE_CAPABILITIES],
  member: [...BASE_CAPABILITIES, "CREATE_CHANNELS", "CREATE_INVITE", "MANAGE_EVENTS"],
  manager: [
    ...BASE_CAPABILITIES,
    "CREATE_CHANNELS",
    "CREATE_INVITE",
    "MANAGE_EVENTS",
    "MANAGE_MESSAGES",
    "PIN_MESSAGES",
  ],
  moderator: [
    ...BASE_CAPABILITIES,
    "CREATE_CHANNELS",
    "CREATE_INVITE",
    "MANAGE_EVENTS",
    "MANAGE_MESSAGES",
    "PIN_MESSAGES",
    "MENTION_EVERYONE",
    "KICK_MEMBERS",
    "TIMEOUT_MEMBERS",
    "MANAGE_MODERATION",
  ],
  admin: [
    ...BASE_CAPABILITIES,
    "CREATE_CHANNELS",
    "CREATE_INVITE",
    "MANAGE_EVENTS",
    "MANAGE_MESSAGES",
    "PIN_MESSAGES",
    "MENTION_EVERYONE",
    "MANAGE_CHANNELS",
    "KICK_MEMBERS",
    "TIMEOUT_MEMBERS",
    "BAN_MEMBERS",
    "MANAGE_ROLES",
    "MANAGE_MODERATION",
    "VIEW_AUDIT_LOG",
  ],
  owner: [
    ...BASE_CAPABILITIES,
    "CREATE_CHANNELS",
    "CREATE_INVITE",
    "MANAGE_EVENTS",
    "MANAGE_MESSAGES",
    "PIN_MESSAGES",
    "MENTION_EVERYONE",
    "MANAGE_CHANNELS",
    "KICK_MEMBERS",
    "TIMEOUT_MEMBERS",
    "BAN_MEMBERS",
    "MANAGE_ROLES",
    "MANAGE_MODERATION",
    "VIEW_AUDIT_LOG",
    "MANAGE_SERVER",
  ],
};

export interface ChannelOverride {
  scope: "role" | "member";
  scopeId: string;
  allow: string[];
  deny: string[];
}

export function hasCapability(
  role: ServerRole,
  capability: Capability,
  overrides: ChannelOverride[] = []
): boolean {
  let allowed = ROLE_CAPABILITIES[role].includes(capability);
  for (const override of overrides) {
    const applies =
      (override.scope === "role" && normalizeRole(override.scopeId) === role) ||
      override.scope === "member";
    if (!applies) continue;
    if (override.deny.includes(capability)) allowed = false;
    if (override.allow.includes(capability)) allowed = true;
  }
  return allowed;
}

export function canModerate(actorRole: ServerRole, targetRole: ServerRole): boolean {
  if (actorRole === "owner") return targetRole !== "owner";
  return (
    ROLE_ORDER[actorRole] >= ROLE_ORDER.moderator &&
    ROLE_ORDER[actorRole] > ROLE_ORDER[targetRole]
  );
}

export const ROLE_LABELS: Record<ServerRole, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  manager: "Manager",
  member: "Member",
  guest: "Guest",
  bot: "Bot",
};

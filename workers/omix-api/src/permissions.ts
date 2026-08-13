/**
 * Omix RBAC — capability-based permission system.
 *
 * Roles: owner > admin > moderator > manager > member > guest/bot.
 * Capabilities are grouped per role; channel overrides (role/member) can add
 * (allow) or remove (deny) capabilities for a single channel.
 *
 * Mirrored on the client in src/lib/services/permissions.ts — keep the
 * capability names and role order in sync.
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

/** Normalize any stored role string to a known role (defensive for legacy rows). */
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
  "MANAGE_MESSAGES", // delete/edit others' messages
  "PIN_MESSAGES",
  "MENTION_EVERYONE", // @everyone / @here
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
  "MANAGE_MODERATION", // resolve reports, view queue
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Base capabilities granted to every role (highest role's set is a superset). */
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
  // Guests can read but not write.
  guest: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
  // Bots can read and write but never manage.
  bot: [...BASE_CAPABILITIES],
  member: [...BASE_CAPABILITIES, "CREATE_CHANNELS", "CREATE_INVITE", "MANAGE_EVENTS"],
  // Managers run day-to-day content (Discord "manage messages" tier).
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
      (override.scope === "member" && override.scopeId === "__current_user__");
    if (!applies) continue;
    if (override.deny.includes(capability)) allowed = false;
    if (override.allow.includes(capability)) allowed = true;
  }
  return allowed;
}

/** Can `actorRole` perform moderation actions against `targetRole`? */
export function canModerate(actorRole: ServerRole, targetRole: ServerRole): boolean {
  if (actorRole === "owner") return targetRole !== "owner";
  return (
    ROLE_ORDER[actorRole] >= ROLE_ORDER.moderator &&
    ROLE_ORDER[actorRole] > ROLE_ORDER[targetRole]
  );
}

/** Capabilities a role change may assign (an actor can't grant above their rank). */
export function canAssignRole(actorRole: ServerRole, targetRole: ServerRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole !== "admin") return false;
  return targetRole !== "owner" && targetRole !== "admin";
}

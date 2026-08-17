export type ExperienceMode = "community" | "developer" | "both";

export type ExperiencePreferences = {
  mode: ExperienceMode;
  defaultMode: "community" | "developer";
  interests: string[];
  developerInterests: string[];
  completed: true;
};

const KEY_PREFIX = "omix:experience:";

function keyFor(uid: string) {
  return `${KEY_PREFIX}${uid}`;
}

export function getExperiencePreferences(uid: string): ExperiencePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExperiencePreferences;
    if (!parsed || parsed.completed !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveExperiencePreferences(
  uid: string,
  preferences: ExperiencePreferences
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(uid), JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent("omixExperienceChanged"));
}

export function setActiveExperience(uid: string, mode: "community" | "developer") {
  const current = getExperiencePreferences(uid);
  if (!current) return;
  saveExperiencePreferences(uid, { ...current, defaultMode: mode });
}

export function getActiveExperience(uid: string): "community" | "developer" {
  const current = getExperiencePreferences(uid);
  return current?.defaultMode ?? "community";
}

export function clearExperiencePreferences(uid: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(uid));
  window.dispatchEvent(new CustomEvent("omixExperienceChanged"));
}

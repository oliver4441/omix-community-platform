"use client";

import { useState } from "react";
import { Store } from "@/lib/store";
import { Mso } from "@/components/ui/icons";

const SETTINGS_KEY = "omix_settings";

interface OmixSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  messageSound: string;
  callRingtone: string;
  dndEnabled: boolean;
  dndDays: string[];
  dndStart: string;
  dndEnd: string;
}

const DEFAULT_SETTINGS: OmixSettings = {
  pushEnabled: false,
  soundEnabled: true,
  messageSound: "Pop",
  callRingtone: "Classic",
  dndEnabled: false,
  dndDays: [],
  dndStart: "22:00",
  dndEnd: "08:00",
};

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const SOUNDS = ["Pop", "Chime", "Ping", "Blip"];
const RINGTONES = ["Classic", "Digital", "Sonar", "Soft"];

export function SettingsPage({
  isMobile,
  displayName,
}: {
  isMobile: boolean;
  displayName: string;
}) {
  const [settings, setSettings] = useState<OmixSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const update = (patch: Partial<OmixSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleDay = (day: string) => {
    const has = settings.dndDays.includes(day);
    update({
      dndDays: has
        ? settings.dndDays.filter((d) => d !== day)
        : [...settings.dndDays, day],
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto no-scrollbar">
      {/* Top app bar (mobile) */}
      <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">
            Omix Community
          </h1>
        </div>
        <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all">
          <Mso name="more_vert" />
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 lg:p-6 flex flex-col gap-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Notifications &amp; Sounds
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Control how Omix reaches you, {displayName}.
          </p>
        </div>

        {/* Push notifications */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
            Push Notifications
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Mso name="notifications" size={22} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-body-md text-body-md text-on-surface font-medium">
                  Desktop notifications
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Mentions, replies and call alerts
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={settings.pushEnabled}
              onClick={() => {
                const next = !settings.pushEnabled;
                update({ pushEnabled: next });
                if (next) Store.requestNotificationPermission();
              }}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                settings.pushEnabled ? "bg-primary" : "bg-surface-container-highest"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  settings.pushEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Sound effects */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
            Sound Effects
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg divide-y divide-outline-variant/20">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Mso name="volume_up" size={22} className="text-secondary shrink-0" />
                <p className="font-body-md text-body-md text-on-surface font-medium">
                  Play sounds
                </p>
              </div>
              <button
                role="switch"
                aria-checked={settings.soundEnabled}
                onClick={() => update({ soundEnabled: !settings.soundEnabled })}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  settings.soundEnabled ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                    settings.soundEnabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Message sound
              </p>
              <select
                className="input-field !w-36 !py-1.5 font-code-md text-code-md"
                value={settings.messageSound}
                onChange={(e) => update({ messageSound: e.target.value })}
                disabled={!settings.soundEnabled}
              >
                {SOUNDS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Call ringtone
              </p>
              <select
                className="input-field !w-36 !py-1.5 font-code-md text-code-md"
                value={settings.callRingtone}
                onChange={(e) => update({ callRingtone: e.target.value })}
                disabled={!settings.soundEnabled}
              >
                {RINGTONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* DND schedule */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
            Do Not Disturb Schedule
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Mso name="do_not_disturb_on" size={22} className="text-error shrink-0" />
                <p className="font-body-md text-body-md text-on-surface font-medium">
                  Enable DND schedule
                </p>
              </div>
              <button
                role="switch"
                aria-checked={settings.dndEnabled}
                onClick={() => update({ dndEnabled: !settings.dndEnabled })}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  settings.dndEnabled ? "bg-error" : "bg-surface-container-highest"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                    settings.dndEnabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <div className={`flex flex-col gap-3 ${settings.dndEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="flex items-center gap-2">
                {DAYS.map((d, i) => {
                  const key = DAY_KEYS[i];
                  const active = settings.dndDays.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleDay(key)}
                      className={`w-9 h-9 rounded-full font-code-md text-code-md border transition-colors ${
                        active
                          ? "bg-error text-on-error border-error"
                          : "bg-surface-container text-on-surface-variant border-outline-variant hover:border-error"
                      }`}
                      aria-pressed={active}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <label className="font-body-sm text-body-sm text-on-surface-variant">
                  From
                </label>
                <input
                  type="time"
                  className="input-field !w-32 !py-1.5 font-code-md text-code-md"
                  value={settings.dndStart}
                  onChange={(e) => update({ dndStart: e.target.value })}
                />
                <label className="font-body-sm text-body-sm text-on-surface-variant">
                  To
                </label>
                <input
                  type="time"
                  className="input-field !w-32 !py-1.5 font-code-md text-code-md"
                  value={settings.dndEnd}
                  onChange={(e) => update({ dndEnd: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

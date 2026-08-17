"use client";

import { useState } from "react";
import { Store } from "@/lib/store";
import { ThemeFontSettings } from "@/components/ui/ThemeFontSettings";

const KEY = "omix_settings";
const DEFAULT = { pushEnabled: false, soundEnabled: true, messageSound: "Pop", callRingtone: "Classic", dndEnabled: false, dndDays: [] as string[], dndStart: "22:00", dndEnd: "08:00" };
const SOUNDS = ["Pop", "Chime", "Ping", "Blip"];
const RINGTONES = ["Classic", "Digital", "Sonar", "Soft"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function SettingsPage({ displayName }: { isMobile: boolean; displayName: string }) {
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return DEFAULT;
    try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULT; }
  });
  const update = (patch: Partial<typeof DEFAULT>) => setSettings((prev) => { const next = { ...prev, ...patch }; localStorage.setItem(KEY, JSON.stringify(next)); return next; });
  const toggleDay = (day: string) => update({ dndDays: settings.dndDays.includes(day) ? settings.dndDays.filter((d) => d !== day) : [...settings.dndDays, day] });

  return <div className="flex-1 min-w-0 overflow-y-auto bg-background no-scrollbar">
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-24 lg:p-6">
      <header><h1 className="text-2xl font-bold text-on-surface">Settings</h1><p className="mt-1 text-sm text-on-surface-variant">Personalize Omix and control notifications, {displayName}.</p></header>
      <ThemeFontSettings />
      <section className="surface overflow-hidden"><div className="border-b border-outline-variant/30 p-4"><h2 className="font-semibold">Notifications</h2><p className="text-sm text-on-surface-variant">Messages, mentions and calls.</p></div><div className="divide-y divide-outline-variant/20">
        <div className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">Push notifications</p><p className="text-sm text-on-surface-variant">Allow Omix to notify you.</p></div><button role="switch" aria-checked={settings.pushEnabled} onClick={() => { const enabled = !settings.pushEnabled; update({ pushEnabled: enabled }); if (enabled) Store.requestNotificationPermission(); }} className={`relative h-6 w-11 rounded-full ${settings.pushEnabled ? "bg-primary" : "bg-surface-container-highest"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${settings.pushEnabled ? "left-[22px]" : "left-0.5"}`} /></button></div>
        <div className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">Sound effects</p><p className="text-sm text-on-surface-variant">Message and call sounds.</p></div><button role="switch" aria-checked={settings.soundEnabled} onClick={() => update({ soundEnabled: !settings.soundEnabled })} className={`relative h-6 w-11 rounded-full ${settings.soundEnabled ? "bg-primary" : "bg-surface-container-highest"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${settings.soundEnabled ? "left-[22px]" : "left-0.5"}`} /></button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-sm text-on-surface-variant">Message sound<select className="input-field mt-1" value={settings.messageSound} onChange={(e) => update({ messageSound: e.target.value })}>{SOUNDS.map((s) => <option key={s}>{s}</option>)}</select></label><label className="text-sm text-on-surface-variant">Call ringtone<select className="input-field mt-1" value={settings.callRingtone} onChange={(e) => update({ callRingtone: e.target.value })}>{RINGTONES.map((r) => <option key={r}>{r}</option>)}</select></label></div>
      </div></section>
      <section className="surface p-4"><h2 className="font-semibold">Do Not Disturb</h2><div className="mt-4 flex items-center justify-between"><span className="text-sm">Enable schedule</span><button role="switch" aria-checked={settings.dndEnabled} onClick={() => update({ dndEnabled: !settings.dndEnabled })} className={`relative h-6 w-11 rounded-full ${settings.dndEnabled ? "bg-primary" : "bg-surface-container-highest"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${settings.dndEnabled ? "left-[22px]" : "left-0.5"}`} /></button></div><div className={`mt-4 space-y-4 ${settings.dndEnabled ? "" : "opacity-50 pointer-events-none"}`}><div className="flex flex-wrap gap-2">{DAYS.map((day) => <button key={day} onClick={() => toggleDay(day)} className={`h-9 w-9 rounded-full border text-xs ${settings.dndDays.includes(day) ? "border-primary bg-primary text-on-primary" : "border-outline-variant"}`}>{day[0].toUpperCase()}</button>)}</div><div className="grid grid-cols-2 gap-3"><label className="text-sm">From<input type="time" className="input-field mt-1" value={settings.dndStart} onChange={(e) => update({ dndStart: e.target.value })} /></label><label className="text-sm">To<input type="time" className="input-field mt-1" value={settings.dndEnd} onChange={(e) => update({ dndEnd: e.target.value })} /></label></div></div></section>
    </main>
  </div>;
}

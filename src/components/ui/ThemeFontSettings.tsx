"use client";

import { useEffect, useState } from "react";
import { Check, Palette, Type } from "lucide-react";

const KEY = "omix_visual_settings";
const themes = [
  { id: "violet", label: "Violet", primary: "#d0bcff", accent: "#4fdbc8" },
  { id: "blue", label: "Ocean", primary: "#8ab4ff", accent: "#5ee7ff" },
  { id: "green", label: "Emerald", primary: "#8de1b0", accent: "#5ee7c1" },
  { id: "rose", label: "Rose", primary: "#ffafd3", accent: "#ffcf8a" },
];
const fonts = [
  { id: "inter", label: "Inter", family: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { id: "system", label: "System", family: "ui-sans-serif, system-ui, sans-serif" },
  { id: "mono", label: "Developer Mono", family: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

export function ThemeFontSettings() {
  const [theme, setTheme] = useState("violet");
  const [font, setFont] = useState("inter");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      const nextTheme = saved.theme || "violet";
      const nextFont = saved.font || "inter";
      setTheme(nextTheme);
      setFont(nextFont);
      applyVisuals(nextTheme, nextFont);
    } catch {}
  }, []);

  const chooseTheme = (id: string) => {
    setTheme(id);
    applyVisuals(id, font);
  };
  const chooseFont = (id: string) => {
    setFont(id);
    applyVisuals(theme, id);
  };

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-outline-variant/30 p-4">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-body-md text-body-md font-semibold text-on-surface">Appearance</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Personalize Omix without changing your account experience.</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-6">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Palette className="h-4 w-4" />Theme colour</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {themes.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseTheme(item.id)} className="rounded-xl border border-outline-variant p-3 text-left transition hover:border-primary">
                <span className="mb-2 block h-7 rounded-lg" style={{ background: `linear-gradient(135deg, ${item.primary}, ${item.accent})` }} />
                <span className="flex items-center justify-between text-xs font-medium">{item.label}{theme === item.id && <Check className="h-4 w-4 text-primary" />}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Type className="h-4 w-4" />Font</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {fonts.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseFont(item.id)} className={`rounded-xl border p-3 text-left transition ${font === item.id ? "border-primary bg-primary/10" : "border-outline-variant hover:border-primary"}`} style={{ fontFamily: item.family }}>
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs text-on-surface-variant">Aa Bb 123</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function applyVisuals(themeId: string, fontId: string) {
  if (typeof document === "undefined") return;
  const theme = themes.find((item) => item.id === themeId) || themes[0];
  const font = fonts.find((item) => item.id === fontId) || fonts[0];
  document.documentElement.style.setProperty("--color-primary", theme.primary);
  document.documentElement.style.setProperty("--color-secondary", theme.accent);
  document.documentElement.style.setProperty("--font-sans", font.family);
  document.documentElement.dataset.omixTheme = themeId;
  document.documentElement.dataset.omixFont = fontId;
  localStorage.setItem(KEY, JSON.stringify({ theme: themeId, font: fontId }));
}

"use client";

import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <span key={index}>{part}</span>;
  });
}

/** Lightweight, dependency-free Markdown rendering for user-generated board posts. */
export function Markdown({ children }: { children: string }) {
  const lines = children.split(/\r?\n/);
  return <div className="space-y-1 whitespace-pre-wrap break-words">
    {lines.map((line, index) => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const className = level === 1 ? "text-base font-bold" : level === 2 ? "text-sm font-bold" : "text-sm font-semibold";
        return <p key={index} className={className}>{inline(heading[2])}</p>;
      }
      if (/^[-*]\s+/.test(line)) return <div key={index} className="pl-4 before:content-['•'] before:mr-2">{inline(line.replace(/^[-*]\s+/, ""))}</div>;
      return <p key={index}>{inline(line)}</p>;
    })}
  </div>;
}

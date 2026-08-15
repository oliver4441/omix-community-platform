"use client";

export function Markdown({ children }: { children: string }) {
  return <div className="whitespace-pre-wrap font-sans">{children}</div>;
}

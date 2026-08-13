"use client";

import { useMemo } from "react";

/**
 * Safe, dependency-free Markdown renderer for Omix.
 *
 * Security model: the source text is HTML-escaped FIRST, then a restricted set of
 * Markdown constructs is applied to the escaped text. Links are rendered with
 * `rel="noopener noreferrer nofollow"` and only http(s)/mailto targets. No raw
 * HTML ever reaches the DOM, so XSS via message/board content is not possible.
 *
 * Supported: headings, bold/italic/strikethrough, inline code, fenced code blocks,
 * links, images (http(s) only), unordered/ordered lists, blockquotes, paragraphs.
 */
interface MarkdownProps {
  children: string;
  /** Additional class for the root container. */
  className?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:";
  } catch {
    return false;
  }
}

function inlineMarkdown(text: string): string {
  // 1. HTML-escape FIRST — nothing unescaped ever reaches the DOM.
  let out = escapeHtml(text);

  // 2. Inline code is hoisted into placeholders so later passes (autolink,
  //    emphasis) never touch its contents.
  const codeFragments: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => {
    codeFragments.push(code);
    return `\u0001${codeFragments.length - 1}\u0001`;
  });

  // 3. Images: ![alt](url) — http(s) only.
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt: string, url: string) =>
      isSafeUrl(url)
        ? `<img src="${url}" alt="${alt}" loading="lazy" class="markdown-img" />`
        : `<em>${alt}</em>`
  );

  // 4. Links: [text](url) — http(s)/mailto only.
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) =>
      isSafeUrl(url)
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow" class="text-[var(--color-pri)] underline">${label}</a>`
        : label
  );

  // 5. Autolink bare URLs, trimming trailing punctuation.
  out = out.replace(/(https?:\/\/[^\s<>()]+)/g, (_m, url: string) => {
    const trailing = (url.match(/[.,;:!?]+$/) || [""])[0];
    const clean = url.slice(0, url.length - trailing.length);
    if (!clean) return _m;
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer nofollow" class="text-[var(--color-pri)] underline break-all">${clean}</a>${trailing}`;
  });

  // 6. Emphasis.
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // 7. Restore code fragments (still escaped — step 1).
  out = out.replace(/\u0001(\d+)\u0001/g, (_m, idx: string) => {
    const code = codeFragments[Number(idx)] ?? "";
    return `<code class="markdown-code">${code}</code>`;
  });
  return out;
}

function blockMarkdown(source: string): string {
  const lines = source.split(/\r?\n/);
  const html: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inQuote = false;

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      html.push("</blockquote>");
      inQuote = false;
    }
  };

  const flushParagraph = (acc: string[]) => {
    const text = acc.join(" ");
    if (text.trim()) html.push(`<p>${inlineMarkdown(text.trim())}</p>`);
    acc.length = 0;
  };

  const para: string[] = [];

  for (const raw of lines) {
    // Fenced code block
    const fence = raw.match(/^```(\w*)\s*$/);
    if (fence) {
      closeList();
      closeQuote();
      flushParagraph(para);
      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        html.push(
          `<pre class="markdown-pre"><code>${codeLines.map(escapeHtml).join("\n")}</code></pre>`
        );
        inCode = false;
        codeLines = [];
      }
      continue;
    }
    if (inCode) {
      codeLines.push(raw);
      continue;
    }
    if (raw.trim() === "") {
      closeList();
      closeQuote();
      flushParagraph(para);
      continue;
    }

    // Headings
    const h = raw.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      closeQuote();
      flushParagraph(para);
      const level = h[1].length;
      const text = inlineMarkdown(h[2]);
      if (level === 1) html.push(`<h2 class="markdown-h2">${text}</h2>`);
      else if (level === 2) html.push(`<h3 class="markdown-h3">${text}</h3>`);
      else html.push(`<h4 class="markdown-h4">${text}</h4>`);
      continue;
    }

    // Blockquote
    if (raw.startsWith(">")) {
      closeList();
      flushParagraph(para);
      if (!inQuote) {
        html.push("<blockquote class=\"markdown-quote\">");
        inQuote = true;
      }
      html.push(`<p>${inlineMarkdown(raw.replace(/^>\s?/, ""))}</p>`);
      continue;
    }
    closeQuote();

    // Lists
    const ul = raw.match(/^\s*[-*+]\s+(.*)$/);
    const ol = raw.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushParagraph(para);
      const kind = ul ? "ul" : "ol";
      if (inList !== kind) {
        closeList();
        html.push(`<${kind} class="markdown-list">`);
        inList = kind;
      }
      html.push(`<li>${inlineMarkdown((ul || ol)![1])}</li>`);
      continue;
    }
    closeList();

    para.push(raw);
  }

  if (inCode) {
    html.push(`<pre class="markdown-pre"><code>${codeLines.map(escapeHtml).join("\n")}</code></pre>`);
  }
  closeList();
  closeQuote();
  flushParagraph(para);

  return html.join("");
}

export function Markdown({ children, className = "" }: MarkdownProps) {
  const html = useMemo(() => blockMarkdown(children ?? ""), [children]);
  return (
    <div
      className={`markdown-body break-words ${className}`}
      // The HTML is fully escaped + sanitized above; see module comment.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

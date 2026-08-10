"use client";

import { useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/atom-one-dark.css";
import { Check, Copy } from "@/components/ui/icons";

// Allow the className attributes react-markdown uses for code languages and
// safe link attributes on anchors. Everything else keeps the default schema.
const SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ["className"]],
    pre: [...(defaultSchema.attributes?.pre || []), ["className"]],
    span: [...(defaultSchema.attributes?.span || []), ["className"]],
    a: [...(defaultSchema.attributes?.a || []), ["target"], ["rel"]],
  },
};

interface CodeBlockProps {
  className?: string;
  code: string;
}

export function CodeBlock({ className, code }: CodeBlockProps) {
  const lang = /language-([\w+-]+)/.exec(className || "")?.[1] || "";
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    const trimmed = code.replace(/\n$/, "");
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(trimmed, { language: lang }).value;
      }
      return hljs.highlightAuto(trimmed).value;
    } catch {
      return trimmed;
    }
  }, [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="markdown-codeblock my-2 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-deepest)]">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-dark)]">
        <span className="font-label-caps text-label-caps text-[10px] uppercase tracking-wider text-[var(--color-txt-muted)]">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] hover:bg-[var(--color-bg-hover)] transition-colors font-code-md text-code-md"
          aria-label="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code
          className={`hljs ${lang ? `language-${lang}` : ""}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

const components: Components = {
  pre({ children }) {
    const child = (Array.isArray(children) ? children[0] : children) as
      | { props?: { className?: string; children?: ReactNode } }
      | undefined;
    const className = child?.props?.className;
    const code = String(child?.props?.children ?? "").replace(/\n$/, "");
    return <CodeBlock className={className} code={code} />;
  },
  code({ children }) {
    return <code className="font-code-md text-code-md">{children}</code>;
  },
  a({ children, href }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--color-pri)] underline decoration-[var(--color-pri-muted)] underline-offset-2 hover:text-[var(--color-pri-hover)] transition-colors break-words"
      >
        {children}
      </a>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, SCHEMA]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

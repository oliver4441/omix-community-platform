// Format message text: bold, italic, code, inline code, links, strikethrough, auto-links
// Supports: **bold**, *italic*, `code`, ```block```, [link](url), ~~strikethrough~~, https://auto-links

type Segment = { type: 'text' | 'bold' | 'italic' | 'code' | 'block' | 'link' | 'strikethrough' | 'br'; text: string; url?: string; lang?: string };

// Auto-link regex
const AUTO_LINK_RE = /(?:^|\s)(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]])/g;

function extractAutoLinks(text: string): Segment[] {
  const parts: Segment[] = [];
  let remaining = text;
  let match = AUTO_LINK_RE.exec(remaining);
  let lastIdx = 0;
  while (match) {
    const prefix = match[0].startsWith(' ') ? ' ' : '';
    const url = match[0].trim();
    if (match.index > 0) {
      parts.push({ type: 'text', text: remaining.substring(lastIdx, match.index + (prefix ? 1 : 0)) });
    }
    parts.push({ type: 'link', text: url, url });
    lastIdx = match.index + match[0].length;
    match = AUTO_LINK_RE.exec(remaining);
  }
  if (lastIdx < remaining.length) {
    parts.push({ type: 'text', text: remaining.substring(lastIdx) });
  }
  return parts.length > 0 ? parts : [{ type: 'text', text }];
}

function parseInline(seg: Segment): Segment[] {
  if (seg.type !== 'text') return [seg];
  const parts: Segment[] = [];
  let remaining = seg.text;

  // Inline code first (so other patterns don't match inside)
  const codeRe = /`([^`]+)`/;
  let match = remaining.match(codeRe);
  while (match) {
    if (match.index! > 0) parts.push(...parseBold(remaining.substring(0, match.index!)));
    parts.push({ type: 'code', text: match[1] });
    remaining = remaining.substring(match.index! + match[0].length);
    match = remaining.match(codeRe);
  }
  if (remaining) parts.push(...parseBold(remaining));
  return parts;
}

function parseBold(text: string): Segment[] {
  const parts: Segment[] = [];
  let remaining = text;
  // Double asterisk **bold**
  const re = /\*\*(.+?)\*\*/g;
  let match = re.exec(remaining);
  while (match) {
    if (match.index > 0) parts.push(...parseItalic(remaining.substring(0, match.index)));
    parts.push(...parseItalic(match[1]).map(s => s.type === 'italic' ? s : { ...s, type: s.type === 'text' ? 'bold' as const : s.type }));
    remaining = remaining.substring(match.index + match[0].length);
    re.lastIndex = 0;
    match = re.exec(remaining);
  }
  if (remaining) parts.push(...parseItalic(remaining));
  return parts;
}

function parseItalic(text: string): Segment[] {
  const parts: Segment[] = [];
  let remaining = text;
  // Single asterisk *italic*
  const re = /\*(.+?)\*/g;
  let match = re.exec(remaining);
  while (match) {
    if (match.index > 0) parts.push(...parseStrikethrough(remaining.substring(0, match.index)));
    parts.push(...parseStrikethrough(match[1]).map(s => ({ ...s, type: s.type === 'text' ? 'italic' as const : s.type })));
    remaining = remaining.substring(match.index + match[0].length);
    re.lastIndex = 0;
    match = re.exec(remaining);
  }
  if (remaining) parts.push(...parseStrikethrough(remaining));
  return parts;
}

function parseStrikethrough(text: string): Segment[] {
  const parts: Segment[] = [];
  let remaining = text;
  const re = /~~(.+?)~~/g;
  let match = re.exec(remaining);
  while (match) {
    if (match.index > 0) parts.push(...parseLinks(remaining.substring(0, match.index)));
    parts.push(...parseLinks(match[1]).map(s => ({ ...s, type: 'strikethrough' as const })));
    remaining = remaining.substring(match.index + match[0].length);
    re.lastIndex = 0;
    match = re.exec(remaining);
  }
  if (remaining) parts.push(...parseLinks(remaining));
  return parts;
}

function parseLinks(text: string): Segment[] {
  // First extract markdown-style links, then auto-link remaining URLs
  const parts: Segment[] = [];
  let remaining = text;
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match = re.exec(remaining);
  while (match) {
    if (match.index > 0) {
      const before = remaining.substring(0, match.index);
      parts.push(...extractAutoLinks(before));
    }
    parts.push({ type: 'link', text: match[1], url: match[2] });
    remaining = remaining.substring(match.index + match[0].length);
    re.lastIndex = 0;
    match = re.exec(remaining);
  }
  if (remaining) parts.push(...extractAutoLinks(remaining));
  return parts;
}

// unused
// function escapeHtml(str: string): string {
//   return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// }

export function formatMessage(text: string): (Segment & { key: number })[] {
  // First extract code blocks
  const blocks: { code: string; lang: string }[] = [];
  const blockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let cleaned = text.replace(blockRe, (_, lang, code) => {
    blocks.push({ code, lang: lang || '' });
    return `\x00BLOCK${blocks.length - 1}\x00`;
  });

  const result: (Segment & { key: number })[] = [];
  let key = 0;

  // Split by block placeholders
  const parts = cleaned.split(/(\x00BLOCK\d+\x00)/);
  for (const part of parts) {
    if (part.startsWith('\x00BLOCK') && part.endsWith('\x00')) {
      const idx = parseInt(part.replace('\x00BLOCK', '').replace('\x00', ''));
      result.push({ type: 'block', text: blocks[idx].code, lang: blocks[idx].lang || undefined, key: key++ });
    } else {
      // Handle newlines - split by \n
      const lines = part.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) result.push({ type: 'br', text: '', key: key++ });
        if (line) {
          const segments = parseInline({ type: 'text', text: line });
          for (const seg of segments) {
            result.push({ ...seg, key: key++ });
          }
        }
      });
    }
  }

  return result;
}

export function renderFormattedText(text: string) {
  if (!text) return null;
  const segments = formatMessage(text);
  return segments.map(seg => {
    switch (seg.type) {
      case 'bold':
        return <strong key={seg.key} className="font-semibold">{seg.text}</strong>;
      case 'italic':
        return <em key={seg.key} className="italic">{seg.text}</em>;
      case 'code':
        return <code key={seg.key} className="bg-[#232428] text-[var(--accent)] px-1.5 py-0.5 rounded text-xs font-mono">{seg.text}</code>;
      case 'block':
        return (
          <div key={seg.key} className="my-2 rounded-lg overflow-hidden border border-gray-700">
            {seg.lang && (
              <div className="bg-[#1a1b1e] px-3 py-1 text-[10px] text-[var(--text-muted)] font-mono border-b border-gray-700">
                {seg.lang}
              </div>
            )}
            <pre className="bg-[#232428] p-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto">
              <code>{seg.text}</code>
            </pre>
          </div>
        );
      case 'link':
        return <a key={seg.key} href={seg.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{seg.text}</a>;
      case 'strikethrough':
        return <del key={seg.key} className="line-through opacity-60">{seg.text}</del>;
      case 'br':
        return <br key={seg.key} />;
      default:
        return <span key={seg.key}>{seg.text}</span>;
    }
  });
}

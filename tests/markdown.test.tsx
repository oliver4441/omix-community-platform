import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/Markdown";

describe("Markdown renderer (XSS-safe)", () => {
  it("renders bold and inline code", () => {
    const html = renderToStaticMarkup(<Markdown>{"**bold** and `code`"}</Markdown>);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<code class="markdown-code">code</code>');
  });

  it("escapes raw HTML (no script execution possible)", () => {
    const html = renderToStaticMarkup(
      <Markdown>{'<script>alert("xss")</script> <img src=x onerror=alert(1)>'}</Markdown>
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("only renders http(s)/mailto links", () => {
    const html = renderToStaticMarkup(<Markdown>{"[safe](https://omix.dev) [bad](javascript:alert(1))"}</Markdown>);
    expect(html).toContain('href="https://omix.dev"');
    expect(html).not.toContain("javascript:");
  });

  it("renders code blocks escaped", () => {
    const html = renderToStaticMarkup(<Markdown>{"```\n<div>raw</div>\n```"}</Markdown>);
    expect(html).toContain("&lt;div&gt;");
  });

  it("renders lists", () => {
    const html = renderToStaticMarkup(<Markdown>{"- one\n- two"}</Markdown>);
    expect(html).toContain("<ul class=\"markdown-list\">");
    expect(html).toContain("<li>one</li>");
  });
});

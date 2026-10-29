import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "./MarkdownMessage";

function render(content: string): string {
  return renderToStaticMarkup(createElement(MarkdownMessage, { content }));
}

describe("MarkdownMessage", () => {
  it("renders headings, lists, code blocks and tables", () => {
    const html = render(
      "## 已完成\n\n- 添加标题\n- 修改颜色\n\n```css\n.title { color: #6750a4; }\n```\n\n| 项目 | 值 |\n| --- | --- |\n| 模块 | 1 |",
    );

    expect(html).toContain("<h2>已完成</h2>");
    expect(html).toContain("<li>添加标题</li>");
    expect(html).toContain('class="language-css"');
    expect(html).toContain("<table>");
    expect(html).toContain("<td>模块</td>");
  });

  it("escapes raw html and keeps links", () => {
    const html = render(
      '<script>alert("x")</script>\n\n[文档](https://example.com/docs)',
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain("文档");
  });
});

import { describe, expect, it } from "vitest";
import { defaultProject } from "../../model/defaults";
import { buildScriptBoardMessages } from "./scriptBoard";

describe("script board AI prompt", () => {
  it("includes block code and connections", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.scriptBoard = {
      blocks: [
        {
          id: "natural",
          kind: "natural",
          title: "需求",
          code: "点击按钮后显示一段提示文字。",
          x: 0,
          y: 0,
          width: 260,
          height: 168,
        },
        {
          id: "a",
          kind: "event",
          title: "点击",
          code: 'document.getElementById("cta").addEventListener("click", () => {});',
          x: 0,
          y: 0,
          width: 260,
          height: 168,
        },
        {
          id: "b",
          kind: "console",
          title: "日志",
          code: 'console.log("ok");',
          x: 300,
          y: 0,
          width: 260,
          height: 168,
        },
      ],
      connections: [{ id: "c", from: "a", to: "b" }],
    };

    const messages = buildScriptBoardMessages(page, "保留变量名");
    const user = messages[1].content ?? "";

    expect(user).toContain("点击");
    expect(user).toContain('console.log("ok");');
    expect(user).toContain("点击 → 日志");
    expect(user).toContain("自然语言说明");
    expect(user).toContain("点击按钮后显示一段提示文字。");
    expect(user).toContain("保留变量名");
  });
});

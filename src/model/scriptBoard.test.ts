import { describe, expect, it } from "vitest";
import {
  SCRIPT_BLOCK_TEMPLATES,
  createScriptBlock,
  scriptBlockCode,
  scriptBlockFields,
  scriptBlockTemplate,
} from "./scriptBoard";

describe("script board blocks", () => {
  it("creates visual blocks for the low-code library", () => {
    const block = createScriptBlock("bind_text", 40, 80);
    expect(block.kind).toBe("bind_text");
    expect(block.fields).toMatchObject({ module: "", value: "Hello" });
    expect(block.code).toContain("data-spark-module-id");
    expect(block.code).toContain("target.textContent");
    expect(block.width).toBe(280);
  });

  it("exposes module binding fields", () => {
    expect(scriptBlockFields("trigger_event")[0]).toMatchObject({
      key: "module",
      kind: "module",
    });
    expect(scriptBlockFields("bind_style").map((field) => field.key)).toEqual([
      "module",
      "property",
      "value",
    ]);
  });

  it("compiles module bindings and variable interpolation", () => {
    const code = scriptBlockCode("bind_text", {
      module: "m_hero",
      value: "{{count}}",
    });
    expect(code).toContain("m_hero");
    expect(code).toContain("target.textContent = String(count);");
  });

  it("compiles high-level state, request and event blocks", () => {
    expect(
      scriptBlockCode("state_set", {
        name: "count",
        operation: "增加",
        value: "2",
      }),
    ).toBe("count = Number(count) + 2;");
    expect(
      scriptBlockCode("fetch_data", {
        url: "/api/items",
        method: "GET",
        format: "文本",
        variable: "text",
      }),
    ).toContain("response.text()");
    const eventCode = scriptBlockCode("trigger_event", {
      module: "m_button",
      event: "click",
      prevent: "是",
    });
    expect(eventCode).toContain("m_button");
    expect(eventCode).toContain("event.preventDefault();");
  });

  it("compiles list rendering with an array variable", () => {
    const code = scriptBlockCode("bind_list", {
      module: "m_list",
      variable: "todos",
      template: "{{item.title}}",
      empty: "暂无待办",
    });
    expect(code).toContain("m_list");
    expect(code).toContain("Array.isArray(todos)");
    expect(code).toContain("String(item.title)");
    expect(code).toContain("暂无待办");
  });

  it("generates syntactically valid JavaScript for every visible block kind", () => {
    for (const template of SCRIPT_BLOCK_TEMPLATES) {
      if (template.hidden || template.kind === "natural") {
        continue;
      }
      const block = createScriptBlock(template.kind, 0, 0);
      const code = scriptBlockCode(template.kind, block.fields ?? {});
      expect(
        () => new Function(code),
        `${template.kind} generated invalid JavaScript`,
      ).not.toThrow();
    }
  });

  it("keeps legacy block kinds hidden from the palette", () => {
    const visible = SCRIPT_BLOCK_TEMPLATES.filter(
      (template) => !template.hidden,
    ).map((template) => template.kind);
    expect(visible).toContain("bind_text");
    expect(visible).not.toContain("event");
    expect(scriptBlockTemplate("event").hidden).toBe(true);
  });
});

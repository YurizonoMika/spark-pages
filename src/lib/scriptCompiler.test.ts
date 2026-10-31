import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import {
  createScriptBlock,
  scriptBlockCode,
} from "../model/scriptBoard";
import type { Page, ScriptBlock, ScriptBlockKind } from "../model/types";
import { compileScriptBoard } from "./scriptCompiler";

function makeBlock(
  kind: ScriptBlockKind,
  fields: Record<string, string> = {},
): ScriptBlock {
  const block = createScriptBlock(kind, 0, 0);
  block.fields = { ...(block.fields ?? {}), ...fields };
  block.code = scriptBlockCode(kind, block.fields);
  return block;
}

function pageWith(blocks: ScriptBlock[], links: [string, string][] = []): Page {
  const page = defaultProject().pages[0];
  page.scriptBoard = {
    blocks,
    connections: links.map(([from, to], index) => ({
      id: `conn_${index}`,
      from,
      to,
    })),
  };
  return page;
}

describe("compileScriptBoard", () => {
  it("puts connected blocks inside their trigger", () => {
    const event = makeBlock("trigger_event", {
      module: "Btn",
      event: "click",
      prevent: "是",
    });
    const setText = makeBlock("bind_text", {
      module: "MyText",
      value: "你好",
    });
    const code = compileScriptBoard(
      pageWith([event, setText], [[event.id, setText.id]]),
    );

    expect(code).toContain('addEventListener("click"');
    expect(code).toContain("event.preventDefault();");
    expect(code).toContain('target.textContent = "你好";');
    expect(code.indexOf("target.textContent")).toBeGreaterThan(
      code.indexOf("addEventListener"),
    );
    expect(() => new Function(code)).not.toThrow();
  });

  it("nests bindings inside conditions and loops", () => {
    const condition = makeBlock("condition", {
      left: "count",
      operator: ">",
      right: "0",
    });
    const setText = makeBlock("bind_text", {
      module: "MyText",
      value: "{{count}}",
    });
    const code = compileScriptBoard(
      pageWith([condition, setText], [[condition.id, setText.id]]),
    );

    expect(code).toContain("if (count > 0)");
    expect(code).toContain("String(count)");
    expect(code.indexOf("String(count)")).toBeGreaterThan(
      code.indexOf("if (count"),
    );
  });

  it("declares variables written by request and input blocks", () => {
    const request = makeBlock("fetch_data", {
      url: "/api/items",
      method: "GET",
      format: "JSON",
      variable: "items",
    });
    const list = makeBlock("bind_list", {
      module: "m_list",
      variable: "items",
      template: "{{item}}",
      empty: "暂无内容",
    });
    const code = compileScriptBoard(
      pageWith([request, list], [[request.id, list.id]]),
    );

    expect(code).toContain("let items;");
    expect(code).toContain("items = __sparkPayload;");
    expect(code).toContain("Array.isArray(items)");
    expect(() => new Function(code)).not.toThrow();
  });

  it("returns an empty script for an empty board", () => {
    const page = defaultProject().pages[0];
    expect(compileScriptBoard(page)).toBe("");
  });

  it("requires AI when natural-language blocks are present", () => {
    const natural = makeBlock("natural", { description: "做点什么" });
    expect(() => compileScriptBoard(pageWith([natural]))).toThrow(
      /自然语言/,
    );
  });

  it("survives cyclic connections without duplicating blocks", () => {
    const first = makeBlock("console", { message: "one" });
    const second = makeBlock("console", { message: "two" });
    const code = compileScriptBoard(
      pageWith(
        [first, second],
        [
          [first.id, second.id],
          [second.id, first.id],
        ],
      ),
    );
    expect(code.match(/one/g)).toHaveLength(1);
    expect(code.match(/two/g)).toHaveLength(1);
    expect(() => new Function(code)).not.toThrow();
  });
});

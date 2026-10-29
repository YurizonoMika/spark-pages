import { describe, expect, it } from "vitest";
import "../core";
import { listModuleDefinitions } from "../registry";
import { defaultProject } from "../../model/defaults";
import type { ModuleNode } from "../../model/types";

const newTypes = [
  "core.card",
  "core.link",
  "core.badge",
  "core.avatar",
  "core.video",
  "core.list",
  "core.quote",
  "core.progress",
  "core.textarea",
  "core.select",
  "core.checkbox",
];

describe("extra core modules", () => {
  it("registers common web components", () => {
    const types = new Set(
      listModuleDefinitions().map((definition) => definition.type),
    );
    for (const type of newTypes) {
      expect(types.has(type)).toBe(true);
    }
  });

  it("renders standalone HTML for every extra module", () => {
    const project = defaultProject();
    const theme = project.theme;
    for (const type of newTypes) {
      const definition = listModuleDefinitions().find(
        (candidate) => candidate.type === type,
      );
      expect(definition).toBeDefined();
      const module: ModuleNode = {
        id: `m_${type.replace(/\W/g, "_")}`,
        type,
        x: 0,
        y: 0,
        width: definition!.defaultSize.width,
        height: definition!.defaultSize.height,
        props: definition!.defaultProps,
      };
      const html = definition!.renderHtml(module, {
        theme,
        preview: true,
      });
      expect(html.length).toBeGreaterThan(20);
      expect(html).not.toContain("undefined");
    }
  });
});

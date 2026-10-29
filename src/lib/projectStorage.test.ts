import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import { projectSchema } from "./projectStorage";

describe("project storage migration", () => {
  it("migrates legacy nodejs drafts to Vue + TS", () => {
    const legacy = defaultProject() as unknown as Record<string, unknown>;
    legacy.type = "nodejs";
    legacy.nodeTemplate = "vite-react";
    delete legacy.template;

    const parsed = projectSchema.parse(legacy);
    expect(parsed.type).toBe("vue");
    expect(parsed.template).toBe("vite-vue-ts");
  });

  it("preserves animation triggers and groups in drafts", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.modules[0].animationTrigger = { type: "click" };
    page.modules[0].animationGroups = [
      {
        id: "anim_a",
        name: "点击动画",
        enabled: true,
        triggers: [
          { type: "hover" },
          {
            type: "condition",
            moduleId: page.modules[1].id,
            property: "value",
            operator: "gt",
            value: "3",
          },
        ],
      },
    ];
    page.animationTrigger = { type: "custom", code: "return true;" };

    const parsed = projectSchema.parse(project);

    expect(parsed.pages[0].modules[0].animationTrigger).toEqual({
      type: "click",
    });
    expect(parsed.pages[0].modules[0].animationGroups?.[0]).toMatchObject({
      id: "anim_a",
      name: "点击动画",
      triggers: [
        { type: "hover" },
        { type: "condition", operator: "gt", value: "3" },
      ],
    });
    expect(parsed.pages[0].animationTrigger).toEqual({
      type: "custom",
      code: "return true;",
    });
  });

  it("keeps HTML projects on the static template", () => {
    const project = defaultProject();
    project.type = "html";
    const parsed = projectSchema.parse({
      ...project,
      template: "vite-vue-ts",
    });
    expect(parsed.template).toBe("static");
  });
});

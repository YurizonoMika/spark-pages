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

import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import { pageFileMap } from "../lib/ai/projectContext";
import {
  parseProjectManifest,
  serializeProjectManifest,
} from "./projectManifest";

describe("project manifest", () => {
  it("round-trips project settings and page file mappings", () => {
    const project = defaultProject();
    project.name = "营销站";
    project.type = "vue";
    project.template = "vite-vue-ts";
    project.pages[0].file = "pages/home.spark";
    project.pages.push({
      ...project.pages[0],
      id: "page_about",
      title: "关于",
      file: "pages/about.spark",
    });

    const manifest = parseProjectManifest(
      serializeProjectManifest(project),
    );

    expect(manifest.name).toBe("营销站");
    expect(manifest.type).toBe("vue");
    expect(manifest.template).toBe("vite-vue-ts");
    expect(manifest.theme).toEqual(project.theme);
    expect(manifest.pages).toEqual([
      { id: project.pages[0].id, title: "首页", file: "pages/home.spark" },
      { id: "page_about", title: "关于", file: "pages/about.spark" },
    ]);
  });

  it("creates unique page files for pages without an explicit path", () => {
    const project = defaultProject();
    project.pages.push({
      ...project.pages[0],
      id: "page_copy",
      title: project.pages[0].title,
      file: undefined,
    });

    const files = pageFileMap(project);
    const paths = [...files.values()];

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths[0]).toMatch(/^pages\/.+\.spark$/);
    expect(paths[1]).toMatch(/-2\.spark$/);
  });
});

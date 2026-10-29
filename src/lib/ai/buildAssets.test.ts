import { describe, expect, it } from "vitest";
import { defaultProject } from "../../model/defaults";
import type { ModuleNode } from "../../model/types";
import { extractBuildAssets } from "./buildAssets";
import { pageCodeDirectory, pageSlug } from "./projectContext";

function imageModule(id = "hero-image"): ModuleNode {
  return {
    id,
    type: "core.image",
    x: 0,
    y: 0,
    width: 320,
    height: 200,
    props: {
      src: "data:image/png;base64,iVBORw0KGgo=",
      alt: "hero",
      fit: "cover",
      radius: 12,
    },
  };
}

describe("build image assets", () => {
  it("moves embedded images to page-local asset paths", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.modules.push(imageModule());
    const directory = pageCodeDirectory(project, pageSlug(project, page));

    const extracted = extractBuildAssets(project);

    const module = extracted.project.pages[0].modules.find(
      (candidate) => candidate.id === "hero-image",
    );
    expect(module?.props.src).toBe("./assets/images/hero-image.png");
    expect(extracted.assets).toEqual([
      {
        path: `${directory}/assets/images/hero-image.png`,
        src: "./assets/images/hero-image.png",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        pageId: page.id,
      },
    ]);
    expect(
      page.modules.find((candidate) => candidate.id === "hero-image")?.props
        .src,
    ).toContain("data:image/png");
  });

  it("keeps remote and relative image sources untouched", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const remote = imageModule("remote");
    remote.props.src = "https://example.com/a.png";
    const relative = imageModule("relative");
    relative.props.src = "./assets/local.png";
    page.modules.push(remote, relative);

    const extracted = extractBuildAssets(project);

    expect(extracted.assets).toHaveLength(0);
    const modules = extracted.project.pages[0].modules;
    expect(
      modules.find((candidate) => candidate.id === "remote")?.props.src,
    ).toBe("https://example.com/a.png");
    expect(
      modules.find((candidate) => candidate.id === "relative")?.props.src,
    ).toBe("./assets/local.png");
  });
});

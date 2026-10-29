import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import { renderPageHtml } from "./renderHtml";

describe("renderPageHtml", () => {
  it("embeds page custom HTML and JavaScript", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = 'document.title = "custom";';

    const html = renderPageHtml(page, project);

    expect(html).toContain('<script>document.title = "custom";</script>');
    expect(html).not.toContain("spark-custom-html");
    expect(html).not.toContain("spark-pages-preview");
  });

  it("renders module ids so page scripts can target elements", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const id = page.modules[0].id;

    const html = renderPageHtml(page, project);

    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(`data-spark-module-id="${id}"`);
  });

  it("renders paused animations and the trigger runtime", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const module = page.modules[0];
    module.animations = {
      entrance: "fade-in",
      loop: "",
      exit: "",
      duration: 500,
      delay: 0,
      exitDelay: 1000,
      easing: "ease-out",
    };
    module.animationTrigger = {
      type: "click",
    };

    const html = renderPageHtml(page, project);

    expect(html).toContain("data-spark-anim-trigger");
    expect(html).toContain("&quot;type&quot;:&quot;click&quot;");
    expect(html).toContain("animation-play-state:paused");
    expect(html).toContain("Spark 动画触发条件执行失败");
  });

  it("renders multiple independent animation groups", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const module = page.modules[0];
    module.animationGroups = [
      {
        id: "anim_click",
        name: "点击",
        enabled: true,
        animations: {
          entrance: "fade-in",
          loop: "",
          exit: "",
          duration: 400,
          delay: 0,
          exitDelay: 1000,
          easing: "ease-out",
        },
        triggers: [{ type: "click" }],
      },
      {
        id: "anim_hover",
        name: "悬停",
        enabled: true,
        keyframes: {
          duration: 800,
          loop: false,
          tracks: {
            opacity: [{ id: "kf1", time: 0, value: 1, easing: "linear" }],
          },
        },
        triggers: [
          { type: "hover" },
          {
            type: "condition",
            moduleId: module.id,
            property: "value",
            operator: "gt",
            value: "1",
          },
        ],
      },
    ];

    const html = renderPageHtml(page, project);

    expect(html.match(/data-spark-anim-triggers="/g)).toHaveLength(2);
    expect(html).toContain('&quot;type&quot;:&quot;hover&quot;');
    expect(html).toContain("spark-kf-");
    expect(html).toContain("Spark 动画触发条件执行失败");
  });

  it("adds the wand bridge only in preview mode", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const preview = renderPageHtml(page, project, { preview: true });

    expect(preview).toContain("spark-pages-preview");
    expect(preview).toContain("spark-wand-selected");
  });

  it("marks TypeScript attachments as non-executable preview scripts", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = "const value: number = 1;";
    page.scriptLanguage = "typescript";

    const html = renderPageHtml(page, project);

    expect(html).toContain('<script type="text/typescript">');
    expect(html).toContain("const value: number = 1;");
  });

  it("escapes a closing script tag inside custom JavaScript", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = 'const html = "</script>";';

    const html = renderPageHtml(page, project);

    expect(html).toContain("<\\/script>");
  });
});

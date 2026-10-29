import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import {
  ProjectXmlError,
  parseProjectXml,
  serializeProject,
} from "./projectXml";

describe("project XML", () => {
  it("round-trips the default project", () => {
    const project = defaultProject();
    const xml = serializeProject(project);
    const parsed = parseProjectXml(xml);

    expect(parsed.version).toBe(1);
    expect(parsed.theme).toEqual(project.theme);
    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0].id).toBe(project.pages[0].id);
    expect(parsed.pages[0].modules).toHaveLength(
      project.pages[0].modules.length,
    );
    expect(parsed.pages[0].modules[1].props.text).toBe("用 AI 构建网页");
  });

  it("round-trips animation trigger conditions and custom code", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const source = page.modules[1];
    page.modules[0].animationTrigger = {
      type: "condition",
      moduleId: source.id,
      property: "value",
      operator: "gt",
      value: "10",
    };
    page.animationTrigger = {
      type: "custom",
      code: "return document.title.length > 0;",
    };

    const parsed = parseProjectXml(serializeProject(project));

    expect(parsed.pages[0].modules[0].animationTrigger).toMatchObject({
      type: "condition",
      moduleId: source.id,
      property: "value",
      operator: "gt",
      value: "10",
    });
    expect(parsed.pages[0].animationTrigger).toMatchObject({
      type: "custom",
      code: "return document.title.length > 0;",
    });
  });

  it("round-trips the page script board", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.scriptBoard = {
      blocks: [
        {
          id: "block_a",
          kind: "event",
          title: "点击按钮",
          code: 'document.getElementById("cta").addEventListener("click", () => {\n  console.log("hi");\n});',
          x: 80,
          y: 120,
          width: 260,
          height: 168,
        },
        {
          id: "block_b",
          kind: "console",
          title: "打印",
          code: 'console.log("done");',
          x: 420,
          y: 120,
          width: 260,
          height: 168,
        },
      ],
      connections: [{ id: "conn_a", from: "block_a", to: "block_b" }],
    };

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].scriptBoard).toEqual(page.scriptBoard);
  });

  it("round-trips multiple animation groups", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.modules[0].animationGroups = [
      {
        id: "anim_click",
        name: "点击动画",
        enabled: true,
        animations: {
          entrance: "fade-in",
          loop: "",
          exit: "",
          duration: 500,
          delay: 0,
          exitDelay: 1000,
          easing: "ease-out",
        },
        triggers: [{ type: "click" }],
      },
      {
        id: "anim_hover",
        name: "悬停动画",
        enabled: false,
        keyframes: {
          duration: 1000,
          loop: true,
          tracks: {
            opacity: [{ id: "kf1", time: 0, value: 1, easing: "linear" }],
          },
        },
        triggers: [
          { type: "hover" },
          {
            type: "condition",
            moduleId: page.modules[1].id,
            property: "value",
            operator: "gt",
            value: "5",
          },
        ],
      },
    ];

    const parsed = parseProjectXml(serializeProject(project));
    const groups = parsed.pages[0].modules[0].animationGroups;

    expect(groups).toHaveLength(2);
    expect(groups?.[0]).toMatchObject({
      id: "anim_click",
      name: "点击动画",
      enabled: true,
    });
    expect(groups?.[1]).toMatchObject({
      id: "anim_hover",
      name: "悬停动画",
      enabled: false,
    });
    expect(groups?.[1].triggers).toHaveLength(2);
  });

  it("round-trips embedded image data URLs", () => {
    const project = defaultProject();
    const src = `data:image/png;base64,${"iVBORw0KGgo=".repeat(4000)}`;
    project.pages[0].modules.push({
      id: "hero-image",
      type: "core.image",
      x: 0,
      y: 0,
      width: 320,
      height: 200,
      props: { src, alt: "hero", fit: "cover", radius: 12 },
    });

    const parsed = parseProjectXml(serializeProject(project));
    const module = parsed.pages[0].modules.find(
      (candidate) => candidate.id === "hero-image",
    );

    expect(module?.props.src).toBe(src);
  });

  it("round-trips project settings", () => {
    const project = defaultProject();
    project.name = "营销官网";
    project.description = "用于 AI 构建的测试项目";
    project.type = "vue";
    project.template = "vite-vue-ts";

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.name).toBe("营销官网");
    expect(parsed.description).toBe("用于 AI 构建的测试项目");
    expect(parsed.type).toBe("vue");
    expect(parsed.template).toBe("vite-vue-ts");
  });

  it("migrates legacy Node.js project XML to Vue + TS", () => {
    const xml = `<?xml version="1.0"?>
<spark-pages version="1" name="Legacy" type="nodejs" node-template="vite-react">
  <page id="p1" width="1200" height="800" grid="16" />
</spark-pages>`;
    const parsed = parseProjectXml(xml);
    expect(parsed.type).toBe("vue");
    expect(parsed.template).toBe("vite-vue-ts");
  });

  it("defaults project settings in older XML files", () => {
    const xml = `<?xml version="1.0"?>
<spark-pages version="1">
  <page id="p1" width="1200" height="800" grid="16" />
</spark-pages>`;
    const parsed = parseProjectXml(xml);
    expect(parsed.name).toBe("未命名项目");
    expect(parsed.description).toBe("");
    expect(parsed.type).toBe("html");
    expect(parsed.template).toBe("static");
  });

  it("round-trips page and module animations", () => {
    const project = defaultProject();
    project.pages[0].animations = {
      entrance: "zoom-in",
      loop: "float",
      exit: "fade-out",
      duration: 800,
      delay: 100,
      exitDelay: 2400,
      easing: "ease-out",
    };
    project.pages[0].modules[1].animations = {
      entrance: "slide-up",
      loop: "",
      exit: "",
      duration: 500,
      delay: 50,
      exitDelay: 3000,
      easing: "linear",
    };

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].animations).toEqual(project.pages[0].animations);
    expect(parsed.pages[0].modules[1].animations).toEqual(
      project.pages[0].modules[1].animations,
    );
  });

  it("round-trips keyframe animations", () => {
    const project = defaultProject();
    project.pages[0].keyframes = {
      duration: 2000,
      loop: false,
      tracks: {
        x: [
          { id: "kf1", time: 0, value: 0, easing: "linear" },
          { id: "kf2", time: 2000, value: 240, easing: "ease-out" },
        ],
        opacity: [
          { id: "kf3", time: 0, value: 1, easing: "linear" },
          { id: "kf4", time: 2000, value: 0.2, easing: "linear" },
        ],
      },
    };
    project.pages[0].modules[1].keyframes = {
      duration: 1000,
      loop: true,
      tracks: {
        rotate: [
          { id: "kf5", time: 0, value: 0, easing: "linear" },
          { id: "kf6", time: 500, value: 20, easing: "linear" },
          { id: "kf7", time: 1000, value: 0, easing: "linear" },
        ],
      },
    };

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].keyframes).toEqual(project.pages[0].keyframes);
    expect(parsed.pages[0].modules[1].keyframes).toEqual(
      project.pages[0].modules[1].keyframes,
    );
  });

  it("round-trips custom page HTML and JavaScript", () => {
    const project = defaultProject();
    project.pages[0].customScript =
      'const marker = "]]>";\nconst value: number = 1;';
    project.pages[0].scriptLanguage = "typescript";

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].customScript).toBe(
      project.pages[0].customScript,
    );
    expect(parsed.pages[0].scriptLanguage).toBe("typescript");
  });

  it("round-trips module reference edges", () => {
    const project = defaultProject();
    project.pages[0].modules[1].anchorX = "right";
    project.pages[0].modules[1].anchorY = "bottom";

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].modules[1].anchorX).toBe("right");
    expect(parsed.pages[0].modules[1].anchorY).toBe("bottom");
  });

  it("preserves special characters and newlines", () => {
    const project = defaultProject();
    project.pages[0].modules[1].props.text =
      "A & B < C\n第二行 ]]> 结束";

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].modules[1].props.text).toBe(
      "A & B < C\n第二行 ]]> 结束",
    );
  });

  it("round-trips typed props", () => {
    const project = defaultProject();
    project.pages[0].modules[0].props.list = ["a", "b"];
    project.pages[0].modules[0].props.enabled = true;
    project.pages[0].modules[0].props.count = 42;

    const parsed = parseProjectXml(serializeProject(project));
    expect(parsed.pages[0].modules[0].props.list).toEqual(["a", "b"]);
    expect(parsed.pages[0].modules[0].props.enabled).toBe(true);
    expect(parsed.pages[0].modules[0].props.count).toBe(42);
  });

  it("preserves unknown plugin module types", () => {
    const project = defaultProject();
    project.pages[0].modules.push({
      id: "m_plugin",
      type: "acme.carousel",
      x: 32,
      y: 512,
      width: 320,
      height: 160,
      props: { slides: 4, autoplay: true },
    });

    const parsed = parseProjectXml(serializeProject(project));
    const module = parsed.pages[0].modules.find(
      (candidate) => candidate.id === "m_plugin",
    );
    expect(module?.type).toBe("acme.carousel");
    expect(module?.props).toEqual({ slides: 4, autoplay: true });
  });

  it("rejects an invalid root element", () => {
    expect(() => parseProjectXml("<page />")).toThrow(ProjectXmlError);
  });

  it("rejects duplicate module ids", () => {
    const xml = `<?xml version="1.0"?>
<spark-pages version="1">
  <page id="p1" width="1200" height="800" grid="16">
    <module id="m1" type="core.text" x="0" y="0" width="16" height="16" />
    <module id="m1" type="core.text" x="0" y="0" width="16" height="16" />
  </page>
</spark-pages>`;
    expect(() => parseProjectXml(xml)).toThrow(/重复模块 ID/);
  });
});

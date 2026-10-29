import { beforeEach, describe, expect, it } from "vitest";
import "../modules/core";
import { useEditorStore } from "./editorStore";
import { rectOf } from "../lib/geometry";

function reset() {
  localStorage.clear();
  useEditorStore.getState().newProject();
}

describe("editor store", () => {
  beforeEach(reset);

  it("adds a module snapped to the grid", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.heading", 7, 9);
    const state = useEditorStore.getState();
    const page = state.project.pages[0];
    const module = page.modules.find((candidate) => candidate.id === id);

    expect(id).toBeTruthy();
    expect(module?.x).toBe(0);
    expect(module?.y).toBe(16);
    expect((module?.width ?? 0) % page.grid).toBe(0);
    expect((module?.height ?? 0) % page.grid).toBe(0);
    expect(state.selection).toEqual([id]);
  });

  it("renames module ids with validation and keeps selection", () => {
    const first = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    expect(first).toBeTruthy();

    expect(useEditorStore.getState().renameModule(first!, "hero-title")).toBeNull();
    const renamed = useEditorStore.getState();
    expect(
      renamed.project.pages[0].modules.some(
        (module) => module.id === "hero-title",
      ),
    ).toBe(true);
    expect(renamed.selection).toEqual(["hero-title"]);

    const second = useEditorStore
      .getState()
      .addModuleAt("core.text", 128, 64);
    expect(
      useEditorStore.getState().renameModule(second!, "hero-title"),
    ).toContain("已存在");
    expect(
      useEditorStore.getState().renameModule(second!, "1bad"),
    ).toContain("ID");
    expect(
      useEditorStore.getState().renameModule(second!, "bad id"),
    ).toContain("ID");
  });

  it("undoes and redoes module additions", () => {
    const before = useEditorStore.getState().project.pages[0].modules.length;
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    expect(useEditorStore.getState().project.pages[0].modules).toHaveLength(
      before + 1,
    );

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.pages[0].modules).toHaveLength(
      before,
    );

    useEditorStore.getState().redo();
    expect(
      useEditorStore
        .getState()
        .project.pages[0].modules.some((module) => module.id === id),
    ).toBe(true);
  });

  it("re-snaps modules when grid resolution changes", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.box", 65, 65);
    useEditorStore.getState().setPageConfig({ grid: 24 });
    const state = useEditorStore.getState();
    const page = state.project.pages[0];
    const module = page.modules.find((candidate) => candidate.id === id);

    expect((module?.x ?? 0) % 24).toBe(0);
    expect((module?.y ?? 0) % 24).toBe(0);
    expect((module?.width ?? 0) % 24).toBe(0);
    expect((module?.height ?? 0) % 24).toBe(0);
  });

  it("edits script board blocks and connections", () => {
    const first = useEditorStore.getState().addScriptBlock("event", 40, 60);
    const second = useEditorStore.getState().addScriptBlock("console", 360, 60);
    expect(useEditorStore.getState().connectScriptBlocks(first, second)).toBe(
      true,
    );
    expect(
      useEditorStore.getState().connectScriptBlocks(first, second),
    ).toBe(false);

    useEditorStore.getState().updateScriptBlock(first, {
      title: "点击",
      code: 'console.log("click");',
    });
    let page = useEditorStore.getState().project.pages[0];
    expect(page.scriptBoard?.blocks).toHaveLength(2);
    expect(page.scriptBoard?.connections).toHaveLength(1);
    expect(page.scriptBoard?.blocks[0]).toMatchObject({
      title: "点击",
      code: 'console.log("click");',
    });

    useEditorStore.getState().removeScriptBlock(second);
    page = useEditorStore.getState().project.pages[0];
    expect(page.scriptBoard?.blocks).toHaveLength(1);
    expect(page.scriptBoard?.connections).toHaveLength(0);
  });

  it("manages multiple animation groups per module", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    const target = { kind: "module" as const, moduleId: id! };
    const first = useEditorStore
      .getState()
      .addAnimationGroup(target, "点击动画");
    const second = useEditorStore
      .getState()
      .addAnimationGroup(target, "悬停动画");

    useEditorStore.getState().setModuleAnimations(
      id!,
      { entrance: "fade-in" },
      first,
    );
    useEditorStore.getState().addAnimationTrack("opacity", 0, second);
    useEditorStore.getState().updateAnimationGroup(target, second, {
      triggers: [{ type: "hover" }],
    });

    const module = useEditorStore
      .getState()
      .project.pages[0].modules.find((candidate) => candidate.id === id);
    expect(module?.animationGroups).toHaveLength(2);
    expect(
      module?.animationGroups?.find((group) => group.id === first)?.animations
        ?.entrance,
    ).toBe("fade-in");
    expect(
      module?.animationGroups?.find((group) => group.id === second)?.keyframes
        ?.tracks.opacity,
    ).toHaveLength(1);
    expect(
      module?.animationGroups?.find((group) => group.id === second)?.triggers,
    ).toEqual([{ type: "hover" }]);

    const copy = useEditorStore
      .getState()
      .duplicateAnimationGroup(target, second);
    expect(copy).toBeTruthy();
    expect(
      useEditorStore.getState().project.pages[0].modules.find(
        (candidate) => candidate.id === id,
      )?.animationGroups,
    ).toHaveLength(3);

    useEditorStore.getState().removeAnimationGroup(target, first);
    expect(
      useEditorStore.getState().project.pages[0].modules.find(
        (candidate) => candidate.id === id,
      )?.animationGroups,
    ).toHaveLength(2);
  });

  it("stores independent page and module animations", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    useEditorStore.getState().setModuleAnimations(id!, {
      entrance: "fade-in",
      duration: 800,
    });
    useEditorStore.getState().setPageAnimations({ loop: "float" });

    const store = useEditorStore.getState();
    const page = store.project.pages[0];
    const module = page.modules.find((candidate) => candidate.id === id);
    expect(module?.animations?.entrance).toBe("fade-in");
    expect(module?.animations?.duration).toBe(800);
    expect(page.animations?.loop).toBe("float");
  });

  it("adds, updates and removes keyframes on the selected module", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    useEditorStore.getState().addKeyframe("x", 0);
    useEditorStore.getState().addKeyframe("x", 500);
    let page = useEditorStore.getState().project.pages[0];
    let module = page.modules.find((candidate) => candidate.id === id);
    let track = module?.keyframes?.tracks.x ?? [];
    expect(track).toHaveLength(2);

    useEditorStore.getState().updateKeyframe("x", track[1].id, {
      value: 120,
    });
    page = useEditorStore.getState().project.pages[0];
    module = page.modules.find((candidate) => candidate.id === id);
    track = module?.keyframes?.tracks.x ?? [];
    expect(track[1].value).toBe(120);

    useEditorStore.getState().removeKeyframe("x", track[1].id);
    page = useEditorStore.getState().project.pages[0];
    module = page.modules.find((candidate) => candidate.id === id);
    expect(module?.keyframes?.tracks.x).toHaveLength(1);
  });

  it("aligns modules to right/bottom page edges", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.box", 64, 64);
    const page = useEditorStore.getState().project.pages[0];
    useEditorStore.getState().alignModuleToEdge(id!, "right");
    let module = useEditorStore
      .getState()
      .project.pages[0].modules.find((candidate) => candidate.id === id);
    if (!module) throw new Error("missing module");
    expect(module.anchorX).toBe("right");
    expect(module.x).toBe(0);
    expect(rectOf(module, page.width, page.height).x + module.width).toBe(
      page.width,
    );

    useEditorStore.getState().alignModuleToEdge(id!, "bottom");
    module = useEditorStore
      .getState()
      .project.pages[0].modules.find((candidate) => candidate.id === id);
    if (!module) throw new Error("missing module");
    expect(module.anchorY).toBe("bottom");
    expect(module.y).toBe(0);
    expect(rectOf(module, page.width, page.height).y + module.height).toBe(
      page.height,
    );
  });

  it("keeps right-aligned modules attached when page width grows", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.box", 64, 64);
    useEditorStore.getState().alignModuleToEdge(id!, "right");
    useEditorStore.getState().setPageConfig({ width: 1400 });
    const page = useEditorStore.getState().project.pages[0];
    const module = page.modules.find((candidate) => candidate.id === id);
    expect(module?.x).toBe(0);
    expect(module?.anchorX).toBe("right");
    if (module) {
      const rect = rectOf(module, page.width, page.height);
      expect(rect.x + rect.width).toBe(page.width);
    }
  });

  it("targets the page when nothing is selected", () => {
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().addKeyframe("opacity", 0);
    const page = useEditorStore.getState().project.pages[0];
    expect(page.keyframes?.tracks.opacity).toHaveLength(1);
  });

  it("adds and removes arbitrary animation tracks", () => {
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().addAnimationTrack("blur", 0);
    let page = useEditorStore.getState().project.pages[0];
    expect(page.keyframes?.tracks.blur).toHaveLength(1);
    useEditorStore.getState().removeAnimationTrack("blur");
    page = useEditorStore.getState().project.pages[0];
    expect(page.keyframes?.tracks.blur).toBeUndefined();
  });

  it("can group all agent edits into one undo step", () => {
    const base = useEditorStore.getState().past.length;
    const id = useEditorStore
      .getState()
      .addModuleAt("core.text", 64, 64);
    useEditorStore.getState().updateModule(id!, {
      x: 96,
      props: { text: "agent edit" },
    });
    expect(useEditorStore.getState().past.length).toBe(base + 2);
    useEditorStore.getState().groupHistorySince(base);
    expect(useEditorStore.getState().past.length).toBe(base + 1);
    useEditorStore.getState().undo();
    expect(
      useEditorStore
        .getState()
        .project.pages[0].modules.some((module) => module.id === id),
    ).toBe(false);
  });

  it("edits page code as one undoable transaction", () => {
    const store = useEditorStore.getState();
    const pageId = store.project.pages[0].id;
    const base = store.past.length;

    store.beginTransaction();
    store.updatePageCodeTransient(pageId, { customScript: "const a = 1;" });
    store.updatePageCodeTransient(pageId, {
      customScript: "const value: number = 1;",
      scriptLanguage: "typescript",
    });
    store.endTransaction();

    const page = useEditorStore.getState().project.pages[0];
    expect(page.customScript).toBe("const value: number = 1;");
    expect(page.scriptLanguage).toBe("typescript");
    expect(useEditorStore.getState().past.length).toBe(base + 1);

    useEditorStore.getState().undo();
    const restored = useEditorStore.getState().project.pages[0];
    expect(restored.customScript).toBeUndefined();
    expect(restored.scriptLanguage).toBeUndefined();
  });

  it("duplicates selected modules with an offset", () => {
    const id = useEditorStore
      .getState()
      .addModuleAt("core.button", 64, 64);
    useEditorStore.getState().duplicateSelected();
    const state = useEditorStore.getState();
    const modules = state.project.pages[0].modules;
    const original = modules.find((module) => module.id === id);
    const clone = modules.find((module) => module.id === state.selection[0]);

    expect(clone?.id).not.toBe(original?.id);
    expect(clone?.x).toBe((original?.x ?? 0) + 32);
    expect(clone?.y).toBe((original?.y ?? 0) + 32);
  });
});

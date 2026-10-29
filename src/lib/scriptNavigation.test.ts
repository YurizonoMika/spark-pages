import { beforeEach, describe, expect, it } from "vitest";
import "../modules/core";
import { useEditorStore } from "../store/editorStore";
import {
  findModuleCodeRange,
  goToModuleCode,
} from "./scriptNavigation";
import type { ModuleNode } from "../model/types";

function setupModule(id = "hero-title"): ModuleNode {
  const store = useEditorStore.getState();
  const moduleId = store.addModuleAt("core.heading", 32, 32);
  if (!moduleId) {
    throw new Error("module not created");
  }
  if (moduleId !== id) {
    store.renameModule(moduleId, id);
  }
  const page = useEditorStore.getState().project.pages[0];
  const module = page.modules.find((candidate) => candidate.id === id);
  if (!module) {
    throw new Error("module missing");
  }
  return module;
}

describe("script navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().newProject();
  });

  it("inserts a starter snippet and reveals it in the page script", () => {
    const module = setupModule();
    const page = useEditorStore.getState().project.pages[0];

    const navigation = goToModuleCode(page.id, module.id);

    expect(navigation).toMatchObject({ ok: true, inserted: true });
    const state = useEditorStore.getState();
    const script = state.project.pages[0].customScript ?? "";
    expect(script).toContain(`getElementById("hero-title")`);
    expect(state.dirty).toBe(true);
    expect(state.scriptReveal?.pageId).toBe(page.id);
    expect(state.scriptReveal?.from).toBeGreaterThanOrEqual(0);
    expect(state.scriptReveal?.to).toBe(script.length);
  });

  it("reuses an existing selector instead of inserting again", () => {
    const module = setupModule();
    const page = useEditorStore.getState().project.pages[0];
    const script = '// setup\nconst hero = document.querySelector("#hero-title");\n';
    useEditorStore.getState().updatePageCode(page.id, {
      customScript: script,
    });

    const navigation = goToModuleCode(page.id, module.id);

    expect(navigation).toMatchObject({ ok: true, inserted: false });
    const state = useEditorStore.getState();
    expect(state.project.pages[0].customScript).toBe(script);
    expect(state.scriptReveal?.from).toBe(script.indexOf("const hero"));
    expect(
      findModuleCodeRange(script, module),
    ).toMatchObject({ from: script.indexOf("const hero") });
  });
});

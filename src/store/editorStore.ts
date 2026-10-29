import { produce } from "immer";
import { create } from "zustand";
import {
  createEmptyPage,
  createId,
  defaultProject,
  deepClone,
} from "../model/defaults";
import type {
  AnimationConfig,
  AnimationTab,
  KeyframeAnimation,
  KeyframeProperty,
  CodeLanguage,
  LeftTab,
  ModuleNode,
  ProjectTemplate,
  Page,
  Project,
  ProjectType,
  PropValue,
  SettingsTab,
  Theme,
  DesignView,
  FileView,
} from "../model/types";
import {
  DEFAULT_ANIMATION,
  normalizeAnimation,
} from "../model/animations";
import {
  DEFAULT_KEYFRAME_ANIMATION,
  keyframePropertyDefinition,
  normalizeKeyframeAnimation,
  valueAtTime,
} from "../model/keyframes";
import { getModuleDefinitionSafe } from "../modules/registry";
import {
  clamp,
  MAX_ZOOM,
  MIN_ZOOM,
  offsetAnchored,
  rectOf,
  rectToAnchored,
  snap,
} from "../lib/geometry";
import { loadDraft } from "../lib/projectStorage";

const HISTORY_LIMIT = 100;

type ProjectRecipe = (draft: Project) => void;

interface PagePatch {
  title?: string;
  width?: number;
  height?: number;
  grid?: number;
  background?: string;
}

interface ProjectSettingsPatch {
  name?: string;
  description?: string;
  type?: ProjectType;
  template?: ProjectTemplate;
}

export interface NewModuleInput {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  props?: Record<string, PropValue>;
}

export interface ModuleUpdatePatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  anchorX?: "left" | "right";
  anchorY?: "top" | "bottom";
  props?: Record<string, PropValue>;
}

export interface PageCodePatch {
  customScript?: string;
  scriptLanguage?: "javascript" | "typescript";
}

export type KeyframeTarget =
  | { kind: "page" }
  | { kind: "module"; moduleId: string };

export interface OpenProjectFile {
  path: string;
  name: string;
  language: CodeLanguage;
  content: string;
  savedContent: string;
}

export type OpenDocument =
  | { kind: "page"; pageId: string }
  | { kind: "file"; path: string };

export interface ScriptReveal {
  pageId: string;
  from: number;
  to: number;
  token: number;
}

const MODULE_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export interface EditorState {
  project: Project;
  activePageId: string;
  selection: string[];
  zoom: number;
  showGrid: boolean;
  designView: DesignView;
  fileView: FileView;
  leftTab: LeftTab;
  inspectorOpen: boolean;
  projectFolder: string | null;
  filesVersion: number;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  buildOpen: boolean;
  pageBuildOpen: boolean;
  animationDockOpen: boolean;
  animationTab: AnimationTab;
  animationTime: number;
  animationPlaying: boolean;
  projectPath: string | null;
  openDocuments: OpenDocument[];
  openFiles: OpenProjectFile[];
  activeFilePath: string | null;
  scriptReveal: ScriptReveal | null;
  dirty: boolean;
  restoredDraft: boolean;
  past: Project[];
  future: Project[];
  transactionBase: Project | null;

  commit: (recipe: ProjectRecipe) => void;
  beginTransaction: () => void;
  updateTransient: (recipe: ProjectRecipe) => void;
  endTransaction: () => void;
  cancelTransaction: () => void;
  undo: () => void;
  redo: () => void;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  addModuleAt: (type: string, x: number, y: number) => string | null;
  addModuleAtCenter: (type: string) => string | null;
  insertModules: (items: NewModuleInput[]) => string[];
  updateModule: (id: string, patch: ModuleUpdatePatch) => void;
  renameModule: (id: string, nextId: string) => string | null;
  setScriptReveal: (reveal: ScriptReveal | null) => void;
  removeModules: (ids: string[]) => void;
  updateModuleProps: (
    id: string,
    patch: Record<string, PropValue>,
  ) => void;
  updateModulePropsTransient: (
    id: string,
    patch: Record<string, PropValue>,
  ) => void;
  updateModuleRect: (
    id: string,
    rect: Pick<ModuleNode, "x" | "y" | "width" | "height">,
  ) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  reorderModule: (
    id: string,
    direction: "up" | "down" | "top" | "bottom",
  ) => void;
  setPageConfig: (patch: PagePatch) => void;
  updatePageCode: (pageId: string, patch: PageCodePatch) => void;
  updatePageCodeTransient: (pageId: string, patch: PageCodePatch) => void;
  replacePage: (page: Page) => void;
  alignModuleToEdge: (
    id: string,
    edge: "left" | "right" | "top" | "bottom",
  ) => void;
  setModuleAnimations: (id: string, patch: Partial<AnimationConfig>) => void;
  setPageAnimations: (patch: Partial<AnimationConfig>) => void;
  groupHistorySince: (baseLength: number) => void;
  setAnimationDockOpen: (open: boolean) => void;
  setAnimationTab: (tab: AnimationTab) => void;
  setAnimationTime: (time: number) => void;
  setAnimationPlaying: (playing: boolean) => void;
  addAnimationTrack: (property: KeyframeProperty, time: number) => void;
  removeAnimationTrack: (property: KeyframeProperty) => void;
  setTargetKeyframes: (
    target: KeyframeTarget,
    config: KeyframeAnimation,
  ) => void;
  addKeyframe: (
    property: KeyframeProperty,
    time: number,
    value?: number,
  ) => void;
  updateKeyframe: (
    property: KeyframeProperty,
    id: string,
    patch: Partial<{ time: number; value: number; easing: string }>,
  ) => void;
  removeKeyframe: (property: KeyframeProperty, id: string) => void;
  setKeyframeDuration: (duration: number) => void;
  setKeyframeLoop: (loop: boolean) => void;
  setProjectSettings: (patch: ProjectSettingsPatch) => void;
  setTheme: (patch: Partial<Theme>) => void;
  setActivePage: (id: string) => void;
  openPageTab: (id: string) => void;
  closePageTab: (id: string) => void;
  addPage: () => void;
  deletePage: (id: string) => void;

  setZoom: (zoom: number) => void;
  setDesignView: (view: DesignView) => void;
  setFileView: (view: FileView) => void;
  setLeftTab: (tab: LeftTab) => void;
  setInspectorOpen: (open: boolean) => void;
  setProjectFolder: (folder: string | null) => void;
  bumpFilesVersion: () => void;
  openFileTab: (file: OpenProjectFile) => void;
  setActiveFilePath: (path: string | null) => void;
  updateFileTabContent: (path: string, content: string) => void;
  markFileTabSaved: (path: string, content: string) => void;
  closeFileTab: (path: string) => void;
  setSettingsOpen: (open: boolean, tab?: SettingsTab) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setBuildOpen: (open: boolean) => void;
  setPageBuildOpen: (open: boolean) => void;
  setProjectPath: (path: string | null) => void;
  markSaved: (path: string | null) => void;
  newProject: () => void;
  loadProject: (project: Project, path?: string | null) => void;
}

function activePageOf(project: Project, activePageId: string): Page {
  return (
    project.pages.find((page) => page.id === activePageId) ??
    project.pages[0]
  );
}

export function selectActivePage(state: EditorState): Page {
  return activePageOf(state.project, state.activePageId);
}

function pageDocument(pageId: string): OpenDocument {
  return { kind: "page", pageId };
}

function withOpenDocument(
  documents: OpenDocument[],
  document: OpenDocument,
): OpenDocument[] {
  const exists = documents.some((candidate) =>
    document.kind === "page"
      ? candidate.kind === "page" && candidate.pageId === document.pageId
      : candidate.kind === "file" && candidate.path === document.path,
  );
  return exists ? documents : [...documents, document];
}

function documentAfter(
  documents: OpenDocument[],
  index: number,
): OpenDocument | undefined {
  return documents[Math.min(index, Math.max(documents.length - 1, 0))];
}

function activationFor(document: OpenDocument): Partial<EditorState> {
  if (document.kind === "page") {
    return {
      activePageId: document.pageId,
      activeFilePath: null,
      selection: [],
      transactionBase: null,
    };
  }
  return { activeFilePath: document.path };
}

export function selectSelectedModules(state: EditorState): ModuleNode[] {
  const page = selectActivePage(state);
  const selected = new Set(state.selection);
  return page.modules.filter((module) => selected.has(module.id));
}

function pruneSelection(
  project: Project,
  activePageId: string,
  selection: string[],
): string[] {
  const page = activePageOf(project, activePageId);
  const ids = new Set(page.modules.map((module) => module.id));
  return selection.filter((id) => ids.has(id));
}

function normalizeProjectState(
  project: Project,
  activePageId: string,
  selection: string[],
): { activePageId: string; selection: string[] } {
  const nextActivePageId = project.pages.some(
    (page) => page.id === activePageId,
  )
    ? activePageId
    : project.pages[0].id;
  return {
    activePageId: nextActivePageId,
    selection: pruneSelection(project, nextActivePageId, selection),
  };
}

function clampModuleToPage(module: ModuleNode, page: Page): void {
  if (module.width > page.width) {
    module.width = Math.max(page.grid, page.width);
  }
  module.x = clamp(module.x, 0, Math.max(page.width - module.width, 0));
  module.y = Math.max(0, module.y);
  if (module.anchorY === "bottom") {
    module.y = clamp(
      module.y,
      0,
      Math.max(page.height - module.height, 0),
    );
  }
}

function growPageHeight(page: Page, extra = 0): void {
  const bottom = page.modules.reduce((max, module) => {
    const rect = rectOf(module, page.width, page.height);
    return Math.max(max, rect.y + rect.height);
  }, 0);
  const desired = Math.max(page.height, bottom + extra);
  page.height = Math.max(
    page.grid,
    Math.ceil(desired / page.grid) * page.grid,
  );
}

function snapPageModules(page: Page, nextGrid: number): void {
  for (const module of page.modules) {
    module.x = Math.max(0, snap(module.x, nextGrid));
    module.y = Math.max(0, snap(module.y, nextGrid));
    module.width = Math.max(nextGrid, snap(module.width, nextGrid));
    module.height = Math.max(nextGrid, snap(module.height, nextGrid));
    clampModuleToPage(module, page);
  }
}

function clampPageWidth(page: Page): void {
  for (const module of page.modules) {
    clampModuleToPage(module, page);
  }
}

function createModuleAt(type: string, x: number, y: number, page: Page): ModuleNode {
  const definition = getModuleDefinitionSafe(type);
  const width = Math.max(
    page.grid,
    snap(definition.defaultSize.width, page.grid),
  );
  const height = Math.max(
    page.grid,
    snap(definition.defaultSize.height, page.grid),
  );
  const snappedX = clamp(snap(x, page.grid), 0, Math.max(page.width - width, 0));
  const snappedY = Math.max(0, snap(y, page.grid));

  return {
    id: createId(),
    type,
    x: snappedX,
    y: snappedY,
    width,
    height,
    props: deepClone(definition.defaultProps),
  };
}

export interface AnimationTarget {
  kind: "page" | "module";
  page: Page;
  module?: ModuleNode;
}

export function animationTargetOf(state: EditorState): AnimationTarget {
  const page = activePageOf(state.project, state.activePageId);
  const module =
    state.selection.length === 1
      ? page.modules.find((candidate) => candidate.id === state.selection[0])
      : undefined;
  return module
    ? { kind: "module", page, module }
    : { kind: "page", page };
}

const restored = loadDraft();
const initialProject = restored?.project ?? defaultProject();
const initialActivePageId =
  restored?.activePageId ?? initialProject.pages[0].id;

function folderOfPath(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function applyPageCodePatch(page: Page, patch: PageCodePatch): void {
  if ("customScript" in patch) {
    page.customScript = patch.customScript || undefined;
  }
  if ("scriptLanguage" in patch) {
    page.scriptLanguage = patch.scriptLanguage;
  }
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  project: initialProject,
  activePageId: initialActivePageId,
  selection: [],
  zoom: 0.75,
  showGrid: true,
  designView: "canvas",
  fileView: "code",
  leftTab: "ai",
  inspectorOpen: true,
  projectFolder: restored?.projectFolder ?? null,
  filesVersion: 0,
  settingsOpen: false,
  settingsTab: "project",
  buildOpen: false,
  pageBuildOpen: false,
  animationDockOpen: false,
  animationTab: "keyframes",
  animationTime: 0,
  animationPlaying: false,
  projectPath: restored?.projectPath ?? null,
  openDocuments: [pageDocument(initialActivePageId)],
  openFiles: [],
  activeFilePath: null,
  scriptReveal: null,
  dirty: false,
  restoredDraft: Boolean(restored),
  past: [],
  future: [],
  transactionBase: null,

  commit(recipe) {
    set((state) => {
      const nextProject = produce(state.project, (draft) => {
        recipe(draft);
        const page = activePageOf(draft, state.activePageId);
        growPageHeight(page);
      });
      if (nextProject === state.project) {
        return {};
      }
      const normalized = normalizeProjectState(
        nextProject,
        state.activePageId,
        state.selection,
      );
      return {
        project: nextProject,
        ...normalized,
        past: [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
        transactionBase: null,
      };
    });
  },

  beginTransaction() {
    set((state) => ({
      transactionBase: state.transactionBase ?? state.project,
    }));
  },

  updateTransient(recipe) {
    set((state) => {
      const nextProject = produce(state.project, recipe);
      if (nextProject === state.project) {
        return {};
      }
      return { project: nextProject };
    });
  },

  endTransaction() {
    set((state) => {
      const base = state.transactionBase;
      if (!base) {
        return {};
      }
      if (base === state.project) {
        return { transactionBase: null };
      }
      return {
        past: [...state.past, base].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
        transactionBase: null,
      };
    });
  },

  cancelTransaction() {
    set((state) =>
      state.transactionBase
        ? { project: state.transactionBase, transactionBase: null }
        : {},
    );
  },

  undo() {
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return {};
      }
      const normalized = normalizeProjectState(
        previous,
        state.activePageId,
        state.selection,
      );
      return {
        project: previous,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
        ...normalized,
        dirty: true,
        transactionBase: null,
      };
    });
  },

  redo() {
    set((state) => {
      const next = state.future[0];
      if (!next) {
        return {};
      }
      const normalized = normalizeProjectState(
        next,
        state.activePageId,
        state.selection,
      );
      return {
        project: next,
        past: [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        ...normalized,
        dirty: true,
        transactionBase: null,
      };
    });
  },

  setSelection(ids) {
    set((state) => {
      const page = selectActivePage(state);
      const available = new Set(page.modules.map((module) => module.id));
      return {
        selection: Array.from(new Set(ids)).filter((id) => available.has(id)),
        inspectorOpen: ids.length > 0 ? true : state.inspectorOpen,
      };
    });
  },

  toggleSelection(id) {
    set((state) => {
      const exists = state.selection.includes(id);
      const next = exists
        ? state.selection.filter((selected) => selected !== id)
        : [...state.selection, id];
      return {
        selection: next,
        inspectorOpen: true,
      };
    });
  },

  clearSelection() {
    set({ selection: [] });
  },

  addModuleAt(type, x, y) {
    const state = get();
    const page = selectActivePage(state);
    const module = createModuleAt(type, x, y, page);
    get().commit((draft) => {
      const target = activePageOf(draft, state.activePageId);
      target.modules.push(module);
      growPageHeight(target, target.grid * 2);
    });
    set({
      selection: [module.id],
      inspectorOpen: true,
      leftTab: "modules",
    });
    return module.id;
  },

  addModuleAtCenter(type) {
    const state = get();
    const page = selectActivePage(state);
    const definition = getModuleDefinitionSafe(type);
    const x = snap((page.width - definition.defaultSize.width) / 2, page.grid);
    const y = snap(
      64 + (page.modules.length % 8) * page.grid * 2,
      page.grid,
    );
    return get().addModuleAt(type, x, y);
  },

  insertModules(items) {
    const state = get();
    const page = selectActivePage(state);
    const modules = items.map((item) => {
      const module = createModuleAt(item.type, item.x, item.y, page);
      if (item.width !== undefined) {
        module.width = Math.min(
          page.width,
          Math.max(page.grid, snap(item.width, page.grid)),
        );
      }
      if (item.height !== undefined) {
        module.height = Math.max(page.grid, snap(item.height, page.grid));
      }
      if (item.props) {
        module.props = { ...module.props, ...deepClone(item.props) };
      }
      clampModuleToPage(module, page);
      return module;
    });
    const ids = modules.map((module) => module.id);
    get().commit((draft) => {
      const target = activePageOf(draft, state.activePageId);
      target.modules.push(...modules);
      growPageHeight(target, target.grid * 2);
    });
    set({ selection: ids, inspectorOpen: true });
    return ids;
  },

  updateModule(id, patch) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const module = page.modules.find((candidate) => candidate.id === id);
      if (!module) {
        return;
      }
      if (patch.props) {
        Object.assign(module.props, deepClone(patch.props));
      }
      if (patch.width !== undefined) {
        module.width = Math.max(page.grid, snap(patch.width, page.grid));
      }
      if (patch.height !== undefined) {
        module.height = Math.max(page.grid, snap(patch.height, page.grid));
      }
      if (patch.anchorX) {
        module.anchorX = patch.anchorX;
      }
      if (patch.anchorY) {
        module.anchorY = patch.anchorY;
      }
      if (patch.x !== undefined) {
        module.x = snap(patch.x, page.grid);
      }
      if (patch.y !== undefined) {
        module.y = snap(patch.y, page.grid);
      }
      clampModuleToPage(module, page);
      growPageHeight(page);
    });
  },

  renameModule(id, nextId) {
    const state = get();
    const page = activePageOf(state.project, state.activePageId);
    if (!page.modules.some((module) => module.id === id)) {
      return "元素不存在，无法修改 ID";
    }
    const next = nextId.trim();
    if (!MODULE_ID_PATTERN.test(next)) {
      return "ID 只能包含字母、数字、下划线和短横线，且必须以字母或下划线开头";
    }
    if (next === id) {
      return null;
    }
    if (page.modules.some((module) => module.id === next)) {
      return "当前页面已存在相同 ID";
    }
    const previousSelection = [...state.selection];
    state.commit((draft) => {
      const targetPage = activePageOf(draft, state.activePageId);
      const module = targetPage.modules.find(
        (candidate) => candidate.id === id,
      );
      if (module) {
        module.id = next;
      }
    });
    set({
      selection: previousSelection.map((selectedId) =>
        selectedId === id ? next : selectedId,
      ),
    });
    return null;
  },

  setScriptReveal(reveal) {
    set({ scriptReveal: reveal });
  },

  removeModules(ids) {
    if (ids.length === 0) {
      return;
    }
    const selected = new Set(ids);
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      page.modules = page.modules.filter(
        (module) => !selected.has(module.id),
      );
    });
    set((state) => ({
      selection: state.selection.filter((id) => !selected.has(id)),
    }));
  },

  updateModuleProps(id, patch) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const module = page.modules.find((candidate) => candidate.id === id);
      if (!module) {
        return;
      }
      Object.assign(module.props, patch);
    });
  },

  updateModulePropsTransient(id, patch) {
    set((state) => {
      const nextProject = produce(state.project, (draft) => {
        const page = activePageOf(draft, state.activePageId);
        const module = page.modules.find((candidate) => candidate.id === id);
        if (!module) {
          return;
        }
        Object.assign(module.props, patch);
      });
      return nextProject === state.project ? {} : { project: nextProject };
    });
  },

  updatePageCode(pageId, patch) {
    get().commit((draft) => {
      const page = draft.pages.find((candidate) => candidate.id === pageId);
      if (page) {
        applyPageCodePatch(page, patch);
      }
    });
  },

  updatePageCodeTransient(pageId, patch) {
    set((state) => {
      const nextProject = produce(state.project, (draft) => {
        const page = draft.pages.find((candidate) => candidate.id === pageId);
        if (page) {
          applyPageCodePatch(page, patch);
        }
      });
      return nextProject === state.project
        ? {}
        : { project: nextProject, dirty: true, future: [] };
    });
  },

  replacePage(page) {
    get().commit((draft) => {
      const index = draft.pages.findIndex(
        (candidate) => candidate.id === page.id,
      );
      if (index >= 0) {
        draft.pages[index] = deepClone(page);
      } else {
        draft.pages.push(deepClone(page));
      }
    });
    set((state) => ({
      activePageId: page.id,
      selection: [],
      activeFilePath: null,
      designView: "canvas",
      openDocuments: withOpenDocument(state.openDocuments, pageDocument(page.id)),
    }));
  },

  updateModuleRect(id, rect) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const module = page.modules.find((candidate) => candidate.id === id);
      if (!module) {
        return;
      }
      Object.assign(module, rect);
    });
  },

  removeSelected() {
    const state = get();
    if (state.selection.length === 0) {
      return;
    }
    const selected = new Set(state.selection);
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      page.modules = page.modules.filter(
        (module) => !selected.has(module.id),
      );
    });
    set({ selection: [] });
  },

  duplicateSelected() {
    const state = get();
    if (state.selection.length === 0) {
      return;
    }
    const selected = new Set(state.selection);
    const page = selectActivePage(state);
    const clones: ModuleNode[] = page.modules
      .filter((module) => selected.has(module.id))
      .map((module) => {
        const clone = {
          ...deepClone(module),
          id: createId(),
          ...offsetAnchored(module, page.grid * 2, page.grid * 2),
        };
        return clone;
      });

    if (clones.length === 0) {
      return;
    }

    get().commit((draft) => {
      const target = activePageOf(draft, state.activePageId);
      target.modules.push(...clones);
      for (const clone of clones) {
        clampModuleToPage(clone, target);
      }
      growPageHeight(target, target.grid * 2);
    });
    set({
      selection: clones.map((clone) => clone.id),
      inspectorOpen: true,
    });
  },

  nudgeSelection(dx, dy) {
    const state = get();
    if (state.selection.length === 0) {
      return;
    }
    const selected = new Set(state.selection);
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      for (const module of page.modules) {
        if (!selected.has(module.id)) {
          continue;
        }
        const rect = rectOf(module, page.width, page.height);
        const nextRect = {
          ...rect,
          x: rect.x + dx,
          y: rect.y + dy,
        };
        Object.assign(
          module,
          rectToAnchored(module, page.width, page.height, nextRect),
        );
        clampModuleToPage(module, page);
      }
      growPageHeight(page);
    });
  },

  reorderModule(id, direction) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const index = page.modules.findIndex((module) => module.id === id);
      if (index < 0) {
        return;
      }
      const [module] = page.modules.splice(index, 1);
      if (!module) {
        return;
      }
      if (direction === "up") {
        page.modules.splice(Math.min(index + 1, page.modules.length), 0, module);
      } else if (direction === "down") {
        page.modules.splice(Math.max(index - 1, 0), 0, module);
      } else if (direction === "top") {
        page.modules.push(module);
      } else {
        page.modules.unshift(module);
      }
    });
  },

  setPageConfig(patch) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const nextGrid = patch.grid ?? page.grid;
      const gridChanged = nextGrid !== page.grid;
      const widthChanged = patch.width !== undefined && patch.width !== page.width;
      const heightChanged =
        patch.height !== undefined && patch.height !== page.height;

      if (patch.title !== undefined) {
        page.title = patch.title;
      }
      if (patch.background !== undefined) {
        page.background = patch.background;
      }
      page.grid = Math.max(4, Math.round(nextGrid));
      if (patch.width !== undefined) {
        page.width = Math.max(page.grid * 10, snap(patch.width, page.grid));
      }
      if (patch.height !== undefined) {
        page.height = Math.max(page.grid * 10, snap(patch.height, page.grid));
      }
      if (gridChanged) {
        snapPageModules(page, page.grid);
      }
      if (widthChanged || heightChanged) {
        clampPageWidth(page);
      }
      growPageHeight(page);
    });
  },

  alignModuleToEdge(id, edge) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const module = page.modules.find((candidate) => candidate.id === id);
      if (!module) {
        return;
      }
      if (edge === "left" || edge === "right") {
        module.anchorX = edge;
        module.x = 0;
      } else {
        module.anchorY = edge;
        module.y = 0;
      }
      clampModuleToPage(module, page);
      growPageHeight(page);
    });
  },

  setModuleAnimations(id, patch) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const module = page.modules.find((candidate) => candidate.id === id);
      if (!module) {
        return;
      }
      module.animations = normalizeAnimation({
        ...(module.animations ?? DEFAULT_ANIMATION),
        ...patch,
      });
    });
  },

  setPageAnimations(patch) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      page.animations = normalizeAnimation({
        ...(page.animations ?? DEFAULT_ANIMATION),
        ...patch,
      });
    });
  },

  groupHistorySince(baseLength) {
    set((state) => {
      if (state.past.length <= baseLength + 1) {
        return {};
      }
      return { past: state.past.slice(0, baseLength + 1) };
    });
  },

  setAnimationDockOpen(open) {
    set({ animationDockOpen: open, animationPlaying: open ? get().animationPlaying : false });
  },

  setAnimationTab(tab) {
    set({ animationTab: tab });
  },

  setAnimationTime(time) {
    const state = get();
    const target = animationTargetOf(state);
    const duration =
      target.module?.keyframes?.duration ??
      target.page.keyframes?.duration ??
      DEFAULT_KEYFRAME_ANIMATION.duration;
    set({ animationTime: clamp(time, 0, duration) });
  },

  setAnimationPlaying(playing) {
    set({ animationPlaying: playing });
  },

  addAnimationTrack(property, time) {
    const state = get();
    const target = animationTargetOf(state);
    const config = normalizeKeyframeAnimation(
      target.module?.keyframes ?? target.page.keyframes,
    );
    if ((config.tracks[property]?.length ?? 0) > 0) {
      return;
    }
    const definition = keyframePropertyDefinition(property);
    const safeTime = clamp(Math.round(time), 0, config.duration);
    const next: KeyframeAnimation = {
      ...config,
      tracks: {
        ...config.tracks,
        [property]: [
          {
            id: createId("kf"),
            time: safeTime,
            value: definition.defaultValue,
            easing: DEFAULT_ANIMATION.easing,
          },
        ],
      },
    };
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = next;
          return;
        }
      }
      page.keyframes = next;
    });
  },

  removeAnimationTrack(property) {
    const state = get();
    const target = animationTargetOf(state);
    const config = target.module?.keyframes ?? target.page.keyframes;
    if (!config) {
      return;
    }
    const tracks = { ...config.tracks };
    delete tracks[property];
    const next: KeyframeAnimation = { ...config, tracks };
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = next;
          return;
        }
      }
      page.keyframes = next;
    });
  },

  setTargetKeyframes(target, config) {
    get().commit((draft) => {
      const page = activePageOf(draft, get().activePageId);
      const next = normalizeKeyframeAnimation(config);
      if (target.kind === "page") {
        page.keyframes = next;
        return;
      }
      const module = page.modules.find(
        (candidate) => candidate.id === target.moduleId,
      );
      if (module) {
        module.keyframes = next;
      }
    });
  },

  addKeyframe(property, time, value) {
    const state = get();
    const target = animationTargetOf(state);
    const config = normalizeKeyframeAnimation(
      target.module?.keyframes ?? target.page.keyframes,
    );
    const definition = keyframePropertyDefinition(property);
    const safeTime = clamp(Math.round(time), 0, config.duration);
    const track = config.tracks[property] ?? [];
    if (track.some((keyframe) => Math.abs(keyframe.time - safeTime) < 5)) {
      return;
    }
    const nextValue =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : valueAtTime(track, safeTime, definition.defaultValue);
    const next: KeyframeAnimation = {
      ...config,
      tracks: {
        ...config.tracks,
        [property]: [
          ...track,
          {
            id: createId("kf"),
            time: safeTime,
            value: clamp(nextValue, definition.min, definition.max),
            easing: DEFAULT_ANIMATION.easing,
          },
        ].sort((a, b) => a.time - b.time),
      },
    };
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = next;
          return;
        }
      }
      page.keyframes = next;
    });
  },

  updateKeyframe(property, id, patch) {
    const state = get();
    const target = animationTargetOf(state);
    const config = target.module?.keyframes ?? target.page.keyframes;
    if (!config) {
      return;
    }
    const track = config.tracks[property];
    if (!track) {
      return;
    }
    const definition = keyframePropertyDefinition(property);
    const next: KeyframeAnimation = {
      ...config,
      tracks: {
        ...config.tracks,
        [property]: track
          .map((keyframe) =>
            keyframe.id === id
              ? {
                  ...keyframe,
                  ...patch,
                  time:
                    patch.time !== undefined
                      ? clamp(Math.round(patch.time), 0, config.duration)
                      : keyframe.time,
                  value:
                    patch.value !== undefined
                      ? clamp(patch.value, definition.min, definition.max)
                      : keyframe.value,
                }
              : keyframe,
          )
          .sort((a, b) => a.time - b.time),
      },
    };
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = next;
          return;
        }
      }
      page.keyframes = next;
    });
  },

  removeKeyframe(property, id) {
    const state = get();
    const target = animationTargetOf(state);
    const config = target.module?.keyframes ?? target.page.keyframes;
    if (!config) {
      return;
    }
    const track = (config.tracks[property] ?? []).filter(
      (keyframe) => keyframe.id !== id,
    );
    const next: KeyframeAnimation = {
      ...config,
      tracks: {
        ...config.tracks,
        [property]: track,
      },
    };
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = next;
          return;
        }
      }
      page.keyframes = next;
    });
  },

  setKeyframeDuration(duration) {
    const state = get();
    const target = animationTargetOf(state);
    const config = normalizeKeyframeAnimation({
      ...(target.module?.keyframes ?? target.page.keyframes),
      duration,
    });
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = config;
          return;
        }
      }
      page.keyframes = config;
    });
    set({ animationTime: clamp(get().animationTime, 0, config.duration) });
  },

  setKeyframeLoop(loop) {
    const state = get();
    const target = animationTargetOf(state);
    const config = normalizeKeyframeAnimation({
      ...(target.module?.keyframes ?? target.page.keyframes),
      loop,
    });
    get().commit((draft) => {
      const page = activePageOf(draft, state.activePageId);
      if (state.selection.length === 1) {
        const module = page.modules.find(
          (candidate) => candidate.id === state.selection[0],
        );
        if (module) {
          module.keyframes = config;
          return;
        }
      }
      page.keyframes = config;
    });
  },

  setProjectSettings(patch) {
    get().commit((draft) => {
      Object.assign(draft, patch);
    });
  },

  setTheme(patch) {
    get().commit((draft) => {
      Object.assign(draft.theme, patch);
    });
  },

  setActivePage(id) {
    get().openPageTab(id);
  },

  openPageTab(id) {
    set((state) => {
      if (!state.project.pages.some((page) => page.id === id)) {
        return {};
      }
      return {
        activePageId: id,
        activeFilePath: null,
        selection: [],
        transactionBase: null,
        openDocuments: withOpenDocument(state.openDocuments, pageDocument(id)),
      };
    });
  },

  closePageTab(id) {
    set((state) => {
      const index = state.openDocuments.findIndex(
        (document) => document.kind === "page" && document.pageId === id,
      );
      if (index < 0) {
        return {};
      }
      const openDocuments = state.openDocuments.filter(
        (_, position) => position !== index,
      );
      const active =
        state.activeFilePath === null && state.activePageId === id;
      if (!active) {
        return { openDocuments };
      }
      const next = documentAfter(openDocuments, index);
      return next
        ? { openDocuments, ...activationFor(next) }
        : { openDocuments, activeFilePath: null };
    });
  },

  addPage() {
    const page = createEmptyPage(`页面 ${get().project.pages.length + 1}`);
    get().commit((draft) => {
      draft.pages.push(page);
    });
    set((state) => ({
      activePageId: page.id,
      selection: [],
      leftTab: "pages",
      designView: "canvas",
      activeFilePath: null,
      openDocuments: withOpenDocument(state.openDocuments, pageDocument(page.id)),
    }));
  },

  deletePage(id) {
    const state = get();
    if (state.project.pages.length <= 1) {
      return;
    }
    get().commit((draft) => {
      draft.pages = draft.pages.filter((page) => page.id !== id);
    });
    const wasActive =
      state.activePageId === id && state.activeFilePath === null;
    const openDocuments = state.openDocuments.filter(
      (document) => !(document.kind === "page" && document.pageId === id),
    );
    if (!wasActive) {
      set({ openDocuments });
      return;
    }
    const nextDocument = openDocuments.find(
      (document): document is Extract<OpenDocument, { kind: "page" }> =>
        document.kind === "page",
    );
    const nextPage =
      (nextDocument &&
        state.project.pages.find(
          (page) => page.id === nextDocument.pageId,
        )) ||
      state.project.pages.find((page) => page.id !== id);
    if (!nextPage) {
      set({ openDocuments, activeFilePath: null });
      return;
    }
    set({
      openDocuments: withOpenDocument(openDocuments, pageDocument(nextPage.id)),
      activePageId: nextPage.id,
      activeFilePath: null,
      selection: [],
    });
  },

  setZoom(zoom) {
    set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
  },

  setDesignView(view) {
    set({ designView: view });
  },

  setFileView(view) {
    set({ fileView: view });
  },

  setLeftTab(tab) {
    set({ leftTab: tab });
  },

  setInspectorOpen(open) {
    set({ inspectorOpen: open });
  },

  setProjectFolder(folder) {
    set({ projectFolder: folder });
  },

  bumpFilesVersion() {
    set((state) => ({ filesVersion: state.filesVersion + 1 }));
  },

  openFileTab(file) {
    set((state) => {
      const existing = state.openFiles.find(
        (candidate) => candidate.path === file.path,
      );
      const openDocuments = withOpenDocument(state.openDocuments, {
        kind: "file",
        path: file.path,
      });
      return existing
        ? { activeFilePath: file.path, openDocuments }
        : {
            openFiles: [...state.openFiles, file],
            activeFilePath: file.path,
            openDocuments,
          };
    });
  },

  setActiveFilePath(path) {
    if (path !== null) {
      set({ activeFilePath: path });
      return;
    }
    set((state) => ({
      activeFilePath: null,
      openDocuments: withOpenDocument(
        state.openDocuments,
        pageDocument(state.activePageId),
      ),
    }));
  },

  updateFileTabContent(path, content) {
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.path === path ? { ...file, content } : file,
      ),
    }));
  },

  markFileTabSaved(path, content) {
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.path === path
          ? { ...file, content, savedContent: content }
          : file,
      ),
    }));
  },

  closeFileTab(path) {
    set((state) => {
      const index = state.openFiles.findIndex(
        (file) => file.path === path,
      );
      if (index < 0) {
        return {};
      }
      const openFiles = state.openFiles.filter(
        (file) => file.path !== path,
      );
      const documentIndex = state.openDocuments.findIndex(
        (document) => document.kind === "file" && document.path === path,
      );
      const openDocuments =
        documentIndex < 0
          ? state.openDocuments
          : state.openDocuments.filter(
              (_, position) => position !== documentIndex,
            );
      if (state.activeFilePath !== path) {
        return { openFiles, openDocuments };
      }
      const next = documentAfter(openDocuments, documentIndex);
      return next
        ? { openFiles, openDocuments, ...activationFor(next) }
        : { openFiles, openDocuments, activeFilePath: null };
    });
  },

  setSettingsOpen(open, tab) {
    set((state) => ({
      settingsOpen: open,
      settingsTab: tab ?? state.settingsTab,
    }));
  },

  setSettingsTab(tab) {
    set({ settingsTab: tab });
  },

  setBuildOpen(open) {
    set({ buildOpen: open });
  },

  setPageBuildOpen(open) {
    set({ pageBuildOpen: open });
  },

  setProjectPath(path) {
    set({ projectPath: path, projectFolder: folderOfPath(path) });
  },

  markSaved(path) {
    set((state) => ({
      projectPath: path,
      projectFolder: path ? folderOfPath(path) : state.projectFolder,
      dirty: false,
    }));
  },

  newProject() {
    const project = defaultProject();
    set({
      project,
      activePageId: project.pages[0].id,
      selection: [],
      past: [],
      future: [],
      transactionBase: null,
      projectPath: null,
      projectFolder: null,
      openDocuments: [pageDocument(project.pages[0].id)],
      openFiles: [],
      activeFilePath: null,
      scriptReveal: null,
      dirty: false,
      zoom: 0.75,
      designView: "canvas",
      fileView: "code",
      settingsOpen: false,
      buildOpen: false,
      pageBuildOpen: false,
      animationDockOpen: false,
      animationPlaying: false,
      animationTime: 0,
    });
  },

  loadProject(project, path = null) {
    const cloned = deepClone(project);
    set({
      project: cloned,
      activePageId: cloned.pages[0].id,
      selection: [],
      past: [],
      future: [],
      transactionBase: null,
      projectPath: path,
      projectFolder: folderOfPath(path),
      openDocuments: [pageDocument(cloned.pages[0].id)],
      openFiles: [],
      activeFilePath: null,
      scriptReveal: null,
      dirty: false,
      designView: "canvas",
      fileView: "code",
      pageBuildOpen: false,
    });
  },
}));


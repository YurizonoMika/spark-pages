import { useCallback, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  useEditorStore,
  selectActivePage,
} from "../store/editorStore";
import { toast } from "../store/toastStore";
import { confirmDiscardChanges } from "../lib/projectFiles";
import { listProjectFiles } from "../lib/ai/build";
import {
  pageFileMap,
} from "../lib/ai/projectContext";
import { parseProjectXml, serializeProject } from "../xml/projectXml";
import {
  PROJECT_MANIFEST_FILE,
  parseProjectManifest,
  projectFromManifest,
  serializeProjectManifest,
} from "../xml/projectManifest";
import { createEmptyPage, defaultProject } from "../model/defaults";
import type { Page, Project } from "../model/types";
import type { ProjectFileEntry } from "../lib/ai/build";

function joinPath(folder: string, name: string): string {
  return `${folder.replace(/[\\/]+$/, "")}/${name}`;
}

function folderOfPath(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function folderName(folder: string): string {
  return (
    folder
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || "未命名项目"
  );
}

function hasProjectEntries(entries: ProjectFileEntry[]): boolean {
  return entries.some(
    (entry) =>
      !entry.isDir &&
      (entry.path === PROJECT_MANIFEST_FILE ||
        (!entry.path.includes("/") &&
          entry.path.toLowerCase().endsWith(".spark")) ||
        /^pages\/[^/]+\.spark$/i.test(entry.path)),
  );
}

function relativeProjectPath(folder: string, path: string): string {
  const normalizedFolder = folder.replaceAll("\\", "/").replace(/\/+$/, "");
  const normalizedPath = path.replaceAll("\\", "/");
  if (normalizedPath.startsWith(`${normalizedFolder}/`)) {
    return normalizedPath.slice(normalizedFolder.length + 1);
  }
  return normalizedPath.split("/").pop() ?? normalizedPath;
}

async function readText(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

async function writeText(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path, content });
}

function projectWithFiles(project: Project): Project {
  const files = pageFileMap(project);
  return {
    ...project,
    pages: project.pages.map((page) => ({
      ...page,
      file: files.get(page.id) ?? page.file,
    })),
  };
}

async function writePageFile(
  folder: string,
  project: Project,
  page: Page,
  file: string,
): Promise<void> {
  const content = serializeProject({
    ...projectWithFiles(project),
    pages: [page],
  });
  await writeText(joinPath(folder, file), content);
}

async function writeManifest(
  folder: string,
  project: Project,
): Promise<string> {
  const path = joinPath(folder, PROJECT_MANIFEST_FILE);
  await writeText(path, serializeProjectManifest(projectWithFiles(project)));
  return path;
}

async function writeWholeProject(
  folder: string,
  project: Project,
): Promise<string> {
  const files = pageFileMap(project);
  for (const page of project.pages) {
    const file = files.get(page.id);
    if (file) {
      await writePageFile(folder, project, page, file);
    }
  }
  return writeManifest(folder, project);
}

async function readManifestProject(
  folder: string,
  manifestPath: string,
): Promise<Project> {
  const manifest = parseProjectManifest(await readText(manifestPath));
  const pages: Page[] = [];
  for (const entry of manifest.pages) {
    if (!/^pages\/[^/]+\.spark$/i.test(entry.file)) {
      console.warn(`忽略不安全的页面路径 ${entry.file}`);
      continue;
    }
    try {
      const parsed = parseProjectXml(
        await readText(joinPath(folder, entry.file)),
      );
      const page = parsed.pages[0];
      if (page) {
        page.file = entry.file;
        pages.push(page);
      }
    } catch (error) {
      console.warn(`无法读取页面文件 ${entry.file}`, error);
    }
  }
  if (pages.length === 0) {
    const page = createEmptyPage("首页");
    page.file = "pages/首页.spark";
    pages.push(page);
  }
  return projectFromManifest(manifest, pages);
}

async function readLegacyProject(path: string): Promise<Project> {
  const project = parseProjectXml(await readText(path));
  const files = pageFileMap(project);
  return {
    ...project,
    pages: project.pages.map((page) => ({
      ...page,
      file: files.get(page.id),
    })),
  };
}

async function readDiscoveredPages(
  folder: string,
  entries: ProjectFileEntry[],
): Promise<{ project: Project; pages: Page[] } | null> {
  const pageEntries = entries.filter(
    (entry) =>
      !entry.isDir && /^pages\/[^/]+\.spark$/i.test(entry.path),
  );
  if (pageEntries.length === 0) {
    return null;
  }
  const pages: Page[] = [];
  let firstProject: Project | null = null;
  for (const entry of pageEntries.sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    try {
      const parsed = parseProjectXml(
        await readText(joinPath(folder, entry.path)),
      );
      const page = parsed.pages[0];
      if (!page) {
        continue;
      }
      page.file = entry.path;
      pages.push(page);
      firstProject ??= parsed;
    } catch (error) {
      console.warn(`无法读取页面文件 ${entry.path}`, error);
    }
  }
  if (pages.length === 0) {
    return null;
  }
  const project = defaultProject();
  project.name = folderName(folder);
  project.pages = pages;
  if (firstProject) {
    project.type = firstProject.type;
    project.template = firstProject.template;
    project.theme = firstProject.theme;
  }
  return { project, pages };
}

function installProject(
  project: Project,
  folder: string,
  manifestPath: string,
): void {
  const store = useEditorStore.getState();
  store.loadProject(project, manifestPath);
  store.setProjectFolder(folder);
  const files = Object.fromEntries(
    project.pages
      .filter((page) => page.file)
      .map((page) => [page.id, page.file as string]),
  );
  store.setPageFiles(files);
  store.bumpFilesVersion();
}

export function useProjectFileActions() {
  const [busy, setBusy] = useState(false);

  const switchProjectFolder = useCallback(async (folder: string) => {
    const state = useEditorStore.getState();
    if (
      state.openFiles.some(
        (file) => file.content !== file.savedContent,
      ) &&
      !window.confirm("还有未保存的代码文件，确定切换工作区吗？")
    ) {
      return;
    }
    if (state.dirty && !(await confirmDiscardChanges())) {
      return;
    }
    setBusy(true);
    try {
      const entries = await listProjectFiles(folder);
      const manifestEntry = entries.find(
        (entry) => !entry.isDir && entry.path === PROJECT_MANIFEST_FILE,
      );

      if (manifestEntry) {
        const manifestPath = joinPath(folder, manifestEntry.path);
        const project = await readManifestProject(folder, manifestPath);
        installProject(project, folder, manifestPath);
        toast(`项目已打开，共 ${project.pages.length} 个页面`, "success");
        return;
      }

      const legacyEntry = entries.find(
        (entry) =>
          !entry.isDir &&
          !entry.path.includes("/") &&
          entry.path.toLowerCase().endsWith(".spark"),
      );
      if (legacyEntry) {
        const legacyPath = joinPath(folder, legacyEntry.path);
        const project = await readLegacyProject(legacyPath);
        const manifestPath = await writeWholeProject(folder, project);
        installProject(projectWithFiles(project), folder, manifestPath);
        toast(
          `已迁移为文件夹项目（${project.pages.length} 个页面，原文件已保留）`,
          "success",
        );
        return;
      }

      const discovered = await readDiscoveredPages(folder, entries);
      if (discovered) {
        const manifestPath = await writeManifest(folder, discovered.project);
        installProject(discovered.project, folder, manifestPath);
        toast(`项目已打开，共 ${discovered.pages.length} 个页面`, "success");
        return;
      }

      const project = defaultProject();
      project.name = folderName(folder);
      const manifestPath = await writeWholeProject(folder, project);
      installProject(projectWithFiles(project), folder, manifestPath);
      toast("已在所选目录创建并打开新项目", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法打开项目文件夹",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const newProjectAction = useCallback(async () => {
    if (!isTauri()) {
      toast("新建项目仅支持桌面应用", "error");
      return;
    }
    let selected: string | string[] | null;
    try {
      selected = await open({
        directory: true,
        multiple: false,
        title: "选择新项目的工作目录",
      });
    } catch (dialogError) {
      toast(
        dialogError instanceof Error
          ? dialogError.message
          : "无法选择项目目录",
        "error",
      );
      return;
    }
    if (!selected || Array.isArray(selected)) {
      return;
    }
    try {
      const entries = await listProjectFiles(selected);
      if (
        hasProjectEntries(entries) &&
        !window.confirm(
          "所选文件夹已经包含 Spark 项目，是否打开已有项目？",
        )
      ) {
        return;
      }
      await switchProjectFolder(selected);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "无法读取所选项目目录",
        "error",
      );
    }
  }, [switchProjectFolder]);

  const openFolderAction = useCallback(async () => {
    if (!isTauri()) {
      toast("打开文件夹仅支持桌面应用", "error");
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "打开项目文件夹",
      });
      if (!selected || Array.isArray(selected)) {
        return;
      }
      await switchProjectFolder(selected);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法打开文件夹",
        "error",
      );
    }
  }, [switchProjectFolder]);

  const openProjectFileAction = useCallback(async (path: string) => {
    const state = useEditorStore.getState();
    setBusy(true);
    try {
      const content = await readText(path);
      const parsed = parseProjectXml(content);
      const folder = state.projectFolder ?? folderOfPath(path);
      const fileName = path.replaceAll("\\", "/").split("/").pop() ?? "";

      if (parsed.pages.length === 1 && fileName !== PROJECT_MANIFEST_FILE) {
        const page = parsed.pages[0];
        if (folder) {
          page.file = relativeProjectPath(folder, path);
        }
        useEditorStore.getState().replacePage(page);
        if (folder && page.file) {
          useEditorStore.getState().setPageFiles({
            [page.id]: page.file,
          });
          const project = useEditorStore.getState().project;
          await writeManifest(folder, project);
        }
        useEditorStore.getState().bumpFilesVersion();
        toast(`页面「${page.title}」已加载`, "success");
        return;
      }

      if (
        state.openFiles.some(
          (file) => file.content !== file.savedContent,
        ) &&
        !window.confirm("还有未保存的代码文件，确定打开其他项目吗？")
      ) {
        return;
      }
      if (state.dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const store = useEditorStore.getState();
      store.loadProject(parsed, path);
      store.bumpFilesVersion();
      toast("项目已打开", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法打开 Spark 项目",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const saveProjectAction = useCallback(async (saveAs = false) => {
    const state = useEditorStore.getState();
    setBusy(true);
    try {
      if (!isTauri()) {
        toast("保存项目仅支持桌面应用", "error");
        return;
      }
      let folder = state.projectFolder;
      if (saveAs) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: "选择项目文件夹",
        });
        if (!selected || Array.isArray(selected)) {
          return;
        }
        folder = selected;
      }
      if (!folder) {
        toast("请先打开项目文件夹", "error");
        return;
      }
      const manifestPath = await writeWholeProject(folder, state.project);
      const store = useEditorStore.getState();
      store.setPageFiles(
        Object.fromEntries(
          Array.from(pageFileMap(store.project).entries()),
        ),
      );
      store.markSaved(manifestPath);
      store.bumpFilesVersion();
      toast(`项目已保存，共 ${store.project.pages.length} 个页面`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法保存项目",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const savePageAction = useCallback(async () => {
    const state = useEditorStore.getState();
    const page = selectActivePage(state);
    const folder = state.projectFolder;
    if (!folder) {
      toast("请先打开项目文件夹", "error");
      return;
    }
    setBusy(true);
    try {
      const files = pageFileMap(state.project);
      const file = files.get(page.id);
      if (!file) {
        throw new Error("无法确定页面文件路径");
      }
      const pageWithFile = { ...page, file };
      await writePageFile(folder, state.project, pageWithFile, file);
      if (isTauri()) {
        await writeManifest(folder, state.project);
      }
      const store = useEditorStore.getState();
      store.setPageFiles({ [page.id]: file });
      store.bumpFilesVersion();
      toast(`页面已保存到 ${file}`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法保存页面",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    newProjectAction,
    openFolderAction,
    openProjectFileAction,
    saveProjectAction,
    savePageAction,
  };
}

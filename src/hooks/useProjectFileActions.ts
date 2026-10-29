import { useCallback, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEditorStore, selectActivePage } from "../store/editorStore";
import { toast } from "../store/toastStore";
import {
  confirmDiscardChanges,
  writeProjectFile,
} from "../lib/projectFiles";
import { listProjectFiles } from "../lib/ai/build";
import { parseProjectXml, serializeProject } from "../xml/projectXml";
import { pageXmlPath } from "../lib/ai/projectContext";
import { defaultProject } from "../model/defaults";

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

function projectPathInFolder(folder: string, projectName: string): string {
  const cleaned = projectName
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return joinPath(folder, `${cleaned || "spark-pages"}.spark`);
}

export function useProjectFileActions() {
  const [busy, setBusy] = useState(false);

  const newProjectAction = useCallback(async () => {
    const state = useEditorStore.getState();
    if (
      state.openFiles.some(
        (file) => file.content !== file.savedContent,
      ) &&
      !window.confirm("还有未保存的代码文件，确定新建项目吗？")
    ) {
      return;
    }
    if (state.dirty && !(await confirmDiscardChanges())) {
      return;
    }
    const folder = state.projectFolder;
    state.newProject();
    if (folder) {
      const store = useEditorStore.getState();
      store.setProjectFolder(folder);
      store.bumpFilesVersion();
    }
    toast("已新建项目", "success");
  }, []);

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
      const folder = selected;
      const entries = await listProjectFiles(folder);
      const projectFile = entries.find(
        (entry) =>
          !entry.isDir &&
          !entry.path.includes("/") &&
          entry.path.toLowerCase().endsWith(".spark"),
      );
      if (projectFile) {
        const path = joinPath(folder, projectFile.path);
        const content = await invoke<string>("read_text_file", { path });
        const project = parseProjectXml(content);
        useEditorStore.getState().loadProject(project, path);
        toast("项目已打开", "success");
      } else {
        const project = defaultProject();
        project.name = folderName(folder);
        const store = useEditorStore.getState();
        store.loadProject(project, null);
        store.setProjectFolder(folder);
        toast("已打开文件夹", "success");
      }
      useEditorStore.getState().bumpFilesVersion();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法打开文件夹",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const openProjectFileAction = useCallback(async (path: string) => {
    const state = useEditorStore.getState();
    setBusy(true);
    try {
      const content = await invoke<string>("read_text_file", { path });
      const project = parseProjectXml(content);
      const isPageFile =
        path.replaceAll("\\", "/").split("/").pop()?.toLowerCase() ===
          "page.spark" && project.pages.length === 1;
      if (isPageFile) {
        useEditorStore.getState().replacePage(project.pages[0]);
        toast("页面已加载", "success");
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
      store.loadProject(project, path);
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
    const page = selectActivePage(state);
    setBusy(true);
    try {
      let targetPath = saveAs ? null : state.projectPath;
      const folder = state.projectFolder;
      if (
        !saveAs &&
        folder &&
        (!targetPath ||
          folderOfPath(targetPath)?.replace(/[\\/]+$/, "") !==
            folder.replace(/[\\/]+$/, ""))
      ) {
        targetPath = projectPathInFolder(folder, state.project.name);
      }
      const path = await writeProjectFile(state.project, targetPath, {
        saveAs,
        fileName: page.title,
      });
      if (path || !isTauri()) {
        const store = useEditorStore.getState();
        store.markSaved(path);
        store.bumpFilesVersion();
        toast("项目已保存", "success");
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法保存项目文件",
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
      const content = serializeProject({
        ...state.project,
        pages: [page],
      });
      const path = pageXmlPath(state.project, page);
      await invoke("write_text_file", {
        path: joinPath(folder, path),
        content,
      });
      const store = useEditorStore.getState();
      store.bumpFilesVersion();
      toast(`页面已保存到 ${path}`, "success");
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

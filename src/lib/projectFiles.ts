import { invoke, isTauri } from "@tauri-apps/api/core";
import { ask, save } from "@tauri-apps/plugin-dialog";
import type { Project } from "../model/types";
import { serializeProject } from "../xml/projectXml";

function safeFileName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function download(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function writeProjectFile(
  project: Project,
  currentPath: string | null,
  options: { saveAs?: boolean; fileName?: string } = {},
): Promise<string | null> {
  const xml = serializeProject(project);

  if (isTauri()) {
    let path = options.saveAs ? null : currentPath;
    if (!path) {
      path = await save({
        defaultPath: `${safeFileName(options.fileName ?? "未命名项目", "未命名项目")}.spark`,
        filters: [{ name: "Spark Pages", extensions: ["spark"] }],
      });
    }
    if (!path) {
      return null;
    }
    await invoke("write_text_file", { path, content: xml });
    return path;
  }

  download(
    xml,
    `${safeFileName(options.fileName ?? "未命名项目", "未命名项目")}.spark`,
    "application/xml",
  );
  return null;
}

export async function confirmDiscardChanges(): Promise<boolean> {
  const message = "当前项目有未保存的修改，继续操作将丢失这些修改。";
  if (isTauri()) {
    return ask(message, {
      title: "放弃修改？",
      kind: "warning",
      okLabel: "继续",
      cancelLabel: "取消",
    });
  }
  return window.confirm(message);
}

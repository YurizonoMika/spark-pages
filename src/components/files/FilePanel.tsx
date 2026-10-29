import { useCallback, useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  AlertCircle,
  FileCode2,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../../store/editorStore";
import { useProjectFileActions } from "../../hooks/useProjectFileActions";
import {
  listProjectFiles,
  type ProjectFileEntry,
} from "../../lib/ai/build";
import {
  CodeEditor,
  type CodeLanguage,
} from "../code/CodeEditor";
import { IconButton } from "../ui/IconButton";
import { toast } from "../../store/toastStore";

const MAX_PREVIEW_BYTES = 400_000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function languageFor(path: string): CodeLanguage | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "html" || extension === "htm" || extension === "vue") {
    return "html";
  }
  if (["js", "jsx", "mjs", "cjs"].includes(extension)) {
    return "javascript";
  }
  if (["ts", "tsx", "mts", "cts"].includes(extension)) {
    return "typescript";
  }
  if (["css", "scss", "less"].includes(extension)) {
    return "css";
  }
  if (extension === "json") {
    return "json";
  }
  return null;
}

function fileIcon(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(extension)) {
    return Image;
  }
  if (["html", "htm", "vue", "js", "jsx", "ts", "tsx", "css", "json"].includes(extension)) {
    return FileCode2;
  }
  return FileText;
}

export function FilePanel() {
  const projectFolder = useEditorStore((state) => state.projectFolder);
  const filesVersion = useEditorStore((state) => state.filesVersion);
  const actions = useProjectFileActions();
  const tauri = isTauri();

  const [entries, setEntries] = useState<ProjectFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectFolder || !tauri) {
      setEntries([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listProjectFiles(projectFolder);
      setEntries(next);
      setSelectedPath((current) =>
        current && next.some((entry) => entry.path === current)
          ? current
          : next.find((entry) => !entry.isDir)?.path ?? null,
      );
    } catch (refreshError) {
      setEntries([]);
      setSelectedPath(null);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "无法读取项目文件夹",
      );
    } finally {
      setLoading(false);
    }
  }, [projectFolder, tauri]);

  useEffect(() => {
    void refresh();
  }, [refresh, filesVersion]);

  useEffect(() => {
    if (!projectFolder || !selectedPath || !tauri) {
      setContent("");
      setContentError(null);
      return;
    }
    const entry = entries.find((item) => item.path === selectedPath);
    if (entry && entry.size > MAX_PREVIEW_BYTES) {
      setContent("");
      setContentError("文件过大，暂不预览");
      return;
    }
    let cancelled = false;
    setContentLoading(true);
    setContentError(null);
    invoke<string>("read_text_file", {
      path: `${projectFolder.replace(/[\\/]+$/, "")}/${selectedPath}`,
    })
      .then((text) => {
        if (cancelled) {
          return;
        }
        if (text.includes("\u0000")) {
          setContent("");
          setContentError("二进制文件，无法预览");
          return;
        }
        setContent(text);
      })
      .catch((readError) => {
        if (!cancelled) {
          setContent("");
          setContentError(
            readError instanceof Error
              ? readError.message
              : "无法读取文件",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entries, projectFolder, selectedPath, tauri]);

  const openEntry = async (entry: ProjectFileEntry) => {
    if (!projectFolder || entry.isDir) {
      return;
    }
    const path = `${projectFolder.replace(/[\\/]+$/, "")}/${entry.path}`;
    if (entry.path.toLowerCase().endsWith(".spark")) {
      await actions.openProjectFileAction(path);
      return;
    }
    const language = languageFor(entry.path);
    if (!language) {
      toast("该文件类型暂不支持在应用内编辑", "info");
      return;
    }
    if (entry.size > MAX_PREVIEW_BYTES) {
      toast("文件过大，暂不支持在应用内编辑", "error");
      return;
    }
    try {
      const text = await invoke<string>("read_text_file", { path });
      if (text.includes("\u0000")) {
        toast("二进制文件无法编辑", "error");
        return;
      }
      const store = useEditorStore.getState();
      const existing = store.openFiles.find((file) => file.path === path);
      if (existing) {
        store.setActiveFilePath(path);
      } else {
        store.openFileTab({
          path,
          name: entry.path.split("/").pop() ?? entry.path,
          language,
          content: text,
          savedContent: text,
        });
      }
      store.setFileView("code");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法打开文件",
        "error",
      );
    }
  };

  const openSelectedFile = async () => {
    if (!projectFolder || !selectedPath) {
      return;
    }
    try {
      await openPath(
        `${projectFolder.replace(/[\\/]+$/, "")}/${selectedPath}`,
      );
    } catch (openError) {
      toast(
        openError instanceof Error ? openError.message : "无法打开文件",
        "error",
      );
    }
  };

  const openFolder = async () => {
    if (!projectFolder) {
      return;
    }
    try {
      await openPath(projectFolder);
    } catch (openError) {
      toast(
        openError instanceof Error ? openError.message : "无法打开文件夹",
        "error",
      );
    }
  };

  const selectedLanguage = selectedPath ? languageFor(selectedPath) : null;
  const selectedEntry = entries.find(
    (entry) => !entry.isDir && entry.path === selectedPath,
  );
  const selectedIsSpark =
    selectedPath?.toLowerCase().endsWith(".spark") ?? false;

  return (
    <div className="file-panel">
      <div className="file-panel-body">
        <div className="file-panel-toolbar">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void actions.openFolderAction()}
            disabled={actions.busy}
          >
            <FolderOpen size={13} />
            {projectFolder ? "更改文件夹" : "打开文件夹"}
          </button>
          <IconButton label="刷新文件列表" onClick={() => void refresh()}>
            <RefreshCw size={14} className={loading ? "spin" : undefined} />
          </IconButton>
          {projectFolder ? (
            <IconButton label="打开项目文件夹" onClick={() => void openFolder()}>
              <FolderOpen size={14} />
            </IconButton>
          ) : null}
        </div>

        {!projectFolder ? (
          <div className="file-panel-empty">
            <Folder size={22} />
            <p>选择项目文件夹后，可在这里查看项目文件。</p>
            <span>打开文件夹或保存项目后会自动关联工作区。</span>
          </div>
        ) : error ? (
          <div className="file-panel-error">
            <AlertCircle size={15} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="file-list">
              {loading && entries.length === 0 ? (
                <div className="file-list-loading">
                  <Loader2 size={14} className="spin" />
                  正在读取文件…
                </div>
              ) : entries.length === 0 ? (
                <p className="file-list-empty">文件夹为空</p>
              ) : (
                entries.map((entry) => {
                  const depth = entry.path.split("/").length - 1;
                  if (entry.isDir) {
                    return (
                      <div
                        key={`dir-${entry.path}`}
                        className="file-row is-dir"
                        style={{ paddingLeft: 10 + depth * 13 }}
                      >
                        <Folder size={13} />
                        <span>{fileName(entry.path)}</span>
                      </div>
                    );
                  }
                  const Icon = fileIcon(entry.path);
                  return (
                    <button
                      key={entry.path}
                      type="button"
                      className={clsx(
                        "file-row",
                        selectedPath === entry.path && "is-active",
                      )}
                      style={{ paddingLeft: 10 + depth * 13 }}
                      onClick={() => setSelectedPath(entry.path)}
                      onDoubleClick={() => void openEntry(entry)}
                      title={`${entry.path} · 双击打开`}
                    >
                      <Icon size={13} />
                      <span>{fileName(entry.path)}</span>
                      <small>{formatBytes(entry.size)}</small>
                    </button>
                  );
                })
              )}
            </div>

            <div className="file-viewer">
              {selectedPath ? (
                <>
                  <header className="file-viewer-header">
                    <code>{selectedPath}</code>
                    <span>
                      {selectedLanguage ?? "文本"}
                      {contentLoading ? " · 读取中…" : ""}
                    </span>
                    {selectedEntry ? (
                      <IconButton
                        label={
                          selectedIsSpark
                            ? "打开 Spark 项目"
                            : "在应用内编辑文件"
                        }
                        onClick={() => void openEntry(selectedEntry)}
                      >
                        {selectedIsSpark ? (
                          <FolderOpen size={13} />
                        ) : (
                          <Pencil size={13} />
                        )}
                      </IconButton>
                    ) : null}
                    <IconButton
                      label="在系统中打开文件"
                      onClick={() => void openSelectedFile()}
                    >
                      <ExternalLink size={13} />
                    </IconButton>
                  </header>
                  <div className="file-viewer-body">
                    {contentError ? (
                      <div className="file-viewer-message">
                        <AlertCircle size={15} />
                        {contentError}
                      </div>
                    ) : selectedLanguage ? (
                      <CodeEditor
                        key={selectedPath}
                        value={content}
                        language={selectedLanguage}
                        readOnly
                      />
                    ) : (
                      <pre className="file-viewer-text">{content}</pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="file-viewer-empty">选择一个文件查看内容</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

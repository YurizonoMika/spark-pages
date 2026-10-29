import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileCode2, Info, Save } from "lucide-react";
import { useEditorStore, type OpenProjectFile } from "../../store/editorStore";
import { CodeEditor } from "./CodeEditor";
import { toast } from "../../store/toastStore";

export function FileCodeView({ file }: { file: OpenProjectFile }) {
  const updateFileTabContent = useEditorStore(
    (state) => state.updateFileTabContent,
  );
  const markFileTabSaved = useEditorStore(
    (state) => state.markFileTabSaved,
  );
  const bumpFilesVersion = useEditorStore((state) => state.bumpFilesVersion);
  const dirty = file.content !== file.savedContent;
  const lineCount =
    file.content === "" ? 0 : file.content.split("\n").length;

  const save = async () => {
    try {
      await invoke("write_text_file", {
        path: file.path,
        content: file.content,
      });
      markFileTabSaved(file.path, file.content);
      bumpFilesVersion();
      toast(`${file.name} 已保存`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法保存文件",
        "error",
      );
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <main className="workspace">
      <section className="script-view">
        <header className="code-toolbar">
          <div className="script-view-title">
            <FileCode2 size={15} />
            <strong>{file.name}</strong>
            <small>{file.language.toUpperCase()}</small>
          </div>
          <div className="code-toolbar-meta">
            <span className="code-page-name" title={file.path}>
              {file.path}
            </span>
            <button
              type="button"
              className="btn btn-ghost code-save-btn"
              onClick={() => void save()}
              title="保存文件 (⌘S)"
            >
              <Save size={13} />
              保存
            </button>
          </div>
        </header>

        <div className="code-note">
          <Info size={13} />
          <span>编辑构建产物代码，保存后直接写回项目文件夹。</span>
        </div>

        <CodeEditor
          value={file.content}
          language={file.language}
          onChange={(next) => updateFileTabContent(file.path, next)}
        />

        <footer className="code-footer">
          <span className="code-footer-hint" title={file.path}>
            {file.path}
          </span>
          <span className="code-position">
            {file.language.toUpperCase()} · {lineCount} 行 ·{" "}
            {dirty ? "未保存" : "已保存"} · ⌘S 保存
          </span>
        </footer>
      </section>
    </main>
  );
}

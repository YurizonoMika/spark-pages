import { FilePlus2 } from "lucide-react";
import {
  selectActivePage,
  useEditorStore,
} from "../store/editorStore";
import { Canvas } from "./canvas/Canvas";
import { PreviewPanel } from "./preview/PreviewPanel";
import { PageScriptView } from "./code/PageScriptView";
import { FileCodeView } from "./code/FileCodeView";
import { BuiltPreview } from "./code/BuiltPreview";

export function Workspace() {
  const designView = useEditorStore((state) => state.designView);
  const fileView = useEditorStore((state) => state.fileView);
  const activeFilePath = useEditorStore((state) => state.activeFilePath);
  const openFiles = useEditorStore((state) => state.openFiles);
  const page = useEditorStore(selectActivePage);
  const pageTabOpen = useEditorStore((state) =>
    state.openDocuments.some(
      (document) =>
        document.kind === "page" &&
        document.pageId === state.activePageId,
    ),
  );
  const openPageTab = useEditorStore((state) => state.openPageTab);
  const activeFile =
    openFiles.find((file) => file.path === activeFilePath) ?? null;

  if (activeFile) {
    if (fileView === "code") {
      return <FileCodeView key={activeFile.path} file={activeFile} />;
    }
    if (fileView === "preview") {
      return (
        <main className="workspace">
          <BuiltPreview file={activeFile} />
        </main>
      );
    }
    return <PageScriptView />;
  }

  if (!pageTabOpen) {
    return (
      <main className="workspace workspace-empty">
        <div className="workspace-empty-card">
          <h2>没有打开的文档</h2>
          <p>页面设计稿已关闭。可以从左侧页面列表重新打开，或直接打开当前页面。</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openPageTab(page.id)}
          >
            <FilePlus2 size={14} />
            打开「{page.title}」
          </button>
        </div>
      </main>
    );
  }

  if (designView === "script") {
    return <PageScriptView />;
  }

  if (designView === "preview") {
    return (
      <main className="workspace">
        <PreviewPanel />
      </main>
    );
  }

  return (
    <main className="workspace">
      <Canvas />
    </main>
  );
}

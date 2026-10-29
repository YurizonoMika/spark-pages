import { FileCode2, Layers3, X } from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../store/editorStore";

export function DocumentTabs() {
  const project = useEditorStore((state) => state.project);
  const openDocuments = useEditorStore((state) => state.openDocuments);
  const openFiles = useEditorStore((state) => state.openFiles);
  const activePageId = useEditorStore((state) => state.activePageId);
  const activeFilePath = useEditorStore((state) => state.activeFilePath);
  const openPageTab = useEditorStore((state) => state.openPageTab);
  const closePageTab = useEditorStore((state) => state.closePageTab);
  const setActiveFilePath = useEditorStore(
    (state) => state.setActiveFilePath,
  );
  const closeFileTab = useEditorStore((state) => state.closeFileTab);
  const setFileView = useEditorStore((state) => state.setFileView);

  const closeTab = (path: string, name: string, dirty: boolean) => {
    if (
      dirty &&
      !window.confirm(`「${name}」有未保存的修改，确定关闭吗？`)
    ) {
      return;
    }
    closeFileTab(path);
  };

  return (
    <nav className="document-tabs" aria-label="打开的文档">
      {openDocuments.map((document) => {
        if (document.kind === "page") {
          const page = project.pages.find(
            (candidate) => candidate.id === document.pageId,
          );
          if (!page) {
            return null;
          }
          const active =
            activeFilePath === null && activePageId === page.id;
          return (
            <div
              key={`page:${page.id}`}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              className={clsx(
                "document-tab",
                "document-tab-design",
                active && "is-active",
              )}
              title={`${project.name} / ${page.title} · XML 设计`}
              onClick={() => openPageTab(page.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPageTab(page.id);
                }
              }}
            >
              <Layers3 size={13} />
              <span className="document-tab-name">{page.title}</span>
              <small>XML</small>
              <button
                type="button"
                className="document-tab-close"
                title={`关闭 ${page.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closePageTab(page.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          );
        }

        const file = openFiles.find(
          (candidate) => candidate.path === document.path,
        );
        if (!file) {
          return null;
        }
        const active = activeFilePath === file.path;
        const dirty = file.content !== file.savedContent;
        return (
          <div
            key={file.path}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            className={clsx(
              "document-tab",
              "document-tab-file",
              active && "is-active",
            )}
            title={file.path}
            onClick={() => {
              setActiveFilePath(file.path);
              setFileView("code");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActiveFilePath(file.path);
                setFileView("code");
              }
            }}
          >
            <FileCode2 size={13} />
            <span className="document-tab-name">{file.name}</span>
            {dirty ? <span className="document-tab-dirty" /> : null}
            <button
              type="button"
              className="document-tab-close"
              title={`关闭 ${file.name}`}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(file.path, file.name, dirty);
              }}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
      {openDocuments.length === 0 ? (
        <span className="document-tabs-empty">没有打开的文档</span>
      ) : null}
    </nav>
  );
}

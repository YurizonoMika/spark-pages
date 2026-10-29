import { FilePlus2, Files, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../../store/editorStore";
import { IconButton } from "../ui/IconButton";

export function PagesPanel() {
  const pages = useEditorStore((state) => state.project.pages);
  const activePageId = useEditorStore((state) => state.activePageId);
  const setActivePage = useEditorStore((state) => state.setActivePage);
  const addPage = useEditorStore((state) => state.addPage);
  const deletePage = useEditorStore((state) => state.deletePage);

  return (
    <div className="pages-panel">
      <div className="pages-list">
        {pages.map((page) => (
          <div
            key={page.id}
            className={clsx(
              "page-row",
              page.id === activePageId && "is-active",
            )}
            onClick={() => setActivePage(page.id)}
          >
            <span className="page-icon">
              <Files size={15} />
            </span>
            <span className="page-main">
              <strong>{page.title}</strong>
              <small>
                {page.modules.length} 个模块 · {page.width}×{page.height}
              </small>
            </span>
            {page.id === activePageId ? (
              <span className="page-current">当前</span>
            ) : null}
            {pages.length > 1 ? (
              <span onClick={(event) => event.stopPropagation()}>
                <IconButton
                  label="删除页面"
                  onClick={() => deletePage(page.id)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <button type="button" className="add-page-button" onClick={addPage}>
        <FilePlus2 size={15} />
        新增页面
      </button>

      <p className="panel-hint">
        多页面结构已写入 XML。Agent 与预览默认作用于当前页面。
      </p>
    </div>
  );
}

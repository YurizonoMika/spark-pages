import { CheckCircle2, Grid3X3, MousePointer2 } from "lucide-react";
import {
  selectActivePage,
  useEditorStore,
} from "../store/editorStore";

export function StatusBar() {
  const page = useEditorStore(selectActivePage);
  const selectedCount = useEditorStore((state) => state.selection.length);
  const zoom = useEditorStore((state) => state.zoom);
  const dirty = useEditorStore((state) => state.dirty);

  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        <span className="status-ready">
          <CheckCircle2 size={12} />
          XML 就绪
        </span>
        <span>{page.modules.length} 个模块</span>
        <span>
          <Grid3X3 size={12} /> {page.grid}px 网格
        </span>
        {selectedCount > 0 ? (
          <span>
            <MousePointer2 size={12} /> 已选中 {selectedCount}
          </span>
        ) : null}
      </div>
      <div className="statusbar-group">
        <span>{dirty ? "有未保存修改" : "已同步"}</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
}

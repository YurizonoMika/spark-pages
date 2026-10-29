import { ChevronDown, ChevronUp, Layers3, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { getModuleDefinitionSafe } from "../../modules/registry";
import { IconButton } from "../ui/IconButton";

export function LayersPanel() {
  const page = useEditorStore(selectActivePage);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const reorderModule = useEditorStore((state) => state.reorderModule);
  const removeSelected = useEditorStore((state) => state.removeSelected);

  const layers = [...page.modules].reverse();

  if (layers.length === 0) {
    return (
      <div className="empty-panel">
        <Layers3 size={26} />
        <strong>还没有图层</strong>
        <p>从模块库拖入一个模块后，图层会出现在这里。</p>
      </div>
    );
  }

  return (
    <div className="layers">
      <p className="panel-hint">列表顶部为最上层。点击选择，⇧ 点击多选。</p>
      {layers.map((module) => {
        const definition = getModuleDefinitionSafe(module.type);
        const Icon = definition.icon;
        const selected = selection.includes(module.id);
        return (
          <div
            key={module.id}
            className={clsx("layer-row", selected && "is-selected")}
            onClick={(event) =>
              event.shiftKey || event.metaKey
                ? toggleSelection(module.id)
                : setSelection([module.id])
            }
          >
            <span className="layer-icon">
              <Icon size={15} />
            </span>
            <span className="layer-main">
              <strong>{definition.label}</strong>
              <small>
                {module.anchorX === "right" ? "右" : "左"}{" "}
                {Math.round(module.x)} · {module.anchorY === "bottom" ? "下" : "上"}{" "}
                {Math.round(module.y)} · {Math.round(module.width)}×
                {Math.round(module.height)}
              </small>
            </span>
            <span className="layer-actions" onClick={(event) => event.stopPropagation()}>
              <IconButton
                label="上移一层"
                onClick={() => reorderModule(module.id, "up")}
              >
                <ChevronUp size={14} />
              </IconButton>
              <IconButton
                label="下移一层"
                onClick={() => reorderModule(module.id, "down")}
              >
                <ChevronDown size={14} />
              </IconButton>
              <IconButton
                label="删除"
                onClick={() => {
                  setSelection([module.id]);
                  removeSelected();
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </span>
          </div>
        );
      })}
    </div>
  );
}

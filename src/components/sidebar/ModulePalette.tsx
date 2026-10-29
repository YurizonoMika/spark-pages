import { GripVertical, PackagePlus } from "lucide-react";
import { groupModuleDefinitions } from "../../modules/registry";
import { useEditorStore } from "../../store/editorStore";
import {
  MODULE_DRAG_TYPE,
  setDraggingModuleType,
} from "../../lib/dnd";
import { toast } from "../../store/toastStore";

export function ModulePalette() {
  const addModuleAtCenter = useEditorStore((state) => state.addModuleAtCenter);
  const groups = groupModuleDefinitions();

  return (
    <div className="palette">
      {groups.map((group) => (
        <section key={group.category} className="palette-group">
          <h3>{group.category}</h3>
          <div className="palette-grid">
            {group.modules.map((definition) => {
              const Icon = definition.icon;
              return (
                <button
                  key={definition.type}
                  type="button"
                  className="palette-card"
                  draggable
                  onDragStart={(event) => {
                    setDraggingModuleType(definition.type);
                    event.dataTransfer.setData(
                      MODULE_DRAG_TYPE,
                      definition.type,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={() => setDraggingModuleType(null)}
                  onClick={() => addModuleAtCenter(definition.type)}
                  title={`${definition.description}（点击添加，或拖入画板）`}
                >
                  <span className="palette-icon">
                    <Icon size={18} />
                  </span>
                  <span className="palette-text">
                    <strong>{definition.label}</strong>
                    <small>{definition.description}</small>
                  </span>
                  <GripVertical size={14} className="palette-grip" />
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <button
        type="button"
        className="plugin-import"
        onClick={() => toast("插件导入将在下一阶段接入", "info")}
      >
        <PackagePlus size={16} />
        <span>
          <strong>导入模块包</strong>
          <small>支持 JS 交互式插件，下一阶段启用</small>
        </span>
      </button>
    </div>
  );
}

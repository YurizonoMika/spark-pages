import {
  ArrowDownToLine,
  Braces,
  Clock3,
  Code2,
  CornerDownLeft,
  Download,
  ExternalLink,
  Eye,
  GitBranch,
  Image as ImageIcon,
  List,
  MessageSquare,
  MousePointerClick,
  Palette,
  Play,
  Repeat,
  Sparkles,
  Tag,
  Terminal,
  TextCursorInput,
  Timer,
  Type,
  Variable,
  Zap,
} from "lucide-react";
import type { ScriptBlockKind } from "../../model/types";
import { SCRIPT_BLOCK_TEMPLATES } from "../../model/scriptBoard";
import { useEditorStore } from "../../store/editorStore";
import {
  SCRIPT_BLOCK_DRAG_TYPE,
  setDraggingScriptBlockKind,
} from "../../lib/dnd";

const ICONS: Partial<Record<ScriptBlockKind, typeof Play>> = {
  natural: Sparkles,
  trigger_ready: Play,
  trigger_event: MousePointerClick,
  trigger_timer: Clock3,
  state: Variable,
  state_set: Zap,
  input_to_state: TextCursorInput,
  fetch_data: Download,
  bind_text: Type,
  bind_value: TextCursorInput,
  bind_image: ImageIcon,
  bind_visibility: Eye,
  bind_class: Tag,
  bind_style: Palette,
  bind_scroll: ArrowDownToLine,
  bind_list: List,
  condition: GitBranch,
  loop: Repeat,
  delay: Timer,
  navigate: ExternalLink,
  console: Terminal,
  comment: MessageSquare,
  custom: Code2,
  start: Play,
  event: MousePointerClick,
  variable: Variable,
  if: GitBranch,
  function: Braces,
  fetch: Download,
  return: CornerDownLeft,
};

export function ScriptBlockPalette() {
  const addScriptBlock = useEditorStore((state) => state.addScriptBlock);
  const groups = SCRIPT_BLOCK_TEMPLATES.filter(
    (template) => !template.hidden,
  ).reduce<Record<string, typeof SCRIPT_BLOCK_TEMPLATES>>(
    (result, template) => {
      result[template.category] = [
        ...(result[template.category] ?? []),
        template,
      ];
      return result;
    },
    {},
  );

  return (
    <div className="palette script-block-palette">
      <p className="script-block-palette-hint">
        点击或拖拽积木到画板。触发、数据和绑定积木会自动列出页面组件，无需手写选择器；点击尾部端点再点击另一个积木的头部端点即可连线。
      </p>
      {Object.entries(groups).map(([category, templates]) => (
        <section
          key={category}
          className={
            category === "入口"
              ? "palette-group script-block-entry"
              : "palette-group"
          }
        >
          <h3>{category}</h3>
          <div className="palette-grid">
            {templates.map((template) => {
              const Icon = ICONS[template.kind] ?? Sparkles;
              return (
                <button
                  key={template.kind}
                  type="button"
                  className="palette-card"
                  draggable
                  onDragStart={(event) => {
                    setDraggingScriptBlockKind(template.kind);
                    event.dataTransfer.setData(
                      SCRIPT_BLOCK_DRAG_TYPE,
                      template.kind,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={() => setDraggingScriptBlockKind(null)}
                  onClick={() => addScriptBlock(template.kind)}
                  title={`${template.description}（点击或拖拽添加）`}
                >
                  <span className="palette-icon">
                    <Icon size={18} />
                  </span>
                  <span className="palette-text">
                    <strong>{template.label}</strong>
                    <small>{template.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

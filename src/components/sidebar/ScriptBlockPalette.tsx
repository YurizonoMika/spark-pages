import {
  Braces,
  Code2,
  CornerDownLeft,
  Download,
  GitBranch,
  MessageSquare,
  MousePointerClick,
  Sparkles,
  Play,
  Repeat,
  Terminal,
  Variable,
} from "lucide-react";
import type { ScriptBlockKind } from "../../model/types";
import { SCRIPT_BLOCK_TEMPLATES } from "../../model/scriptBoard";
import { useEditorStore } from "../../store/editorStore";

const ICONS: Record<ScriptBlockKind, typeof Play> = {
  natural: Sparkles,
  start: Play,
  event: MousePointerClick,
  variable: Variable,
  if: GitBranch,
  loop: Repeat,
  function: Braces,
  fetch: Download,
  return: CornerDownLeft,
  console: Terminal,
  comment: MessageSquare,
  custom: Code2,
};

export function ScriptBlockPalette() {
  const addScriptBlock = useEditorStore((state) => state.addScriptBlock);
  const groups = SCRIPT_BLOCK_TEMPLATES.reduce<
    Record<string, typeof SCRIPT_BLOCK_TEMPLATES>
  >((result, template) => {
    result[template.category] = [
      ...(result[template.category] ?? []),
      template,
    ];
    return result;
  }, {});

  return (
    <div className="palette script-block-palette">
      <p className="script-block-palette-hint">
        点击积木添加到画板。点击积木尾部端点，再点击另一个积木头部端点即可连线。
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
              const Icon = ICONS[template.kind];
              return (
                <button
                  key={template.kind}
                  type="button"
                  className="palette-card"
                  onClick={() => addScriptBlock(template.kind)}
                  title={`${template.description}（点击添加）`}
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

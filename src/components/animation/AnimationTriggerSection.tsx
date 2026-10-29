import { Plus, Trash2 } from "lucide-react";
import type {
  AnimationTrigger,
  AnimationTriggerType,
  ModuleNode,
} from "../../model/types";
import { normalizeTrigger } from "../../model/animations";
import { getModuleDefinitionSafe } from "../../modules/registry";

const TRIGGER_LABELS: Record<
  Exclude<AnimationTriggerType, "auto">,
  string
> = {
  click: "点击时",
  hover: "鼠标悬停时",
  condition: "组件值条件",
  custom: "自定义 JS",
};

const TRIGGER_OPTIONS = (
  Object.keys(TRIGGER_LABELS) as Array<Exclude<AnimationTriggerType, "auto">>
).map((value) => ({ value, label: TRIGGER_LABELS[value] }));

function TriggerEditor({
  trigger,
  index,
  modules,
  targetKey,
  onPatch,
  onRemove,
}: {
  trigger: AnimationTrigger;
  index: number;
  modules: ModuleNode[];
  targetKey: string;
  onPatch: (patch: Partial<AnimationTrigger>) => void;
  onRemove: () => void;
}) {
  const type = trigger.type === "auto" ? "click" : trigger.type;
  const updateType = (next: Exclude<AnimationTriggerType, "auto">) => {
    if (next === "condition") {
      onPatch({
        type: next,
        moduleId: trigger.moduleId || modules[0]?.id || "",
        property: trigger.property ?? "value",
        operator: trigger.operator ?? "gt",
        value: trigger.value ?? "",
      });
      return;
    }
    if (next === "custom") {
      onPatch({
        type: next,
        code:
          trigger.code?.trim() ||
          '// 返回 true 时播放\n// element: 当前组件，modules: 页面组件，event: 触发事件\nreturn true;',
      });
      return;
    }
    onPatch({ type: next });
  };

  return (
    <div className="animation-trigger-card">
      <div className="animation-trigger-card-head">
        <span>条件 {index + 1}</span>
        <button
          type="button"
          className="animation-trigger-remove"
          onClick={onRemove}
          title="删除这个触发条件"
        >
          <Trash2 size={12} />
          删除
        </button>
      </div>

      <label className="trigger-field">
        <span>触发方式</span>
        <select
          value={type}
          onChange={(event) =>
            updateType(
              event.target.value as Exclude<AnimationTriggerType, "auto">,
            )
          }
        >
          {TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {type === "click" ? (
        <p className="animation-trigger-hint">
          点击页面或组件时播放；再次点击会重新播放。
        </p>
      ) : null}

      {type === "hover" ? (
        <p className="animation-trigger-hint">
          鼠标进入时播放一次；移出后再次进入可重新播放。
        </p>
      ) : null}

      {type === "condition" ? (
        <div className="animation-trigger-condition">
          <label className="trigger-field">
            <span>组件</span>
            <select
              value={trigger.moduleId ?? ""}
              onChange={(event) => onPatch({ moduleId: event.target.value })}
            >
              <option value="">选择组件</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {getModuleDefinitionSafe(module.type).label} · {module.id}
                </option>
              ))}
            </select>
          </label>

          <div className="trigger-field-grid">
            <label className="trigger-field">
              <span>读取值</span>
              <select
                value={trigger.property ?? "value"}
                onChange={(event) =>
                  onPatch({
                    property: event.target
                      .value as AnimationTrigger["property"],
                  })
                }
              >
                <option value="value">输入值</option>
                <option value="text">文本内容</option>
                <option value="attribute">HTML 属性</option>
              </select>
            </label>
            <label className="trigger-field">
              <span>条件</span>
              <select
                value={trigger.operator ?? "gt"}
                onChange={(event) =>
                  onPatch({
                    operator: event.target
                      .value as AnimationTrigger["operator"],
                  })
                }
              >
                <option value="gt">大于</option>
                <option value="eq">等于</option>
                <option value="lt">小于</option>
              </select>
            </label>
          </div>

          {trigger.property === "attribute" ? (
            <label className="trigger-field">
              <span>属性名</span>
              <input
                key={`${targetKey}-${index}-attribute`}
                type="text"
                defaultValue={trigger.attribute ?? "data-spark-value"}
                onBlur={(event) => onPatch({ attribute: event.target.value })}
                placeholder="data-spark-value"
              />
            </label>
          ) : null}

          <label className="trigger-field">
            <span>比较值</span>
            <input
              key={`${targetKey}-${index}-value`}
              type="text"
              defaultValue={trigger.value ?? ""}
              onBlur={(event) => onPatch({ value: event.target.value })}
              placeholder="例如 10 或 done"
            />
          </label>

          <p className="animation-trigger-hint">
            每 150ms 检查一次；输入值读取组件内的 input / textarea / select，
            其他组件也可以提供 data-spark-value 或 HTML 属性。
          </p>
        </div>
      ) : null}

      {type === "custom" ? (
        <div className="animation-trigger-condition">
          <label className="trigger-field">
            <span>条件代码</span>
            <textarea
              key={`${targetKey}-${index}-custom`}
              rows={5}
              defaultValue={
                trigger.code ??
                '// 返回 true 时播放\n// element: 当前组件，modules: 页面组件，event: 触发事件\nreturn true;'
              }
              onBlur={(event) => onPatch({ code: event.target.value })}
              spellCheck={false}
            />
          </label>
          <p className="animation-trigger-hint">
            代码需要返回布尔值。可用变量：<code>element</code>、
            <code>modules</code>、<code>event</code>。
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function AnimationTriggerSection({
  triggers,
  modules,
  scope,
  targetKey,
  hasAnimation,
  onChange,
}: {
  triggers: AnimationTrigger[];
  modules: ModuleNode[];
  scope: "page" | "module";
  targetKey: string;
  hasAnimation: boolean;
  onChange: (triggers: AnimationTrigger[]) => void;
}) {
  const updateTrigger = (
    index: number,
    patch: Partial<AnimationTrigger>,
  ) => {
    onChange(
      triggers.map((trigger, position) =>
        position === index
          ? normalizeTrigger({ ...trigger, ...patch })
          : trigger,
      ),
    );
  };

  return (
    <div className="animation-trigger-panel">
      <div className="animation-trigger-head">
        <div>
          <strong>动画触发条件</strong>
          <small>
            {scope === "page" ? "页面动画" : "组件动画"} ·{" "}
            {triggers.length > 0
              ? `${triggers.length} 个触发条件`
              : "自动播放"}
          </small>
        </div>
        {!hasAnimation ? (
          <span className="trigger-warning">请先添加动画</span>
        ) : null}
      </div>

      {triggers.length === 0 ? (
        <p className="animation-trigger-hint">
          没有触发条件时，页面载入后会直接播放。添加条件后，动画会等待条件满足再播放。
        </p>
      ) : null}

      <div className="animation-trigger-list">
        {triggers.map((trigger, index) => (
          <TriggerEditor
            key={`${targetKey}-${index}-${trigger.type}`}
            trigger={trigger}
            index={index}
            modules={modules}
            targetKey={targetKey}
            onPatch={(patch) => updateTrigger(index, patch)}
            onRemove={() =>
              onChange(triggers.filter((_, position) => position !== index))
            }
          />
        ))}
      </div>

      <button
        type="button"
        className="btn btn-ghost animation-trigger-add"
        onClick={() => onChange([...triggers, normalizeTrigger({ type: "click" })])}
      >
        <Plus size={13} />
        添加触发条件
      </button>

      {!hasAnimation ? (
        <p className="animation-trigger-hint">
          当前{scope === "page" ? "页面" : "组件"}还没有预设或关键帧动画，设置触发条件后会保留，但需要先添加动画才能播放。
        </p>
      ) : null}
    </div>
  );
}

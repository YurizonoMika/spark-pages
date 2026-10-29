import type {
  AnimationTrigger,
  AnimationTriggerType,
  ModuleNode,
} from "../../model/types";
import {
  DEFAULT_TRIGGER,
  normalizeTrigger,
} from "../../model/animations";
import { getModuleDefinitionSafe } from "../../modules/registry";

const TRIGGER_LABELS: Record<AnimationTriggerType, string> = {
  auto: "自动播放",
  click: "点击时",
  hover: "鼠标悬停时",
  condition: "组件值条件",
  custom: "自定义 JS",
};

export function AnimationTriggerSection({
  trigger,
  modules,
  scope,
  targetKey,
  hasAnimation,
  onChange,
}: {
  trigger?: AnimationTrigger;
  modules: ModuleNode[];
  scope: "page" | "module";
  targetKey: string;
  hasAnimation: boolean;
  onChange: (trigger: AnimationTrigger) => void;
}) {
  const current = trigger ?? DEFAULT_TRIGGER;
  const update = (patch: Partial<AnimationTrigger>) => {
    onChange(normalizeTrigger({ ...current, ...patch }));
  };
  const changeType = (type: AnimationTriggerType) => {
    if (type === "condition") {
      update({
        type,
        moduleId: current.moduleId || modules[0]?.id || "",
        property: current.property ?? "value",
        operator: current.operator ?? "gt",
        value: current.value ?? "",
      });
      return;
    }
    if (type === "custom") {
      update({
        type,
        code:
          current.code?.trim() ||
          '// 返回 true 时播放\n// element: 当前组件，modules: 页面组件，event: 触发事件\nreturn true;',
      });
      return;
    }
    update({ type });
  };

  return (
    <div className="animation-trigger-panel">
      <div className="animation-trigger-head">
        <div>
          <strong>动画触发条件</strong>
          <small>
            {scope === "page" ? "页面动画" : "组件动画"} ·{" "}
            {TRIGGER_LABELS[current.type]}
          </small>
        </div>
        {!hasAnimation ? <span className="trigger-warning">请先添加动画</span> : null}
      </div>

      <label className="trigger-field">
        <span>触发方式</span>
        <select
          value={current.type}
          onChange={(event) =>
            changeType(event.target.value as AnimationTriggerType)
          }
        >
          <option value="auto">自动播放</option>
          <option value="click">点击时</option>
          <option value="hover">鼠标悬停时</option>
          <option value="condition">组件值条件</option>
          <option value="custom">自定义 JS</option>
        </select>
      </label>

      {current.type === "auto" ? (
        <p className="animation-trigger-hint">
          页面载入后立即播放入场、循环和离场动画。
        </p>
      ) : null}

      {current.type === "click" ? (
        <p className="animation-trigger-hint">
          点击{scope === "page" ? "页面" : "该组件"}时播放动画；再次点击会重新播放。
        </p>
      ) : null}

      {current.type === "hover" ? (
        <p className="animation-trigger-hint">
          鼠标进入{scope === "page" ? "页面" : "该组件"}时播放一次；移出后再次进入可重新播放。
        </p>
      ) : null}

      {current.type === "condition" ? (
        <div className="animation-trigger-condition">
          <label className="trigger-field">
            <span>组件</span>
            <select
              value={current.moduleId ?? ""}
              onChange={(event) => update({ moduleId: event.target.value })}
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
                value={current.property ?? "value"}
                onChange={(event) =>
                  update({
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
                value={current.operator ?? "gt"}
                onChange={(event) =>
                  update({
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

          {current.property === "attribute" ? (
            <label className="trigger-field">
              <span>属性名</span>
              <input
                key={`${targetKey}-attribute`}
                type="text"
                defaultValue={current.attribute ?? "data-spark-value"}
                onBlur={(event) => update({ attribute: event.target.value })}
                placeholder="data-spark-value"
              />
            </label>
          ) : null}

          <label className="trigger-field">
            <span>比较值</span>
            <input
              key={`${targetKey}-value`}
              type="text"
              defaultValue={current.value ?? ""}
              onBlur={(event) => update({ value: event.target.value })}
              placeholder="例如 10 或 done"
            />
          </label>

          <p className="animation-trigger-hint">
            预览中每 150ms 检查一次；输入值会读取组件内的 input / textarea /
            select，其他组件也可以提供 data-spark-value 或 HTML 属性。
          </p>
        </div>
      ) : null}

      {current.type === "custom" ? (
        <div className="animation-trigger-condition">
          <label className="trigger-field">
            <span>条件代码</span>
            <textarea
              key={`${targetKey}-custom`}
              rows={6}
              defaultValue={
                current.code ??
                '// 返回 true 时播放\n// element: 当前组件，modules: 页面组件，event: 触发事件\nreturn true;'
              }
              onBlur={(event) => update({ code: event.target.value })}
              spellCheck={false}
            />
          </label>
          <p className="animation-trigger-hint">
            代码会在预览和导出的页面中执行，需要返回布尔值。可用变量：
            <code>element</code>、<code>modules</code>、<code>event</code>。
          </p>
        </div>
      ) : null}

      {!hasAnimation ? (
        <p className="animation-trigger-hint">
          当前{scope === "page" ? "页面" : "组件"}还没有预设或关键帧动画，设置触发条件后会保留，但需要先添加动画才能播放。
        </p>
      ) : null}
    </div>
  );
}

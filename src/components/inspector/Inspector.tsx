import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  Move,
  MousePointer2,
  Palette,
  Settings2,
  Tag,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import clsx from "clsx";
import type { AnimationConfig, ModuleNode } from "../../model/types";
import {
  EASING_OPTIONS,
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  LOOP_ANIMATIONS,
  hasAnimations,
} from "../../model/animations";
import {
  getModuleDefinitionSafe,
} from "../../modules/registry";
import type {
  FieldOption,
  ModuleField,
  ModuleFieldGroup,
} from "../../modules/types";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { FONT_OPTIONS } from "../../model/fonts";
import { clamp, snap } from "../../lib/geometry";
import { IconButton } from "../ui/IconButton";
import {
  dataUrlBytes,
  imageFileToDataUrl,
} from "../../lib/imageUpload";

const FIELD_GROUP_META: Record<
  ModuleFieldGroup,
  { label: string; icon: typeof FileText }
> = {
  content: { label: "内容", icon: FileText },
  typography: { label: "排版", icon: Type },
  appearance: { label: "外观", icon: Palette },
  interaction: { label: "交互", icon: MousePointer2 },
};

const FIELD_GROUP_ORDER: ModuleFieldGroup[] = [
  "content",
  "typography",
  "appearance",
  "interaction",
];

const CONTENT_KEYS = new Set(["text", "src", "alt", "label", "placeholder"]);
const TYPOGRAPHY_KEYS = new Set([
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "align",
  "level",
  "size",
  "labelFontSize",
  "labelFontWeight",
]);
const APPEARANCE_KEYS = new Set([
  "color",
  "textColor",
  "labelColor",
  "background",
  "borderColor",
  "borderWidth",
  "radius",
  "fit",
  "thickness",
  "variant",
]);
const INTERACTION_KEYS = new Set(["href", "inputType"]);

function fieldGroup(field: ModuleField): ModuleFieldGroup {
  if (field.group) {
    return field.group;
  }
  if (INTERACTION_KEYS.has(field.key)) {
    return "interaction";
  }
  if (TYPOGRAPHY_KEYS.has(field.key)) {
    return "typography";
  }
  if (APPEARANCE_KEYS.has(field.key)) {
    return "appearance";
  }
  if (CONTENT_KEYS.has(field.key)) {
    return "content";
  }
  return "content";
}

function groupModuleFields(fields: ModuleField[]) {
  return FIELD_GROUP_ORDER.map((group) => ({
    id: group,
    ...FIELD_GROUP_META[group],
    fields: fields.filter((field) => fieldGroup(field) === group),
  })).filter((group) => group.fields.length > 0);
}

function Control({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={clsx("field", wide && "field-wide")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function useLocalValue(value: string): [string, (next: string) => void] {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return [local, setLocal];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function ImageSourceControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  const value =
    typeof module.props[field.key] === "string"
      ? (module.props[field.key] as string)
      : "";
  const [local, setLocal] = useLocalValue(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const endTransaction = useEditorStore((state) => state.endTransaction);
  const updateTransient = useEditorStore(
    (state) => state.updateModulePropsTransient,
  );
  const updateProps = useEditorStore((state) => state.updateModuleProps);
  const localImage = value.startsWith("data:image/");

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const result = await imageFileToDataUrl(file);
      const patch: Record<string, string> = { [field.key]: result.dataUrl };
      const alt = String(module.props.alt ?? "").trim();
      if (!alt) {
        patch.alt = result.name.replace(/\.[^.]+$/, "");
      }
      updateProps(module.id, patch);
      setLocal(result.dataUrl);
    } catch (fileError) {
      setError(
        fileError instanceof Error ? fileError.message : "无法读取图片",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Control label={field.label} wide>
      <div className="image-source-control">
        {localImage ? (
          <div className="image-source-local">
            <span className="image-source-badge">
              <ImagePlus size={12} />
              本地图片 · {formatFileSize(dataUrlBytes(value))}
            </span>
            <div className="image-source-actions">
              <button
                type="button"
                className="btn btn-ghost btn-compact"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? (
                  <Loader2 size={12} className="spin" />
                ) : (
                  <ImagePlus size={12} />
                )}
                替换
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-compact"
                disabled={busy}
                onClick={() => {
                  updateProps(module.id, { [field.key]: "" });
                  setLocal("");
                }}
              >
                <Trash2 size={12} />
                移除
              </button>
            </div>
          </div>
        ) : (
          <div className="image-source-row">
            <input
              type="text"
              value={local}
              placeholder={field.placeholder}
              onFocus={beginTransaction}
              onChange={(event) => {
                setLocal(event.target.value);
                updateTransient(module.id, {
                  [field.key]: event.target.value,
                });
              }}
              onBlur={endTransaction}
            />
            <button
              type="button"
              className="btn btn-ghost btn-compact"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <Loader2 size={12} className="spin" />
              ) : (
                <ImagePlus size={12} />
              )}
              从文件插入
            </button>
          </div>
        )}

        <input
          id={inputId}
          ref={fileRef}
          className="image-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void handleFile(file);
            }
          }}
        />

        {value ? (
          <div className="image-source-preview">
            <img src={value} alt="" draggable={false} />
          </div>
        ) : null}

        {error ? (
          <p className="panel-hint is-error">{error}</p>
        ) : (
          <p className="panel-hint">
            {localImage
              ? "图片已存入设计稿；构建时会写入 build/ 对应页面的 assets 目录。"
              : "支持 PNG / JPG / WebP / GIF / SVG；从文件插入的大图会自动压缩。"}
          </p>
        )}
      </div>
    </Control>
  );
}

function TextControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  const value =
    typeof module.props[field.key] === "string"
      ? (module.props[field.key] as string)
      : "";
  const [local, setLocal] = useLocalValue(value);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const endTransaction = useEditorStore((state) => state.endTransaction);
  const updateTransient = useEditorStore(
    (state) => state.updateModulePropsTransient,
  );

  if (module.type === "core.image" && field.key === "src") {
    return <ImageSourceControl module={module} field={field} />;
  }

  if (field.kind === "textarea") {
    return (
      <Control label={field.label} wide>
        <textarea
          value={local}
          rows={field.rows ?? 4}
          placeholder={field.placeholder}
          onFocus={beginTransaction}
          onChange={(event) => {
            setLocal(event.target.value);
            updateTransient(module.id, { [field.key]: event.target.value });
          }}
          onBlur={endTransaction}
        />
      </Control>
    );
  }

  return (
    <Control label={field.label} wide>
      <input
        type="text"
        value={local}
        placeholder={field.placeholder}
        onFocus={beginTransaction}
        onChange={(event) => {
          setLocal(event.target.value);
          updateTransient(module.id, { [field.key]: event.target.value });
        }}
        onBlur={endTransaction}
      />
    </Control>
  );
}

function NumberControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  const value =
    typeof module.props[field.key] === "number"
      ? String(module.props[field.key])
      : "";
  const [local, setLocal] = useLocalValue(value);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const endTransaction = useEditorStore((state) => state.endTransaction);
  const updateTransient = useEditorStore(
    (state) => state.updateModulePropsTransient,
  );

  return (
    <Control label={field.label}>
      <input
        type="number"
        value={local}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        placeholder={field.placeholder}
        onFocus={beginTransaction}
        onChange={(event) => {
          setLocal(event.target.value);
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            updateTransient(module.id, {
              [field.key]: clamp(
                next,
                field.min ?? Number.NEGATIVE_INFINITY,
                field.max ?? Number.POSITIVE_INFINITY,
              ),
            });
          }
        }}
        onBlur={endTransaction}
      />
    </Control>
  );
}

function SelectControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  const updateProps = useEditorStore((state) => state.updateModuleProps);
  const current = module.props[field.key];
  const options = field.options ?? [];

  return (
    <Control label={field.label}>
      <select
        value={String(current ?? "")}
        onChange={(event) => {
          const option = options.find(
            (candidate) => String(candidate.value) === event.target.value,
          );
          updateProps(module.id, {
            [field.key]: option?.value ?? event.target.value,
          });
        }}
      >
        {options.map((option: FieldOption) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </Control>
  );
}

function ColorControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  const value =
    typeof module.props[field.key] === "string"
      ? (module.props[field.key] as string)
      : "";
  const [local, setLocal] = useLocalValue(value);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const endTransaction = useEditorStore((state) => state.endTransaction);
  const updateTransient = useEditorStore(
    (state) => state.updateModulePropsTransient,
  );
  const pickerValue = /^#[0-9a-f]{6}$/i.test(local) ? local : "#ffffff";

  return (
    <Control label={field.label}>
      <div className="color-control">
        <input
          type="color"
          value={pickerValue}
          onFocus={beginTransaction}
          onChange={(event) => {
            setLocal(event.target.value);
            updateTransient(module.id, { [field.key]: event.target.value });
          }}
          onBlur={endTransaction}
        />
        <input
          type="text"
          value={local}
          placeholder={field.placeholder}
          onFocus={beginTransaction}
          onChange={(event) => {
            setLocal(event.target.value);
            updateTransient(module.id, { [field.key]: event.target.value });
          }}
          onBlur={endTransaction}
        />
      </div>
    </Control>
  );
}

function BooleanControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  const updateProps = useEditorStore((state) => state.updateModuleProps);
  const checked = module.props[field.key] === true;
  return (
    <label className="toggle-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          updateProps(module.id, { [field.key]: event.target.checked })
        }
      />
      <span>{field.label}</span>
    </label>
  );
}

function ModuleFieldControl({
  module,
  field,
}: {
  module: ModuleNode;
  field: ModuleField;
}) {
  if (field.kind === "textarea" || field.kind === "text") {
    return <TextControl module={module} field={field} />;
  }
  if (field.kind === "number") {
    return <NumberControl module={module} field={field} />;
  }
  if (field.kind === "select") {
    return <SelectControl module={module} field={field} />;
  }
  if (field.kind === "color") {
    return <ColorControl module={module} field={field} />;
  }
  return <BooleanControl module={module} field={field} />;
}

function RectControl({
  module,
  pageWidth,
  pageHeight,
  grid,
}: {
  module: ModuleNode;
  pageWidth: number;
  pageHeight: number;
  grid: number;
}) {
  const updateRect = useEditorStore((state) => state.updateModuleRect);
  const alignModuleToEdge = useEditorStore(
    (state) => state.alignModuleToEdge,
  );
  const definition = getModuleDefinitionSafe(module.type);
  const minWidth = definition.minSize?.width ?? grid * 2;
  const minHeight = definition.minSize?.height ?? grid * 2;
  const anchorX = module.anchorX ?? "left";
  const anchorY = module.anchorY ?? "top";
  const maxX = Math.max(pageWidth - module.width, 0);
  const maxY =
    anchorY === "bottom"
      ? Math.max(pageHeight - module.height, 0)
      : Math.max(pageHeight, 0);

  const commit = (
    key: "x" | "y" | "width" | "height",
    raw: string,
  ) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return;
    }
    if (key === "x") {
      updateRect(module.id, {
        x: clamp(snap(value, grid), 0, maxX),
        y: module.y,
        width: module.width,
        height: module.height,
      });
    } else if (key === "y") {
      updateRect(module.id, {
        x: module.x,
        y: clamp(snap(value, grid), 0, maxY),
        width: module.width,
        height: module.height,
      });
    } else if (key === "width") {
      updateRect(module.id, {
        x: module.x,
        y: module.y,
        width: Math.max(
          grid,
          Math.min(
            snap(Math.max(value, minWidth), grid),
            Math.max(pageWidth - module.x, grid),
          ),
        ),
        height: module.height,
      });
    } else {
      updateRect(module.id, {
        x: module.x,
        y: module.y,
        width: module.width,
        height: Math.max(
          grid,
          Math.min(
            snap(Math.max(value, minHeight), grid),
            anchorY === "bottom"
              ? Math.max(pageHeight - module.y, grid)
              : Number.POSITIVE_INFINITY,
          ),
        ),
      });
    }
  };

  return (
    <div className="section">
      <div className="section-title">
        <span className="section-title-label">
          <Move size={13} />
          布局与对齐
        </span>
        <small>吸附 {grid}px</small>
      </div>
      <div className="alignment-control">
        <span className="alignment-title">对齐到页面</span>
        <div className="alignment-buttons">
          <button
            type="button"
            className={clsx(
              "alignment-button",
              anchorX === "left" && "is-active",
            )}
            onClick={() => alignModuleToEdge(module.id, "left")}
          >
            <ArrowLeft size={14} />
            左
          </button>
          <button
            type="button"
            className={clsx(
              "alignment-button",
              anchorX === "right" && "is-active",
            )}
            onClick={() => alignModuleToEdge(module.id, "right")}
          >
            <ArrowRight size={14} />
            右
          </button>
          <button
            type="button"
            className={clsx(
              "alignment-button",
              anchorY === "top" && "is-active",
            )}
            onClick={() => alignModuleToEdge(module.id, "top")}
          >
            <ArrowUp size={14} />
            上
          </button>
          <button
            type="button"
            className={clsx(
              "alignment-button",
              anchorY === "bottom" && "is-active",
            )}
            onClick={() => alignModuleToEdge(module.id, "bottom")}
          >
            <ArrowDown size={14} />
            下
          </button>
        </div>
        <p className="alignment-hint">
          位置字段对应 CSS 的 left / right / top / bottom 边距。
        </p>
      </div>
      <div className="field-grid">
        <Control label={anchorX === "right" ? "右 (right)" : "左 (left)"}>
          <input
            key={`x-${module.x}-${anchorX}`}
            type="number"
            defaultValue={Math.round(module.x)}
            onBlur={(event) => commit("x", event.target.value)}
          />
        </Control>
        <Control label={anchorY === "bottom" ? "下 (bottom)" : "上 (top)"}>
          <input
            key={`y-${module.y}-${anchorY}`}
            type="number"
            defaultValue={Math.round(module.y)}
            onBlur={(event) => commit("y", event.target.value)}
          />
        </Control>
        <Control label="W">
          <input
            key={`w-${module.width}`}
            type="number"
            defaultValue={Math.round(module.width)}
            onBlur={(event) => commit("width", event.target.value)}
          />
        </Control>
        <Control label="H">
          <input
            key={`h-${module.height}`}
            type="number"
            defaultValue={Math.round(module.height)}
            onBlur={(event) => commit("height", event.target.value)}
          />
        </Control>
      </div>
    </div>
  );
}

function ModuleIdControl({ module }: { module: ModuleNode }) {
  const renameModule = useEditorStore((state) => state.renameModule);
  const [value, setValue] = useState(module.id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(module.id);
    setError(null);
  }, [module.id]);

  const commit = () => {
    const next = value.trim();
    if (next === module.id) {
      setValue(module.id);
      setError(null);
      return;
    }
    const message = renameModule(module.id, next);
    if (message) {
      setError(message);
      setValue(module.id);
      return;
    }
    setError(null);
    setValue(next);
  };

  return (
    <div className="section">
      <div className="section-title">
        <span className="section-title-label">
          <Tag size={13} />
          元素 ID
        </span>
        <small>脚本可通过 ID 访问</small>
      </div>
      <div className="fields">
        <Control label="ID">
          <input
            className={clsx("module-id-input", error && "is-invalid")}
            value={value}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setValue(module.id);
                setError(null);
                event.currentTarget.blur();
              }
            }}
          />
        </Control>
      </div>
      <p className={clsx("panel-hint", error && "is-error")}>
        {error ??
          `在脚本中使用 document.getElementById("${module.id}") 访问该元素。`}
      </p>
    </div>
  );
}

function SimpleColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
  return (
    <div className="color-control">
      <input
        type="color"
        value={pickerValue}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function AnimationNumber({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <Control label={label}>
      <input
        key={`${label}-${value}`}
        type="number"
        defaultValue={value}
        min={min}
        step={step}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
    </Control>
  );
}

function AnimationSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Control label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Control>
  );
}

export function AnimationSection({
  config,
  scope,
  onChange,
  onPreview,
}: {
  config: AnimationConfig;
  scope: "page" | "module";
  onChange: (patch: Partial<AnimationConfig>) => void;
  onPreview: () => void;
}) {
  const active = hasAnimations(config);

  return (
    <div className="section animation-section">
      <div className="section-title">
        <span>动画</span>
        {active ? <small>已启用</small> : <small>可选</small>}
      </div>
      <div className="fields">
        <AnimationSelect
          label="出场动画"
          value={config.entrance}
          options={ENTRANCE_ANIMATIONS}
          onChange={(value) => onChange({ entrance: value })}
        />
        <AnimationSelect
          label="循环播放"
          value={config.loop}
          options={LOOP_ANIMATIONS}
          onChange={(value) => onChange({ loop: value })}
        />
        <AnimationSelect
          label="离场动画"
          value={config.exit}
          options={EXIT_ANIMATIONS}
          onChange={(value) => onChange({ exit: value })}
        />
      </div>

      {active ? (
        <>
          <div className="field-grid animation-timing">
            <AnimationNumber
              label="时长 (ms)"
              value={config.duration}
              min={100}
              step={50}
              onChange={(value) => onChange({ duration: value })}
            />
            <AnimationNumber
              label="延迟 (ms)"
              value={config.delay}
              min={0}
              step={50}
              onChange={(value) => onChange({ delay: value })}
            />
            <AnimationNumber
              label="离场延迟 (ms)"
              value={config.exitDelay}
              min={0}
              step={100}
              onChange={(value) => onChange({ exitDelay: value })}
            />
            <AnimationSelect
              label="缓动"
              value={config.easing}
              options={EASING_OPTIONS}
              onChange={(value) => onChange({ easing: value })}
            />
          </div>
          <p className="panel-hint">
            {scope === "page" ? "页面" : "组件"}载入后播放出场动画，循环动画持续播放；
            离场动画在出场完成后等待“离场延迟”再播放。
          </p>
          <div className="animation-actions">
            <button type="button" className="btn btn-ghost" onClick={onPreview}>
              <Eye size={14} />
              在预览中查看
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                onChange({ entrance: "", loop: "", exit: "" })
              }
            >
              清除动画
            </button>
          </div>
        </>
      ) : (
        <p className="panel-hint">
          选择一个出场、循环或离场动画后，可设置时长、延迟与缓动。
        </p>
      )}
    </div>
  );
}

function PageSettings() {
  const page = useEditorStore(selectActivePage);
  const theme = useEditorStore((state) => state.project.theme);
  const setPageConfig = useEditorStore((state) => state.setPageConfig);
  const setTheme = useEditorStore((state) => state.setTheme);

  const handleNumber =
    (key: "width" | "height" | "grid") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        setPageConfig({ [key]: value });
      }
    };

  return (
    <div className="inspector-content">
      <div className="section">
        <div className="section-title">
          <span className="section-title-label">
            <FileText size={13} />
            页面
          </span>
        </div>
        <Control label="页面名称" wide>
          <input
            key={page.title}
            type="text"
            defaultValue={page.title}
            onBlur={(event) => setPageConfig({ title: event.target.value })}
          />
        </Control>
        <div className="field-grid">
          <Control label="宽度">
            <input
              key={`pw-${page.width}`}
              type="number"
              defaultValue={page.width}
              step={page.grid}
              onBlur={handleNumber("width")}
            />
          </Control>
          <Control label="高度">
            <input
              key={`ph-${page.height}`}
              type="number"
              defaultValue={page.height}
              step={page.grid}
              onBlur={handleNumber("height")}
            />
          </Control>
          <Control label="网格">
            <input
              key={`pg-${page.grid}`}
              type="number"
              defaultValue={page.grid}
              min={4}
              step={4}
              onBlur={handleNumber("grid")}
            />
          </Control>
          <Control label="背景">
            <SimpleColorField
              value={page.background}
              onChange={(value) => setPageConfig({ background: value })}
            />
          </Control>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <span className="section-title-label">
            <Type size={13} />
            排版
          </span>
        </div>
        <Control label="页面字体" wide>
          <select
            value={theme.fontFamily}
            onChange={(event) => setTheme({ fontFamily: event.target.value })}
          >
            {FONT_OPTIONS.some(
              (option) => option.value === theme.fontFamily,
            ) ? null : (
              <option value={theme.fontFamily}>当前自定义字体</option>
            )}
            {FONT_OPTIONS.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </Control>
        <p className="settings-hint">
          页面字体作为默认值；每个文本组件都可以单独覆盖。
        </p>
      </div>

      <div className="section">
        <div className="section-title">
          <span className="section-title-label">
            <Palette size={13} />
            颜色
          </span>
        </div>
        <div className="field-grid">
          <Control label="主色">
            <SimpleColorField
              value={theme.primary}
              onChange={(value) => setTheme({ primary: value })}
            />
          </Control>
          <Control label="文字色">
            <SimpleColorField
              value={theme.text}
              onChange={(value) => setTheme({ text: value })}
            />
          </Control>
          <Control label="次要色">
            <SimpleColorField
              value={theme.muted}
              onChange={(value) => setTheme({ muted: value })}
            />
          </Control>
          <Control label="表面色">
            <SimpleColorField
              value={theme.surface}
              onChange={(value) => setTheme({ surface: value })}
            />
          </Control>
        </div>
      </div>

      <div className="inspector-meta">
        <span>页面 ID</span>
        <code>{page.id}</code>
        <span>模块数量</span>
        <strong>{page.modules.length}</strong>
      </div>
    </div>
  );
}

export function Inspector() {
  const open = useEditorStore((state) => state.inspectorOpen);
  const setOpen = useEditorStore((state) => state.setInspectorOpen);
  const page = useEditorStore(selectActivePage);
  const selection = useEditorStore((state) => state.selection);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const duplicateSelected = useEditorStore(
    (state) => state.duplicateSelected,
  );
  const removeSelected = useEditorStore((state) => state.removeSelected);
  const reorderModule = useEditorStore((state) => state.reorderModule);

  if (!open) {
    return null;
  }

  const selected = page.modules.filter((module) =>
    selection.includes(module.id),
  );
  const module = selected.length === 1 ? selected[0] : undefined;
  const definition = module ? getModuleDefinitionSafe(module.type) : null;
  const Icon = definition?.icon;

  return (
    <aside className="inspector">
      <header className="inspector-header">
        <div className="inspector-title">
          {module && Icon ? (
            <>
              <span className="inspector-module-icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{definition?.label}</strong>
                <small>{module.type}</small>
              </div>
            </>
          ) : selected.length > 1 ? (
            <>
              <span className="inspector-module-icon">
                <MousePointer2 size={16} />
              </span>
              <div>
                <strong>{selected.length} 个模块</strong>
                <small>多选</small>
              </div>
            </>
          ) : (
            <>
              <span className="inspector-module-icon">
                <Settings2 size={16} />
              </span>
              <div>
                <strong>页面设置</strong>
                <small>{page.title}</small>
              </div>
            </>
          )}
        </div>
        <IconButton label="关闭属性面板" onClick={() => setOpen(false)}>
          <X size={15} />
        </IconButton>
      </header>

      <div className="inspector-scroll">
        {module && definition ? (
          <div className="inspector-content">
            {selected.length === 1 ? (
              <ModuleIdControl module={module} />
            ) : null}

            {selected.length === 1 ? (
              <RectControl
                module={module}
                pageWidth={page.width}
                pageHeight={page.height}
                grid={page.grid}
              />
            ) : null}

            {definition.fields.length > 0 ? (
              groupModuleFields(definition.fields).map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div className="section" key={group.id}>
                    <div className="section-title">
                      <span className="section-title-label">
                        <GroupIcon size={13} />
                        {group.label}
                      </span>
                    </div>
                    <div className="fields">
                      {group.fields.map((field) => (
                        <ModuleFieldControl
                          key={field.key}
                          module={module}
                          field={field}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="panel-hint">该模块没有可配置属性。</p>
            )}

            <div className="section">
              <div className="section-title">
                <span className="section-title-label">
                  <Settings2 size={13} />
                  操作
                </span>
              </div>
              <div className="inspector-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={duplicateSelected}
                >
                  <Copy size={14} />
                  复制
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    module ? reorderModule(module.id, "top") : undefined
                  }
                >
                  <ChevronsUp size={14} />
                  置顶
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    module ? reorderModule(module.id, "bottom") : undefined
                  }
                >
                  <ChevronsDown size={14} />
                  置底
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={removeSelected}
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost page-settings-link"
              onClick={clearSelection}
            >
              <Settings2 size={14} />
              返回页面设置
            </button>
          </div>
        ) : selected.length > 1 ? (
          <div className="inspector-content">
            <p className="panel-hint">
              已选择 {selected.length} 个模块。拖动任意一个可整体移动。
            </p>
            <div className="inspector-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={duplicateSelected}
              >
                <Copy size={14} />
                复制
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={removeSelected}
              >
                <Trash2 size={14} />
                删除
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost page-settings-link"
              onClick={clearSelection}
            >
              <Settings2 size={14} />
              返回页面设置
            </button>
          </div>
        ) : (
          <PageSettings />
        )}
      </div>
    </aside>
  );
}

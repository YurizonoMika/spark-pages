import type {
  AnimationConfig,
  AnimationTrigger,
  KeyframeAnimation,
  ModuleNode,
  Page,
  PropValue,
} from "../../model/types";
import { createId } from "../../model/defaults";
import {
  DEFAULT_ANIMATION,
  EASING_OPTIONS,
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  LOOP_ANIMATIONS,
  hasAnimationTrigger,
  normalizeTrigger,
  type AnimationOption,
} from "../../model/animations";
import {
  ANIMATABLE_PROPERTIES,
  normalizeKeyframeAnimation,
  valueAtTime,
} from "../../model/keyframes";
import {
  getModuleDefinitionSafe,
  listModuleDefinitions,
} from "../../modules/registry";
import { serializeProject } from "../../xml/projectXml";
import {
  selectActivePage,
  useEditorStore,
  type KeyframeTarget,
  type ModuleUpdatePatch,
  type NewModuleInput,
} from "../../store/editorStore";

export interface AgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolExecutionResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  summary: string;
}

export const TOOL_LABELS: Record<string, string> = {
  get_page: "读取页面",
  get_selection: "读取选区",
  list_module_types: "读取模块库",
  get_module: "读取模块",
  insert_modules: "插入模块",
  update_module: "修改模块",
  remove_modules: "删除模块",
  set_page_config: "修改页面",
  set_theme: "修改主题",
  list_page_files: "列出页面文件",
  read_page_file: "读取页面文件",
  write_page_file: "写入页面文件",
  read_page_script: "读取页面脚本",
  write_page_script: "写入页面脚本",
  read_current_file: "读取当前文件",
  write_current_file: "写入当前文件",
  set_preset_animation: "设置预设动画",
  set_animation_trigger: "设置动画触发",
  set_animation_timing: "设置动画时长",
  add_animation_track: "添加动画轨道",
  remove_animation_track: "删除动画轨道",
  add_animation_keyframe: "添加关键帧",
  update_animation_keyframe: "修改关键帧",
  remove_animation_keyframe: "删除关键帧",
};

const ENTRANCE_VALUES = ENTRANCE_ANIMATIONS.map((option) => option.value);
const LOOP_VALUES = LOOP_ANIMATIONS.map((option) => option.value);
const EXIT_VALUES = EXIT_ANIMATIONS.map((option) => option.value);
const ANIMATABLE_KEYS = ANIMATABLE_PROPERTIES.map((property) => property.key);

function presetValue(
  value: unknown,
  options: AnimationOption[],
  field: string,
): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string" || !options.some((option) => option.value === value)) {
    throw new Error(
      `${field} 无效，可选值: ${options.map((option) => option.value || "无").join(", ")}`,
    );
  }
  return value;
}

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_page",
      description:
        "获取当前页面完整信息：尺寸、网格、模块列表、动画以及 XML。修改结构前应先调用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_selection",
      description: "获取当前在画板或预览魔杖中选中的模块。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_module_types",
      description:
        "列出所有可用模块类型、默认尺寸、可配置字段和 AI 使用说明。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_module",
      description: "读取一个模块的完整属性、位置、尺寸、动画和关键帧。",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "insert_modules",
      description:
        "批量插入模块。坐标使用页面像素并会自动吸附网格。props 必须符合模块字段。",
      parameters: {
        type: "object",
        properties: {
          modules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                props: { type: "object", additionalProperties: true },
              },
              required: ["type", "x", "y"],
            },
          },
        },
        required: ["modules"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_module",
      description:
        "修改模块的位置、尺寸、参照边或属性。x/y 是相对于 anchorX/anchorY 的边距；默认左上。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          patch: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              anchorX: { type: "string", enum: ["left", "right"] },
              anchorY: { type: "string", enum: ["top", "bottom"] },
              props: { type: "object", additionalProperties: true },
            },
          },
        },
        required: ["id", "patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_modules",
      description: "删除一个或多个模块。",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
        },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_page_config",
      description:
        "修改页面名称、宽度、高度、网格或背景色。宽度/高度/网格会自动对齐网格。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
          grid: { type: "number" },
          background: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_theme",
      description: "修改项目主题字体和颜色。",
      parameters: {
        type: "object",
        properties: {
          fontFamily: { type: "string" },
          primary: { type: "string" },
          text: { type: "string" },
          muted: { type: "string" },
          surface: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_page_files",
      description:
        "列出当前页面目录中的代码文件（HTML/CSS/JS/TS/Vue 等）。读取或修改页面代码前先调用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page_file",
      description:
        "读取当前页面目录中的一个代码文件。只能访问当前页面目录，不能读取项目其他文件。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对项目根目录的页面文件路径" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_page_file",
      description:
        "写入或覆盖当前页面目录中的一个代码文件。HTML、CSS、JS、TS、Vue 等文件应分开保存；写入会直接保存到项目文件夹。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对项目根目录的页面文件路径" },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page_script",
      description:
        "读取当前 .spark 页面设计稿中保存的页面脚本（JavaScript/TypeScript）和脚本语言。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "write_page_script",
      description:
        "写入或覆盖当前 .spark 页面设计稿中的页面脚本，脚本保存在 XML 设计稿中并进入撤销历史。仅在当前标签是页面设计稿时使用，不要用它写项目里的 JS/TS 文件。",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "完整页面脚本内容；传空字符串表示清空脚本",
          },
          language: {
            type: "string",
            enum: ["javascript", "typescript"],
            description: "脚本语言，默认保持当前页面的语言",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_preset_animation",
      description:
        "设置页面或组件的出场、循环、离场预设动画。target=page 或 module；module 时必须提供 moduleId。只传需要修改的字段。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          entrance: {
            type: "string",
            enum: ENTRANCE_VALUES,
            description: `出场动画：${ENTRANCE_ANIMATIONS.map((option) => `${option.value || "(空)"}=${option.label}`).join(", ")}`,
          },
          loop: {
            type: "string",
            enum: LOOP_VALUES,
            description: `循环动画：${LOOP_ANIMATIONS.map((option) => `${option.value || "(空)"}=${option.label}`).join(", ")}`,
          },
          exit: {
            type: "string",
            enum: EXIT_VALUES,
            description: `离场动画：${EXIT_ANIMATIONS.map((option) => `${option.value || "(空)"}=${option.label}`).join(", ")}`,
          },
          duration: { type: "number" },
          delay: { type: "number" },
          exitDelay: { type: "number" },
          easing: {
            type: "string",
            enum: EASING_OPTIONS.map((option) => option.value),
            description: "缓动曲线，默认使用当前动画的缓动。",
          },
        },
        required: ["target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_animation_trigger",
      description:
        "设置页面或组件的动画触发条件。type=click 点击、hover 悬停、condition 组件值条件、custom 自定义 JS、auto 自动播放。condition 需要 sourceModuleId、sourceProperty（value/text/attribute）、operator（gt/eq/lt）和 value；custom 需要 code，代码需返回布尔值。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string", description: "target=module 时的目标组件 ID" },
          type: {
            type: "string",
            enum: ["auto", "click", "hover", "condition", "custom"],
          },
          sourceModuleId: {
            type: "string",
            description: "condition 时要监视值的组件 ID",
          },
          sourceProperty: {
            type: "string",
            enum: ["value", "text", "attribute"],
            description: "condition 时读取的值来源，默认 value",
          },
          sourceAttribute: {
            type: "string",
            description: "sourceProperty=attribute 时的 HTML 属性名，如 data-spark-value",
          },
          operator: { type: "string", enum: ["gt", "eq", "lt"] },
          value: { type: "string", description: "condition 的比较值" },
          code: {
            type: "string",
            description:
              "custom 条件 JS 代码，可访问 element、modules、event，必须返回布尔值",
          },
        },
        required: ["target", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_animation_timing",
      description:
        "设置页面或组件关键帧动画的总时长（毫秒）和是否循环。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          duration: { type: "number", description: "关键帧动画总时长，单位毫秒" },
          loop: { type: "boolean", description: "是否循环播放" },
        },
        required: ["target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_animation_track",
      description:
        "为页面或组件的关键帧动画添加一条可动画数值轨道（如 opacity、rotate、blur）。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          property: {
            type: "string",
            enum: ANIMATABLE_KEYS,
            description: `可动画属性：${ANIMATABLE_PROPERTIES.map((property) => `${property.key}=${property.label} (${property.min}~${property.max})`).join(", ")}`,
          },
          time: { type: "number", description: "时间点，单位毫秒" },
          value: { type: "number", description: "属性值，会按轨道范围自动限制" },
          easing: { type: "string", enum: EASING_OPTIONS.map((option) => option.value) },
        },
        required: ["target", "property"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_animation_track",
      description: "删除页面或组件的一条关键帧动画轨道。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          property: { type: "string", enum: ANIMATABLE_KEYS },
        },
        required: ["target", "property"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_animation_keyframe",
      description:
        "在指定动画轨道的某个时间点添加关键帧。time 单位为毫秒。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          property: { type: "string", enum: ANIMATABLE_KEYS },
          time: { type: "number", description: "时间点，单位毫秒" },
          value: { type: "number", description: "属性值，会按轨道范围自动限制" },
          easing: { type: "string", enum: EASING_OPTIONS.map((option) => option.value) },
        },
        required: ["target", "property", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_animation_keyframe",
      description:
        "修改关键帧的时间、值或缓动。需要提供轨道 property 和 keyframeId。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          property: { type: "string", enum: ANIMATABLE_KEYS },
          keyframeId: { type: "string" },
          time: { type: "number" },
          value: { type: "number" },
          easing: { type: "string", enum: EASING_OPTIONS.map((option) => option.value) },
        },
        required: ["target", "property", "keyframeId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_animation_keyframe",
      description: "删除某条动画轨道中的一个关键帧。",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["page", "module"] },
          moduleId: { type: "string" },
          property: { type: "string", enum: ANIMATABLE_KEYS },
          keyframeId: { type: "string" },
        },
        required: ["target", "property", "keyframeId"],
      },
    },
  },
];

function objectArg(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("工具参数必须是对象");
  }
  return value as Record<string, unknown>;
}

function stringArg(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`缺少字符串参数 ${key}`);
  }
  return value;
}

function numberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`参数 ${key} 必须是数字`);
  }
  return value;
}

function moduleSummary(module: ModuleNode) {
  return {
    id: module.id,
    type: module.type,
    label: getModuleDefinitionSafe(module.type).label,
    x: module.x,
    y: module.y,
    width: module.width,
    height: module.height,
    anchorX: module.anchorX ?? "left",
    anchorY: module.anchorY ?? "top",
    props: module.props,
    ...(module.animations ? { animations: module.animations } : {}),
    ...(module.keyframes ? { keyframes: module.keyframes } : {}),
    ...(module.animationTrigger
      ? { animationTrigger: module.animationTrigger }
      : {}),
  };
}

function activePage() {
  const state = useEditorStore.getState();
  return { state, page: selectActivePage(state) };
}

function requireNumberArg(
  args: Record<string, unknown>,
  key: string,
): number {
  const value = numberArg(args, key);
  if (value === undefined) {
    throw new Error(`缺少数字参数 ${key}`);
  }
  return value;
}

function safeEasing(value: unknown, fallback: string): string {
  return typeof value === "string" &&
    EASING_OPTIONS.some((option) => option.value === value)
    ? value
    : fallback;
}

function animationTarget(
  args: Record<string, unknown>,
  page: Page,
): { target: KeyframeTarget; label: string } {
  const target = args.target;
  if (target === "page") {
    return { target: { kind: "page" }, label: "页面" };
  }
  if (target === "module") {
    const moduleId = stringArg(args, "moduleId");
    if (!page.modules.some((module) => module.id === moduleId)) {
      throw new Error(`模块不存在: ${moduleId}`);
    }
    return {
      target: { kind: "module", moduleId },
      label: `模块 ${moduleId}`,
    };
  }
  throw new Error('target 必须是 "page" 或 "module"');
}

function presetAnimationFor(
  target: KeyframeTarget,
  page: Page,
): AnimationConfig {
  if (target.kind === "page") {
    return page.animations ?? DEFAULT_ANIMATION;
  }
  return (
    page.modules.find((module) => module.id === target.moduleId)?.animations ??
    DEFAULT_ANIMATION
  );
}

function keyframesFor(
  target: KeyframeTarget,
  page: Page,
): KeyframeAnimation {
  if (target.kind === "page") {
    return normalizeKeyframeAnimation(page.keyframes);
  }
  const module = page.modules.find(
    (candidate) => candidate.id === target.moduleId,
  );
  return normalizeKeyframeAnimation(module?.keyframes);
}

function setKeyframes(
  target: KeyframeTarget,
  config: KeyframeAnimation,
): void {
  useEditorStore.getState().setTargetKeyframes(target, config);
}

function animationTrackDefinition(property: string) {
  return ANIMATABLE_PROPERTIES.find((item) => item.key === property);
}

function withTrackValueClamp(
  property: string,
  value: number,
): number {
  const definition = animationTrackDefinition(property);
  if (!definition) {
    return value;
  }
  return Math.min(definition.max, Math.max(definition.min, value));
}

export function executeAgentTool(
  name: string,
  rawArgs: unknown,
): ToolExecutionResult {
  try {
    const args =
      rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
        ? objectArg(rawArgs)
        : {};
    const { state, page } = activePage();

    if (name === "get_page") {
      const project = { ...state.project, pages: [page] };
      return {
        ok: true,
        summary: `读取页面「${page.title}」，${page.modules.length} 个模块`,
        result: {
          page: {
            id: page.id,
            title: page.title,
            width: page.width,
            height: page.height,
            grid: page.grid,
            background: page.background,
            ...(page.customScript ? { customScript: page.customScript } : {}),
            ...(page.scriptLanguage ? { scriptLanguage: page.scriptLanguage } : {}),
            ...(page.animations ? { animations: page.animations } : {}),
            ...(page.keyframes ? { keyframes: page.keyframes } : {}),
            ...(page.animationTrigger
              ? { animationTrigger: page.animationTrigger }
              : {}),
            modules: page.modules.map(moduleSummary),
          },
          xml: serializeProject(project),
        },
      };
    }

    if (name === "get_selection") {
      const selected = page.modules.filter((module) =>
        state.selection.includes(module.id),
      );
      return {
        ok: true,
        summary: `当前选中 ${selected.length} 个模块`,
        result: { ids: selected.map((module) => module.id), modules: selected.map(moduleSummary) },
      };
    }

    if (name === "list_module_types") {
      const definitions = listModuleDefinitions().map((definition) => ({
        type: definition.type,
        label: definition.label,
        category: definition.category,
        description: definition.ai?.description ?? definition.description,
        usage: definition.ai?.usage,
        defaultSize: definition.defaultSize,
        fields: definition.fields.map((field) => ({
          key: field.key,
          label: field.label,
          kind: field.kind,
          options: field.options?.map((option) => option.value),
          min: field.min,
          max: field.max,
        })),
      }));
      return {
        ok: true,
        summary: `共 ${definitions.length} 种模块`,
        result: { modules: definitions },
      };
    }

    if (name === "get_module") {
      const id = stringArg(args, "id");
      const module = page.modules.find((candidate) => candidate.id === id);
      if (!module) {
        throw new Error(`模块不存在: ${id}`);
      }
      return {
        ok: true,
        summary: `读取模块 ${id}`,
        result: { module: moduleSummary(module) },
      };
    }

    if (name === "insert_modules") {
      const modules = args.modules;
      if (!Array.isArray(modules) || modules.length === 0) {
        throw new Error("modules 必须是非空数组");
      }
      const inputs: NewModuleInput[] = modules.map((item) => {
        const record = objectArg(item);
        const type = stringArg(record, "type");
        const x = numberArg(record, "x");
        const y = numberArg(record, "y");
        if (x === undefined || y === undefined) {
          throw new Error("每个模块都必须提供 x 和 y");
        }
        const props =
          record.props && typeof record.props === "object" && !Array.isArray(record.props)
            ? (record.props as Record<string, PropValue>)
            : undefined;
        if (!listModuleDefinitions().some((definition) => definition.type === type)) {
          throw new Error(`未知模块类型: ${type}`);
        }
        return {
          type,
          x,
          y,
          width: numberArg(record, "width"),
          height: numberArg(record, "height"),
          props,
        };
      });
      const ids = state.insertModules(inputs);
      return {
        ok: true,
        summary: `插入 ${ids.length} 个模块`,
        result: { ids },
      };
    }

    if (name === "update_module") {
      const id = stringArg(args, "id");
      if (!page.modules.some((module) => module.id === id)) {
        throw new Error(`模块不存在: ${id}`);
      }
      const patch = objectArg(args.patch);
      const props =
        patch.props && typeof patch.props === "object" && !Array.isArray(patch.props)
          ? (patch.props as Record<string, PropValue>)
          : undefined;
      const update: ModuleUpdatePatch = {
        x: numberArg(patch, "x"),
        y: numberArg(patch, "y"),
        width: numberArg(patch, "width"),
        height: numberArg(patch, "height"),
        props,
      };
      if (patch.anchorX === "left" || patch.anchorX === "right") {
        update.anchorX = patch.anchorX;
      }
      if (patch.anchorY === "top" || patch.anchorY === "bottom") {
        update.anchorY = patch.anchorY;
      }
      state.updateModule(id, update);
      return {
        ok: true,
        summary: `修改模块 ${id}`,
        result: { id },
      };
    }

    if (name === "remove_modules") {
      if (!Array.isArray(args.ids) || args.ids.length === 0) {
        throw new Error("ids 必须是非空数组");
      }
      const ids = args.ids.filter((id): id is string => typeof id === "string");
      const missing = ids.filter(
        (id) => !page.modules.some((module) => module.id === id),
      );
      if (missing.length > 0) {
        throw new Error(`模块不存在: ${missing.join(", ")}`);
      }
      state.removeModules(ids);
      return {
        ok: true,
        summary: `删除 ${ids.length} 个模块`,
        result: { ids },
      };
    }

    if (name === "set_page_config") {
      state.setPageConfig({
        title: typeof args.title === "string" ? args.title : undefined,
        width: numberArg(args, "width"),
        height: numberArg(args, "height"),
        grid: numberArg(args, "grid"),
        background:
          typeof args.background === "string" ? args.background : undefined,
      });
      return {
        ok: true,
        summary: "页面设置已更新",
      };
    }

    if (name === "set_theme") {
      const patch = {
        fontFamily:
          typeof args.fontFamily === "string" ? args.fontFamily : undefined,
        primary: typeof args.primary === "string" ? args.primary : undefined,
        text: typeof args.text === "string" ? args.text : undefined,
        muted: typeof args.muted === "string" ? args.muted : undefined,
        surface: typeof args.surface === "string" ? args.surface : undefined,
      };
      const cleaned = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(cleaned).length === 0) {
        throw new Error("没有可更新的主题属性");
      }
      state.setTheme(cleaned);
      return {
        ok: true,
        summary: "主题已更新",
      };
    }

    if (name === "read_page_script") {
      const language = page.scriptLanguage ?? "javascript";
      const code = page.customScript ?? "";
      return {
        ok: true,
        summary: `读取页面「${page.title}」脚本（${language}）`,
        result: {
          pageId: page.id,
          pageTitle: page.title,
          language,
          code,
          lineCount: code === "" ? 0 : code.split("\n").length,
        },
      };
    }

    if (name === "write_page_script") {
      const rawCode = args.code;
      if (typeof rawCode !== "string") {
        throw new Error("缺少字符串参数 code");
      }
      const language =
        args.language === "typescript"
          ? "typescript"
          : args.language === "javascript"
            ? "javascript"
            : page.scriptLanguage ?? "javascript";
      state.updatePageCode(page.id, {
        customScript: rawCode,
        scriptLanguage: language,
      });
      return {
        ok: true,
        summary: `写入页面「${page.title}」脚本（${language}）`,
        result: {
          pageId: page.id,
          language,
          lineCount: rawCode === "" ? 0 : rawCode.split("\n").length,
        },
      };
    }

    if (name === "set_animation_trigger") {
      const { target, label } = animationTarget(args, page);
      const rawType = typeof args.type === "string" ? args.type : "auto";
      const sourceModuleId =
        typeof args.sourceModuleId === "string"
          ? args.sourceModuleId
          : undefined;
      if (
        !["auto", "click", "hover", "condition", "custom"].includes(rawType)
      ) {
        throw new Error(`不支持的触发类型: ${rawType}`);
      }
      if (rawType === "condition" && !sourceModuleId) {
        throw new Error("condition 触发需要提供 sourceModuleId");
      }
      if (
        rawType === "condition" &&
        sourceModuleId &&
        !page.modules.some((module) => module.id === sourceModuleId)
      ) {
        throw new Error(`条件组件不存在: ${sourceModuleId}`);
      }
      if (rawType === "custom" && !String(args.code ?? "").trim()) {
        throw new Error("custom 触发条件需要提供 code");
      }
      const trigger = normalizeTrigger({
        type: rawType as AnimationTrigger["type"],
        moduleId: sourceModuleId,
        property:
          typeof args.sourceProperty === "string"
            ? (args.sourceProperty as "value" | "text" | "attribute")
            : "value",
        attribute:
          typeof args.sourceAttribute === "string"
            ? args.sourceAttribute
            : undefined,
        operator:
          typeof args.operator === "string"
            ? (args.operator as "gt" | "eq" | "lt")
            : "gt",
        value:
          args.value === undefined || args.value === null
            ? ""
            : String(args.value),
        code: typeof args.code === "string" ? args.code : undefined,
      });
      if (target.kind === "page") {
        state.setPageAnimationTrigger(trigger);
      } else {
        state.setModuleAnimationTrigger(target.moduleId, trigger);
      }
      return {
        ok: true,
        summary: hasAnimationTrigger(trigger)
          ? `设置${label}的动画触发：${trigger.type}`
          : `关闭${label}的动画触发条件`,
        result: { target, trigger },
      };
    }

    if (name === "set_preset_animation") {
      const { target, label } = animationTarget(args, page);
      const current = presetAnimationFor(target, page);
      const patch: Partial<AnimationConfig> = {};
      if (args.entrance !== undefined) {
        patch.entrance = presetValue(args.entrance, ENTRANCE_ANIMATIONS, "entrance");
      }
      if (args.loop !== undefined) {
        patch.loop = presetValue(args.loop, LOOP_ANIMATIONS, "loop");
      }
      if (args.exit !== undefined) {
        patch.exit = presetValue(args.exit, EXIT_ANIMATIONS, "exit");
      }
      if (numberArg(args, "duration") !== undefined) {
        patch.duration = numberArg(args, "duration");
      }
      if (numberArg(args, "delay") !== undefined) {
        patch.delay = numberArg(args, "delay");
      }
      if (numberArg(args, "exitDelay") !== undefined) {
        patch.exitDelay = numberArg(args, "exitDelay");
      }
      if (typeof args.easing === "string") {
        patch.easing = safeEasing(args.easing, current.easing);
      }
      if (Object.keys(patch).length === 0) {
        throw new Error("没有可更新的预设动画属性");
      }
      if (target.kind === "page") {
        state.setPageAnimations(patch);
      } else {
        state.setModuleAnimations(target.moduleId, patch);
      }
      return {
        ok: true,
        summary: `更新${label}的预设动画`,
        result: { target, patch },
      };
    }

    if (name === "set_animation_timing") {
      const { target, label } = animationTarget(args, page);
      const duration = numberArg(args, "duration");
      const loop = typeof args.loop === "boolean" ? args.loop : undefined;
      if (duration === undefined && loop === undefined) {
        throw new Error("duration 和 loop 至少提供一个");
      }
      const config = keyframesFor(target, page);
      const next = normalizeKeyframeAnimation({
        ...config,
        duration: duration ?? config.duration,
        loop: loop ?? config.loop,
      });
      setKeyframes(target, next);
      return {
        ok: true,
        summary: `更新${label}的动画时长/循环`,
        result: { duration: next.duration, loop: next.loop },
      };
    }

    if (name === "add_animation_track") {
      const { target, label } = animationTarget(args, page);
      const property = stringArg(args, "property");
      const definition = animationTrackDefinition(property);
      if (!definition) {
        throw new Error(`不支持的动画属性: ${property}`);
      }
      const config = keyframesFor(target, page);
      if ((config.tracks[property]?.length ?? 0) > 0) {
        throw new Error(`动画轨道已存在: ${property}`);
      }
      const time = Math.min(
        config.duration,
        Math.max(0, Math.round(numberArg(args, "time") ?? 0)),
      );
      const value = withTrackValueClamp(
        property,
        numberArg(args, "value") ?? definition.defaultValue,
      );
      const id = createId("kf");
      const next = normalizeKeyframeAnimation({
        ...config,
        tracks: {
          ...config.tracks,
          [property]: [
            {
              id,
              time,
              value,
              easing: safeEasing(args.easing, DEFAULT_ANIMATION.easing),
            },
          ],
        },
      });
      setKeyframes(target, next);
      return {
        ok: true,
        summary: `为${label}添加轨道 ${definition.label}`,
        result: { property, keyframeId: id, time, value },
      };
    }

    if (name === "remove_animation_track") {
      const { target, label } = animationTarget(args, page);
      const property = stringArg(args, "property");
      const config = keyframesFor(target, page);
      if (!config.tracks[property]) {
        throw new Error(`动画轨道不存在: ${property}`);
      }
      const tracks = { ...config.tracks };
      delete tracks[property];
      setKeyframes(target, { ...config, tracks });
      return {
        ok: true,
        summary: `删除${label}的动画轨道 ${property}`,
        result: { property },
      };
    }

    if (name === "add_animation_keyframe") {
      const { target, label } = animationTarget(args, page);
      const property = stringArg(args, "property");
      const definition = animationTrackDefinition(property);
      if (!definition) {
        throw new Error(`不支持的动画属性: ${property}`);
      }
      const config = keyframesFor(target, page);
      const track = config.tracks[property] ?? [];
      const time = Math.min(
        config.duration,
        Math.max(0, Math.round(requireNumberArg(args, "time"))),
      );
      const value = withTrackValueClamp(
        property,
        numberArg(args, "value") ??
          valueAtTime(track, time, definition.defaultValue),
      );
      const id = createId("kf");
      const next = normalizeKeyframeAnimation({
        ...config,
        tracks: {
          ...config.tracks,
          [property]: [
            ...track,
            {
              id,
              time,
              value,
              easing: safeEasing(args.easing, DEFAULT_ANIMATION.easing),
            },
          ],
        },
      });
      setKeyframes(target, next);
      return {
        ok: true,
        summary: `为${label}的${definition.label}添加关键帧`,
        result: { property, keyframeId: id, time, value },
      };
    }

    if (name === "update_animation_keyframe") {
      const { target, label } = animationTarget(args, page);
      const property = stringArg(args, "property");
      const keyframeId = stringArg(args, "keyframeId");
      const definition = animationTrackDefinition(property);
      if (!definition) {
        throw new Error(`不支持的动画属性: ${property}`);
      }
      const config = keyframesFor(target, page);
      const track = config.tracks[property] ?? [];
      const keyframe = track.find((item) => item.id === keyframeId);
      if (!keyframe) {
        throw new Error(`关键帧不存在: ${keyframeId}`);
      }
      const time = numberArg(args, "time");
      const value = numberArg(args, "value");
      const next = normalizeKeyframeAnimation({
        ...config,
        tracks: {
          ...config.tracks,
          [property]: track.map((item) =>
            item.id === keyframeId
              ? {
                  ...item,
                  time:
                    time !== undefined
                      ? Math.min(config.duration, Math.max(0, Math.round(time)))
                      : item.time,
                  value:
                    value !== undefined
                      ? withTrackValueClamp(property, value)
                      : item.value,
                  easing:
                    typeof args.easing === "string"
                      ? safeEasing(args.easing, item.easing)
                      : item.easing,
                }
              : item,
          ),
        },
      });
      setKeyframes(target, next);
      return {
        ok: true,
        summary: `修改${label}的${definition.label}关键帧`,
        result: { property, keyframeId },
      };
    }

    if (name === "remove_animation_keyframe") {
      const { target, label } = animationTarget(args, page);
      const property = stringArg(args, "property");
      const keyframeId = stringArg(args, "keyframeId");
      const config = keyframesFor(target, page);
      const track = config.tracks[property] ?? [];
      if (!track.some((item) => item.id === keyframeId)) {
        throw new Error(`关键帧不存在: ${keyframeId}`);
      }
      const next = normalizeKeyframeAnimation({
        ...config,
        tracks: {
          ...config.tracks,
          [property]: track.filter((item) => item.id !== keyframeId),
        },
      });
      setKeyframes(target, next);
      return {
        ok: true,
        summary: `删除${label}的${property}关键帧`,
        result: { property, keyframeId },
      };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "工具执行失败",
      summary: `工具执行失败：${name}`,
    };
  }
}

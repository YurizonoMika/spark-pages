import { createId } from "./defaults";
import type {
  ScriptBlock,
  ScriptBlockKind,
  ScriptBoard,
  ScriptConnection,
} from "./types";

export type ScriptBlockFieldKind =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "module";

export interface ScriptBlockFieldDefinition {
  key: string;
  label: string;
  kind: ScriptBlockFieldKind;
  placeholder?: string;
  options?: string[];
}

export interface ScriptBlockTemplate {
  kind: ScriptBlockKind;
  label: string;
  category: string;
  description: string;
  code: string;
  hidden?: boolean;
}

export const SCRIPT_BLOCK_TEMPLATES: ScriptBlockTemplate[] = [
  {
    kind: "natural",
    label: "自然语言",
    category: "入口",
    description: "用自然语言描述整段脚本要实现的功能",
    code: "这段脚本需要实现：\n",
  },
  {
    kind: "trigger_ready",
    label: "页面加载",
    category: "触发",
    description: "页面打开后执行后续积木",
    code: 'document.addEventListener("DOMContentLoaded", () => {\n  // 页面加载后执行\n});',
  },
  {
    kind: "trigger_event",
    label: "组件事件",
    category: "触发",
    description: "点击、输入等事件发生时执行后续积木",
    code:
      'document.querySelector(\'[data-spark-module-id="module-id"]\')?.addEventListener("click", (event) => {\n  // 事件发生时执行\n});',
  },
  {
    kind: "trigger_timer",
    label: "定时器",
    category: "触发",
    description: "按固定间隔或延迟执行后续积木",
    code: "setInterval(() => {\n  // 定时执行\n}, 1000);",
  },
  {
    kind: "state",
    label: "变量",
    category: "数据",
    description: "创建一个脚本变量",
    code: "let count = 0;",
  },
  {
    kind: "state_set",
    label: "改变量",
    category: "数据",
    description: "设值、累加、取反或追加变量",
    code: "count = 1;",
  },
  {
    kind: "input_to_state",
    label: "读取输入",
    category: "数据",
    description: "把组件的输入值写入变量",
    code: 'document.querySelector(\'[data-spark-module-id="module-id"]\')?.addEventListener("input", (event) => {\n  count = event.target.value;\n});',
  },
  {
    kind: "fetch_data",
    label: "请求数据",
    category: "数据",
    description: "请求接口并把结果存入变量",
    code:
      'fetch("/api/data")\n  .then((response) => response.json())\n  .then((data) => {\n    items = data;\n  });',
  },
  {
    kind: "bind_text",
    label: "设置文字",
    category: "绑定",
    description: "把文字或变量写入页面组件",
    code:
      'const root = document.querySelector(\'[data-spark-module-id="module-id"]\');\nif (root) root.textContent = "Hello";',
  },
  {
    kind: "bind_value",
    label: "设置输入",
    category: "绑定",
    description: "设置输入框、下拉框的值",
    code:
      'const field = document.querySelector(\'[data-spark-module-id="module-id"] input, [data-spark-module-id="module-id"] textarea\');\nif (field) field.value = "Hello";',
  },
  {
    kind: "bind_image",
    label: "设置图片",
    category: "绑定",
    description: "替换组件里的图片、视频或背景图",
    code:
      'const media = document.querySelector(\'[data-spark-module-id="module-id"] img\');\nif (media) media.src = "https://…";',
  },
  {
    kind: "bind_visibility",
    label: "显示隐藏",
    category: "绑定",
    description: "显示、隐藏或切换组件",
    code:
      'const root = document.querySelector(\'[data-spark-module-id="module-id"]\');\nif (root) root.style.display = "none";',
  },
  {
    kind: "bind_class",
    label: "样式类",
    category: "绑定",
    description: "添加、移除或切换 CSS 类",
    code:
      'const root = document.querySelector(\'[data-spark-module-id="module-id"]\');\nif (root) root.classList.add("is-active");',
  },
  {
    kind: "bind_style",
    label: "设置样式",
    category: "绑定",
    description: "设置组件的一个样式属性",
    code:
      'const root = document.querySelector(\'[data-spark-module-id="module-id"]\');\nif (root) root.style.color = "#6750a4";',
  },
  {
    kind: "bind_scroll",
    label: "滚动到",
    category: "绑定",
    description: "把页面滚动到指定组件",
    code:
      'document.querySelector(\'[data-spark-module-id="module-id"]\')?.scrollIntoView({ behavior: "smooth", block: "start" });',
  },
  {
    kind: "bind_list",
    label: "渲染列表",
    category: "绑定",
    description: "用数组变量渲染列表项",
    code:
      'const root = document.querySelector(\'[data-spark-module-id="module-id"]\');\nif (root) root.textContent = items.map((item) => item).join(" ");',
  },
  {
    kind: "condition",
    label: "条件",
    category: "逻辑",
    description: "条件成立时执行后续积木",
    code: "if (count > 0) {\n  // 条件成立\n}",
  },
  {
    kind: "loop",
    label: "遍历",
    category: "逻辑",
    description: "遍历数组，对每一项执行后续积木",
    code: "for (const item of items) {\n  // 处理每一项\n}",
  },
  {
    kind: "delay",
    label: "等待",
    category: "逻辑",
    description: "延迟一段时间后继续执行",
    code: "setTimeout(() => {\n  // 等待后执行\n}, 500);",
  },
  {
    kind: "navigate",
    label: "跳转",
    category: "逻辑",
    description: "打开链接或切换到其他页面",
    code: 'window.location.href = "https://example.com";',
  },
  {
    kind: "console",
    label: "输出",
    category: "说明",
    description: "打印日志或调试信息",
    code: 'console.log("hello");',
  },
  {
    kind: "comment",
    label: "注释",
    category: "说明",
    description: "记录设计意图或 TODO",
    code: "// 在这里写说明\n",
  },
  {
    kind: "custom",
    label: "自定义代码",
    category: "说明",
    description: "高级：直接编写任意 JavaScript",
    code: "// 自由填写代码\n",
  },
  {
    kind: "start",
    label: "开始",
    category: "兼容",
    description: "旧版流程起点",
    code: "// 开始\n",
    hidden: true,
  },
  {
    kind: "event",
    label: "事件（旧版）",
    category: "兼容",
    description: "旧版事件积木",
    code: "",
    hidden: true,
  },
  {
    kind: "variable",
    label: "变量（旧版）",
    category: "兼容",
    description: "旧版变量积木",
    code: "",
    hidden: true,
  },
  {
    kind: "if",
    label: "条件（旧版）",
    category: "兼容",
    description: "旧版条件积木",
    code: "",
    hidden: true,
  },
  {
    kind: "function",
    label: "函数（旧版）",
    category: "兼容",
    description: "旧版函数积木",
    code: "",
    hidden: true,
  },
  {
    kind: "fetch",
    label: "请求（旧版）",
    category: "兼容",
    description: "旧版请求积木",
    code: "",
    hidden: true,
  },
  {
    kind: "return",
    label: "返回（旧版）",
    category: "兼容",
    description: "旧版返回积木",
    code: "",
    hidden: true,
  },
];

export function scriptBlockTemplate(
  kind: ScriptBlockKind,
): ScriptBlockTemplate {
  return (
    SCRIPT_BLOCK_TEMPLATES.find((template) => template.kind === kind) ??
    SCRIPT_BLOCK_TEMPLATES.find((template) => template.kind === "custom") ??
    SCRIPT_BLOCK_TEMPLATES[0]
  );
}

export function createScriptBlock(
  kind: ScriptBlockKind,
  x: number,
  y: number,
): ScriptBlock {
  const template = scriptBlockTemplate(kind);
  const fields = defaultScriptBlockFields(kind);
  return {
    id: createId("block"),
    kind,
    title: template.label,
    code: scriptBlockCode(kind, fields),
    fields,
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: 280,
    height: 240,
  };
}

export function emptyScriptBoard(): ScriptBoard {
  return { blocks: [], connections: [] };
}

export function createScriptConnection(
  from: string,
  to: string,
): ScriptConnection {
  return { id: createId("conn"), from, to };
}

const EVENT_OPTIONS = [
  "click",
  "dblclick",
  "input",
  "change",
  "submit",
  "mouseenter",
  "mouseleave",
  "keydown",
  "scroll",
  "focus",
  "blur",
];

const DECLARATION_OPTIONS = ["const", "let", "var"];
const METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE"];
const FORMAT_OPTIONS = ["JSON", "文本"];
const OPERATION_OPTIONS = ["设为", "增加", "减少", "取反", "追加"];
const VISIBILITY_OPTIONS = ["显示", "隐藏", "切换"];
const CLASS_OPTIONS = ["添加", "移除", "切换"];
const STYLE_OPTIONS = [
  "color",
  "backgroundColor",
  "fontSize",
  "fontWeight",
  "opacity",
  "borderRadius",
  "transform",
  "width",
  "height",
  "letterSpacing",
];
const SCROLL_BEHAVIOR_OPTIONS = ["平滑", "立即"];
const SCROLL_ALIGN_OPTIONS = ["顶部", "居中", "底部"];
const TIMER_MODE_OPTIONS = ["重复执行", "延迟一次"];
const BOOLEAN_OPTIONS = ["否", "是"];

export function scriptBlockFields(
  kind: ScriptBlockKind,
): ScriptBlockFieldDefinition[] {
  if (kind === "natural") {
    return [
      {
        key: "description",
        label: "功能描述",
        kind: "textarea",
        placeholder: "用自然语言描述这段脚本要实现的功能…",
      },
    ];
  }
  if (kind === "trigger_ready") {
    return [
      {
        key: "note",
        label: "加载后执行",
        kind: "textarea",
        placeholder: "页面打开后要做什么？",
      },
    ];
  }
  if (kind === "trigger_event") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "event",
        label: "事件",
        kind: "select",
        options: EVENT_OPTIONS,
      },
      {
        key: "prevent",
        label: "阻止默认行为",
        kind: "select",
        options: BOOLEAN_OPTIONS,
      },
    ];
  }
  if (kind === "trigger_timer") {
    return [
      {
        key: "mode",
        label: "执行方式",
        kind: "select",
        options: TIMER_MODE_OPTIONS,
      },
      {
        key: "ms",
        label: "间隔（毫秒）",
        kind: "number",
        placeholder: "1000",
      },
    ];
  }
  if (kind === "state") {
    return [
      { key: "name", label: "变量名", kind: "text", placeholder: "例如 count" },
      {
        key: "value",
        label: "初始值",
        kind: "text",
        placeholder: "数字、文字、true 或 {{变量}}",
      },
    ];
  }
  if (kind === "state_set") {
    return [
      { key: "name", label: "变量名", kind: "text", placeholder: "例如 count" },
      {
        key: "operation",
        label: "操作",
        kind: "select",
        options: OPERATION_OPTIONS,
      },
      {
        key: "value",
        label: "值",
        kind: "text",
        placeholder: "例如 1、Hello 或 {{输入变量}}",
      },
    ];
  }
  if (kind === "input_to_state") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "variable",
        label: "写入变量",
        kind: "text",
        placeholder: "例如 inputValue",
      },
      {
        key: "event",
        label: "监听事件",
        kind: "select",
        options: ["input", "change"],
      },
    ];
  }
  if (kind === "fetch_data") {
    return [
      {
        key: "url",
        label: "请求地址",
        kind: "text",
        placeholder: "https://… 或 /api/data",
      },
      {
        key: "method",
        label: "方法",
        kind: "select",
        options: METHOD_OPTIONS,
      },
      {
        key: "format",
        label: "返回格式",
        kind: "select",
        options: FORMAT_OPTIONS,
      },
      {
        key: "variable",
        label: "存入变量",
        kind: "text",
        placeholder: "例如 data",
      },
    ];
  }
  if (kind === "bind_text") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "value",
        label: "显示内容",
        kind: "textarea",
        placeholder: "文字，或 {{变量名}}",
      },
    ];
  }
  if (kind === "bind_value") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "value",
        label: "输入值",
        kind: "text",
        placeholder: "文字，或 {{变量名}}",
      },
    ];
  }
  if (kind === "bind_image") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "src",
        label: "图片地址",
        kind: "text",
        placeholder: "https://… 或 {{变量名}}",
      },
    ];
  }
  if (kind === "bind_visibility") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "mode",
        label: "操作",
        kind: "select",
        options: VISIBILITY_OPTIONS,
      },
    ];
  }
  if (kind === "bind_class") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "className",
        label: "样式类",
        kind: "text",
        placeholder: "例如 is-active",
      },
      {
        key: "mode",
        label: "操作",
        kind: "select",
        options: CLASS_OPTIONS,
      },
    ];
  }
  if (kind === "bind_style") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "property",
        label: "样式属性",
        kind: "select",
        options: STYLE_OPTIONS,
      },
      {
        key: "value",
        label: "样式值",
        kind: "text",
        placeholder: "例如 #6750a4、24px、0.5",
      },
    ];
  }
  if (kind === "bind_scroll") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "behavior",
        label: "滚动方式",
        kind: "select",
        options: SCROLL_BEHAVIOR_OPTIONS,
      },
      {
        key: "align",
        label: "对齐位置",
        kind: "select",
        options: SCROLL_ALIGN_OPTIONS,
      },
    ];
  }
  if (kind === "bind_list") {
    return [
      { key: "module", label: "页面组件", kind: "module" },
      {
        key: "variable",
        label: "数组变量",
        kind: "text",
        placeholder: "例如 items",
      },
      {
        key: "template",
        label: "每项内容",
        kind: "text",
        placeholder: "例如 {{item}} 或 {{item.name}}",
      },
      {
        key: "empty",
        label: "空列表文字",
        kind: "text",
        placeholder: "暂无内容",
      },
    ];
  }
  if (kind === "condition") {
    return [
      {
        key: "left",
        label: "左侧",
        kind: "text",
        placeholder: "变量或数字，例如 count",
      },
      {
        key: "operator",
        label: "判断",
        kind: "select",
        options: ["==", "!=", ">", "<", ">=", "<=", "包含"],
      },
      {
        key: "right",
        label: "右侧",
        kind: "text",
        placeholder: "例如 0、true 或 Hello",
      },
      {
        key: "note",
        label: "成立时执行",
        kind: "textarea",
        placeholder: "条件成立时做什么？",
      },
    ];
  }
  if (kind === "loop") {
    return [
      {
        key: "item",
        label: "当前项",
        kind: "text",
        placeholder: "例如 item",
      },
      {
        key: "iterable",
        label: "遍历变量",
        kind: "text",
        placeholder: "例如 items",
      },
      {
        key: "note",
        label: "循环内容",
        kind: "textarea",
        placeholder: "每项要做什么？",
      },
    ];
  }
  if (kind === "delay") {
    return [
      {
        key: "ms",
        label: "等待（毫秒）",
        kind: "number",
        placeholder: "500",
      },
    ];
  }
  if (kind === "navigate") {
    return [
      {
        key: "url",
        label: "链接地址",
        kind: "text",
        placeholder: "https://… 或 /page",
      },
      {
        key: "newTab",
        label: "新标签页",
        kind: "select",
        options: BOOLEAN_OPTIONS,
      },
    ];
  }
  if (kind === "console") {
    return [
      {
        key: "message",
        label: "输出内容",
        kind: "text",
        placeholder: "例如 页面已加载",
      },
    ];
  }
  if (kind === "comment") {
    return [
      {
        key: "text",
        label: "说明",
        kind: "textarea",
        placeholder: "记录设计意图或 TODO",
      },
    ];
  }
  if (kind === "custom") {
    return [
      {
        key: "code",
        label: "自由代码",
        kind: "textarea",
        placeholder: "自定义 JavaScript",
      },
    ];
  }

  // 旧版积木字段，保证已保存的画板仍可编辑。
  if (kind === "start") {
    return [
      {
        key: "note",
        label: "启动说明",
        kind: "textarea",
        placeholder: "页面加载后要执行什么？",
      },
    ];
  }
  if (kind === "event") {
    return [
      {
        key: "selector",
        label: "元素 ID",
        kind: "text",
        placeholder: "例如 cta",
      },
      {
        key: "event",
        label: "事件",
        kind: "select",
        options: EVENT_OPTIONS,
      },
      {
        key: "note",
        label: "事件逻辑",
        kind: "textarea",
        placeholder: "事件发生时做什么？",
      },
    ];
  }
  if (kind === "variable") {
    return [
      {
        key: "declaration",
        label: "声明",
        kind: "select",
        options: DECLARATION_OPTIONS,
      },
      { key: "name", label: "变量名", kind: "text", placeholder: "例如 count" },
      { key: "value", label: "初始值", kind: "text", placeholder: "例如 0" },
    ];
  }
  if (kind === "if") {
    return [
      {
        key: "condition",
        label: "条件",
        kind: "text",
        placeholder: "例如 count > 0",
      },
      {
        key: "note",
        label: "成立时执行",
        kind: "textarea",
        placeholder: "条件成立时做什么？",
      },
    ];
  }
  if (kind === "function") {
    return [
      {
        key: "name",
        label: "函数名",
        kind: "text",
        placeholder: "例如 handleClick",
      },
      {
        key: "params",
        label: "参数",
        kind: "text",
        placeholder: "例如 event",
      },
      {
        key: "note",
        label: "函数内容",
        kind: "textarea",
        placeholder: "函数要做什么？",
      },
    ];
  }
  if (kind === "fetch") {
    return [
      {
        key: "url",
        label: "请求地址",
        kind: "text",
        placeholder: "/api/data",
      },
      {
        key: "method",
        label: "方法",
        kind: "select",
        options: METHOD_OPTIONS,
      },
      {
        key: "variable",
        label: "响应变量",
        kind: "text",
        placeholder: "data",
      },
      {
        key: "note",
        label: "响应处理",
        kind: "textarea",
        placeholder: "拿到数据后做什么？",
      },
    ];
  }
  if (kind === "return") {
    return [
      {
        key: "value",
        label: "返回值",
        kind: "text",
        placeholder: "例如 true",
      },
    ];
  }
  return [
    {
      key: "code",
      label: "自由代码",
      kind: "textarea",
      placeholder: "自定义 JavaScript",
    },
  ];
}

export function defaultScriptBlockFields(
  kind: ScriptBlockKind,
): Record<string, string> {
  if (kind === "natural") {
    return { description: "这段脚本需要实现：\n" };
  }
  if (kind === "trigger_ready") {
    return { note: "页面加载后执行" };
  }
  if (kind === "trigger_event") {
    return { module: "", event: "click", prevent: "否" };
  }
  if (kind === "trigger_timer") {
    return { mode: "重复执行", ms: "1000" };
  }
  if (kind === "state") {
    return { name: "count", value: "0" };
  }
  if (kind === "state_set") {
    return { name: "count", operation: "设为", value: "1" };
  }
  if (kind === "input_to_state") {
    return { module: "", variable: "inputValue", event: "input" };
  }
  if (kind === "fetch_data") {
    return {
      url: "/api/data",
      method: "GET",
      format: "JSON",
      variable: "data",
    };
  }
  if (kind === "bind_text") {
    return { module: "", value: "Hello" };
  }
  if (kind === "bind_value") {
    return { module: "", value: "Hello" };
  }
  if (kind === "bind_image") {
    return { module: "", src: "" };
  }
  if (kind === "bind_visibility") {
    return { module: "", mode: "显示" };
  }
  if (kind === "bind_class") {
    return { module: "", className: "is-active", mode: "添加" };
  }
  if (kind === "bind_style") {
    return { module: "", property: "color", value: "#6750a4" };
  }
  if (kind === "bind_scroll") {
    return { module: "", behavior: "平滑", align: "顶部" };
  }
  if (kind === "bind_list") {
    return {
      module: "",
      variable: "items",
      template: "{{item}}",
      empty: "暂无内容",
    };
  }
  if (kind === "condition") {
    return {
      left: "count",
      operator: ">",
      right: "0",
      note: "条件成立时执行",
    };
  }
  if (kind === "loop") {
    return { item: "item", iterable: "items", note: "处理每一项" };
  }
  if (kind === "delay") {
    return { ms: "500" };
  }
  if (kind === "navigate") {
    return { url: "https://example.com", newTab: "否" };
  }
  if (kind === "console") {
    return { message: "hello" };
  }
  if (kind === "comment") {
    return { text: "在这里写说明" };
  }
  if (kind === "custom") {
    return { code: "// 自由填写代码\n" };
  }

  // 旧版积木默认值。
  if (kind === "start") {
    return { note: "页面加载后执行" };
  }
  if (kind === "event") {
    return {
      selector: "element-id",
      event: "click",
      note: "在这里写事件逻辑",
    };
  }
  if (kind === "variable") {
    return { declaration: "const", name: "value", value: "0" };
  }
  if (kind === "if") {
    return { condition: "condition", note: "条件成立时执行" };
  }
  if (kind === "function") {
    return { name: "handle", params: "event", note: "函数逻辑" };
  }
  if (kind === "fetch") {
    return {
      url: "/api/data",
      method: "GET",
      variable: "data",
      note: "拿到数据后执行",
    };
  }
  if (kind === "return") {
    return { value: "value" };
  }
  return { code: "// 自由填写代码\n" };
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function identifier(value: string, fallback = "value"): string {
  const cleaned = value.trim().replace(/[^\w$]/g, "_");
  return /^[A-Za-z_$][\w$]*$/.test(cleaned) ? cleaned : fallback;
}

function isVariableToken(value: string): string | null {
  const match = value.trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
  return match?.[1]?.trim() ?? null;
}

/** 把字段值编译成字符串表达式，支持 {{变量名}} 插值。 */
function textExpression(value: string): string {
  const variable = isVariableToken(value);
  if (variable) {
    return `String(${variable})`;
  }
  const trimmed = value.trim();
  if (!trimmed.includes("{{")) {
    return quote(value);
  }
  const literal = trimmed
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  const template = literal.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_match, name: string) => `\${${name.trim()}}`,
  );
  return `String(\`${template}\`)`;
}

/** 把字段值编译成字面量表达式：数字、布尔、null、变量或字符串。 */
function literalExpression(value: string): string {
  const variable = isVariableToken(value);
  if (variable) {
    return variable;
  }
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed === "true" || trimmed === "false" || trimmed === "null") {
    return trimmed;
  }
  if (trimmed === "undefined") {
    return "undefined";
  }
  return quote(value);
}

function numberExpression(value: string): string {
  const variable = isVariableToken(value);
  if (variable) {
    return `Number(${variable})`;
  }
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  return `Number(${literalExpression(value)})`;
}

function moduleRoot(moduleId: string): string {
  return `document.querySelector(${quote(
    `[data-spark-module-id="${moduleId.trim()}"]`,
  )})`;
}

function blockComment(text: string, indent = "  "): string {
  return text
    .split(/\r?\n/)
    .map((line) => `${indent}// ${line}`)
    .join("\n");
}

function indentLines(text: string, indent = "  "): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

function blockBody(
  inner: string | undefined,
  fallback: string,
  indent = "  ",
): string {
  if (inner && inner.trim()) {
    return indentLines(inner.trim(), indent);
  }
  return blockComment(fallback, indent);
}

export function scriptBlockCode(
  kind: ScriptBlockKind,
  fields: Record<string, string>,
  inner?: string,
): string {
  const value = (key: string, fallback = "") => fields[key] ?? fallback;
  const text = (key: string) => value(key).trim();

  if (kind === "natural") {
    return value("description");
  }
  if (kind === "trigger_ready") {
    return `document.addEventListener("DOMContentLoaded", () => {\n${blockBody(
      inner,
      text("note") || "页面加载后执行",
    )}\n});`;
  }
  if (kind === "trigger_event") {
    const event = text("event") || "click";
    const prevent = text("prevent") === "是";
    const cursor =
      event === "click" || event === "dblclick"
        ? '\n  if (root) root.style.cursor = "pointer";'
        : "";
    return `(() => {\n  const root = ${moduleRoot(
      text("module"),
    )};${cursor}\n  root?.addEventListener(${quote(
      event,
    )}, (event) => {\n${
      prevent ? "    event.preventDefault();\n" : ""
    }${blockBody(inner, "在这里连接后续积木", "    ")}\n  });\n})();`;
  }
  if (kind === "trigger_timer") {
    const ms = text("ms") || "1000";
    if (text("mode") === "延迟一次") {
      return `setTimeout(() => {\n${blockBody(
        inner,
        "延时后执行后续积木",
      )}\n}, ${ms});`;
    }
    return `setInterval(() => {\n${blockBody(
      inner,
      "定时执行后续积木",
    )}\n}, ${ms});`;
  }
  if (kind === "state") {
    return `let ${identifier(text("name"))} = ${literalExpression(
      value("value"),
    )};`;
  }
  if (kind === "state_set") {
    const name = identifier(text("name"));
    const operation = text("operation") || "设为";
    if (operation === "取反") {
      return `${name} = !${name};`;
    }
    if (operation === "增加") {
      return `${name} = Number(${name}) + ${numberExpression(
        value("value"),
      )};`;
    }
    if (operation === "减少") {
      return `${name} = Number(${name}) - ${numberExpression(
        value("value"),
      )};`;
    }
    if (operation === "追加") {
      return `${name} = String(${name}) + ${textExpression(value("value"))};`;
    }
    return `${name} = ${literalExpression(value("value"))};`;
  }
  if (kind === "input_to_state") {
    const variable = identifier(text("variable"), "inputValue");
    const event = text("event") || "input";
    return `(() => {\n  const root = ${moduleRoot(text("module"))};\n  root?.addEventListener(${quote(
      event,
    )}, (event) => {\n    const field = event.target;\n    ${variable} = field.type === "checkbox" ? field.checked : field.value;\n${blockBody(
      inner,
      "输入后执行",
      "    ",
    )}\n  });\n})();`;
  }
  if (kind === "fetch_data") {
    const method = text("method") || "GET";
    const variable = identifier(text("variable"), "data");
    const parse =
      text("format") === "文本" ? "response.text()" : "response.json()";
    return `fetch(${quote(text("url") || "/api/data")}, { method: ${quote(
      method,
    )} })\n  .then((response) => ${parse})\n  .then((__sparkPayload) => {\n    ${variable} = __sparkPayload;\n${blockBody(
      inner,
      "处理请求结果",
      "    ",
    )}\n  })\n  .catch((error) => console.error(error));`;
  }
  if (kind === "bind_text") {
    return `(() => {\n  const root = ${moduleRoot(text("module"))};\n  if (!root) return;\n  let target =\n    root.querySelector("[data-spark-bind='text']") ||\n    root.querySelector("strong, h1, h2, h3, h4, p, span, a, button, li") ||\n    root;\n  while (target.children && target.children.length === 1) {\n    target = target.children[0];\n  }\n  target.textContent = ${textExpression(value("value"))};\n})();`;
  }
  if (kind === "bind_value") {
    return `(() => {\n  const root = ${moduleRoot(text("module"))};\n  if (!root) return;\n  const field = root.querySelector("input, textarea, select");\n  if (!field) return;\n  const value = ${textExpression(value("value"))};\n  if (field.type === "checkbox") {\n    field.checked = Boolean(value);\n  } else {\n    field.value = value;\n  }\n})();`;
  }
  if (kind === "bind_image") {
    return `(() => {\n  const root = ${moduleRoot(text("module"))};\n  if (!root) return;\n  const media = root.querySelector("img, video");\n  const source = ${textExpression(value("src"))};\n  if (media) {\n    media.src = source;\n  } else {\n    root.style.backgroundImage = 'url("' + source + '")';\n  }\n})();`;
  }
  if (kind === "bind_visibility") {
    const mode = text("mode") || "显示";
    const operation =
      mode === "隐藏"
        ? 'root.style.display = "none";'
        : mode === "切换"
          ? 'root.style.display = root.style.display === "none" ? "" : "none";'
          : 'root.style.display = "";';
    return `(() => {\n  const root = ${moduleRoot(
      text("module"),
    )};\n  if (!root) return;\n  ${operation}\n})();`;
  }
  if (kind === "bind_class") {
    const className = text("className") || "is-active";
    const mode = text("mode") || "添加";
    const method =
      mode === "移除" ? "remove" : mode === "切换" ? "toggle" : "add";
    return `(() => {\n  const root = ${moduleRoot(
      text("module"),
    )};\n  if (!root) return;\n  root.classList.${method}(${quote(
      className,
    )});\n})();`;
  }
  if (kind === "bind_style") {
    const property = text("property") || "color";
    return `(() => {\n  const root = ${moduleRoot(
      text("module"),
    )};\n  if (!root) return;\n  root.style[${quote(property)}] = ${textExpression(
      value("value"),
    )};\n})();`;
  }
  if (kind === "bind_scroll") {
    const behavior = text("behavior") === "立即" ? "auto" : "smooth";
    const align =
      text("align") === "居中"
        ? "center"
        : text("align") === "底部"
          ? "end"
          : "start";
    return `${moduleRoot(
      text("module"),
    )}?.scrollIntoView({ behavior: ${quote(behavior)}, block: ${quote(
      align,
    )} });`;
  }
  if (kind === "bind_list") {
    const variable = identifier(text("variable"), "items");
    const itemContent = textExpression(value("template") || "{{item}}");
    return `(() => {\n  const root = ${moduleRoot(
      text("module"),
    )};\n  if (!root) return;\n  const container = root.querySelector("ul, ol") || root;\n  const list = Array.isArray(${variable}) ? ${variable} : [];\n  container.replaceChildren();\n  if (list.length === 0) {\n    const empty = document.createElement("div");\n    empty.textContent = ${quote(text("empty") || "暂无内容")};\n    container.appendChild(empty);\n    return;\n  }\n  const tag = container.tagName === "UL" || container.tagName === "OL" ? "li" : "div";\n  for (const item of list) {\n    const node = document.createElement(tag);\n    node.textContent = ${itemContent};\n    container.appendChild(node);\n  }\n})();`;
  }
  if (kind === "condition") {
    const left = text("left") || "true";
    const operator = text("operator") || "==";
    const right = literalExpression(value("right"));
    const condition =
      operator === "包含"
        ? `String(${left}).includes(String(${right}))`
        : `${left} ${operator} ${right}`;
    return `if (${condition}) {\n${blockBody(
      inner,
      text("note") || "条件成立时执行",
    )}\n}`;
  }
  if (kind === "loop") {
    return `for (const ${identifier(text("item"), "item")} of ${
      text("iterable") || "items"
    }) {\n${blockBody(inner, text("note") || "处理每一项")}\n}`;
  }
  if (kind === "delay") {
    return `setTimeout(() => {\n${blockBody(
      inner,
      "等待后执行后续积木",
    )}\n}, ${text("ms") || "500"});`;
  }
  if (kind === "navigate") {
    const url = textExpression(value("url"));
    if (text("newTab") === "是") {
      return `window.open(${url}, "_blank", "noopener,noreferrer");`;
    }
    return `window.location.href = ${url};`;
  }
  if (kind === "console") {
    return `console.log(${textExpression(value("message"))});`;
  }
  if (kind === "comment") {
    return text("text")
      .split(/\r?\n/)
      .map((line) => `// ${line}`)
      .join("\n");
  }
  if (kind === "custom") {
    return value("code");
  }

  // 旧版积木代码生成。
  if (kind === "start") {
    return `// 开始\n// ${text("note")}${
      inner && inner.trim() ? `\n${inner}` : ""
    }`;
  }
  if (kind === "event") {
    const selector = text("selector") || "element-id";
    const event = text("event") || "click";
    return `document.getElementById(${quote(
      selector,
    )})?.addEventListener(${quote(event)}, (event) => {\n${blockBody(
      inner,
      text("note"),
    )}\n});`;
  }
  if (kind === "variable") {
    const declaration = ["const", "let", "var"].includes(text("declaration"))
      ? text("declaration")
      : "const";
    return `${declaration} ${identifier(text("name"), "value")} = ${literalExpression(
      value("value"),
    )};`;
  }
  if (kind === "if") {
    return `if (${text("condition") || "true"}) {\n${blockBody(
      inner,
      text("note"),
    )}\n}`;
  }
  if (kind === "function") {
    return `function ${identifier(text("name"), "handle")}(${
      text("params")
    }) {\n${blockBody(inner, text("note"))}\n}`;
  }
  if (kind === "fetch") {
    const method = text("method") || "GET";
    const variable = identifier(text("variable"), "data");
    return `fetch(${quote(text("url") || "/api/data")}, { method: ${quote(
      method,
    )} })\n  .then((response) => response.json())\n  .then((${variable}) => {\n    // ${text(
      "note",
    )}\n  });`;
  }
  if (kind === "return") {
    return `return ${literalExpression(value("value"))};`;
  }
  return value("code");
}

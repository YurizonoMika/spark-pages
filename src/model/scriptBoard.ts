import { createId } from "./defaults";
import type {
  ScriptBlock,
  ScriptBlockKind,
  ScriptBoard,
  ScriptConnection,
} from "./types";

export type ScriptBlockFieldKind = "text" | "textarea" | "select" | "number";

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
}

export const SCRIPT_BLOCK_TEMPLATES: ScriptBlockTemplate[] = [
  {
    kind: "natural",
    label: "自然语言",
    category: "入口",
    description: "用自然语言描述代码功能",
    code: "这段脚本需要实现：\n",
  },
  {
    kind: "start",
    label: "开始",
    category: "流程",
    description: "流程起点或模块加载",
    code: "// 开始\n",
  },
  {
    kind: "event",
    label: "事件",
    category: "流程",
    description: "绑定点击、悬停等事件",
    code: 'document.getElementById("element-id")?.addEventListener("click", () => {\n  // 在这里写事件逻辑\n});\n',
  },
  {
    kind: "variable",
    label: "变量",
    category: "数据",
    description: "声明变量或常量",
    code: "const value = 0;\n",
  },
  {
    kind: "if",
    label: "条件",
    category: "逻辑",
    description: "if / else 条件分支",
    code: "if (condition) {\n  // 条件成立\n} else {\n  // 条件不成立\n}\n",
  },
  {
    kind: "loop",
    label: "循环",
    category: "逻辑",
    description: "遍历数组或重复执行",
    code: "for (const item of items) {\n  // 处理每个 item\n}\n",
  },
  {
    kind: "function",
    label: "函数",
    category: "逻辑",
    description: "定义一个可复用函数",
    code: "function handle() {\n  // 函数逻辑\n}\n",
  },
  {
    kind: "fetch",
    label: "请求",
    category: "数据",
    description: "发送网络请求",
    code: 'fetch("/api/data")\n  .then((response) => response.json())\n  .then((data) => {\n    console.log(data);\n  });\n',
  },
  {
    kind: "return",
    label: "返回",
    category: "流程",
    description: "返回结果或结束流程",
    code: "return value;\n",
  },
  {
    kind: "console",
    label: "输出",
    category: "调试",
    description: "打印日志或调试信息",
    code: 'console.log("hello");\n',
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
    label: "自定义",
    category: "说明",
    description: "自由编写任意 JavaScript",
    code: "// 自由填写代码\n",
  },
];

export function scriptBlockTemplate(
  kind: ScriptBlockKind,
): ScriptBlockTemplate {
  return (
    SCRIPT_BLOCK_TEMPLATES.find((template) => template.kind === kind) ??
    SCRIPT_BLOCK_TEMPLATES[SCRIPT_BLOCK_TEMPLATES.length - 1]
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
  "input",
  "change",
  "submit",
  "mouseenter",
  "mouseleave",
];

const DECLARATION_OPTIONS = ["const", "let", "var"];
const METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE"];

export function scriptBlockFields(
  kind: ScriptBlockKind,
): ScriptBlockFieldDefinition[] {
  if (kind === "natural") {
    return [
      {
        key: "description",
        label: "功能描述",
        kind: "textarea",
        placeholder: "用自然语言描述这段代码要实现的功能…",
      },
    ];
  }
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
        label: "遍历对象",
        kind: "text",
        placeholder: "例如 items",
      },
      {
        key: "note",
        label: "循环内容",
        kind: "textarea",
        placeholder: "每次循环做什么？",
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
  if (kind === "loop") {
    return { item: "item", iterable: "items", note: "处理每个 item" };
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
  if (kind === "console") {
    return { message: "hello" };
  }
  if (kind === "comment") {
    return { text: "在这里写说明" };
  }
  return { code: "// 自由填写代码\n" };
}

function quote(value: string): string {
  return JSON.stringify(value);
}

export function scriptBlockCode(
  kind: ScriptBlockKind,
  fields: Record<string, string>,
): string {
  const value = (key: string, fallback = "") => fields[key] ?? fallback;
  const text = (key: string) => value(key).trim();
  if (kind === "natural") {
    return value("description");
  }
  if (kind === "start") {
    return `// 开始\n// ${text("note")}`;
  }
  if (kind === "event") {
    const selector = text("selector") || "element-id";
    const event = text("event") || "click";
    return `document.getElementById(${quote(selector)})?.addEventListener(${quote(event)}, (event) => {\n  // ${text("note")}\n});`;
  }
  if (kind === "variable") {
    const declaration = ["const", "let", "var"].includes(text("declaration"))
      ? text("declaration")
      : "const";
    return `${declaration} ${text("name") || "value"} = ${text("value") || "undefined"};`;
  }
  if (kind === "if") {
    return `if (${text("condition") || "true"}) {\n  // ${text("note")}\n}`;
  }
  if (kind === "loop") {
    return `for (const ${text("item") || "item"} of ${text("iterable") || "items"}) {\n  // ${text("note")}\n}`;
  }
  if (kind === "function") {
    return `function ${text("name") || "handle"}(${text("params")}) {\n  // ${text("note")}\n}`;
  }
  if (kind === "fetch") {
    const method = text("method") || "GET";
    const variable = text("variable") || "data";
    return `fetch(${quote(text("url") || "/api/data")}, { method: ${quote(method)} })\n  .then((response) => response.json())\n  .then((${variable}) => {\n    // ${text("note")}\n  });`;
  }
  if (kind === "return") {
    return `return ${text("value") || "value"};`;
  }
  if (kind === "console") {
    return `console.log(${quote(text("message"))});`;
  }
  if (kind === "comment") {
    return text("text")
      .split(/\r?\n/)
      .map((line) => `// ${line}`)
      .join("\n");
  }
  return value("code");
}

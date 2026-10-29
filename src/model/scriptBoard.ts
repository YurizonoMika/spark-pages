import { createId } from "./defaults";
import type {
  ScriptBlock,
  ScriptBlockKind,
  ScriptBoard,
  ScriptConnection,
} from "./types";

export interface ScriptBlockTemplate {
  kind: ScriptBlockKind;
  label: string;
  category: string;
  description: string;
  code: string;
}

export const SCRIPT_BLOCK_TEMPLATES: ScriptBlockTemplate[] = [
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
  return {
    id: createId("block"),
    kind,
    title: template.label,
    code: template.code,
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: 260,
    height: 168,
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

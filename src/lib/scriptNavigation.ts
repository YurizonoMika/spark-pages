import { getModuleDefinitionSafe } from "../modules/registry";
import type { ModuleNode, Page } from "../model/types";
import { useEditorStore } from "../store/editorStore";

const ID_CHAR = /[A-Za-z0-9_-]/;

function findBareId(code: string, id: string): number {
  let index = 0;
  while (index <= code.length - id.length) {
    const found = code.indexOf(id, index);
    if (found < 0) {
      return -1;
    }
    const before = found > 0 ? code[found - 1] : "";
    const after = code[found + id.length] ?? "";
    if (!ID_CHAR.test(before) && !ID_CHAR.test(after)) {
      return found;
    }
    index = found + id.length;
  }
  return -1;
}

export function findModuleCodeRange(
  code: string,
  module: ModuleNode,
): { from: number; to: number } | null {
  const id = module.id;
  const candidates = [
    `data-spark-module-id="${id}"`,
    `data-spark-module-id='${id}'`,
    `getElementById("${id}")`,
    `getElementById('${id}')`,
    `#${id}`,
  ];
  let start = -1;
  let end = -1;
  for (const candidate of candidates) {
    const found = code.indexOf(candidate);
    if (found >= 0) {
      start = found;
      end = found + candidate.length;
      break;
    }
  }
  if (start < 0) {
    const bare = findBareId(code, id);
    if (bare < 0) {
      return null;
    }
    start = bare;
    end = bare + id.length;
  }
  const lineStart = code.lastIndexOf("\n", start) + 1;
  const lineBreak = code.indexOf("\n", end);
  return {
    from: lineStart,
    to: lineBreak < 0 ? code.length : lineBreak,
  };
}

export function moduleCodeSnippet(
  module: ModuleNode,
  page: Page,
): string {
  const label = getModuleDefinitionSafe(module.type).label;
  const language = page.scriptLanguage ?? "javascript";
  const languageLabel = language === "typescript" ? "TypeScript" : "JavaScript";
  return [
    `// 元素：${label} · ${module.id}（${languageLabel}）`,
    "{",
    `  const element = document.getElementById(${JSON.stringify(module.id)});`,
    "  if (element) {",
    `    // 在这里为「${label}」添加交互`,
    "  }",
    "}",
  ].join("\n");
}

export interface ModuleCodeNavigation {
  ok: boolean;
  inserted: boolean;
  error?: string;
}

export function goToModuleCode(
  pageId: string,
  moduleId: string,
): ModuleCodeNavigation {
  const store = useEditorStore.getState();
  const page = store.project.pages.find(
    (candidate) => candidate.id === pageId,
  );
  if (!page) {
    return { ok: false, inserted: false, error: "页面不存在" };
  }
  const module = page.modules.find(
    (candidate) => candidate.id === moduleId,
  );
  if (!module) {
    return { ok: false, inserted: false, error: "元素不存在" };
  }
  const code = page.customScript ?? "";
  const existing = findModuleCodeRange(code, module);
  if (existing) {
    store.setScriptReveal({
      pageId,
      from: existing.from,
      to: existing.to,
      token: Date.now(),
    });
    return { ok: true, inserted: false };
  }

  const snippet = moduleCodeSnippet(module, page);
  const next =
    code.trim() === ""
      ? snippet
      : `${code.replace(/\s+$/, "")}\n\n${snippet}`;
  const from = next.length - snippet.length;
  store.updatePageCode(pageId, {
    customScript: next,
    scriptLanguage: page.scriptLanguage ?? "javascript",
  });
  store.setScriptReveal({
    pageId,
    from,
    to: next.length,
    token: Date.now(),
  });
  return { ok: true, inserted: true };
}

import type { Page, Project } from "../model/types";
import { getModuleDefinitionSafe } from "../modules/registry";
import { escapeHtml, htmlAttr } from "./escape";
import { rectOf } from "./geometry";
import { ANIMATION_CSS, wrapAnimatedHtml } from "./animation";
import { buildKeyframeAnimation } from "./keyframes";

const PREVIEW_BRIDGE = String.raw`<script>
(function () {
  var APP_SOURCE = "spark-pages-app";
  var PREVIEW_SOURCE = "spark-pages-preview";
  var wandActive = false;
  var selected = [];
  var hovered = null;

  function post(type, id) {
    parent.postMessage({ source: PREVIEW_SOURCE, type: type, id: id || null }, "*");
  }
  function moduleAt(x, y) {
    var element = document.elementFromPoint(x, y);
    return element && element.closest
      ? element.closest("[data-spark-module-id]")
      : null;
  }
  function clearHover() {
    if (hovered) hovered.classList.remove("spark-wand-hover");
    hovered = null;
  }
  function applySelection(ids) {
    selected = Array.isArray(ids) ? ids : [];
    var nodes = document.querySelectorAll("[data-spark-module-id]");
    for (var index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      node.classList.toggle(
        "spark-wand-selected",
        selected.indexOf(node.getAttribute("data-spark-module-id")) !== -1,
      );
    }
  }
  function hoverAt(x, y) {
    var target = wandActive ? moduleAt(x, y) : null;
    if (target === hovered) return;
    clearHover();
    if (target) {
      hovered = target;
      target.classList.add("spark-wand-hover");
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.source !== APP_SOURCE) return;
    if (data.type === "wand") {
      wandActive = Boolean(data.active);
      if (!wandActive) clearHover();
    } else if (data.type === "selection") {
      applySelection(data.ids);
    } else if (data.type === "hover") {
      hoverAt(data.x, data.y);
    } else if (data.type === "clear-hover") {
      clearHover();
    } else if (data.type === "select") {
      var target = wandActive ? moduleAt(data.x, data.y) : null;
      var id = target && target.getAttribute("data-spark-module-id");
      if (id) {
        applySelection([id]);
        post("select", id);
      }
    }
  });

  post("ready");
})();
</script>`;

function inlineScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

export interface RenderOptions {
  preview?: boolean;
}

export function renderPageHtml(
  page: Page,
  project: Project,
  options: RenderOptions = {},
): string {
  const theme = project.theme;
  const keyframeCss: string[] = [];
  const modules = page.modules
    .map((module, index) => {
      const definition = getModuleDefinitionSafe(module.type);
      const keyframe = buildKeyframeAnimation(
        module.keyframes,
        `module-${module.id}`,
      );
      keyframeCss.push(keyframe.css);
      const content = keyframe.wrap(
        definition.renderHtml(module, {
          theme,
          preview: true,
        }),
      );
      const animatedContent = wrapAnimatedHtml(content, module.animations);
      const rect = rectOf(module, page.width, page.height);
      return `<div id="${htmlAttr(module.id)}" class="spark-module" data-spark-module-id="${htmlAttr(module.id)}" data-spark-module-type="${htmlAttr(module.type)}" style="position:absolute;left:${rect.x}px;top:${rect.y}px;width:${module.width}px;height:${module.height}px;z-index:${index + 1};">${animatedContent}</div>`;
    })
    .join("\n");

  const pageKeyframe = buildKeyframeAnimation(
    page.keyframes,
    `page-${page.id}`,
  );
  keyframeCss.push(pageKeyframe.css);
  const customScript = page.customScript?.trim()
    ? `<script${page.scriptLanguage === "typescript" ? ' type="text/typescript"' : ""}>${inlineScript(page.customScript)}</script>`
    : "";
  const pageHtml = `<div class="spark-page">${modules}</div>`;
  const keyframePage = pageKeyframe.wrap(pageHtml);
  const animatedPage = wrapAnimatedHtml(keyframePage, page.animations);
  const previewBridge = options.preview ? PREVIEW_BRIDGE : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(page.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${page.width}px;
    height: ${page.height}px;
    overflow: hidden;
    background: ${htmlAttr(page.background)};
    font-family: ${htmlAttr(theme.fontFamily)};
    color: ${htmlAttr(theme.text)};
    -webkit-font-smoothing: antialiased;
  }
  .spark-page {
    position: relative;
    width: ${page.width}px;
    height: ${page.height}px;
    overflow: hidden;
    background: ${htmlAttr(page.background)};
    --spark-primary: ${htmlAttr(theme.primary)};
    --spark-text: ${htmlAttr(theme.text)};
    --spark-muted: ${htmlAttr(theme.muted)};
    --spark-surface: ${htmlAttr(theme.surface)};
  }
  .spark-module { box-sizing: border-box; }
  .spark-kf-layer { width: 100%; height: 100%; position: relative; }
  ${ANIMATION_CSS}
  ${keyframeCss.join("\n")}
  .spark-wand-hover { outline: 2px solid #6750a4 !important; outline-offset: -2px !important; cursor: crosshair !important; }
  .spark-wand-selected { outline: 2px solid #6750a4 !important; outline-offset: -2px !important; }
  a { color: inherit; }
  input, button, textarea, select { font-family: inherit; }
</style>
</head>
<body>
${animatedPage}
${customScript}
${previewBridge}
</body>
</html>`;
}



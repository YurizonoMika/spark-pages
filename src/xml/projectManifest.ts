import type {
  Page,
  Project,
  ProjectTemplate,
  ProjectType,
  Theme,
} from "../model/types";
import { DEFAULT_THEME } from "../model/defaults";
import { escapeXmlAttr } from "../lib/escape";
import { pageFileMap } from "../lib/ai/projectContext";

export const PROJECT_MANIFEST_FILE = "spark.project.xml";

export interface ManifestPage {
  id: string;
  title: string;
  file: string;
}

export interface ProjectManifest {
  version: 1;
  name: string;
  description: string;
  type: ProjectType;
  template: ProjectTemplate;
  theme: Theme;
  pages: ManifestPage[];
}

export class ProjectManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectManifestError";
  }
}

function attr(value: string): string {
  return `="${escapeXmlAttr(value)}"`;
}

function readAttr(element: Element, name: string): string | null {
  return element.hasAttribute(name) ? element.getAttribute(name) : null;
}

export function serializeProjectManifest(project: Project): string {
  const files = pageFileMap(project);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<spark-project version="1" name${attr(project.name)} type${attr(project.type)} template${attr(project.template)} description${attr(project.description)}>`,
    `  <theme font-family${attr(project.theme.fontFamily)} primary${attr(project.theme.primary)} text${attr(project.theme.text)} muted${attr(project.theme.muted)} surface${attr(project.theme.surface)} />`,
    "  <pages>",
  ];
  for (const page of project.pages) {
    const file = files.get(page.id) ?? page.file ?? `pages/${page.id}.spark`;
    lines.push(
      `    <page id${attr(page.id)} title${attr(page.title)} file${attr(file)} />`,
    );
  }
  lines.push("  </pages>", "</spark-project>", "");
  return lines.join("\n");
}

export function parseProjectManifest(xml: string): ProjectManifest {
  if (!xml.trim()) {
    throw new ProjectManifestError("项目设置文件为空");
  }
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) {
    throw new ProjectManifestError("项目设置 XML 格式错误");
  }
  const root = document.documentElement;
  if (root.tagName !== "spark-project") {
    throw new ProjectManifestError("不是 Spark Pages 项目设置文件");
  }
  const themeElement = Array.from(root.children).find(
    (element) => element.tagName === "theme",
  );
  const type: ProjectType = readAttr(root, "type") === "vue" ? "vue" : "html";
  const template: ProjectTemplate =
    readAttr(root, "template") === "vite-vue-ts" || type === "vue"
      ? "vite-vue-ts"
      : "static";
  const pagesElement = Array.from(root.children).find(
    (element) => element.tagName === "pages",
  );
  const pages: ManifestPage[] = [];
  if (pagesElement) {
    for (const element of Array.from(pagesElement.children)) {
      if (element.tagName !== "page") {
        continue;
      }
      const id = readAttr(element, "id")?.trim();
      const file = readAttr(element, "file")?.trim();
      if (!id || !file) {
        continue;
      }
      pages.push({
        id,
        title: readAttr(element, "title")?.trim() || "未命名页面",
        file,
      });
    }
  }
  return {
    version: 1,
    name: readAttr(root, "name")?.trim() || "未命名项目",
    description: readAttr(root, "description") ?? "",
    type,
    template,
    theme: themeElement
      ? {
          fontFamily:
            readAttr(themeElement, "font-family") ?? DEFAULT_THEME.fontFamily,
          primary: readAttr(themeElement, "primary") ?? DEFAULT_THEME.primary,
          text: readAttr(themeElement, "text") ?? DEFAULT_THEME.text,
          muted: readAttr(themeElement, "muted") ?? DEFAULT_THEME.muted,
          surface:
            readAttr(themeElement, "surface") ?? DEFAULT_THEME.surface,
        }
      : { ...DEFAULT_THEME },
    pages,
  };
}

export function projectFromManifest(
  manifest: ProjectManifest,
  pages: Page[],
): Project {
  return {
    version: 1,
    name: manifest.name,
    description: manifest.description,
    type: manifest.type,
    template: manifest.template,
    theme: manifest.theme,
    pages: pages.length > 0 ? pages : [],
  };
}

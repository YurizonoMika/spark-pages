import type { Page, Project } from "../../model/types";

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 48);
}

function fallbackSlug(page: Page): string {
  const id = page.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toLowerCase();
  return id ? `page-${id}` : "page";
}

export function pageSlugs(project: Project): Map<string, string> {
  const taken = new Set<string>();
  const result = new Map<string, string>();
  for (const page of project.pages) {
    const base = sanitizeSlug(page.title) || fallbackSlug(page);
    let slug = base;
    let suffix = 2;
    while (taken.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    taken.add(slug);
    result.set(page.id, slug);
  }
  return result;
}

export function pageSlug(project: Project, page: Page): string {
  return (
    pageSlugs(project).get(page.id) ?? fallbackSlug(page)
  );
}

export function projectTypeLabel(project: Project): string {
  return project.type === "vue" ? "Vue + TS" : "HTML + JS";
}

export function projectTemplateLabel(project: Project): string {
  return project.template === "vite-vue-ts"
    ? "Vite + Vue 3 + TypeScript"
    : "静态 HTML + JS";
}

export function pageCodeDirectory(project: Project, slug: string): string {
  return project.type === "vue" ? `src/pages/${slug}` : `pages/${slug}`;
}

export const BUILD_DIRECTORY = "build";

export function projectBuildRoot(folder: string): string {
  return `${folder.replace(/[\\/]+$/, "")}/${BUILD_DIRECTORY}`;
}

export function buildExistingFiles(
  entries: Array<{ path: string; isDir: boolean }>,
): string[] {
  const prefix = `${BUILD_DIRECTORY}/`;
  return entries
    .filter((entry) => !entry.isDir)
    .map((entry) => entry.path.replaceAll("\\", "/"))
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length));
}

export function pageXmlPath(project: Project, page: Page): string {
  return `${pageCodeDirectory(project, pageSlug(project, page))}/page.spark`;
}

export function projectSettingsSummary(project: Project): string {
  const slugs = pageSlugs(project);
  const pages = project.pages
    .map((page) => {
      const slug = slugs.get(page.id) ?? page.id;
      return `- ${page.title}（${slug}）：${page.width}×${page.height}px，网格 ${page.grid}px，${page.modules.length} 个模块，自定义脚本 ${page.customScript ? (page.scriptLanguage === "typescript" ? "TypeScript" : "JavaScript") : "无"}`;
    })
    .join("\n");

  return `完整项目设置：
- 项目名称：${project.name}
- 项目说明：${project.description || "无"}
- 项目类型：${projectTypeLabel(project)}
- 项目模板：${projectTemplateLabel(project)}
- 主题字体：${project.theme.fontFamily}
- 主色：${project.theme.primary}
- 文字色：${project.theme.text}
- 次要色：${project.theme.muted}
- 表面色：${project.theme.surface}

页面清单：
${pages}`;
}

export function pageSettingsSummary(
  project: Project,
  page: Page,
  slug: string,
): string {
  return `当前页面设置：
- 标题：${page.title}
- 页面 slug：${slug}
- 页面文件目录：${pageCodeDirectory(project, slug)}
- 尺寸：${page.width}×${page.height}px
- 网格：${page.grid}px
- 背景：${page.background}
- 模块数：${page.modules.length}
- 自定义脚本：${page.customScript ? `${page.scriptLanguage === "typescript" ? "TypeScript" : "JavaScript"}（见 XML）` : "无"}`;
}

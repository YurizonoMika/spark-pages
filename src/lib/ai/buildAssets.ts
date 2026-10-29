import type { Page, Project } from "../../model/types";
import { pageCodeDirectory, pageSlugs } from "./projectContext";

export interface BuildImageAsset {
  /** Path relative to the build root. */
  path: string;
  /** Path written into the page markup, relative to the page directory. */
  src: string;
  dataUrl: string;
  pageId: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

function extensionFor(dataUrl: string): string {
  const mime = /^data:([^;,]+)[;,]/.exec(dataUrl)?.[1] ?? "";
  return MIME_EXTENSIONS[mime] ?? "png";
}

function safeFileBase(value: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "image"
  );
}

export interface ExtractedBuildAssets {
  project: Project;
  assets: BuildImageAsset[];
}

/**
 * Replace embedded image data URLs with short, page-relative asset paths
 * before building, so AI prompts stay small. The returned assets are written
 * next to the generated page files.
 */
export function extractBuildAssets(project: Project): ExtractedBuildAssets {
  const cloned = structuredClone(project);
  const slugs = pageSlugs(project);
  const assets: BuildImageAsset[] = [];
  const usedNames = new Set<string>();

  for (const page of cloned.pages) {
    const directory = pageCodeDirectory(
      project,
      slugs.get(page.id) ?? page.id,
    );
    for (const module of page.modules) {
      if (module.type !== "core.image") {
        continue;
      }
      const src = module.props.src;
      if (typeof src !== "string" || !src.startsWith("data:image/")) {
        continue;
      }
      const extension = extensionFor(src);
      const base = safeFileBase(module.id);
      let name = `${base}.${extension}`;
      let suffix = 2;
      while (usedNames.has(`${page.id}:${name}`)) {
        name = `${base}-${suffix}.${extension}`;
        suffix += 1;
      }
      usedNames.add(`${page.id}:${name}`);
      const relativeSrc = `./assets/images/${name}`;
      module.props.src = relativeSrc;
      assets.push({
        path: `${directory}/assets/images/${name}`,
        src: relativeSrc,
        dataUrl: src,
        pageId: page.id,
      });
    }
  }

  return { project: cloned, assets };
}

export function pageAssets(
  assets: BuildImageAsset[],
  page: Page,
): BuildImageAsset[] {
  return assets.filter((asset) => asset.pageId === page.id);
}

/**
 * Vue projects generate preview.html files for the in-app preview. Since those
 * are opened via srcDoc, relative image paths must be inlined as data URLs.
 */
export function inlinePreviewAssets<T extends { path: string; content: string }>(
  files: T[],
  assets: BuildImageAsset[],
): T[] {
  if (assets.length === 0) {
    return files;
  }
  return files.map((file) => {
    if (!file.path.endsWith("preview.html")) {
      return file;
    }
    const directory = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    const pageAssets = assets.filter((asset) =>
      asset.path.startsWith(directory),
    );
    if (pageAssets.length === 0) {
      return file;
    }
    let content = file.content;
    for (const asset of pageAssets) {
      content = content.replaceAll(asset.src, asset.dataUrl);
    }
    return { ...file, content };
  });
}

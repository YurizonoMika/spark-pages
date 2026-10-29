import type { ModuleNode, Rect, ResizeHandle } from "../model/types";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function snapDown(value: number, grid: number): number {
  return Math.floor(value / grid) * grid;
}

export function ceilToGrid(value: number, grid: number): number {
  return Math.ceil(value / grid) * grid;
}

export function rectOf(
  module: ModuleNode,
  pageWidth: number,
  pageHeight: number,
): Rect {
  const x =
    (module.anchorX ?? "left") === "right"
      ? pageWidth - module.x - module.width
      : module.x;
  const y =
    (module.anchorY ?? "top") === "bottom"
      ? pageHeight - module.y - module.height
      : module.y;
  return {
    x,
    y,
    width: module.width,
    height: module.height,
  };
}

export function moduleBounds(
  modules: ModuleNode[],
  pageWidth: number,
  pageHeight: number,
): Rect {
  if (modules.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const rects = modules.map((module) => rectOf(module, pageWidth, pageHeight));
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function rectToAnchored(
  module: ModuleNode,
  pageWidth: number,
  pageHeight: number,
  rect: Rect,
): { x: number; y: number; width: number; height: number } {
  const x =
    (module.anchorX ?? "left") === "right"
      ? pageWidth - rect.x - rect.width
      : rect.x;
  const y =
    (module.anchorY ?? "top") === "bottom"
      ? pageHeight - rect.y - rect.height
      : rect.y;
  return { x, y, width: rect.width, height: rect.height };
}

export function offsetAnchored(
  module: ModuleNode,
  dx: number,
  dy: number,
): { x: number; y: number } {
  return {
    x: module.x + ((module.anchorX ?? "left") === "right" ? -dx : dx),
    y: module.y + ((module.anchorY ?? "top") === "bottom" ? -dy : dy),
  };
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x <= rect.x + rect.width &&
    y <= rect.y + rect.height
  );
}

export function clampRectToPage(rect: Rect, pageWidth: number): Rect {
  const width = Math.min(Math.max(rect.width, 0), pageWidth);
  const x = clamp(rect.x, 0, pageWidth - width);
  const y = Math.max(rect.y, 0);
  return { x, y, width, height: Math.max(rect.height, 0) };
}

export interface ResizeOptions {
  grid: number;
  minWidth: number;
  minHeight: number;
  pageWidth: number;
}

export function resizeRect(
  start: Rect,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  options: ResizeOptions,
): Rect {
  const { grid, pageWidth } = options;
  const minWidth = Math.max(grid, ceilToGrid(options.minWidth, grid));
  const minHeight = Math.max(grid, ceilToGrid(options.minHeight, grid));

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle.includes("w")) {
    left = snap(left + deltaX, grid);
  }
  if (handle.includes("e")) {
    right = snap(right + deltaX, grid);
  }
  if (handle.includes("n")) {
    top = snap(top + deltaY, grid);
  }
  if (handle.includes("s")) {
    bottom = snap(bottom + deltaY, grid);
  }

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(pageWidth, right);

  if (right - left < minWidth) {
    if (handle.includes("w")) {
      left = right - minWidth;
    } else {
      right = left + minWidth;
    }
  }

  if (bottom - top < minHeight) {
    if (handle.includes("n")) {
      top = bottom - minHeight;
    } else {
      bottom = top + minHeight;
    }
  }

  if (left < 0) {
    left = 0;
    right = Math.max(right, left + minWidth);
  }
  if (right > pageWidth) {
    right = pageWidth;
    left = Math.min(left, right - minWidth);
  }
  if (top < 0) {
    top = 0;
    bottom = Math.max(bottom, top + minHeight);
  }

  return {
    x: left,
    y: top,
    width: Math.max(right - left, minWidth),
    height: Math.max(bottom - top, minHeight),
  };
}

export function fitZoom(
  pageWidth: number,
  pageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 96,
): number {
  const availableWidth = Math.max(viewportWidth - padding, 200);
  const availableHeight = Math.max(viewportHeight - padding, 200);
  return clamp(
    Math.min(availableWidth / pageWidth, availableHeight / pageHeight, 1),
    MIN_ZOOM,
    MAX_ZOOM,
  );
}

export function pagePointFromClient(
  clientX: number,
  clientY: number,
  pageRect: DOMRect,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (clientX - pageRect.left) / zoom,
    y: (clientY - pageRect.top) / zoom,
  };
}

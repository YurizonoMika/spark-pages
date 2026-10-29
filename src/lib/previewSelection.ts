export interface PreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Maps a click in the parent window to coordinates inside the scaled preview iframe. */
export function previewPointFromClient(
  clientX: number,
  clientY: number,
  rect: PreviewRect,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: ((clientX - rect.left) / rect.width) * pageWidth,
    y: ((clientY - rect.top) / rect.height) * pageHeight,
  };
}

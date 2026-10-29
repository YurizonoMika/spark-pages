import { describe, expect, it } from "vitest";
import { previewPointFromClient } from "./previewSelection";

describe("previewPointFromClient", () => {
  const rect = { left: 100, top: 50, width: 600, height: 600 };

  it("maps scaled preview coordinates back to page coordinates", () => {
    expect(previewPointFromClient(100, 50, rect, 1200, 1200)).toEqual({
      x: 0,
      y: 0,
    });
    expect(previewPointFromClient(400, 350, rect, 1200, 600)).toEqual({
      x: 600,
      y: 300,
    });
    expect(previewPointFromClient(700, 650, rect, 1200, 1200)).toEqual({
      x: 1200,
      y: 1200,
    });
  });

  it("returns null for a collapsed preview", () => {
    expect(
      previewPointFromClient(10, 10, { ...rect, width: 0 }, 1200, 1200),
    ).toBeNull();
    expect(
      previewPointFromClient(10, 10, { ...rect, height: 0 }, 1200, 1200),
    ).toBeNull();
  });
});

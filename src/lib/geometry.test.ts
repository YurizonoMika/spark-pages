import { describe, expect, it } from "vitest";
import {
  clamp,
  fitZoom,
  moduleBounds,
  rectOf,
  resizeRect,
  snap,
} from "./geometry";

describe("geometry", () => {
  it("snaps values to the grid", () => {
    expect(snap(7, 16)).toBe(0);
    expect(snap(8, 16)).toBe(16);
    expect(snap(-17, 16)).toBe(-16);
  });

  it("clamps values", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
  });

  it("computes module bounds", () => {
    expect(
      moduleBounds(
        [
          { id: "a", type: "core.box", x: 16, y: 32, width: 64, height: 48, props: {} },
          { id: "b", type: "core.box", x: 96, y: 16, width: 32, height: 32, props: {} },
        ],
        1200,
        1200,
      ),
    ).toEqual({ x: 16, y: 16, width: 112, height: 64 });
  });

  it("resolves right/bottom anchors to absolute rectangles", () => {
    const module = {
      id: "m",
      type: "core.box",
      x: 100,
      y: 80,
      width: 200,
      height: 100,
      props: {},
      anchorX: "right" as const,
      anchorY: "bottom" as const,
    };
    expect(rectOf(module, 1200, 900)).toEqual({
      x: 900,
      y: 720,
      width: 200,
      height: 100,
    });
  });

  it("resizes from the south-east handle with snapping", () => {
    expect(
      resizeRect(
        { x: 16, y: 16, width: 160, height: 80 },
        "se",
        30,
        17,
        { grid: 16, minWidth: 32, minHeight: 32, pageWidth: 1200 },
      ),
    ).toEqual({ x: 16, y: 16, width: 192, height: 96 });
  });

  it("keeps the minimum size when resizing from the north-west", () => {
    const result = resizeRect(
      { x: 64, y: 64, width: 64, height: 64 },
      "nw",
      100,
      100,
      { grid: 16, minWidth: 32, minHeight: 32, pageWidth: 1200 },
    );
    expect(result.width).toBeGreaterThanOrEqual(32);
    expect(result.height).toBeGreaterThanOrEqual(32);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it("fits a page into a viewport", () => {
    expect(fitZoom(1200, 1200, 900, 700)).toBeLessThan(1);
    expect(fitZoom(400, 300, 900, 700)).toBe(1);
  });
});

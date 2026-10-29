import { create } from "zustand";

const STORAGE_KEY = "spark-pages:layout:v1";

export const DEFAULT_LEFT_WIDTH = 352;
export const DEFAULT_RIGHT_WIDTH = 304;
export const LEFT_MIN_WIDTH = 280;
export const LEFT_MAX_WIDTH = 480;
export const RIGHT_MIN_WIDTH = 280;
export const RIGHT_MAX_WIDTH = 520;
export const MIN_WORKSPACE_WIDTH = 360;
const RESIZER_WIDTH = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function maxLeft(viewport: number, right: number): number {
  return Math.max(
    LEFT_MIN_WIDTH,
    Math.min(LEFT_MAX_WIDTH, viewport - right - MIN_WORKSPACE_WIDTH - RESIZER_WIDTH),
  );
}

function maxRight(viewport: number, left: number): number {
  return Math.max(
    RIGHT_MIN_WIDTH,
    Math.min(
      RIGHT_MAX_WIDTH,
      viewport - left - MIN_WORKSPACE_WIDTH - RESIZER_WIDTH,
    ),
  );
}

function loadWidths(): { leftWidth: number; rightWidth: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        leftWidth?: unknown;
        rightWidth?: unknown;
      };
      return {
        leftWidth: clamp(
          typeof parsed.leftWidth === "number"
            ? parsed.leftWidth
            : DEFAULT_LEFT_WIDTH,
          LEFT_MIN_WIDTH,
          LEFT_MAX_WIDTH,
        ),
        rightWidth: clamp(
          typeof parsed.rightWidth === "number"
            ? parsed.rightWidth
            : DEFAULT_RIGHT_WIDTH,
          RIGHT_MIN_WIDTH,
          RIGHT_MAX_WIDTH,
        ),
      };
    }
  } catch {
    // Ignore invalid layout state.
  }
  return { leftWidth: DEFAULT_LEFT_WIDTH, rightWidth: DEFAULT_RIGHT_WIDTH };
}

function persist(leftWidth: number, rightWidth: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftWidth, rightWidth }));
  } catch {
    // Layout persistence is best effort.
  }
}

interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  clampForViewport: (viewport: number) => void;
}

const initial = loadWidths();

export const useLayoutStore = create<LayoutState>()((set, get) => ({
  ...initial,
  setLeftWidth(width) {
    const viewport = typeof window === "undefined" ? 1440 : window.innerWidth;
    const rightWidth = get().rightWidth;
    const next = clamp(
      width,
      LEFT_MIN_WIDTH,
      maxLeft(viewport, rightWidth),
    );
    set({ leftWidth: next });
    persist(next, rightWidth);
  },
  setRightWidth(width) {
    const viewport = typeof window === "undefined" ? 1440 : window.innerWidth;
    const leftWidth = get().leftWidth;
    const next = clamp(
      width,
      RIGHT_MIN_WIDTH,
      maxRight(viewport, leftWidth),
    );
    set({ rightWidth: next });
    persist(leftWidth, next);
  },
  clampForViewport(viewport) {
    let leftWidth = clamp(
      get().leftWidth,
      LEFT_MIN_WIDTH,
      LEFT_MAX_WIDTH,
    );
    let rightWidth = clamp(
      get().rightWidth,
      RIGHT_MIN_WIDTH,
      RIGHT_MAX_WIDTH,
    );
    const available = viewport - MIN_WORKSPACE_WIDTH - RESIZER_WIDTH;
    if (leftWidth + rightWidth > available) {
      let excess = leftWidth + rightWidth - available;
      const rightReduction = Math.min(
        excess,
        Math.max(rightWidth - RIGHT_MIN_WIDTH, 0),
      );
      rightWidth -= rightReduction;
      excess -= rightReduction;
      leftWidth = Math.max(LEFT_MIN_WIDTH, leftWidth - excess);
    }
    set({ leftWidth, rightWidth });
    persist(leftWidth, rightWidth);
  },
}));

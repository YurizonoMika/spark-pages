import { create } from "zustand";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "spark-pages:theme:v1";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): ResolvedTheme {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

function loadMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
      return raw;
    }
  } catch {
    // Ignore inaccessible storage.
  }
  return "system";
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) {
    meta.content = theme === "dark" ? "#141218" : "#f7f2fa";
  }
}

function syncWindowTheme(theme: ResolvedTheme): void {
  if (!isTauri()) {
    return;
  }
  try {
    void getCurrentWindow()
      .setTheme(theme)
      .catch(() => {
        // The native title bar can keep its current theme if this is unavailable.
      });
  } catch {
    // The webview may not expose the window API in every environment.
  }
}

function persistMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Theme persistence is best effort.
  }
}

const initialMode = loadMode();
const initialTheme = resolveTheme(initialMode, systemPrefersDark());

applyTheme(initialTheme);
syncWindowTheme(initialTheme);

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: initialMode,
  resolved: initialTheme,
  setMode(mode) {
    const resolved = resolveTheme(mode, systemPrefersDark());
    persistMode(mode);
    applyTheme(resolved);
    syncWindowTheme(resolved);
    set({ mode, resolved });
  },
  toggle() {
    get().setMode(get().resolved === "dark" ? "light" : "dark");
  },
}));

if (
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function"
) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    const state = useThemeStore.getState();
    if (state.mode !== "system") {
      return;
    }
    const resolved = resolveTheme("system", media.matches);
    applyTheme(resolved);
    syncWindowTheme(resolved);
    useThemeStore.setState({ resolved });
  });
}

import { create } from "zustand";

const STORAGE_KEY = "spark-pages:ai:v1";

export interface AiConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  baseUrl: "",
  model: "",
  temperature: 0.3,
  maxTokens: 12000,
};

function loadConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AI_CONFIG };
    }
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      baseUrl:
        typeof parsed.baseUrl === "string"
          ? parsed.baseUrl
          : DEFAULT_AI_CONFIG.baseUrl,
      model:
        typeof parsed.model === "string" ? parsed.model : DEFAULT_AI_CONFIG.model,
      temperature:
        typeof parsed.temperature === "number" &&
        Number.isFinite(parsed.temperature)
          ? parsed.temperature
          : DEFAULT_AI_CONFIG.temperature,
      maxTokens:
        typeof parsed.maxTokens === "number" && parsed.maxTokens > 0
          ? Math.round(parsed.maxTokens)
          : DEFAULT_AI_CONFIG.maxTokens,
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

interface AiSettingsState extends AiConfig {
  keyConfigured: boolean;
  setConfig: (patch: Partial<AiConfig>) => void;
  setKeyConfigured: (configured: boolean) => void;
}

export const useAiSettingsStore = create<AiSettingsState>()((set, get) => ({
  ...loadConfig(),
  keyConfigured: false,
  setConfig(patch) {
    const next: AiConfig = {
      baseUrl: patch.baseUrl ?? get().baseUrl,
      model: patch.model ?? get().model,
      temperature: patch.temperature ?? get().temperature,
      maxTokens: patch.maxTokens ?? get().maxTokens,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Settings persistence is best effort.
    }
    set(next);
  },
  setKeyConfigured(configured) {
    set({ keyConfigured: configured });
  },
}));

export function aiConfigReady(config: AiConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.model.trim());
}

export function isLocalAiEndpoint(baseUrl: string): boolean {
  return (
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("[::1]")
  );
}

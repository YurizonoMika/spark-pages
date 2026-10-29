import { create } from "zustand";

export interface ChatToolTrace {
  id: string;
  name: string;
  label: string;
  args: string;
  status: "running" | "success" | "error";
  summary: string;
  result?: string;
  error?: string;
}

export interface UiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces?: ChatToolTrace[];
  attachments?: string[];
  createdAt: number;
}

const STORAGE_PREFIX = "spark-pages:chat:v1:";

function storageKey(projectKey: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(projectKey)}`;
}

function loadMessages(projectKey: string): UiChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(projectKey));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is UiChatMessage =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as UiChatMessage).id === "string" &&
        ((item as UiChatMessage).role === "user" ||
          (item as UiChatMessage).role === "assistant") &&
        typeof (item as UiChatMessage).content === "string",
    );
  } catch {
    return [];
  }
}

function saveMessages(projectKey: string, messages: UiChatMessage[]): void {
  try {
    localStorage.setItem(
      storageKey(projectKey),
      JSON.stringify(messages.slice(-80)),
    );
  } catch {
    // Chat persistence is best effort.
  }
}

interface AiChatState {
  projectKey: string;
  messages: UiChatMessage[];
  busy: boolean;
  status: string;
  load: (projectKey: string) => void;
  append: (message: UiChatMessage) => void;
  update: (id: string, patch: Partial<UiChatMessage>) => void;
  addTrace: (messageId: string, trace: ChatToolTrace) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
  clear: () => void;
}

const initialKey = "draft";

export const useAiChatStore = create<AiChatState>()((set, get) => ({
  projectKey: initialKey,
  messages: loadMessages(initialKey),
  busy: false,
  status: "",
  load(projectKey) {
    if (get().projectKey === projectKey) {
      return;
    }
    set({
      projectKey,
      messages: loadMessages(projectKey),
      busy: false,
      status: "",
    });
  },
  append(message) {
    const state = get();
    const messages = [...state.messages, message].slice(-80);
    saveMessages(state.projectKey, messages);
    set({ messages });
  },
  update(id, patch) {
    const state = get();
    const messages = state.messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    );
    saveMessages(state.projectKey, messages);
    set({ messages });
  },
  addTrace(messageId, trace) {
    const state = get();
    const messages = state.messages.map((message) =>
      message.id === messageId
        ? { ...message, traces: [...(message.traces ?? []), trace] }
        : message,
    );
    saveMessages(state.projectKey, messages);
    set({ messages });
  },
  setBusy(busy) {
    set({ busy });
  },
  setStatus(status) {
    set({ status });
  },
  clear() {
    const state = get();
    try {
      localStorage.removeItem(storageKey(state.projectKey));
    } catch {
      // Ignore storage failures.
    }
    set({ messages: [], status: "" });
  },
}));

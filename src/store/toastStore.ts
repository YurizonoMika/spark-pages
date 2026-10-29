import { create } from "zustand";
import { nanoid } from "nanoid";

export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  items: [],
  push(message, kind = "info") {
    const item: ToastItem = { id: nanoid(8), message, kind };
    set((state) => ({ items: [...state.items, item].slice(-4) }));
  },
  dismiss(id) {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },
}));

export function toast(message: string, kind: ToastKind = "info"): void {
  useToastStore.getState().push(message, kind);
}

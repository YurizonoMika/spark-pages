import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";
import { useToastStore, type ToastItem } from "../../store/toastStore";

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), 3600);
    return () => window.clearTimeout(timer);
  }, [dismiss, item.id]);

  const Icon =
    item.kind === "success"
      ? CheckCircle2
      : item.kind === "error"
        ? AlertCircle
        : Info;

  return (
    <div className={clsx("toast", `toast-${item.kind}`)} role="status">
      <Icon size={16} />
      <span>{item.message}</span>
      <button type="button" onClick={() => dismiss(item.id)} aria-label="关闭">
        <X size={14} />
      </button>
    </div>
  );
}

export function Toaster() {
  const items = useToastStore((state) => state.items);
  return (
    <div className="toaster">
      {items.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  );
}

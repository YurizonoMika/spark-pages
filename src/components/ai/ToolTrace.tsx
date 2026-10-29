import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { ChatToolTrace } from "../../store/aiChatStore";

export function ToolTrace({ trace }: { trace: ChatToolTrace }) {
  const Icon =
    trace.status === "error"
      ? AlertCircle
      : trace.status === "success"
        ? CheckCircle2
        : Loader2;
  return (
    <details className={clsx("ai-tool-trace", `is-${trace.status}`)}>
      <summary>
        <span className="ai-tool-status">
          <Icon
            size={13}
            className={trace.status === "running" ? "spin" : undefined}
          />
        </span>
        <strong>{trace.label}</strong>
        <small>{trace.summary}</small>
      </summary>
      <pre>{trace.args}</pre>
      {trace.result ? <pre>{trace.result}</pre> : null}
      {trace.error ? <p className="ai-tool-error">{trace.error}</p> : null}
    </details>
  );
}

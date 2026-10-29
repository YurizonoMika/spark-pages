import { useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  Terminal,
} from "lucide-react";
import type { ChatToolTrace } from "../../store/aiChatStore";
import { toast } from "../../store/toastStore";
import { ToolTrace } from "../ai/ToolTrace";

export interface BuildLogEntry {
  id: string;
  kind: "assistant" | "tool";
  text?: string;
  trace?: ChatToolTrace;
}

interface BuildLogPanelProps {
  entries: BuildLogEntry[];
  open: boolean;
  running: boolean;
  onToggle: () => void;
}

function buildLogText(entries: BuildLogEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.kind === "assistant") {
        return `[AI]\n${entry.text ?? ""}`;
      }
      const trace = entry.trace;
      if (!trace) {
        return "";
      }
      return [
        `[工具] ${trace.label} — ${trace.summary}`,
        trace.args,
        trace.result ?? "",
        trace.error ? `错误：${trace.error}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function BuildLogPanel({
  entries,
  open,
  running,
  onToggle,
}: BuildLogPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const body = bodyRef.current;
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [entries, open]);

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(buildLogText(entries));
      toast("AI 输出已复制", "success");
    } catch {
      toast("无法复制到剪贴板", "error");
    }
  };

  return (
    <section className="build-log">
      <header className="build-log-header">
        <button
          type="button"
          className="build-log-toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <Terminal size={14} />
          <strong>AI 输出与 Agent 调用</strong>
          <span className="build-log-count">{entries.length}</span>
          {running ? <span className="build-log-live">实时</span> : null}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          className="btn btn-ghost build-log-copy"
          onClick={() => void copyLog()}
          disabled={entries.length === 0}
        >
          <Copy size={12} />
          复制
        </button>
      </header>
      {open ? (
        <div className="build-log-body" ref={bodyRef}>
          {entries.length === 0 ? (
            <p className="build-log-empty">等待 AI 输出和 Agent 工具调用…</p>
          ) : (
            entries.map((entry) =>
              entry.kind === "assistant" ? (
                <div key={entry.id} className="build-log-assistant">
                  <Sparkles size={13} />
                  <pre>{entry.text}</pre>
                </div>
              ) : entry.trace ? (
                <ToolTrace key={entry.id} trace={entry.trace} />
              ) : null,
            )
          )}
        </div>
      ) : null}
    </section>
  );
}

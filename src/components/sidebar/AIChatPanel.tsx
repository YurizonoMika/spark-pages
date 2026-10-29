import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  ArrowUp,
  Bot,
  Braces,
  FileCode2,
  MousePointer2,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Wrench,
} from "lucide-react";
import clsx from "clsx";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { getModuleDefinitionSafe } from "../../modules/registry";
import { useAiSettingsStore, aiConfigReady } from "../../lib/ai/settings";
import {
  useAiChatStore,
  type UiChatMessage,
} from "../../store/aiChatStore";
import { runAgentTurn } from "../../lib/ai/agent";
import { AGENT_SKILLS, agentSkill } from "../../lib/ai/skills";
import { toast } from "../../store/toastStore";
import { IconButton } from "../ui/IconButton";
import { MarkdownMessage } from "./MarkdownMessage";
import { ToolTrace } from "../ai/ToolTrace";

const capabilities = [
  { icon: Braces, label: "读取页面 XML" },
  { icon: Wrench, label: "插入与修改模块" },
  { icon: MousePointer2, label: "理解魔杖选区" },
  { icon: SlidersHorizontal, label: "调整主题与布局" },
  { icon: FileCode2, label: "读写页面代码" },
];

function MessageBubble({ message }: { message: UiChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ai-message ai-message-user">
        <div className="ai-bubble ai-bubble-user">
          <p>{message.content}</p>
          {message.attachments && message.attachments.length > 0 ? (
            <div className="ai-message-attachments">
              {message.attachments.map((label, index) => (
                <span key={`${label}-${index}`} className="attachment-chip">
                  <MousePointer2 size={11} />
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (
    !message.content &&
    (!message.traces || message.traces.length === 0)
  ) {
    return null;
  }

  return (
    <div className="ai-message ai-message-assistant">
      <div className="ai-avatar">
        <Sparkles size={15} />
      </div>
      <div className="ai-bubble">
        {message.content ? <MarkdownMessage content={message.content} /> : null}
        {message.traces && message.traces.length > 0 ? (
          <div className="ai-tool-traces">
            {message.traces.map((trace) => (
              <ToolTrace key={`${trace.id}-${trace.name}`} trace={trace} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AIChatPanel() {
  const page = useEditorStore(selectActivePage);
  const project = useEditorStore((state) => state.project);
  const selection = useEditorStore((state) => state.selection);
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);
  const messages = useAiChatStore((state) => state.messages);
  const busy = useAiChatStore((state) => state.busy);
  const status = useAiChatStore((state) => state.status);
  const loadChat = useAiChatStore((state) => state.load);
  const append = useAiChatStore((state) => state.append);
  const update = useAiChatStore((state) => state.update);
  const addTrace = useAiChatStore((state) => state.addTrace);
  const setBusy = useAiChatStore((state) => state.setBusy);
  const setStatus = useAiChatStore((state) => state.setStatus);
  const clear = useAiChatStore((state) => state.clear);

  const baseUrl = useAiSettingsStore((state) => state.baseUrl);
  const model = useAiSettingsStore((state) => state.model);
  const temperature = useAiSettingsStore((state) => state.temperature);
  const maxTokens = useAiSettingsStore((state) => state.maxTokens);
  const configured = aiConfigReady({ baseUrl, model, temperature, maxTokens });

  const [draft, setDraft] = useState("");
  const [skillId, setSkillId] = useState("general");
  const cancelRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const projectKey = project.pages[0]?.id ?? "draft";

  useEffect(() => {
    loadChat(projectKey);
  }, [loadChat, projectKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  const selectedModules = page.modules.filter((module) =>
    selection.includes(module.id),
  );
  const skill = agentSkill(skillId);

  const send = async () => {
    if (busy) {
      return;
    }
    if (!configured) {
      toast("请先在设置中配置模型和 API Key", "info");
      setSettingsOpen(true, "ai");
      return;
    }
    const userText = draft.trim();
    if (!userText) {
      return;
    }

    const history = messages
      .filter((message) => message.content.trim())
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
    const selectedIds = [...selection];
    const attachments = selectedModules.map(
      (module) => getModuleDefinitionSafe(module.type).label,
    );
    const userMessage: UiChatMessage = {
      id: nanoid(10),
      role: "user",
      content: userText,
      attachments,
      createdAt: Date.now(),
    };
    const assistantId = nanoid(10);
    const assistantMessage: UiChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      traces: [],
      createdAt: Date.now(),
    };

    const historyBase = useEditorStore.getState().past.length;
    append(userMessage);
    append(assistantMessage);
    setDraft("");
    setBusy(true);
    setStatus("Agent 正在思考…");
    cancelRef.current = false;

    try {
      const result = await runAgentTurn({
        config: { baseUrl, model, temperature, maxTokens },
        skillId,
        history,
        userText,
        selectedModuleIds: selectedIds,
        onStatus: setStatus,
        onTrace: (trace) => addTrace(assistantId, trace),
        isCancelled: () => cancelRef.current,
      });
      update(assistantId, {
        content: result.content || "已完成页面修改。",
      });
    } catch (error) {
      update(assistantId, {
        content: `请求失败：${error instanceof Error ? error.message : "未知错误"}`,
      });
      toast(
        error instanceof Error ? error.message : "Agent 请求失败",
        "error",
      );
    } finally {
      useEditorStore.getState().groupHistorySince(historyBase);
      setBusy(false);
      setStatus("");
      cancelRef.current = false;
    }
  };

  const stop = () => {
    cancelRef.current = true;
    setStatus("正在停止…");
  };

  const clearChat = () => {
    if (busy) {
      return;
    }
    clear();
    toast("对话已清空", "info");
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="ai-panel">
      <div className="ai-chat-toolbar">
        <span
          className={clsx("ai-model-chip", configured && "is-ready")}
        >
          <Bot size={13} />
          {configured ? model : "未配置模型"}
        </span>
        <div className="ai-chat-actions">
          <IconButton
            label="模型设置"
            onClick={() => setSettingsOpen(true, "ai")}
          >
            <Settings2 size={15} />
          </IconButton>
          <IconButton
            label="清空对话"
            onClick={clearChat}
            disabled={busy || messages.length === 0}
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      <div className="ai-messages">
        {showWelcome ? (
          <>
            <div className="ai-message ai-message-assistant">
              <div className="ai-avatar">
                <Sparkles size={15} />
              </div>
              <div className="ai-bubble">
                <p>
                  我是 Spark Pages 的页面 Agent。我会通过工具直接读取和修改当前页面，
                  修改会实时反映到画板，并且可以撤销。
                </p>
                <div className="capability-grid">
                  {capabilities.map((capability) => {
                    const Icon = capability.icon;
                    return (
                      <span key={capability.label} className="capability-chip">
                        <Icon size={13} />
                        {capability.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {!configured ? (
              <div className="ai-runtime-notice">
                <Bot size={16} />
                <div>
                  <strong>还没有配置模型</strong>
                  <p>
                    在模型设置中填写 OpenAI 兼容的 Base URL、模型名称和 API
                    Key，然后就可以通过对话修改页面。
                  </p>
                  <button
                    type="button"
                    className="ai-setup-button"
                    onClick={() => setSettingsOpen(true, "ai")}
                  >
                    配置模型
                  </button>
                </div>
              </div>
            ) : (
              <div className="ai-start-hint">
                试试：「把当前页面改成深色科技风」或「帮我生成一个产品落地页」
              </div>
            )}
          </>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {busy ? (
          <div className="ai-message ai-message-assistant">
            <div className="ai-avatar">
              <Sparkles size={15} />
            </div>
            <div className="ai-bubble ai-bubble-pending">
              <span className="ai-typing">
                <span />
                <span />
                <span />
              </span>
              <small>{status || "正在处理…"}</small>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="ai-composer">
        {selectedModules.length > 0 ? (
          <div className="attachment-list">
            <span className="attachment-label">魔杖选区</span>
            {selectedModules.map((module) => {
              const definition = getModuleDefinitionSafe(module.type);
              return (
                <span key={module.id} className="attachment-chip">
                  <MousePointer2 size={12} />
                  {definition.label}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className={clsx("composer-box", (!configured || busy) && "is-disabled")}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              configured
                ? "描述你想修改的内容…"
                : "请先在设置中配置模型"
            }
            rows={3}
            disabled={!configured || busy}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-footer">
            <label className="agent-skill">
              <span>技能</span>
              <select
                value={skillId}
                onChange={(event) => setSkillId(event.target.value)}
                disabled={busy}
                title={skill.description}
              >
                {AGENT_SKILLS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="composer-config"
              onClick={() => setSettingsOpen(true, "ai")}
            >
              {configured ? "模型设置" : "配置模型"}
            </button>
            <button
              type="button"
              className="composer-send"
              disabled={busy ? false : !draft.trim() || !configured}
              onClick={() => (busy ? stop() : void send())}
              aria-label={busy ? "停止" : "发送"}
              title={busy ? "停止" : "发送"}
            >
              {busy ? <Square size={13} /> : <ArrowUp size={15} />}
            </button>
          </div>
        </div>
        <p className="composer-hint">
          ↵ 发送 · Shift+↵ 换行 · 选中模块可附加到消息
        </p>
      </div>
    </div>
  );
}

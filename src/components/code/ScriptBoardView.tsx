import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { Page, ScriptBlock } from "../../model/types";
import { scriptBlockTemplate } from "../../model/scriptBoard";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import {
  aiConfigReady,
  useAiSettingsStore,
} from "../../lib/ai/settings";
import { generateScriptFromBoard } from "../../lib/ai/scriptBoard";
import { toast } from "../../store/toastStore";
import { Modal } from "../ui/Modal";

function edgePath(from: ScriptBlock, to: ScriptBlock): string {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const middle = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
}

function pendingPath(from: ScriptBlock, x: number, y: number): string {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const middle = (y1 + y) / 2;
  return `M ${x1} ${y1} C ${x1} ${middle}, ${x} ${middle}, ${x} ${y}`;
}

export function ScriptBoardView({ page }: { page: Page }) {
  const activePage = useEditorStore(selectActivePage);
  const updateScriptBlockTransient = useEditorStore(
    (state) => state.updateScriptBlockTransient,
  );
  const removeScriptBlock = useEditorStore(
    (state) => state.removeScriptBlock,
  );
  const connectScriptBlocks = useEditorStore(
    (state) => state.connectScriptBlocks,
  );
  const removeScriptConnection = useEditorStore(
    (state) => state.removeScriptConnection,
  );
  const clearScriptBoard = useEditorStore(
    (state) => state.clearScriptBoard,
  );
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const endTransaction = useEditorStore((state) => state.endTransaction);
  const updatePageCode = useEditorStore((state) => state.updatePageCode);
  const setScriptView = useEditorStore((state) => state.setScriptView);
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);
  const baseUrl = useAiSettingsStore((state) => state.baseUrl);
  const model = useAiSettingsStore((state) => state.model);
  const temperature = useAiSettingsStore((state) => state.temperature);
  const maxTokens = useAiSettingsStore((state) => state.maxTokens);

  const board = page.scriptBoard ?? { blocks: [], connections: [] };
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const canvasWidth = Math.max(
    1600,
    ...board.blocks.map((block) => block.x + block.width + 280),
  );
  const canvasHeight = Math.max(
    1000,
    ...board.blocks.map((block) => block.y + block.height + 280),
  );
  const blockById = new Map(board.blocks.map((block) => [block.id, block]));
  const pendingBlock = pendingFrom ? blockById.get(pendingFrom) : undefined;

  const startDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    block: ScriptBlock,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    beginTransaction();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = block.x;
    const originY = block.y;
    const move = (moveEvent: PointerEvent) => {
      updateScriptBlockTransient(block.id, {
        x: Math.max(0, originX + moveEvent.clientX - startX),
        y: Math.max(0, originY + moveEvent.clientY - startY),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      endTransaction();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const handleTail = (id: string) => {
    setPendingFrom((current) => (current === id ? null : id));
  };

  const handleHead = (id: string) => {
    if (!pendingFrom) {
      return;
    }
    if (pendingFrom === id) {
      setPendingFrom(null);
      return;
    }
    const connected = connectScriptBlocks(pendingFrom, id);
    if (!connected) {
      toast("无法连接：已经存在相同连线", "info");
    }
    setPendingFrom(null);
    setPointer(null);
  };

  const cancelPending = () => {
    setPendingFrom(null);
    setPointer(null);
  };

  const openAi = () => {
    if (!aiConfigReady({ baseUrl, model, temperature, maxTokens })) {
      toast("请先在设置中配置模型", "info");
      setSettingsOpen(true, "ai");
      return;
    }
    if (board.blocks.length === 0) {
      toast("请先从左侧积木库添加积木", "info");
      return;
    }
    setAiError(null);
    setAiOpen(true);
  };

  const generate = async () => {
    setGenerating(true);
    setAiError(null);
    try {
      const code = await generateScriptFromBoard(
        activePage,
        { baseUrl, model, temperature, maxTokens },
        instruction,
      );
      updatePageCode(activePage.id, { customScript: code });
      setAiOpen(false);
      setScriptView("code");
      toast("AI 已生成页面脚本", "success");
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "AI 生成代码失败",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="script-board-view">
      <div className="script-board-toolbar">
        <div className="script-board-meta">
          <span>{board.blocks.length} 个积木</span>
          <span>{board.connections.length} 条连接</span>
          <small>点击尾部端点再点击头部端点连线</small>
        </div>
        <div className="script-board-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (
                board.blocks.length > 0 &&
                window.confirm("清空整个脚本画板？")
              ) {
                clearScriptBoard();
                cancelPending();
              }
            }}
            disabled={board.blocks.length === 0}
          >
            <Trash2 size={13} />
            清空
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={openAi}
            disabled={board.blocks.length === 0 || generating}
          >
            {generating ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <Sparkles size={14} />
            )}
            AI 生成代码
          </button>
        </div>
      </div>

      <div className="script-board-scroll">
        <div
          ref={canvasRef}
          className="script-board-canvas"
          style={{ width: canvasWidth, height: canvasHeight }}
          onClick={cancelPending}
          onPointerMove={(event) => {
            if (!pendingFrom) {
              return;
            }
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              setPointer({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }
          }}
        >
          <svg
            className="script-board-edges"
            width={canvasWidth}
            height={canvasHeight}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="script-board-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
              </marker>
            </defs>
            {board.connections.map((connection) => {
              const from = blockById.get(connection.from);
              const to = blockById.get(connection.to);
              if (!from || !to) {
                return null;
              }
              return (
                <path
                  key={connection.id}
                  className="script-board-edge"
                  d={edgePath(from, to)}
                  markerEnd="url(#script-board-arrow)"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeScriptConnection(connection.id);
                  }}
                >
                  <title>点击删除这条连接</title>
                </path>
              );
            })}
            {pendingBlock && pointer ? (
              <path
                className="script-board-edge is-pending"
                d={pendingPath(pendingBlock, pointer.x, pointer.y)}
              />
            ) : null}
          </svg>

          {board.blocks.map((block) => {
            const template = scriptBlockTemplate(block.kind);
            return (
              <div
                key={block.id}
                className={clsx(
                  "script-block",
                  `is-${block.kind}`,
                  pendingFrom === block.id && "is-pending-source",
                )}
                style={{
                  left: block.x,
                  top: block.y,
                  width: block.width,
                  height: block.height,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="script-port is-head"
                  title="头部节点：点击连接"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleHead(block.id);
                  }}
                />
                <div
                  className="script-block-head"
                  onPointerDown={(event) => startDrag(event, block)}
                >
                  <span className="script-block-kind">{template.label}</span>
                  <input
                    className="script-block-title"
                    value={block.title}
                    onFocus={beginTransaction}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      updateScriptBlockTransient(block.id, {
                        title: event.target.value,
                      })
                    }
                    onBlur={endTransaction}
                  />
                  <button
                    type="button"
                    className="script-block-delete"
                    title="删除积木"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeScriptBlock(block.id);
                      if (pendingFrom === block.id) {
                        cancelPending();
                      }
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
                <textarea
                  className="script-block-code"
                  spellCheck={false}
                  value={block.code}
                  onFocus={beginTransaction}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    updateScriptBlockTransient(block.id, {
                      code: event.target.value,
                    })
                  }
                  onBlur={endTransaction}
                />
                <button
                  type="button"
                  className="script-port is-tail"
                  title="尾部节点：点击后选择另一个积木的头部"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTail(block.id);
                  }}
                />
              </div>
            );
          })}

          {board.blocks.length === 0 ? (
            <div className="script-board-empty">
              <Link2 size={24} />
              <strong>从左侧积木库添加积木</strong>
              <p>输入代码草稿，连接积木的头尾节点，然后交给 AI 生成完整脚本。</p>
            </div>
          ) : null}
        </div>
      </div>

      {aiOpen ? (
        <Modal
          title="用 AI 生成页面脚本"
          subtitle={`${board.blocks.length} 个积木 · ${board.connections.length} 条连接`}
          icon={<Sparkles size={17} />}
          size="lg"
          dismissable={!generating}
          onClose={() => setAiOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAiOpen(false)}
                disabled={generating}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => void generate()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {generating ? "正在生成…" : "生成并写入脚本"}
              </button>
            </>
          }
        >
          <div className="script-board-ai">
            <p>
              AI 会根据积木内容与连接关系生成完整 JavaScript，并直接写入当前页面的脚本。
              生成后会切换到代码视图。
            </p>
            <label className="trigger-field">
              <span>补充要求（可选）</span>
              <textarea
                rows={4}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="例如：使用事件委托，保留已有变量名，增加错误处理…"
                disabled={generating}
              />
            </label>
            {aiError ? <p className="panel-hint is-error">{aiError}</p> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

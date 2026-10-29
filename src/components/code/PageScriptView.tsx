import { useCallback, useEffect, useRef } from "react";
import { Braces, FileCode2, Info } from "lucide-react";
import clsx from "clsx";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { CodeEditor } from "./CodeEditor";

type ScriptLanguage = "javascript" | "typescript";

const scriptTabs: Array<{
  id: ScriptLanguage;
  label: string;
  icon: typeof FileCode2;
}> = [
  { id: "javascript", label: "JavaScript", icon: Braces },
  { id: "typescript", label: "TypeScript", icon: FileCode2 },
];

export function PageScriptView() {
  const page = useEditorStore(selectActivePage);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const endTransaction = useEditorStore((state) => state.endTransaction);
  const updatePageCode = useEditorStore((state) => state.updatePageCode);
  const updatePageCodeTransient = useEditorStore(
    (state) => state.updatePageCodeTransient,
  );
  const tab: ScriptLanguage = page.scriptLanguage ?? "javascript";
  const scriptReveal = useEditorStore((state) => state.scriptReveal);
  const reveal =
    scriptReveal && scriptReveal.pageId === page.id
      ? scriptReveal
      : null;
  const commitTimerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (commitTimerRef.current === null) {
      return;
    }
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    endTransaction();
  }, [endTransaction]);

  const handleChange = useCallback(
    (next: string) => {
      if (commitTimerRef.current === null) {
        beginTransaction();
      } else {
        window.clearTimeout(commitTimerRef.current);
      }
      updatePageCodeTransient(page.id, {
        customScript: next,
        scriptLanguage: tab,
      });
      commitTimerRef.current = window.setTimeout(() => {
        commitTimerRef.current = null;
        endTransaction();
      }, 700);
    },
    [
      beginTransaction,
      endTransaction,
      page.id,
      tab,
      updatePageCodeTransient,
    ],
  );

  useEffect(() => {
    flush();
  }, [flush, page.id, tab]);

  useEffect(() => () => flush(), [flush]);

  const value = page.customScript ?? "";
  const lineCount = value === "" ? 0 : value.split("\n").length;

  return (
    <main className="workspace">
      <section className="script-view">
        <header className="code-toolbar">
          <div className="script-view-title">
            <Braces size={15} />
            <strong>页面脚本</strong>
            <small>{page.title}</small>
          </div>
          <div className="code-script-switch" role="tablist">
            {scriptTabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  title={item.label}
                  className={clsx(
                    "code-script-button",
                    tab === item.id && "is-active",
                  )}
                  onClick={() => {
                    if (tab !== item.id) {
                      updatePageCode(page.id, {
                        scriptLanguage: item.id,
                      });
                    }
                  }}
                >
                  <Icon size={11} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="code-note">
          <Info size={13} />
          <span>
            {tab === "javascript"
              ? "JavaScript 在 XML 设计稿预览中执行，并会作为构建页面的设计上下文。"
              : "TypeScript 仅作为构建上下文保存，不在 XML 设计稿预览中直接执行。"}
          </span>
        </div>

        <CodeEditor
          key={`${page.id}:${tab}`}
          value={value}
          language={tab}
          onChange={handleChange}
          onBlur={flush}
          reveal={reveal}
        />

        <footer className="code-footer">
          <span className="code-footer-hint">
            {tab === "javascript"
              ? "JavaScript 沙箱执行"
              : "TypeScript 构建上下文"}{" "}
            · 自动保存
          </span>
          <span className="code-position">
            {tab === "javascript" ? "JavaScript" : "TypeScript"} · {lineCount} 行 ·
            Ctrl/⌘+Space 补全
          </span>
        </footer>
      </section>
    </main>
  );
}

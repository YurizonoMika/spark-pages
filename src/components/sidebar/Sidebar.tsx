import {
  Bot,
  Boxes,
  Files,
  FolderTree,
  Layers3,
} from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../../store/editorStore";
import { aiConfigReady, useAiSettingsStore } from "../../lib/ai/settings";
import type { LeftTab } from "../../model/types";
import { AIChatPanel } from "./AIChatPanel";
import { ModulePalette } from "./ModulePalette";
import { LayersPanel } from "./LayersPanel";
import { PagesPanel } from "./PagesPanel";
import { FilePanel } from "../files/FilePanel";

const tabs: Array<{
  id: LeftTab;
  label: string;
  icon: typeof Bot;
}> = [
  { id: "ai", label: "AI", icon: Bot },
  { id: "files", label: "文件", icon: FolderTree },
  { id: "modules", label: "模块", icon: Boxes },
  { id: "layers", label: "图层", icon: Layers3 },
  { id: "pages", label: "页面", icon: Files },
];

const headers: Record<LeftTab, { title: string; subtitle: string }> = {
  ai: { title: "Agent", subtitle: "通过工具编辑页面" },
  files: { title: "项目文件", subtitle: "查看项目文件夹" },
  modules: { title: "模块库", subtitle: "拖拽到画板" },
  layers: { title: "图层", subtitle: "调整顺序与选择" },
  pages: { title: "页面", subtitle: "管理项目页面" },
};

export function Sidebar() {
  const leftTab = useEditorStore((state) => state.leftTab);
  const setLeftTab = useEditorStore((state) => state.setLeftTab);
  const configured = useAiSettingsStore((state) => aiConfigReady(state));
  const projectFolder = useEditorStore((state) => state.projectFolder);
  const header = headers[leftTab];
  const folderName = projectFolder
    ? projectFolder.replace(/[\\/]+$/, "").split(/[\\/]/).pop()
    : null;
  const subtitle =
    leftTab === "files"
      ? folderName ?? "未选择项目文件夹"
      : header.subtitle;

  return (
    <aside className="sidebar">
      <nav className="sidebar-rail" aria-label="侧边栏">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={clsx(
                "rail-button",
                leftTab === tab.id && "is-active",
              )}
              onClick={() => setLeftTab(tab.id)}
              title={tab.label}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <section className="sidebar-panel">
        <header className="panel-header">
          <div>
            <h2>{header.title}</h2>
            <p title={subtitle}>{subtitle}</p>
          </div>
          {leftTab === "ai" ? (
            <span className={clsx("agent-status", configured && "is-ready")}>
              <span
                className={clsx(
                  "agent-status-dot",
                  configured && "is-ready",
                )}
              />
              {configured ? "已配置" : "未连接"}
            </span>
          ) : null}
        </header>

        <div className={clsx("panel-body", leftTab === "files" && "is-files")}>
          {leftTab === "ai" ? <AIChatPanel /> : null}
          {leftTab === "files" ? <FilePanel /> : null}
          {leftTab === "modules" ? <ModulePalette /> : null}
          {leftTab === "layers" ? <LayersPanel /> : null}
          {leftTab === "pages" ? <PagesPanel /> : null}
        </div>
      </section>
    </aside>
  );
}

import {
  Braces,
  Clapperboard,
  Code2,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  Moon,
  PanelRight,
  PanelsTopLeft,
  Redo2,
  Save,
  Settings2,
  Sparkles,
  Sun,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import clsx from "clsx";
import {
  selectActivePage,
  useEditorStore,
} from "../store/editorStore";
import type { useProjectFileActions } from "../hooks/useProjectFileActions";
import { IconButton } from "./ui/IconButton";
import { useThemeStore } from "../store/themeStore";

interface TopBarProps {
  actions: ReturnType<typeof useProjectFileActions>;
}

type ViewOption = {
  id: "canvas" | "script" | "preview" | "code";
  label: string;
  icon: typeof PanelsTopLeft;
};

const designViewOptions: ViewOption[] = [
  { id: "canvas", label: "画布", icon: PanelsTopLeft },
  { id: "script", label: "脚本", icon: Braces },
  { id: "preview", label: "预览", icon: Eye },
];

const fileViewOptions: ViewOption[] = [
  { id: "code", label: "代码", icon: Code2 },
  { id: "preview", label: "预览", icon: Eye },
  { id: "script", label: "脚本", icon: Braces },
];

export function TopBar({ actions }: TopBarProps) {
  const page = useEditorStore(selectActivePage);
  const project = useEditorStore((state) => state.project);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const projectFolder = useEditorStore((state) => state.projectFolder);
  const pastCount = useEditorStore((state) => state.past.length);
  const futureCount = useEditorStore((state) => state.future.length);
  const zoom = useEditorStore((state) => state.zoom);
  const designView = useEditorStore((state) => state.designView);
  const fileView = useEditorStore((state) => state.fileView);
  const activeFilePath = useEditorStore((state) => state.activeFilePath);
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setDesignView = useEditorStore((state) => state.setDesignView);
  const setFileView = useEditorStore((state) => state.setFileView);
  const setInspectorOpen = useEditorStore((state) => state.setInspectorOpen);
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);
  const setBuildOpen = useEditorStore((state) => state.setBuildOpen);
  const setPageBuildOpen = useEditorStore(
    (state) => state.setPageBuildOpen,
  );
  const animationDockOpen = useEditorStore(
    (state) => state.animationDockOpen,
  );
  const resolvedTheme = useThemeStore((state) => state.resolved);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const setAnimationDockOpen = useEditorStore(
    (state) => state.setAnimationDockOpen,
  );
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const fileName = projectPath
    ? projectPath.split(/[\\/]/).pop()
    : projectFolder
      ? projectFolder.replace(/[\\/]+$/, "").split(/[\\/]/).pop()
      : undefined;
  const fileDocument = Boolean(activeFilePath);
  const pageTabOpen = useEditorStore((state) =>
    state.openDocuments.some(
      (document) =>
        document.kind === "page" &&
        document.pageId === state.activePageId,
    ),
  );
  const hasDocument = fileDocument || pageTabOpen;
  const viewOptions = fileDocument ? fileViewOptions : designViewOptions;
  const activeView = fileDocument ? fileView : designView;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <Sparkles size={16} />
        </span>
        <span className="brand-name">Spark Pages</span>
      </div>

      <div className="topbar-group">
        <IconButton
          label="新建项目 (⌘N)"
          onClick={() => void actions.newProjectAction()}
          disabled={actions.busy}
        >
          <FilePlus2 size={16} />
        </IconButton>
        <IconButton
          label="打开文件夹 (⌘O)"
          onClick={() => void actions.openFolderAction()}
          disabled={actions.busy}
        >
          <FolderOpen size={16} />
        </IconButton>
        <IconButton
          label="保存项目 (⌘S)"
          onClick={() => void actions.saveProjectAction(false)}
          disabled={actions.busy}
        >
          {actions.busy ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <Save size={16} />
          )}
        </IconButton>
        <IconButton
          label="保存页面 (⌘⌥S)"
          onClick={() => void actions.savePageAction()}
          disabled={actions.busy || !projectFolder}
        >
          <FileText size={16} />
        </IconButton>
      </div>

      <div className="topbar-divider" />

      <div className="topbar-group">
        <IconButton
          label="撤销 (⌘Z)"
          onClick={undo}
          disabled={pastCount === 0}
        >
          <Undo2 size={16} />
        </IconButton>
        <IconButton
          label="重做 (⇧⌘Z)"
          onClick={redo}
          disabled={futureCount === 0}
        >
          <Redo2 size={16} />
        </IconButton>
      </div>

      <div className="topbar-page">
        <span className="topbar-page-title" title={project.name}>
          {project.name}
        </span>
        <span className="topbar-page-sep">/</span>
        <span className="topbar-page-subtitle">{page.title}</span>
        <span
          className={clsx("save-indicator", dirty && "is-dirty")}
          title={dirty ? "有未保存修改" : "已保存"}
        />
        {fileName ? <span className="topbar-file-name">{fileName}</span> : null}
      </div>

      <div className="view-switch">
        {hasDocument ? (
          viewOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                className={clsx(
                  "view-switch-button",
                  activeView === option.id && "is-active",
                )}
                onClick={() => {
                  if (fileDocument) {
                    setFileView(option.id as "code" | "preview" | "script");
                  } else {
                    setDesignView(
                      option.id as "canvas" | "script" | "preview",
                    );
                  }
                }}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })
        ) : (
          <span className="view-switch-empty">未打开文档</span>
        )}
      </div>

      <div className="topbar-group topbar-right">
        <div className="topbar-zoom">
          <IconButton
            label="缩小"
            onClick={() => setZoom(zoom - 0.1)}
            disabled={zoom <= 0.25}
          >
            <ZoomOut size={16} />
          </IconButton>
          <button
            type="button"
            className="zoom-label"
            onClick={() => setZoom(1)}
            title="重置为 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            label="放大"
            onClick={() => setZoom(zoom + 0.1)}
            disabled={zoom >= 2.5}
          >
            <ZoomIn size={16} />
          </IconButton>
          <div className="topbar-divider" />
        </div>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => setBuildOpen(true)}
          title="通过 AI 构建项目文件"
        >
          <Sparkles size={14} />
          构建项目
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => setPageBuildOpen(true)}
          disabled={actions.busy}
        >
          <Wand2 size={14} />
          构建此页面
        </button>
        <IconButton
          label="动画时间轴"
          active={animationDockOpen}
          onClick={() => setAnimationDockOpen(!animationDockOpen)}
        >
          <Clapperboard size={16} />
        </IconButton>
        <IconButton
          label={resolvedTheme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          onClick={toggleTheme}
        >
          {resolvedTheme === "dark" ? (
            <Sun size={16} />
          ) : (
            <Moon size={16} />
          )}
        </IconButton>
        <IconButton
          label="项目设置"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 size={16} />
        </IconButton>
        <IconButton
          label="属性面板"
          active={inspectorOpen}
          onClick={() => setInspectorOpen(!inspectorOpen)}
        >
          <PanelRight size={16} />
        </IconButton>
      </div>
    </header>
  );
}

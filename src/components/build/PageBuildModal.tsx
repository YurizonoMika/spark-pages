import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import {
  aiConfigReady,
  isLocalAiEndpoint,
  useAiSettingsStore,
  type AiConfig,
} from "../../lib/ai/settings";
import { hasApiKey } from "../../lib/ai/client";
import {
  buildPagePreviewHtml,
  buildPageWithAi,
  writePageFiles,
  type BuiltPage,
} from "../../lib/ai/pageBuild";
import { listProjectFiles } from "../../lib/ai/build";
import {
  buildExistingFiles,
  pageCodeDirectory,
  pageSlug,
  projectBuildRoot,
  projectTypeLabel,
} from "../../lib/ai/projectContext";
import { toast } from "../../store/toastStore";
import { Modal } from "../ui/Modal";
import { BuildLogPanel, type BuildLogEntry } from "./BuildLogPanel";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface PageBuildResult extends BuiltPage {
  root: string;
  preview: string | null;
  directory: string;
}

export function PageBuildModal() {
  const open = useEditorStore((state) => state.pageBuildOpen);
  if (!open) {
    return null;
  }
  return <PageBuildModalInner />;
}

function PageBuildModalInner() {
  const project = useEditorStore((state) => state.project);
  const page = useEditorStore(selectActivePage);
  const projectFolder = useEditorStore((state) => state.projectFolder);
  const setProjectFolder = useEditorStore((state) => state.setProjectFolder);
  const bumpFilesVersion = useEditorStore((state) => state.bumpFilesVersion);
  const setPageBuildOpen = useEditorStore(
    (state) => state.setPageBuildOpen,
  );
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);

  const baseUrl = useAiSettingsStore((state) => state.baseUrl);
  const model = useAiSettingsStore((state) => state.model);
  const temperature = useAiSettingsStore((state) => state.temperature);
  const maxTokens = useAiSettingsStore((state) => state.maxTokens);
  const keyConfigured = useAiSettingsStore((state) => state.keyConfigured);
  const setKeyConfigured = useAiSettingsStore(
    (state) => state.setKeyConfigured,
  );

  const [folder, setFolder] = useState(projectFolder ?? "");
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PageBuildResult | null>(null);
  const [keyChecked, setKeyChecked] = useState(false);
  const [logEntries, setLogEntries] = useState<BuildLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(true);

  const config: AiConfig = { baseUrl, model, temperature, maxTokens };
  const configured = aiConfigReady(config);
  const needsKey =
    configured && !keyConfigured && !isLocalAiEndpoint(baseUrl);
  const tauri = isTauri();
  const slug = pageSlug(project, page);
  const directory = pageCodeDirectory(project, slug);

  useEffect(() => {
    if (!tauri) {
      setKeyChecked(true);
      return;
    }
    hasApiKey()
      .then((value) => {
        setKeyConfigured(value);
        setKeyChecked(true);
      })
      .catch(() => setKeyChecked(true));
  }, [setKeyConfigured, tauri]);

  useEffect(() => {
    setResult(null);
    setLogEntries([]);
    setError(null);
    setStatus("");
  }, [page.id]);

  const appendLog = useCallback((entry: Omit<BuildLogEntry, "id">) => {
    setLogEntries((previous) =>
      [...previous, { ...entry, id: nanoid() }].slice(-200),
    );
  }, []);

  const close = () => {
    if (!running) {
      setPageBuildOpen(false);
    }
  };

  const chooseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目文件夹",
      });
      if (typeof selected === "string") {
        setFolder(selected);
        setProjectFolder(selected);
      }
    } catch (dialogError) {
      toast(
        dialogError instanceof Error
          ? dialogError.message
          : "无法打开文件夹选择器",
        "error",
      );
    }
  };

  const startBuild = async () => {
    setError(null);
    setResult(null);
    setLogEntries([]);
    setLogOpen(true);

    if (!tauri) {
      setError("页面构建仅支持桌面应用，请通过 npm run tauri dev 启动。");
      return;
    }
    if (!configured) {
      setError("尚未配置模型，请先在“模型与密钥”中填写 Base URL 和模型名称。");
      return;
    }
    if (!folder.trim()) {
      setError("请先选择项目文件夹。");
      return;
    }

    setRunning(true);
    setStatus("正在读取项目文件和页面 XML…");
    try {
      const buildRoot = projectBuildRoot(folder);
      const existing = await listProjectFiles(folder);
      const existingFiles = buildExistingFiles(existing);
      const built = await buildPageWithAi(
        project,
        page,
        config,
        instruction,
        {
          root: buildRoot,
          existingFiles,
          callbacks: {
            onStatus: (next) => setStatus(next),
            onAssistantMessage: (text) =>
              appendLog({ kind: "assistant", text }),
            onTool: (trace) => appendLog({ kind: "tool", trace }),
          },
        },
      );
      setStatus("正在写入页面文件…");
      await writePageFiles(buildRoot, built.files);
      bumpFilesVersion();
      setResult({
        ...built,
        root: buildRoot,
        directory,
        preview: buildPagePreviewHtml(project, page, built.files),
      });
      setStatus("页面构建完成");
      toast("页面构建完成", "success");
    } catch (buildError) {
      setError(
        buildError instanceof Error ? buildError.message : "页面构建失败",
      );
      setStatus("");
    } finally {
      setRunning(false);
    }
  };

  const openDirectory = async () => {
    try {
      await openPath(result?.root ?? folder);
    } catch (openError) {
      toast(
        openError instanceof Error ? openError.message : "无法打开文件夹",
        "error",
      );
    }
  };

  const openPageFile = async () => {
    if (!result) {
      return;
    }
    const fileName = project.type === "vue" ? "index.vue" : "index.html";
    try {
      await openPath(`${result.root}/${result.directory}/${fileName}`);
    } catch (openError) {
      toast(
        openError instanceof Error ? openError.message : "无法打开文件",
        "error",
      );
    }
  };

  const footer = result ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={close}>
        关闭
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => void startBuild()}
        disabled={running}
      >
        <Sparkles size={14} />
        重新构建
      </button>
      <button
        type="button"
        className="btn btn-accent"
        onClick={() => void openPageFile()}
      >
        <ExternalLink size={14} />
        打开页面文件
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={close}
        disabled={running}
      >
        取消
      </button>
      <button
        type="button"
        className="btn btn-accent"
        onClick={() => void startBuild()}
        disabled={running || !folder}
      >
        {running ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <Wand2 size={14} />
        )}
        {running ? "页面构建中…" : "开始构建此页面"}
      </button>
    </>
  );

  return (
    <Modal
      title="构建此页面"
      subtitle={`${project.name} · ${page.title}`}
      icon={<Wand2 size={17} />}
      size="xl"
      dismissable={!running}
      onClose={close}
      footer={footer}
    >
      {result ? (
        <div className="build-success page-build-result">
          <div className="build-success-header">
            <span className="build-success-icon">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>页面构建完成</strong>
              <p>{result.summary}</p>
            </div>
          </div>

          <div className="page-build-meta">
            <span>{projectTypeLabel(project)}</span>
            <span>{result.directory}/</span>
            <span>{result.files.length} 个文件</span>
            <span>{result.root}</span>
          </div>

          <div className="page-build-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void openDirectory()}
            >
              <FolderOpen size={14} />
              打开文件夹
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void openPageFile()}
            >
              <ExternalLink size={14} />
              打开页面文件
            </button>
          </div>

          {result.preview ? (
            <div className="page-build-preview">
              <div className="page-build-preview-header">
                <span>页面预览</span>
                <small>HTML/CSS/JS 分文件预览（已内联样式和脚本）</small>
              </div>
              <iframe
                title={`${page.title} 构建预览`}
                srcDoc={result.preview}
                sandbox="allow-scripts allow-forms"
              />
            </div>
          ) : (
            <div className="build-warning">
              <AlertCircle size={16} />
              <p>
                Vue 页面文件已写入项目。运行项目的 npm run dev 后即可在
                Vite 中查看该页面。
              </p>
            </div>
          )}

          <div className="build-file-list">
            {result.files.map((file) => (
              <details key={file.path} className="build-file-row">
                <summary title="点击查看生成内容">
                  <code>{file.path}</code>
                  <span>{formatBytes(file.content.length)}</span>
                </summary>
                <pre>{file.content}</pre>
              </details>
            ))}
          </div>

          <BuildLogPanel
            entries={logEntries}
            open={logOpen}
            running={running}
            onToggle={() => setLogOpen((value) => !value)}
          />
        </div>
      ) : (
        <div className="build-form">
          <div className="build-model-card">
            <span className="build-model-icon">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>{configured ? model : "未配置模型"}</strong>
              <p>
                {configured
                  ? baseUrl
                  : "需要先配置 OpenAI 兼容的 Base URL、模型名称和 API Key。"}
              </p>
            </div>
            <span
              className={
                !configured
                  ? "build-key-missing"
                  : keyConfigured || isLocalAiEndpoint(baseUrl)
                    ? "build-key-ok"
                    : "build-key-missing"
              }
            >
              {!configured
                ? "未配置"
                : keyConfigured || isLocalAiEndpoint(baseUrl)
                  ? "密钥就绪"
                  : keyChecked
                    ? "缺少密钥"
                    : "检查中"}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPageBuildOpen(false);
                setSettingsOpen(true, "ai");
              }}
            >
              模型设置
            </button>
          </div>

          {needsKey ? (
            <div className="build-warning">
              <AlertCircle size={16} />
              <p>
                当前接口不在本机，但还没有保存 API Key。请先到模型设置中保存密钥。
              </p>
            </div>
          ) : null}

          <div className="settings-field">
            <label>项目文件夹</label>
            <div className="path-picker">
              <input
                type="text"
                value={folder}
                readOnly
                placeholder="选择项目文件夹，页面文件会直接写入其中"
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void chooseFolder()}
                disabled={running}
              >
                <FolderOpen size={14} />
                {folder ? "更改" : "选择"}
              </button>
            </div>
            <p className="settings-hint">
              AI 会读取 build/ 中的现有页面代码；构建产物写入 {folder || "项目目录"}/build，并同步到左侧文件视图。
            </p>
          </div>

          <div className="page-build-target">
            <span className="page-build-chip">{projectTypeLabel(project)}</span>
            <span className="page-build-chip">{directory}/</span>
            <span className="page-build-chip">{page.width} × {page.height}</span>
            <span className="page-build-chip">{page.modules.length} 个模块</span>
          </div>

          <div className="settings-field">
            <label htmlFor="page-build-instruction">额外构建要求</label>
            <textarea
              id="page-build-instruction"
              rows={4}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="例如：将页面拆成 HTML/CSS/JS 文件；增加滚动动效；移动端改成汉堡菜单…"
              disabled={running}
            />
            <p className="settings-hint">
              会将完整项目设置、页面设置和当前页面 XML 发送给模型；AI 通过
              read_page_file / write_page_file 读写页面代码，HTML、CSS、JS、Vue、TS
              文件分开存放。模型需支持 Function Calling / Tools。
            </p>
          </div>

          {running || status ? (
            <div className="build-progress">
              {running ? <Loader2 size={16} className="spin" /> : null}
              <span>{status}</span>
            </div>
          ) : null}

          {running || logEntries.length > 0 ? (
            <BuildLogPanel
              entries={logEntries}
              open={logOpen}
              running={running}
              onToggle={() => setLogOpen((value) => !value)}
            />
          ) : null}

          {error ? (
            <div className="build-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

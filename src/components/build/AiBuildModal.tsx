import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEditorStore } from "../../store/editorStore";
import { useAiSettingsStore } from "../../lib/ai/settings";
import {
  aiConfigReady,
  isLocalAiEndpoint,
  type AiConfig,
} from "../../lib/ai/settings";
import { hasApiKey } from "../../lib/ai/client";
import {
  generateProjectFiles,
  listProjectFiles,
  writeBuildAssets,
  writeBuildFiles,
  type BuildResult,
} from "../../lib/ai/build";
import {
  extractBuildAssets,
  inlinePreviewAssets,
} from "../../lib/ai/buildAssets";
import {
  buildExistingFiles,
  projectBuildRoot,
  projectTemplateLabel,
  projectTypeLabel,
} from "../../lib/ai/projectContext";
import { toast } from "../../store/toastStore";
import { Modal } from "../ui/Modal";
import {
  BuildLogPanel,
  type BuildLogEntry,
} from "./BuildLogPanel";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function AiBuildModal() {
  const openBuild = useEditorStore((state) => state.buildOpen);
  if (!openBuild) {
    return null;
  }
  return <AiBuildModalInner />;
}

function AiBuildModalInner() {
  const project = useEditorStore((state) => state.project);
  const projectFolder = useEditorStore((state) => state.projectFolder);
  const setProjectFolder = useEditorStore((state) => state.setProjectFolder);
  const bumpFilesVersion = useEditorStore((state) => state.bumpFilesVersion);
  const setBuildOpen = useEditorStore((state) => state.setBuildOpen);
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
  const [result, setResult] = useState<BuildResult | null>(null);
  const [keyChecked, setKeyChecked] = useState(false);
  const [logEntries, setLogEntries] = useState<BuildLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(true);

  const config: AiConfig = { baseUrl, model, temperature, maxTokens };
  const configured = aiConfigReady(config);
  const needsKey = configured && !keyConfigured && !isLocalAiEndpoint(baseUrl);
  const tauri = isTauri();

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

  const close = () => {
    if (!running) {
      setBuildOpen(false);
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

  const appendLog = useCallback((entry: Omit<BuildLogEntry, "id">) => {
    setLogEntries((previous) =>
      [...previous, { ...entry, id: nanoid() }].slice(-200),
    );
  }, []);

  const startBuild = async () => {
    setError(null);
    setResult(null);
    setLogEntries([]);
    setLogOpen(true);

    if (!tauri) {
      setError("AI 构建仅支持桌面应用，请通过 npm run tauri dev 启动。");
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
    try {
      setStatus("正在读取项目文件夹和页面 XML…");
      const buildRoot = projectBuildRoot(folder);
      const existing = await listProjectFiles(folder);
      const existingFiles = buildExistingFiles(existing);
      const extracted = extractBuildAssets(project);
      const generated = await generateProjectFiles(
        extracted.project,
        config,
        instruction,
        buildRoot,
        existingFiles,
        {
          onStatus: (next) => setStatus(next),
          onAssistantMessage: (text) =>
            appendLog({ kind: "assistant", text }),
          onTool: (trace) => appendLog({ kind: "tool", trace }),
        },
      );
      setStatus("正在写入项目文件…");
      const files = inlinePreviewAssets(
        generated.files,
        extracted.assets,
      );
      await writeBuildFiles(buildRoot, files);
      await writeBuildAssets(buildRoot, extracted.assets);
      bumpFilesVersion();
      setResult({ ...generated, files, root: buildRoot });
      setStatus("构建完成");
      toast("AI 项目构建完成", "success");
    } catch (buildError) {
      setError(
        buildError instanceof Error ? buildError.message : "AI 构建失败",
      );
      setStatus("");
    } finally {
      setRunning(false);
    }
  };

  const copyCommand = async () => {
    const root = result?.root ?? folder;
    const command =
      project.type === "vue"
        ? `cd "${root}"\nnpm install\nnpm run dev`
        : `cd "${root}"\n# 直接打开 index.html 浏览项目`;
    try {
      await navigator.clipboard.writeText(command);
      toast("启动命令已复制", "success");
    } catch {
      toast("无法复制到剪贴板", "error");
    }
  };

  const footer = result ? (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => void openPath(result.root)}
      >
        <FolderOpen size={14} />
        打开文件夹
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
        onClick={() => setBuildOpen(false)}
      >
        完成
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
        {running ? "项目构建中…" : "开始构建项目"}
      </button>
    </>
  );

  return (
    <Modal
      title="通过 AI 构建项目"
      subtitle={`${project.name} · ${projectTypeLabel(project)}`}
      icon={<Sparkles size={17} />}
      size="lg"
      dismissable={!running}
      onClose={close}
      footer={footer}
    >
      {result ? (
        <div className="build-success">
          <div className="build-success-header">
            <span className="build-success-icon">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>项目构建完成</strong>
              <p>{result.summary}</p>
            </div>
          </div>

          <div className="build-root">
            <span>构建产物目录</span>
            <code>{result.root}</code>
          </div>

          <div className="page-build-meta">
            <span>{projectTypeLabel(project)}</span>
            <span>{projectTemplateLabel(project)}</span>
            <span>{result.files.length} 个文件</span>
          </div>

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

          <div className="build-command">
            <div>
              <strong>
                {project.type === "vue" ? "启动项目" : "预览项目"}
              </strong>
              <code>
                {project.type === "vue"
                  ? `cd "${result.root}" && npm install && npm run dev`
                  : `打开 "${result.root}/index.html"`}
              </code>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void copyCommand()}
            >
              复制命令
            </button>
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
                setBuildOpen(false);
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
                当前接口不在本机，但还没有保存 API Key。开始构建时后端会拒绝请求，
                请先到模型设置中保存密钥。
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
                placeholder="选择项目文件夹，AI 会直接写入其中"
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
              AI 会读取此文件夹 build/ 中的现有代码。构建产物统一写入 {folder || "项目目录"}/build，左侧文件视图可查看结果。
            </p>
          </div>

          <div className="page-build-target">
            <span className="page-build-chip">{projectTypeLabel(project)}</span>
            <span className="page-build-chip">{projectTemplateLabel(project)}</span>
            <span className="page-build-chip">{project.pages.length} 个页面</span>
          </div>

          <div className="settings-field">
            <label htmlFor="build-instruction">额外构建要求</label>
            <textarea
              id="build-instruction"
              rows={4}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="例如：整体风格更简洁；增加移动端导航；保留所有中文文案；使用深色主题…"
              disabled={running}
            />
            <p className="settings-hint">
              构建会读取/写入项目文件（HTML、CSS、JS、Vue、TS 等分开存放），并始终附带完整项目设置说明和 XML。模型需支持
              Function Calling / Tools；运行过程可在下方查看。
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

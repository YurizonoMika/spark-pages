import { useEffect, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Code2,
  Cpu,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Server,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { isTauri } from "@tauri-apps/api/core";
import type { ProjectType } from "../../model/types";
import { useEditorStore } from "../../store/editorStore";
import { useAiSettingsStore } from "../../lib/ai/settings";
import { aiConfigReady, type AiConfig } from "../../lib/ai/settings";
import {
  chatCompletion,
  deleteApiKey,
  hasApiKey,
  saveApiKey,
} from "../../lib/ai/client";
import { toast } from "../../store/toastStore";
import { useThemeStore, type ThemeMode } from "../../store/themeStore";
import { Modal } from "../ui/Modal";

const themeOptions: Array<{
  id: ThemeMode;
  label: string;
  icon: typeof Monitor;
}> = [
  { id: "system", label: "跟随系统", icon: Monitor },
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
];

const presets = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    id: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
  },
];

function SettingsModalInner() {
  const project = useEditorStore((state) => state.project);
  const tab = useEditorStore((state) => state.settingsTab);
  const setSettingsTab = useEditorStore((state) => state.setSettingsTab);
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);
  const setProjectSettings = useEditorStore(
    (state) => state.setProjectSettings,
  );

  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  const aiConfig = useAiSettingsStore();
  const setConfig = useAiSettingsStore((state) => state.setConfig);
  const keyConfigured = useAiSettingsStore((state) => state.keyConfigured);
  const setKeyConfigured = useAiSettingsStore(
    (state) => state.setKeyConfigured,
  );

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [type, setType] = useState<ProjectType>(project.type);

  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl);
  const [model, setModel] = useState(aiConfig.model);
  const [temperature, setTemperature] = useState(
    String(aiConfig.temperature),
  );
  const [maxTokens, setMaxTokens] = useState(String(aiConfig.maxTokens));
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const tauri = isTauri();

  useEffect(() => {
    if (!tauri) {
      return;
    }
    hasApiKey()
      .then(setKeyConfigured)
      .catch(() => setKeyConfigured(false));
  }, [setKeyConfigured, tauri]);

  const close = () => setSettingsOpen(false);

  const saveProject = () => {
    if (!name.trim()) {
      toast("项目名称不能为空", "error");
      return;
    }
    setProjectSettings({
      name: name.trim(),
      description: description.trim(),
      type,
      template: type === "vue" ? "vite-vue-ts" : "static",
    });
    toast("项目设置已保存", "success");
    close();
  };

  const currentAiConfig = (): AiConfig => ({
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    temperature: Number(temperature) || 0,
    maxTokens: Number(maxTokens) || 4096,
  });

  const persist = async (): Promise<AiConfig> => {
    const config = currentAiConfig();
    setConfig(config);
    if (apiKey.trim()) {
      if (!tauri) {
        throw new Error("浏览器预览模式不支持保存 API Key");
      }
      await saveApiKey(apiKey.trim());
      setKeyConfigured(true);
      setApiKey("");
    }
    return config;
  };

  const saveAi = async () => {
    setSaving(true);
    try {
      await persist();
      toast(
        apiKey.trim() ? "模型配置和密钥已保存" : "模型配置已保存",
        "success",
      );
      close();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法保存模型配置",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const config = await persist();
      if (!aiConfigReady(config)) {
        throw new Error("请填写 API Base URL 和模型名称");
      }
      const result = await chatCompletion(
        config,
        [{ role: "user", content: "只回复 OK" }],
        { temperature: 0, maxTokens: 16 },
      );
      const text =
        typeof result.message.content === "string"
          ? result.message.content
          : "OK";
      toast(`连接成功：${text.slice(0, 40)}`, "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "连接测试失败",
        "error",
      );
    } finally {
      setTesting(false);
    }
  };

  const clearKey = async () => {
    if (!tauri) {
      return;
    }
    try {
      await deleteApiKey();
      setKeyConfigured(false);
      setApiKey("");
      toast("API Key 已从本机删除", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "无法删除 API Key",
        "error",
      );
    }
  };

  const footer =
    tab === "project" ? (
      <>
        <button type="button" className="btn btn-ghost" onClick={close}>
          取消
        </button>
        <button type="button" className="btn btn-accent" onClick={saveProject}>
          保存项目设置
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void testConnection()}
          disabled={testing || saving}
        >
          {testing ? <Loader2 size={14} className="spin" /> : <Cpu size={14} />}
          测试连接
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void saveAi()}
          disabled={saving || testing}
        >
          {saving ? <Loader2 size={14} className="spin" /> : null}
          保存模型配置
        </button>
      </>
    );

  return (
    <Modal
      title="Spark Pages 设置"
      subtitle="项目属性与模型连接"
      icon={<Settings2 size={17} />}
      size="lg"
      onClose={close}
      footer={footer}
    >
      <div className="settings-tabs">
        <button
          type="button"
          className={clsx("settings-tab", tab === "project" && "is-active")}
          onClick={() => setSettingsTab("project")}
        >
          <Boxes size={14} />
          项目设置
        </button>
        <button
          type="button"
          className={clsx("settings-tab", tab === "ai" && "is-active")}
          onClick={() => setSettingsTab("ai")}
        >
          <Sparkles size={14} />
          模型与密钥
        </button>
      </div>

      {tab === "project" ? (
        <div className="settings-section">
          <div className="settings-field">
            <label htmlFor="project-name">项目名称</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：我的产品官网"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="project-description">项目说明</label>
            <textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="一句话描述这个项目，AI 构建时会作为上下文"
            />
          </div>

          <div className="settings-field">
            <label>项目类型</label>
            <div className="project-type-grid">
              <button
                type="button"
                className={clsx(
                  "project-type-card",
                  type === "html" && "is-active",
                )}
                onClick={() => setType("html")}
              >
                <span className="project-type-icon">
                  <Code2 size={19} />
                </span>
                <span>
                  <strong>HTML + JS</strong>
                  <small>静态多页面站点，可构建项目与页面</small>
                </span>
              </button>
              <button
                type="button"
                className={clsx(
                  "project-type-card",
                  type === "vue" && "is-active",
                )}
                onClick={() => setType("vue")}
              >
                <span className="project-type-icon">
                  <Server size={19} />
                </span>
                <span>
                  <strong>Vue + TS 项目</strong>
                  <small>Vite + Vue 3 + TypeScript，可构建项目与页面</small>
                </span>
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label>应用外观</label>
            <div className="theme-options">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={clsx(
                      "theme-option",
                      themeMode === option.id && "is-active",
                    )}
                    onClick={() => setThemeMode(option.id)}
                  >
                    <Icon size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="settings-hint">
              “跟随系统”会自动响应操作系统的浅色/深色外观；也可以固定为浅色或深色。
            </p>
          </div>
        </div>
      ) : (
        <div className="settings-section">
          <div className="settings-section-title">
            <span>OpenAI 兼容接口</span>
            <span
              className={clsx(
                "key-status",
                keyConfigured && "is-configured",
              )}
            >
              <KeyRound size={12} />
              {keyConfigured ? "密钥已保存" : "未保存密钥"}
            </span>
          </div>

          <div className="preset-row">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-button"
                onClick={() => {
                  setBaseUrl(preset.baseUrl);
                  setModel(preset.model);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="settings-grid">
            <div className="settings-field settings-field-wide">
              <label htmlFor="ai-base-url">API Base URL</label>
              <input
                id="ai-base-url"
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <p className="settings-hint">
                只需填写到 /v1；请求会自动拼接 /chat/completions。
              </p>
            </div>
            <div className="settings-field">
              <label htmlFor="ai-model">模型名称</label>
              <input
                id="ai-model"
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4.1-mini / deepseek-chat"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="ai-key">API Key</label>
              <input
                id="ai-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={keyConfigured ? "已保存，留空不修改" : "sk-…"}
                autoComplete="off"
              />
              <p className="settings-hint">
                {tauri
                  ? "密钥保存在应用数据目录（文件权限 0600），不写入项目文件，也不会反复弹出系统授权。"
                  : "浏览器预览模式无法保存密钥，请使用桌面应用。"}
              </p>
            </div>
            <div className="settings-field">
              <label htmlFor="ai-temperature">Temperature</label>
              <input
                id="ai-temperature"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="ai-max-tokens">Max Tokens</label>
              <input
                id="ai-max-tokens"
                type="number"
                min={512}
                step={512}
                value={maxTokens}
                onChange={(event) => setMaxTokens(event.target.value)}
              />
            </div>
          </div>

          {keyConfigured ? (
            <button
              type="button"
              className="btn btn-danger settings-clear-key"
              onClick={() => void clearKey()}
              disabled={!tauri}
            >
              <Trash2 size={14} />
              删除本机 API Key
            </button>
          ) : null}

          <div className="settings-note">
            <CheckCircle2 size={15} />
            <p>
              Spark Pages 不内置任何模型额度。请求由你的设备直接发往配置的
              Base URL，聊天内容和页面 XML 会发送给该服务。Agent
              工具调用需要模型支持 Function Calling / Tools。
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function SettingsModal() {
  const open = useEditorStore((state) => state.settingsOpen);
  if (!open) {
    return null;
  }
  return <SettingsModalInner />;
}

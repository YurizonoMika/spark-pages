import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEditorStore } from "../../store/editorStore";
import type { OpenProjectFile } from "../../store/editorStore";

function parentDirectory(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}

async function tryRead(path: string): Promise<string | null> {
  try {
    const content = await invoke<string>("read_text_file", { path });
    return content.trim() ? content : null;
  } catch {
    return null;
  }
}

function cleanReference(value: string): string {
  return value.split("?")[0].split("#")[0];
}

async function inlineAssets(
  html: string,
  directory: string,
  activeFile: OpenProjectFile,
): Promise<string> {
  const readAsset = async (path: string) =>
    path === activeFile.path ? activeFile.content : tryRead(path);
  let result = html;
  const cssPattern =
    /<link[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
  const jsPattern =
    /<script[^>]*src=["']([^"']+\.(?:js|mjs))["'][^>]*><\/script>/gi;

  const cssMatches = Array.from(result.matchAll(cssPattern));
  for (const match of cssMatches) {
    const href = cleanReference(match[1]);
    if (/^(https?:|data:|\/\/|#)/i.test(href)) {
      continue;
    }
    const content = await readAsset(
      `${directory}/${href.replace(/^\.\//, "")}`,
    );
    if (content) {
      result = result.replace(match[0], `<style>\n${content}\n</style>`);
    }
  }

  const jsMatches = Array.from(result.matchAll(jsPattern));
  for (const match of jsMatches) {
    const src = cleanReference(match[1]);
    if (/^(https?:|data:|\/\/|#)/i.test(src)) {
      continue;
    }
    const content = await readAsset(
      `${directory}/${src.replace(/^\.\//, "")}`,
    );
    if (content) {
      result = result.replace(match[0], `<script>\n${content}\n</script>`);
    }
  }

  return result;
}

export function BuiltPreview({ file }: { file: OpenProjectFile }) {
  const filesVersion = useEditorStore((state) => state.filesVersion);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const directory = parentDirectory(file.path);
    const load = async () => {
      setLoading(true);
      setError(null);
      setHtml(null);
      const preview =
        file.path.endsWith("/preview.html")
          ? file.content
          : await tryRead(`${directory}/preview.html`);
      if (cancelled) {
        return;
      }
      if (preview) {
        setHtml(preview);
        setLoading(false);
        return;
      }

      let htmlSource: string | null = null;
      if (file.path.toLowerCase().endsWith(".html")) {
        htmlSource = file.content;
      } else {
        htmlSource = await tryRead(`${directory}/index.html`);
      }
      if (!htmlSource) {
        if (!cancelled) {
          setError("未找到构建产物预览，请先构建页面或运行项目。");
          setLoading(false);
        }
        return;
      }
      const inlined = await inlineAssets(htmlSource, directory, file);
      if (!cancelled) {
        setHtml(inlined);
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [file.path, file.content, filesVersion]);

  return (
    <section className="built-preview">
      <header className="built-preview-header">
        <strong>构建产物预览</strong>
        <span title={file.path}>{file.name}</span>
      </header>
      <div className="built-preview-body">
        {loading ? (
          <div className="built-preview-message">
            <Loader2 size={16} className="spin" />
            正在读取构建产物…
          </div>
        ) : error ? (
          <div className="built-preview-message">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : html ? (
          <iframe
            title={`${file.name} 构建产物预览`}
            srcDoc={html}
            sandbox="allow-scripts allow-forms"
          />
        ) : null}
      </div>
    </section>
  );
}

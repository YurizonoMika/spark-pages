import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

const components: Components = {
  a({ href, children }) {
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (!href) {
            return;
          }
          if (href.startsWith("#")) {
            return;
          }
          if (isTauri()) {
            void openUrl(href).catch(() => undefined);
          } else {
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }}
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    return <img src={src} alt={alt ?? ""} loading="lazy" />;
  },
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="ai-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

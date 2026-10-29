import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import { renderPageHtml } from "./renderHtml";

describe("renderPageHtml", () => {
  it("embeds page custom HTML and JavaScript", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = 'document.title = "custom";';

    const html = renderPageHtml(page, project);

    expect(html).toContain('<script>document.title = "custom";</script>');
    expect(html).not.toContain("spark-custom-html");
    expect(html).not.toContain("spark-pages-preview");
  });

  it("renders module ids so page scripts can target elements", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const id = page.modules[0].id;

    const html = renderPageHtml(page, project);

    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(`data-spark-module-id="${id}"`);
  });

  it("adds the wand bridge only in preview mode", () => {
    const project = defaultProject();
    const page = project.pages[0];
    const preview = renderPageHtml(page, project, { preview: true });

    expect(preview).toContain("spark-pages-preview");
    expect(preview).toContain("spark-wand-selected");
  });

  it("marks TypeScript attachments as non-executable preview scripts", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = "const value: number = 1;";
    page.scriptLanguage = "typescript";

    const html = renderPageHtml(page, project);

    expect(html).toContain('<script type="text/typescript">');
    expect(html).toContain("const value: number = 1;");
  });

  it("escapes a closing script tag inside custom JavaScript", () => {
    const project = defaultProject();
    const page = project.pages[0];
    page.customScript = 'const html = "</script>";';

    const html = renderPageHtml(page, project);

    expect(html).toContain("<\\/script>");
  });
});

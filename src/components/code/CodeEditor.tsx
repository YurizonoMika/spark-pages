import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import {
  completeFromList,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import {
  javascript,
  javascriptLanguage,
} from "@codemirror/lang-javascript";
import { tags as t } from "@lezer/highlight";
import type { CodeLanguage } from "../../model/types";
import { useThemeStore } from "../../store/themeStore";

export type { CodeLanguage };

interface CodeEditorProps {
  value: string;
  language: CodeLanguage;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  reveal?: { from: number; to: number; token: number } | null;
}

const jsCompletions = [
  { label: "document", type: "variable", detail: "DOM" },
  { label: "window", type: "variable", detail: "DOM" },
  { label: "console.log", type: "function", detail: "调试输出", apply: "console.log()" },
  snippetCompletion('document.querySelector("${}")', {
    label: "querySelector",
    type: "method",
    detail: "document",
  }),
  snippetCompletion('document.querySelectorAll("${}")', {
    label: "querySelectorAll",
    type: "method",
    detail: "document",
  }),
  snippetCompletion('document.getElementById("${}")', {
    label: "getElementById",
    type: "method",
    detail: "document",
  }),
  snippetCompletion('addEventListener("${event}", (event) => {\n\t${}\n})', {
    label: "addEventListener",
    type: "method",
    detail: "event",
  }),
  snippetCompletion('setTimeout(() => {\n\t${}\n}, ${})', {
    label: "setTimeout",
    type: "function",
    detail: "timing",
  }),
  snippetCompletion('requestAnimationFrame(() => {\n\t${}\n})', {
    label: "requestAnimationFrame",
    type: "function",
    detail: "animation",
  }),
  {
    label: 'querySelectorAll("[data-spark-module-id]")',
    type: "method",
    detail: "Spark 模块",
    apply: 'document.querySelectorAll("[data-spark-module-id]")',
  },
];

function makeHighlight(dark: boolean) {
  if (dark) {
    return HighlightStyle.define([
      { tag: t.comment, color: "#9e958f", fontStyle: "italic" },
      { tag: [t.keyword, t.modifier, t.operatorKeyword], color: "#d0bcff" },
      { tag: [t.string, t.special(t.string)], color: "#7dd3a7" },
      { tag: [t.number, t.bool, t.null], color: "#f0b86e" },
      { tag: [t.tagName, t.angleBracket], color: "#ffb4ab" },
      { tag: t.attributeName, color: "#cbb6ff" },
      { tag: t.attributeValue, color: "#7dd3a7" },
      { tag: [t.function(t.variableName), t.labelName], color: "#9ecbff" },
      { tag: t.propertyName, color: "#c4b5fd" },
      { tag: [t.typeName, t.className, t.namespace], color: "#80cbc4" },
      {
        tag: [t.definition(t.variableName), t.definition(t.propertyName)],
        color: "#9ecbff",
      },
      { tag: t.variableName, color: "#e6e0e9" },
      { tag: t.regexp, color: "#f0a6ca" },
      { tag: [t.meta, t.processingInstruction], color: "#b8b0a8" },
      { tag: t.invalid, color: "#ff897d" },
    ]);
  }
  return HighlightStyle.define([
    { tag: t.comment, color: "#8a8175", fontStyle: "italic" },
    { tag: [t.keyword, t.modifier, t.operatorKeyword], color: "#7c3aed" },
    { tag: [t.string, t.special(t.string)], color: "#0f766e" },
    { tag: [t.number, t.bool, t.null], color: "#b45309" },
    { tag: [t.tagName, t.angleBracket], color: "#b3261e" },
    { tag: t.attributeName, color: "#6750a4" },
    { tag: t.attributeValue, color: "#0f766e" },
    { tag: [t.function(t.variableName), t.labelName], color: "#1d4ed8" },
    { tag: t.propertyName, color: "#6d28d9" },
    { tag: [t.typeName, t.className, t.namespace], color: "#0e7490" },
    {
      tag: [t.definition(t.variableName), t.definition(t.propertyName)],
      color: "#1d4ed8",
    },
    { tag: t.variableName, color: "#1f2937" },
    { tag: t.regexp, color: "#a21caf" },
    { tag: [t.meta, t.processingInstruction], color: "#7c6f64" },
    { tag: t.invalid, color: "#ba1a1a" },
  ]);
}

function makeTheme(dark: boolean) {
  const activeLine = dark
    ? "rgba(208, 188, 255, 0.08)"
    : "rgba(103, 80, 164, 0.06)";
  const activeGutter = dark
    ? "rgba(208, 188, 255, 0.12)"
    : "rgba(103, 80, 164, 0.08)";
  const selection = dark
    ? "rgba(208, 188, 255, 0.24)"
    : "rgba(103, 80, 164, 0.2)";
  const matching = dark
    ? "rgba(208, 188, 255, 0.2)"
    : "rgba(103, 80, 164, 0.16)";
  const matchingOutline = dark
    ? "rgba(208, 188, 255, 0.5)"
    : "rgba(103, 80, 164, 0.4)";
  const tooltipShadow = dark
    ? "0 10px 30px rgba(0, 0, 0, 0.55)"
    : "0 10px 30px rgba(29, 27, 32, 0.18)";

  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "var(--md-surface)",
        color: "var(--md-on-surface)",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        lineHeight: "1.65",
      },
      ".cm-content": {
        padding: "14px 0",
        caretColor: "var(--md-primary)",
      },
      ".cm-line": {
        padding: "0 16px 0 10px",
      },
      ".cm-gutters": {
        borderRight: "1px solid var(--md-outline-variant)",
        backgroundColor: "var(--md-surface-container)",
        color: "var(--md-on-surface-variant)",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "34px",
        padding: "0 10px 0 14px",
      },
      ".cm-activeLine": {
        backgroundColor: activeLine,
      },
      ".cm-activeLineGutter": {
        backgroundColor: activeGutter,
        color: "var(--md-primary)",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: `${selection} !important`,
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--md-primary)",
        borderLeftWidth: "2px",
      },
      ".cm-panels": {
        backgroundColor: "var(--md-surface-container)",
        color: "var(--md-on-surface)",
      },
      ".cm-searchMatch": {
        backgroundColor: dark
          ? "rgba(255, 193, 7, 0.28)"
          : "rgba(255, 193, 7, 0.32)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: dark
          ? "rgba(255, 152, 0, 0.36)"
          : "rgba(255, 152, 0, 0.42)",
      },
      ".cm-tooltip": {
        overflow: "hidden",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: "10px",
        backgroundColor: "var(--md-surface)",
        color: "var(--md-on-surface)",
        boxShadow: tooltipShadow,
      },
      ".cm-tooltip-autocomplete > ul > li": {
        padding: "4px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "var(--md-primary-container)",
        color: "var(--md-on-primary-container)",
      },
      ".cm-completionDetail": {
        marginLeft: "8px",
        color: "var(--md-on-surface-variant)",
        fontStyle: "normal",
      },
      ".cm-foldGutter .cm-gutterElement": {
        color: "var(--md-on-surface-variant)",
      },
      ".cm-matchingBracket": {
        backgroundColor: matching,
        outline: `1px solid ${matchingOutline}`,
      },
      "&.cm-focused": {
        outline: "none",
      },
    },
    { dark },
  );
}

function editorTheme(dark: boolean) {
  return [makeTheme(dark), syntaxHighlighting(makeHighlight(dark))];
}

function languageExtension(language: CodeLanguage) {
  if (language === "html") {
    return html({ autoCloseTags: true, matchClosingTags: true });
  }
  if (language === "css") {
    return css();
  }
  if (language === "json") {
    return json();
  }
  if (language === "typescript") {
    return [
      javascript({ typescript: true }),
      javascriptLanguage.data.of({
        autocomplete: completeFromList(jsCompletions),
      }),
    ];
  }
  return [
    javascript(),
    javascriptLanguage.data.of({
      autocomplete: completeFromList(jsCompletions),
    }),
  ];
}

function readOnlyExtensions(readOnly: boolean) {
  return readOnly
    ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
    : [];
}

function placeholderFor(language: CodeLanguage): string {
  if (language === "css") {
    return "/* 在这里编写样式 */";
  }
  if (language === "json") {
    return "{}";
  }
  if (language === "javascript" || language === "typescript") {
    return "// 在这里添加页面 JavaScript";
  }
  return "<!-- 在这里添加 HTML -->";
}

export function CodeEditor({
  value,
  language,
  onChange,
  onBlur,
  readOnly = false,
  reveal = null,
}: CodeEditorProps) {
  const dark = useThemeStore((state) => state.resolved === "dark");
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const lastValueRef = useRef(value);
  const darkRef = useRef(dark);
  const readOnlyRef = useRef(readOnly);
  const revealRef = useRef(reveal);
  const themeCompartment = useRef(new Compartment()).current;
  const readOnlyCompartment = useRef(new Compartment()).current;

  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;
  darkRef.current = dark;
  readOnlyRef.current = readOnly;
  revealRef.current = reveal;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const state = EditorState.create({
      doc: lastValueRef.current,
      extensions: [
        basicSetup,
        languageExtension(language),
        themeCompartment.of(editorTheme(darkRef.current)),
        readOnlyCompartment.of(readOnlyExtensions(readOnlyRef.current)),
        EditorView.lineWrapping,
        placeholder(placeholderFor(language)),
        keymap.of([indentWithTab]),
        EditorView.contentAttributes.of({
          "aria-label": language === "html" ? "HTML 源代码" : "JavaScript 源代码",
          spellcheck: "false",
        }),
        EditorView.domEventHandlers({
          blur: () => {
            onBlurRef.current?.();
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }
          const next = update.state.doc.toString();
          if (next === lastValueRef.current) {
            return;
          }
          lastValueRef.current = next;
          onChangeRef.current?.(next);
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: themeCompartment.reconfigure(editorTheme(dark)),
    });
  }, [dark, themeCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)),
    });
  }, [readOnly, readOnlyCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    lastValueRef.current = value;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    const target = revealRef.current;
    if (!view || !target) {
      return;
    }
    const length = view.state.doc.length;
    const from = Math.min(Math.max(target.from, 0), length);
    const to = Math.min(Math.max(target.to, from), length);
    view.dispatch({
      selection: { anchor: from, head: to },
      scrollIntoView: true,
    });
    view.focus();
  }, [reveal?.token]);

  return <div className="code-editor-host" ref={hostRef} />;
}

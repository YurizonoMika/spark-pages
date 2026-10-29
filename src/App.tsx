import { useEffect, useRef, type CSSProperties } from "react";
import clsx from "clsx";
import { TopBar } from "./components/TopBar";
import { DocumentTabs } from "./components/DocumentTabs";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Workspace } from "./components/Workspace";
import { Inspector } from "./components/inspector/Inspector";
import { StatusBar } from "./components/StatusBar";
import { Toaster } from "./components/ui/Toaster";
import { SettingsModal } from "./components/settings/SettingsModal";
import { AiBuildModal } from "./components/build/AiBuildModal";
import { PageBuildModal } from "./components/build/PageBuildModal";
import { AnimationDock } from "./components/animation/AnimationDock";
import { SidebarResizer } from "./components/layout/SidebarResizer";
import { useProjectFileActions } from "./hooks/useProjectFileActions";
import { useEditorStore } from "./store/editorStore";
import { useLayoutStore } from "./store/layoutStore";
import { saveDraft } from "./lib/projectStorage";
import { toast } from "./store/toastStore";

export default function App() {
  const actions = useProjectFileActions();
  const restoredDraft = useEditorStore((state) => state.restoredDraft);
  const animationDockOpen = useEditorStore(
    (state) => state.animationDockOpen,
  );
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen);
  const leftWidth = useLayoutStore((state) => state.leftWidth);
  const rightWidth = useLayoutStore((state) => state.rightWidth);

  const restoredToastShown = useRef(false);

  useEffect(() => {
    if (restoredDraft && !restoredToastShown.current) {
      restoredToastShown.current = true;
      toast("已恢复上次自动保存的草稿", "info");
    }
  }, [restoredDraft]);

  useEffect(() => {
    const clamp = () =>
      useLayoutStore.getState().clampForViewport(window.innerWidth);
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (
        state.project === previous.project &&
        state.activePageId === previous.activePageId &&
        state.projectFolder === previous.projectFolder &&
        state.projectPath === previous.projectPath
      ) {
        return;
      }
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        const current = useEditorStore.getState();
        saveDraft(
          current.project,
          current.activePageId,
          current.projectFolder,
          current.projectPath,
        );
      }, 500);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const editorState = useEditorStore.getState();
      if (
        editorState.settingsOpen ||
        editorState.buildOpen ||
        editorState.pageBuildOpen
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "s") {
        if (event.altKey) {
          event.preventDefault();
          void actions.savePageAction();
          return;
        }
        if (
          editorState.activeFilePath &&
          editorState.fileView === "code"
        ) {
          return;
        }
        event.preventDefault();
        void actions.saveProjectAction(event.shiftKey);
        return;
      }

      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]',
        )
      ) {
        return;
      }
      if (mod && key === "o") {
        event.preventDefault();
        void actions.openFolderAction();
        return;
      }
      if (mod && key === "n") {
        event.preventDefault();
        void actions.newProjectAction();
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          useEditorStore.getState().redo();
        } else {
          useEditorStore.getState().undo();
        }
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        useEditorStore.getState().duplicateSelected();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        useEditorStore.getState().removeSelected();
        return;
      }
      if (event.key === "Escape") {
        useEditorStore.getState().clearSelection();
        return;
      }
      if (event.key.startsWith("Arrow")) {
        const state = useEditorStore.getState();
        const page = state.project.pages.find(
          (candidate) => candidate.id === state.activePageId,
        );
        if (!page) {
          return;
        }
        const step = event.shiftKey ? page.grid * 5 : page.grid;
        const dx =
          event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy =
          event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        if (dx !== 0 || dy !== 0) {
          event.preventDefault();
          state.nudgeSelection(dx, dy);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);

  return (
    <div
      className={clsx(
        "app-shell",
        animationDockOpen && "has-animation-dock",
      )}
      style={
        {
          "--left-sidebar-width": `${leftWidth}px`,
          "--right-sidebar-width": `${rightWidth}px`,
        } as CSSProperties
      }
    >
      <TopBar actions={actions} />
      <DocumentTabs />
      <div className="app-body">
        <Sidebar />
        <SidebarResizer side="left" />
        <Workspace />
        {inspectorOpen ? (
          <>
            <SidebarResizer side="right" />
            <Inspector />
          </>
        ) : null}
      </div>
      {animationDockOpen ? <AnimationDock /> : null}
      <StatusBar />
      <SettingsModal />
      <AiBuildModal />
      <PageBuildModal />
      <Toaster />
    </div>
  );
}

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Pause,
  Play,
  Plus,
  Repeat,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { Keyframe, KeyframeProperty } from "../../model/types";
import {
  DEFAULT_ANIMATION,
  EASING_OPTIONS,
  hasAnimations,
} from "../../model/animations";
import { animationGroupsOf } from "../../model/animationGroups";
import {
  ANIMATABLE_PROPERTIES,
  DEFAULT_KEYFRAME_ANIMATION,
  formatKeyframeValue,
  hasKeyframes,
  keyframePropertyDefinition,
  sampleKeyframes,
} from "../../model/keyframes";
import {
  selectActivePage,
  useEditorStore,
} from "../../store/editorStore";
import { getModuleDefinitionSafe } from "../../modules/registry";
import { clamp } from "../../lib/geometry";
import { AnimationSection } from "../inspector/Inspector";
import { AnimationTriggerSection } from "./AnimationTriggerSection";
import { IconButton } from "../ui/IconButton";

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function AnimationDock() {
  const page = useEditorStore(selectActivePage);
  const selection = useEditorStore((state) => state.selection);
  const tab = useEditorStore((state) => state.animationTab);
  const time = useEditorStore((state) => state.animationTime);
  const playing = useEditorStore((state) => state.animationPlaying);
  const setTab = useEditorStore((state) => state.setAnimationTab);
  const setTime = useEditorStore((state) => state.setAnimationTime);
  const setPlaying = useEditorStore((state) => state.setAnimationPlaying);
  const setDockOpen = useEditorStore((state) => state.setAnimationDockOpen);
  const addAnimationTrack = useEditorStore(
    (state) => state.addAnimationTrack,
  );
  const removeAnimationTrack = useEditorStore(
    (state) => state.removeAnimationTrack,
  );
  const addKeyframe = useEditorStore((state) => state.addKeyframe);
  const updateKeyframe = useEditorStore((state) => state.updateKeyframe);
  const removeKeyframe = useEditorStore((state) => state.removeKeyframe);
  const setDuration = useEditorStore((state) => state.setKeyframeDuration);
  const setLoop = useEditorStore((state) => state.setKeyframeLoop);
  const setModuleAnimations = useEditorStore(
    (state) => state.setModuleAnimations,
  );
  const setPageAnimations = useEditorStore(
    (state) => state.setPageAnimations,
  );
  const setAnimationGroupTriggers = useEditorStore(
    (state) => state.setAnimationGroupTriggers,
  );
  const addAnimationGroup = useEditorStore(
    (state) => state.addAnimationGroup,
  );
  const updateAnimationGroup = useEditorStore(
    (state) => state.updateAnimationGroup,
  );
  const removeAnimationGroup = useEditorStore(
    (state) => state.removeAnimationGroup,
  );
  const duplicateAnimationGroup = useEditorStore(
    (state) => state.duplicateAnimationGroup,
  );
  const selectedGroupId = useEditorStore(
    (state) => state.animationGroupId,
  );
  const setSelectedGroupId = useEditorStore(
    (state) => state.setAnimationGroupId,
  );
  const setDesignView = useEditorStore((state) => state.setDesignView);
  const setActiveFilePath = useEditorStore(
    (state) => state.setActiveFilePath,
  );

  const targetModule =
    selection.length === 1
      ? page.modules.find((module) => module.id === selection[0])
      : undefined;
  const targetLabel = targetModule
    ? getModuleDefinitionSafe(targetModule.type).label
    : "页面";
  const targetNode = targetModule ?? page;
  const target = targetModule
    ? ({ kind: "module", moduleId: targetModule.id } as const)
    : ({ kind: "page" } as const);
  const groups = animationGroupsOf(targetNode);
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const keyframes = selectedGroup?.keyframes ?? DEFAULT_KEYFRAME_ANIMATION;
  const duration = keyframes.duration;
  const loop = keyframes.loop;
  const presetConfig = selectedGroup?.animations ?? DEFAULT_ANIMATION;
  const targetKey = targetModule ? `module-${targetModule.id}` : `page-${page.id}`;
  const targetTriggers = selectedGroup?.triggers ?? [];
  const targetHasAnimation = Boolean(
    hasAnimations(presetConfig) || hasKeyframes(keyframes),
  );

  useEffect(() => {
    const nextId = selectedGroup?.id ?? null;
    if (selectedGroupId !== nextId) {
      setSelectedGroupId(nextId);
    }
  }, [selectedGroup?.id, selectedGroupId, setSelectedGroupId]);

  const [selectedKeyframe, setSelectedKeyframe] = useState<{
    property: KeyframeProperty;
    id: string;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    property: KeyframeProperty;
    id: string;
    time: number;
  } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedKeyframe(null);
  }, [targetKey, selectedGroup?.id]);

  useEffect(() => {
    if (time > duration) {
      setTime(duration);
    }
  }, [duration, setTime, time]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const startedAt = performance.now();
    const startedTime = useEditorStore.getState().animationTime;
    let raf = 0;
    const tick = (now: number) => {
      let next = startedTime + (now - startedAt);
      if (next >= duration) {
        if (loop) {
          next %= duration;
        } else {
          next = duration;
          setPlaying(false);
        }
      }
      setTime(next);
      if (loop || next < duration) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, loop, playing, setPlaying, setTime]);

  const seekFromClientX = (clientX: number) => {
    const element = timelineRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    setPlaying(false);
    setTime(ratio * duration);
  };

  const beginSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    seekFromClientX(event.clientX);
    const move = (pointerEvent: PointerEvent) => {
      seekFromClientX(pointerEvent.clientX);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const beginKeyframeDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    property: KeyframeProperty,
    keyframe: Keyframe,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedKeyframe({ property, id: keyframe.id });
    setPlaying(false);
    setTime(keyframe.time);
    const element = timelineRef.current;
    if (!element) {
      return;
    }
    const width = element.getBoundingClientRect().width;
    const startX = event.clientX;
    let latestTime = keyframe.time;
    const move = (pointerEvent: PointerEvent) => {
      latestTime = clamp(
        Math.round(
          keyframe.time + ((pointerEvent.clientX - startX) / width) * duration,
        ),
        0,
        duration,
      );
      setDragging({ property, id: keyframe.id, time: latestTime });
      setTime(latestTime);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(null);
      if (Math.abs(latestTime - keyframe.time) > 1) {
        updateKeyframe(
          property,
          keyframe.id,
          { time: latestTime },
          selectedGroup?.id,
        );
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const sampled = sampleKeyframes(keyframes, time);
  const trackEntries = Object.entries(keyframes.tracks)
    .filter(([, track]) => track.length > 0)
    .sort(([a], [b]) => {
      const orderA = ANIMATABLE_PROPERTIES.findIndex((item) => item.key === a);
      const orderB = ANIMATABLE_PROPERTIES.findIndex((item) => item.key === b);
      return (orderA < 0 ? 999 : orderA) - (orderB < 0 ? 999 : orderB);
    });
  const availableTracks = ANIMATABLE_PROPERTIES.filter(
    (property) => (keyframes.tracks[property.key]?.length ?? 0) === 0,
  );
  const selectedData =
    selectedKeyframe &&
    (keyframes.tracks[selectedKeyframe.property] ?? []).find(
      (keyframe) => keyframe.id === selectedKeyframe.id,
    );
  const selectedProperty = selectedKeyframe
    ? keyframePropertyDefinition(selectedKeyframe.property)
    : null;

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (time >= duration) {
      setTime(0);
    }
    setPlaying(true);
  };

  const ticks = Array.from({ length: 11 }, (_, index) => index / 10);

  return (
    <section className="animation-dock">
      <header className="animation-dock-header">
        <div className="animation-target">
          <span className="animation-target-icon">
            <Clapperboard size={16} />
          </span>
          <div>
            <strong>{targetLabel}</strong>
            <small>{targetModule ? "组件动画" : "页面动画"}</small>
          </div>
        </div>

        <div className="animation-tabs">
          <button
            type="button"
            className={clsx("animation-tab", tab === "keyframes" && "is-active")}
            onClick={() => setTab("keyframes")}
          >
            关键帧
          </button>
          <button
            type="button"
            className={clsx("animation-tab", tab === "presets" && "is-active")}
            onClick={() => setTab("presets")}
          >
            预设
          </button>
          <button
            type="button"
            className={clsx("animation-tab", tab === "trigger" && "is-active")}
            onClick={() => setTab("trigger")}
          >
            触发
          </button>
        </div>

        <div
          className="animation-transport"
          style={{ display: tab === "keyframes" ? undefined : "none" }}
        >
          <IconButton
            label="回到开始"
            onClick={() => {
              setPlaying(false);
              setTime(0);
            }}
          >
            <SkipBack size={15} />
          </IconButton>
          <button
            type="button"
            className="animation-play"
            onClick={togglePlay}
            aria-label={playing ? "暂停" : "播放"}
            title={playing ? "暂停" : "播放"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <IconButton
            label="跳到结尾"
            onClick={() => {
              setPlaying(false);
              setTime(duration);
            }}
          >
            <SkipForward size={15} />
          </IconButton>
          <span className="animation-time">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <IconButton
            label="向前 100ms"
            onClick={() => setTime(time - 100)}
          >
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton
            label="向后 100ms"
            onClick={() => setTime(time + 100)}
          >
            <ChevronRight size={14} />
          </IconButton>
          <div className="animation-duration">
            <span>时长</span>
            <input
              key={`duration-${duration}`}
              type="number"
              min={0.1}
              step={0.1}
              defaultValue={formatSeconds(duration)}
              onBlur={(event) => {
                const seconds = Number(event.target.value);
                if (Number.isFinite(seconds) && seconds > 0) {
                  setDuration(seconds * 1000, selectedGroup?.id);
                }
              }}
            />
            <span>s</span>
          </div>
          <IconButton
            label={loop ? "关闭循环" : "开启循环"}
            active={loop}
            onClick={() => setLoop(!loop, selectedGroup?.id)}
          >
            <Repeat size={15} />
          </IconButton>
        </div>

        <IconButton label="关闭动画时间轴" onClick={() => setDockOpen(false)}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="animation-group-bar">
        <div className="animation-group-list">
          {groups.length === 0 ? (
            <span className="animation-group-empty">
              还没有动画，点击右侧 + 新建
            </span>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={clsx(
                  "animation-group-chip",
                  group.id === selectedGroup?.id && "is-active",
                  !group.enabled && "is-disabled",
                )}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <span className="animation-group-name">{group.name}</span>
                <small>
                  {group.triggers.length > 0
                    ? `${group.triggers.length} 触发`
                    : "自动"}
                </small>
              </button>
            ))
          )}
        </div>
        <div className="animation-group-actions">
          {selectedGroup ? (
            <>
              <input
                key={`${targetKey}-${selectedGroup.id}-name`}
                className="animation-group-rename"
                defaultValue={selectedGroup.name}
                onBlur={(event) =>
                  updateAnimationGroup(target, selectedGroup.id, {
                    name: event.target.value,
                  })
                }
                title="重命名动画"
              />
              <label className="animation-group-enabled">
                <input
                  type="checkbox"
                  checked={selectedGroup.enabled}
                  onChange={(event) =>
                    updateAnimationGroup(target, selectedGroup.id, {
                      enabled: event.target.checked,
                    })
                  }
                />
                启用
              </label>
            </>
          ) : null}
          <IconButton
            label="新建动画"
            onClick={() => {
              const id = addAnimationGroup(target);
              setSelectedGroupId(id);
              setTab("presets");
            }}
          >
            <Plus size={15} />
          </IconButton>
          <IconButton
            label="复制动画"
            disabled={!selectedGroup}
            onClick={() => {
              if (!selectedGroup) {
                return;
              }
              const id = duplicateAnimationGroup(target, selectedGroup.id);
              if (id) {
                setSelectedGroupId(id);
              }
            }}
          >
            <Copy size={14} />
          </IconButton>
          <IconButton
            label="删除动画"
            disabled={!selectedGroup}
            onClick={() => {
              if (selectedGroup) {
                removeAnimationGroup(target, selectedGroup.id);
              }
            }}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      {tab === "trigger" ? (
        <div className="animation-presets">
          <AnimationTriggerSection
            triggers={targetTriggers}
            modules={page.modules}
            scope={targetModule ? "module" : "page"}
            targetKey={targetKey}
            hasAnimation={targetHasAnimation}
            onChange={(triggers) => {
              const groupId =
                selectedGroup?.id ?? addAnimationGroup(target);
              setAnimationGroupTriggers(target, groupId, triggers);
            }}
          />
        </div>
      ) : tab === "presets" ? (
        <div className="animation-presets">
          <AnimationSection
            config={presetConfig}
            scope={targetModule ? "module" : "page"}
            onChange={(patch) => {
              const groupId =
                selectedGroup?.id ?? addAnimationGroup(target);
              if (targetModule) {
                setModuleAnimations(targetModule.id, patch, groupId);
              } else {
                setPageAnimations(patch, groupId);
              }
            }}
            onPreview={() => {
              setActiveFilePath(null);
              setDesignView("preview");
            }}
          />
        </div>
      ) : (
        <div className="timeline-layout">
          <div className="timeline-labels">
            <div className="timeline-label-spacer">
              <select
                className="timeline-add-track"
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    addAnimationTrack(
                      event.target.value,
                      time,
                      selectedGroup?.id,
                    );
                  }
                }}
                disabled={availableTracks.length === 0}
              >
                <option value="">
                  {availableTracks.length === 0
                    ? "所有轨道已添加"
                    : "+ 添加轨道"}
                </option>
                {availableTracks.map((property) => (
                  <option key={property.key} value={property.key}>
                    {property.label}
                  </option>
                ))}
              </select>
            </div>
            {trackEntries.map(([property]) => {
              const definition = keyframePropertyDefinition(property);
              return (
                <div className="timeline-label" key={property}>
                  <span>{definition.label}</span>
                  <small>
                    {formatKeyframeValue(property, sampled[property] ?? 0)}
                  </small>
                  <button
                    type="button"
                    className="timeline-add-keyframe"
                    title={`在 ${formatTime(time)} 添加${definition.label}关键帧`}
                    onClick={() =>
                      addKeyframe(property, time, undefined, selectedGroup?.id)
                    }
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    className="timeline-remove-track"
                    title="删除轨道"
                    onClick={() =>
                      removeAnimationTrack(property, selectedGroup?.id)
                    }
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="timeline-main">
            <div
              className="timeline-ruler"
              ref={timelineRef}
              onPointerDown={beginSeek}
            >
              {ticks.map((ratio) => (
                <span
                  key={ratio}
                  className="timeline-tick"
                  style={{ left: `${ratio * 100}%` }}
                >
                  {formatTime(ratio * duration)}
                </span>
              ))}
            </div>

            <div className="timeline-rows">
              {trackEntries.map(([property, track]) => {
                const definition = keyframePropertyDefinition(property);
                return (
                  <div
                    key={property}
                    className="timeline-track"
                    onPointerDown={beginSeek}
                  >
                    {track.map((keyframe) => {
                      const currentTime =
                        dragging &&
                        dragging.property === property &&
                        dragging.id === keyframe.id
                          ? dragging.time
                          : keyframe.time;
                      const selected =
                        selectedKeyframe?.property === property &&
                        selectedKeyframe.id === keyframe.id;
                      return (
                        <button
                          key={keyframe.id}
                          type="button"
                          className={clsx(
                            "timeline-keyframe",
                            selected && "is-selected",
                          )}
                          style={{
                            left: `${(currentTime / duration) * 100}%`,
                          }}
                          title={`${definition.label} ${formatTime(currentTime)} = ${formatKeyframeValue(property, keyframe.value)}`}
                          onPointerDown={(event) =>
                            beginKeyframeDrag(event, property, keyframe)
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
              {trackEntries.length === 0 ? (
                <div className="timeline-empty">
                  选择左上角的“添加轨道”开始创建关键帧动画。
                </div>
              ) : null}
            </div>

            <div
              className="timeline-playhead"
              style={{ left: `${(time / duration) * 100}%` }}
            >
              <span />
            </div>
          </div>
        </div>
      )}

      {tab === "keyframes" ? (
        <div className="keyframe-editor">
          {selectedData && selectedProperty && selectedKeyframe ? (
            <>
              <span className="keyframe-editor-label">
                {selectedProperty.label}
              </span>
              <label>
                时间
                <input
                  key={`time-${selectedData.id}-${selectedData.time}`}
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={formatSeconds(selectedData.time)}
                  onBlur={(event) => {
                    const seconds = Number(event.target.value);
                    if (Number.isFinite(seconds)) {
                      updateKeyframe(
                        selectedKeyframe.property,
                        selectedData.id,
                        { time: seconds * 1000 },
                        selectedGroup?.id,
                      );
                    }
                  }}
                />
                s
              </label>
              <label>
                值
                <input
                  key={`value-${selectedData.id}-${selectedData.value}`}
                  type="number"
                  min={selectedProperty.min}
                  max={selectedProperty.max}
                  step={selectedProperty.step}
                  defaultValue={selectedData.value}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      updateKeyframe(
                        selectedKeyframe.property,
                        selectedData.id,
                        { value },
                        selectedGroup?.id,
                      );
                    }
                  }}
                />
                {selectedProperty.unit}
              </label>
              <label>
                缓动
                <select
                  value={selectedData.easing}
                  onChange={(event) =>
                    updateKeyframe(
                      selectedKeyframe.property,
                      selectedData.id,
                      { easing: event.target.value },
                      selectedGroup?.id,
                    )
                  }
                >
                  {EASING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-danger keyframe-delete"
                onClick={() => {
                  removeKeyframe(
                    selectedKeyframe.property,
                    selectedData.id,
                    selectedGroup?.id,
                  );
                  setSelectedKeyframe(null);
                }}
              >
                <Trash2 size={13} />
                删除关键帧
              </button>
            </>
          ) : (
            <span className="keyframe-editor-hint">
              {hasKeyframes(keyframes)
                ? "点击关键帧编辑时间、值和缓动；拖动关键帧可调整时间。"
                : "点击属性右侧的 + 在当前时间添加第一个关键帧。"}
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}

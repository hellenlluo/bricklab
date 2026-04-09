"use client";

import { useState, useRef, useEffect } from "react";
import { BRICK_LIBRARY, type BrickDefinition } from "@/lib/brickLibrary";
import { useScene, type CustomBrickDefinition } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";

type AnyBrick = BrickDefinition | CustomBrickDefinition;

function createAssetFromBrick(
  brick: AnyBrick,
  index: number,
  defaultBrickColor: string,
): SceneAsset {
  const isPreset = "type" in brick;
  return {
    id: `${brick.id}-${Date.now()}`,
    name: `Brick ${index}`,
    type: "preset-brick",
    visible: true,
    selectable: true,
    modelPath: isPreset ? (brick as BrickDefinition).modelPath : "/brick.glb",
    position: [0, 0, 0],
    materialColor: defaultBrickColor,
    materialRoughness: 0.88,
    materialMetalness: 0.2,
    preset: {
      studsX: brick.studsX,
      studsY: brick.studsY,
    },
  };
}

export default function ToolBar() {
  const { assets, addAsset, customBricks, defaultBrickColor } = useScene();
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "brick-1x1",
    "brick-2x2",
    "brick-4x2",
  ]);
  const dropupRef = useRef<HTMLDivElement>(null);

  const allBricks: AnyBrick[] = [...BRICK_LIBRARY, ...customBricks];

  useEffect(() => {
    if (!expanded) return;
    function handleMouseDown(e: MouseEvent) {
      if (dropupRef.current && !dropupRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [expanded]);

  function toggleBrick(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  }

  const orderedSelectedBricks = selectedIds
    .map((id) => allBricks.find((b) => b.id === id))
    .filter(Boolean) as AnyBrick[];

  function handleAdd(brick: AnyBrick) {
    addAsset(createAssetFromBrick(brick, assets.length + 1, defaultBrickColor));
  }

  return (
    <div
      style={{
        height: "5vh",
        width: "35vw",
        bottom: "5vh",
        left: "50%",
        transform: "translateX(-50%)",
      }}
      className="fixed flex items-center px-3 gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-40"
    >
      {/* Drop-up brick type selector */}
      <div
        ref={dropupRef}
        className="relative flex-shrink-0 self-stretch flex items-center"
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span
            className="inline-block text-zinc-900 dark:text-zinc-100 transition-transform duration-200"
            style={{
              fontSize: "0.5rem",
              transform: expanded ? "rotate(-90deg)" : "rotate(0deg)",
              lineHeight: 1,
            }}
          >
            ▶
          </span>
          <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Quick Add
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {selectedIds.length}/6
          </span>
        </button>

        {expanded && (
          <div className="absolute bottom-full left-0 w-full bg-white dark:bg-zinc-900 border border-b-0 border-zinc-200 dark:border-zinc-800 rounded-t-xl z-50 overflow-hidden">
            <ul className="py-1">
              {allBricks.map((brick) => {
                const checked = selectedIds.includes(brick.id);
                const disabled = !checked && selectedIds.length >= 6;
                return (
                  <li key={brick.id}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBrick(brick.id);
                      }}
                      disabled={disabled}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors
                        ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}
                        ${checked ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}
                      `}
                    >
                      <span
                        className={`w-3.5 h-3.5 flex items-center justify-center rounded border flex-shrink-0 transition-colors
                          ${
                            checked
                              ? "bg-zinc-600 dark:bg-zinc-400 border-zinc-600 dark:border-zinc-400"
                              : "border-zinc-300 dark:border-zinc-600"
                          }
                        `}
                      >
                        {checked && (
                          <span className="text-white dark:text-zinc-900 text-[8px] leading-none font-bold">
                            ✓
                          </span>
                        )}
                      </span>
                      <span>{brick.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Quick-add brick shortcut buttons */}
      {orderedSelectedBricks.map((brick) => (
        <button
          key={brick.id}
          onClick={() => handleAdd(brick)}
          title={`Add ${brick.name} brick`}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <span className="text-zinc-500 dark:text-zinc-400 font-bold leading-none">
            +
          </span>
          <span className="font-medium">{brick.name}</span>
        </button>
      ))}
    </div>
  );
}

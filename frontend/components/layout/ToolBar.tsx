"use client";

import { useState, useRef, useEffect } from "react";
import { BRICK_LIBRARY, type BrickDefinition } from "@/lib/brickLibrary";
import { useScene, type CustomBrickDefinition } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";
import { Checkbox } from "@/components/ui/checkbox";

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
    category: "primitive",
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
        width: "35vw",
        bottom: "5vh",
        left: "50%",
        transform: "translateX(-50%)",
      }}
      className="fixed flex items-center p-2.5 gap-2 bg-background border border-border rounded-none z-40 leading-none"
    >
      {/* Drop-up brick type selector */}
      <div
        ref={dropupRef}
        className="relative flex-shrink-0 self-stretch inline-flex items-center leading-none"
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          className="h-8 flex items-center gap-2 px-2 rounded-none leading-none hover:bg-muted transition-colors"
        >
          <span
            className="inline-block text-xs text-foreground transition-transform duration-200"
            style={{
              transform: expanded ? "rotate(-90deg)" : "rotate(0deg)",
              lineHeight: 1,
            }}
          >
            ▶
          </span>
          <span className="text-sm font-semibold leading-none tracking-tight text-foreground">
            Quick Add
          </span>
          <span className="text-xs leading-none text-muted-foreground">
            {selectedIds.length}/6
          </span>
        </button>

        {expanded && (
          <div className="absolute bottom-full left-0 w-full bg-background border border-b-0 border-border rounded-none z-50 overflow-hidden">
            <ul className="py-1">
              {allBricks.map((brick) => {
                const checked = selectedIds.includes(brick.id);
                const disabled = !checked && selectedIds.length >= 6;
                return (
                  <li key={brick.id}>
                    <label
                      className={`flex items-center gap-2 w-full px-2 h-8 text-xs leading-none text-left transition-colors select-none
                        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-muted"}
                        ${checked ? "text-foreground" : "text-muted-foreground"}
                      `}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggleBrick(brick.id)}
                        className="size-3.5 flex-shrink-0"
                      />
                      <span>{brick.name}</span>
                    </label>
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
          className="h-8 flex items-center gap-1 px-2 rounded-none text-xs leading-none text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
        >
          <span className="text-muted-foreground font-normal leading-none">
            +
          </span>
          <span className="leading-none">{brick.name}</span>
        </button>
      ))}
    </div>
  );
}

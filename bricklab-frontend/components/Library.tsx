"use client";

import { useState } from "react";
import { BRICK_LIBRARY, type BrickDefinition } from "@/lib/brickLibrary";
import { useScene, type CustomBrickDefinition } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";
import BrickPreview from "@/components/BrickPreview";

function createAssetFromBrick(
  brick: BrickDefinition | CustomBrickDefinition,
  index: number,
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
    materialColor: "#bfbfff",
    materialRoughness: 0.88,
    materialMetalness: 0.2,
    preset: {
      studsX: brick.studsX,
      studsY: brick.studsY,
    },
  };
}

interface LibraryProps {
  onClose?: () => void;
}

function BrickCard({
  brick,
  onClick,
  onRemove,
  fillHeight = false,
}: {
  brick: BrickDefinition | CustomBrickDefinition;
  onClick: () => void;
  onRemove?: () => void;
  fillHeight?: boolean;
}) {
  return (
    <div className={`group relative flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 bg-white dark:bg-zinc-900 overflow-hidden transition-all${fillHeight ? " h-full" : ""}`}>
      <button
        onClick={onClick}
        className={`flex flex-col w-full cursor-pointer${fillHeight ? " flex-1 min-h-0" : ""}`}
      >
        <div className={fillHeight ? "flex-1 min-h-0 bg-zinc-100 dark:bg-zinc-800 p-2" : "aspect-6/5 w-full bg-zinc-100 dark:bg-zinc-800 p-2"}>
          <BrickPreview
            studsX={brick.studsX}
            studsY={brick.studsY}
            className="w-full h-full"
            stroke="currentColor"
            strokeWidth={0.5}
          />
        </div>
        <div className="px-2 py-1.5 text-left">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate block">
            {brick.name}
          </span>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] leading-none"
          title="Remove"
        >
          ✕
        </button>
      )}
    </div>
  );
}

type Tab = "preset" | "custom";

export default function Library({ onClose }: LibraryProps) {
  const { assets, addAsset, customBricks, addCustomBrick, removeCustomBrick } = useScene();
  const [tab, setTab] = useState<Tab>("preset");
  const [studsX, setStudsX] = useState("3");
  const [studsY, setStudsY] = useState("3");
  const [formError, setFormError] = useState<string | null>(null);

  function handleBrickClick(brick: BrickDefinition | CustomBrickDefinition) {
    addAsset(createAssetFromBrick(brick, assets.length + 1));
    onClose?.();
  }

  function handleAddCustom() {
    const x = Math.round(Number(studsX));
    const y = Math.round(Number(studsY));
    if (!studsX || !studsY || isNaN(x) || isNaN(y) || x < 1 || y < 1 || x > 32 || y > 32) {
      setFormError("Dimensions must be between 1 and 32.");
      return;
    }
    const alreadyExists =
      BRICK_LIBRARY.some((b) => b.studsX === x && b.studsY === y) ||
      customBricks.some((b) => b.studsX === x && b.studsY === y);
    if (alreadyExists) {
      setFormError(`A ${x}×${y} brick type already exists.`);
      return;
    }
    setFormError(null);
    const id = `custom-${x}x${y}-${Date.now()}`;
    const def: CustomBrickDefinition = { id, name: `${x}×${y}`, studsX: x, studsY: y };
    addCustomBrick(def);
  }

  const tabClass = (t: Tab) =>
    `flex-1 py-1.5 text-sm font-normal transition-colors rounded-md ${
      tab === t
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800"
    }`;

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Library
        </span>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-[1vw] px-[1vw] pt-2 pb-0">
        <button className={tabClass("preset")} onClick={() => setTab("preset")}>
          Preset
        </button>
        <button className={tabClass("custom")} onClick={() => setTab("custom")}>
          Custom
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {tab === "preset" && (
          <div className="h-full p-[1vw]">
            <div className="grid grid-cols-4 grid-rows-2 gap-[1vw] h-full">
              {BRICK_LIBRARY.map((brick) => (
                <BrickCard
                  key={brick.id}
                  brick={brick}
                  onClick={() => handleBrickClick(brick)}
                  fillHeight
                />
              ))}
            </div>
          </div>
        )}

        {tab === "custom" && (
          <div className="h-full overflow-y-auto p-[1vw]">
          {/* Define new custom brick */}
          <div className="flex items-end gap-1.5 mb-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">X</span>
              <input
                type="number"
                min={1}
                max={32}
                value={studsX}
                onChange={(e) => setStudsX(e.target.value)}
                className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 w-16"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">Y</span>
              <input
                type="number"
                min={1}
                max={32}
                value={studsY}
                onChange={(e) => setStudsY(e.target.value)}
                className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 w-16"
              />
            </div>
            <button
              onClick={handleAddCustom}
              className="px-3 py-1.5 rounded-md bg-zinc-700 text-white text-[10px] font-medium hover:bg-zinc-600 transition-colors"
            >
              Add
            </button>
          </div>
          {formError && (
            <p className="text-xs text-red-500 mb-2">{formError}</p>
          )}

          {customBricks.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
              No custom brick types yet. Define one above.
            </p>
          )}

          {customBricks.length > 0 && (
            <div className="grid grid-cols-4 gap-[1vw] [grid-auto-rows:calc((60vh_-_85px_-_3vw)_/_2)]">
              {customBricks.map((brick) => (
                <BrickCard
                  key={brick.id}
                  brick={brick}
                  onClick={() => handleBrickClick(brick)}
                  onRemove={() => removeCustomBrick(brick.id)}
                  fillHeight
                />
              ))}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

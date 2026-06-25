"use client";

import { useState } from "react";
import { BRICK_LIBRARY, type BrickDefinition } from "@/lib/brickLibrary";
import { useScene, type CustomBrickDefinition } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";
import BrickPreview from "@/components/BrickPreview";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function createAssetFromBrick(
  brick: BrickDefinition | CustomBrickDefinition,
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
    <div
      className={`group relative flex flex-col rounded-none border border-accent bg-accent/25 overflow-hidden transition-colors hover:bg-accent/35${fillHeight ? " h-full" : ""}`}
    >
      <button
        onClick={onClick}
        className={`flex flex-col w-full cursor-pointer${fillHeight ? " flex-1 min-h-0" : ""}`}
      >
        <div
          className={
            fillHeight ? "flex-1 min-h-0 p-2" : "aspect-6/5 w-full p-2"
          }
        >
          <BrickPreview
            studsX={brick.studsX}
            studsY={brick.studsY}
            className="w-full h-full"
            strokeWidth={0.5}
          />
        </div>
        <div className="px-2 py-1.5 text-left">
          <span className="text-xs font-medium text-accent truncate block">
            {brick.name}
          </span>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-none bg-muted text-xs text-muted-foreground hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity leading-none"
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
  const {
    assets,
    addAsset,
    customBricks,
    addCustomBrick,
    removeCustomBrick,
    defaultBrickColor,
  } = useScene();
  const [tab, setTab] = useState<Tab>("preset");
  const [studsX, setStudsX] = useState("3");
  const [studsY, setStudsY] = useState("3");
  const [formError, setFormError] = useState<string | null>(null);

  function handleBrickClick(brick: BrickDefinition | CustomBrickDefinition) {
    addAsset(createAssetFromBrick(brick, assets.length + 1, defaultBrickColor));
    onClose?.();
  }

  function handleAddCustom() {
    const x = Math.round(Number(studsX));
    const y = Math.round(Number(studsY));
    if (
      !studsX ||
      !studsY ||
      isNaN(x) ||
      isNaN(y) ||
      x < 1 ||
      y < 1 ||
      x > 32 ||
      y > 32
    ) {
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
    const def: CustomBrickDefinition = {
      id,
      name: `${x}×${y}`,
      studsX: x,
      studsY: y,
    };
    addCustomBrick(def);
  }

  const tabClass = (t: Tab) =>
    `flex-1 h-8 flex items-center justify-center text-sm font-normal leading-none text-foreground transition-colors rounded-none ${
      tab === t ? "bg-muted" : "hover:bg-muted"
    }`;

  return (
    <div className="flex flex-col h-[calc(60vh-0.25rem)]">
      {/* Header */}
      <div className="px-2.5 py-2 border-b border-border">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Library
        </span>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 px-2.5 pt-5 pb-0">
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
          <div className="h-full p-2.5">
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full">
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
          <div className="h-full overflow-y-auto p-2.5">
            {/* Define new custom brick */}
            <div className="flex items-end gap-1.5 mb-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground text-center">
                  X
                </span>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={studsX}
                  onChange={(e) => setStudsX(e.target.value)}
                  className="w-16"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground text-center">
                  Y
                </span>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={studsY}
                  onChange={(e) => setStudsY(e.target.value)}
                  className="w-16"
                />
              </div>
              <Button
                onClick={handleAddCustom}
                className="!h-8 !py-0 flex items-center justify-center shrink-0 leading-none"
              >
                Add
              </Button>
            </div>
            {formError && (
              <p className="text-xs text-red-500 mb-2">{formError}</p>
            )}

            {customBricks.length === 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                No custom brick types yet. Define one above.
              </p>
            )}

            {customBricks.length > 0 && (
              <div className="grid grid-cols-4 gap-2 [grid-auto-rows:calc((60vh_-_0.25rem_-_85px_-_40px)_/_2)]">
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

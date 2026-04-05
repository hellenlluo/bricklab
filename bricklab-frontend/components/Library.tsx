"use client";

import { BRICK_LIBRARY, type BrickDefinition } from "@/lib/brickLibrary";
import { useScene } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";
import BrickPreview from "@/components/BrickPreview";

function createAssetFromBrick(
  brick: BrickDefinition,
  index: number,
): SceneAsset {
  return {
    id: `${brick.id}-${Date.now()}`,
    name: `Brick ${index}`,
    type: brick.type,
    visible: true,
    selectable: true,
    modelPath: brick.modelPath,
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

export default function Library({ onClose }: LibraryProps) {
  const { assets, addAsset } = useScene();

  function handleBrickClick(brick: BrickDefinition) {
    addAsset(createAssetFromBrick(brick, assets.length + 1));
    onClose?.();
  }

  return (
    <div>
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Library
        </span>
      </div>

      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-4 gap-3">
          {BRICK_LIBRARY.map((brick) => (
            <button
              key={brick.id}
              onClick={() => handleBrickClick(brick)}
              className="group flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 bg-white dark:bg-zinc-900 overflow-hidden transition-all cursor-pointer"
            >
              <div className="aspect-square w-full bg-[#F5F5F5] dark:bg-zinc-800 p-2">
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
          ))}
        </div>
      </div>
    </div>
  );
}

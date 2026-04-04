"use client";

import { BRICK_LIBRARY, type BrickDefinition } from "@/lib/brickLibrary";
import { useScene } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";

function createAssetFromBrick(
  brick: BrickDefinition,
  index: number,
): SceneAsset {
  return {
    id: `${brick.id}-${Date.now()}`,
    name: `Brick ${index}`,
    type: brick.type,
    visible: true,
    modelPath: brick.modelPath,
    position: [0, 0, 0],
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
              className="group flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-400 bg-white dark:bg-zinc-900 overflow-hidden transition-all cursor-pointer"
            >
              <div
                className={`aspect-square w-full flex items-center justify-center ${
                  brick.modelPath
                    ? "bg-[#F5F5F5] dark:bg-zinc-800"
                    : "bg-[#F5F5F5] dark:bg-zinc-800"
                }`}
              >
                {brick.modelPath ? (
                  <span className="text-3xl select-none">🧱</span>
                ) : (
                  <span className="block w-8 h-8 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded" />
                )}
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

"use client";

import { useState, useEffect } from "react";
import { useScene } from "@/store/sceneStore";
import Input from "@/components/ui/Input";

function normalizePlateSize(size: number): number {
  const rounded = Math.max(2, Math.round(size));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export default function SettingsPanel() {
  const {
    sceneBackground,
    setSceneBackground,
    plateSize,
    setPlateSize,
    plateColor,
    setPlateColor,
    maxCameraDistance,
    setMaxCameraDistance,
    defaultBrickColor,
    setDefaultBrickColor,
    selectionColor,
    setSelectionColor,
  } = useScene();
  const [plateSizeDraft, setPlateSizeDraft] = useState(String(plateSize));
  const [maxDistanceDraft, setMaxDistanceDraft] = useState(
    String(maxCameraDistance),
  );

  useEffect(() => {
    setPlateSizeDraft(String(plateSize));
  }, [plateSize]);

  useEffect(() => {
    setMaxDistanceDraft(String(maxCameraDistance));
  }, [maxCameraDistance]);

  return (
    <div data-no-deselect className="px-3 py-3 flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
          Background Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={sceneBackground}
            onChange={(e) => setSceneBackground(e.target.value)}
            className="w-7 h-7 rounded-none cursor-pointer border border-zinc-400 dark:border-zinc-500 bg-transparent p-0.5"
          />
          <Input
            type="text"
            value={sceneBackground}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setSceneBackground(v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                setSceneBackground(sceneBackground);
              }
            }}
            maxLength={7}
            className="w-full font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
          Baseplate Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={plateColor}
            onChange={(e) => setPlateColor(e.target.value)}
            className="w-7 h-7 rounded-none cursor-pointer border border-zinc-400 dark:border-zinc-500 bg-transparent p-0.5"
          />
          <Input
            type="text"
            value={plateColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPlateColor(v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                setPlateColor(plateColor);
              }
            }}
            maxLength={7}
            className="w-full font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
          Baseplate Size
        </span>
        <Input
          type="number"
          min={2}
          step={2}
          value={plateSizeDraft}
          onChange={(e) => setPlateSizeDraft(e.target.value)}
          onBlur={() => {
            const n = parseInt(plateSizeDraft, 10);
            if (!isNaN(n) && n > 0) {
              const normalized = normalizePlateSize(n);
              setPlateSize(normalized);
              setPlateSizeDraft(String(normalized));
            } else {
              setPlateSizeDraft(String(plateSize));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setPlateSizeDraft(String(plateSize));
          }}
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
          Max Zoom Distance
        </span>
        <Input
          type="number"
          min={1}
          value={maxDistanceDraft}
          onChange={(e) => setMaxDistanceDraft(e.target.value)}
          onBlur={() => {
            const n = parseInt(maxDistanceDraft, 10);
            if (!isNaN(n) && n > 0) {
              setMaxCameraDistance(n);
              setMaxDistanceDraft(String(n));
            } else {
              setMaxDistanceDraft(String(maxCameraDistance));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape")
              setMaxDistanceDraft(String(maxCameraDistance));
          }}
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
          Default Brick Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={defaultBrickColor}
            onChange={(e) => setDefaultBrickColor(e.target.value)}
            className="w-7 h-7 rounded-none cursor-pointer border border-zinc-400 dark:border-zinc-500 bg-transparent p-0.5"
          />
          <Input
            type="text"
            value={defaultBrickColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setDefaultBrickColor(v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                setDefaultBrickColor(defaultBrickColor);
              }
            }}
            maxLength={7}
            className="w-full font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
          Selection Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={selectionColor}
            onChange={(e) => setSelectionColor(e.target.value)}
            className="w-7 h-7 rounded-none cursor-pointer border border-zinc-400 dark:border-zinc-500 bg-transparent p-0.5"
          />
          <Input
            type="text"
            value={selectionColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setSelectionColor(v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                setSelectionColor(selectionColor);
              }
            }}
            maxLength={7}
            className="w-full font-mono"
          />
        </div>
      </div>
    </div>
  );
}

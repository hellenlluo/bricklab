"use client";

import { useScene } from "@/store/sceneStore";

export default function SettingsPanel() {
  const { sceneBackground, setSceneBackground } = useScene();

  return (
    <div data-no-deselect className="px-3 py-3 flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Background Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={sceneBackground}
            onChange={(e) => setSceneBackground(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent p-0.5"
          />
          <input
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
            className="text-xs bg-[#F5F5F5] dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 w-full font-mono"
          />
        </div>
      </div>
    </div>
  );
}

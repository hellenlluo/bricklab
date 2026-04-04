"use client";

import PropertiesPanel from "@/components/panels/PropertiesPanel";
import SettingsPanel from "@/components/panels/SettingsPanel";
import { useScene } from "@/store/sceneStore";

export default function RightSidebar() {
  const { selectedAssetId } = useScene();

  return (
    <aside
      style={{ width: "15vw", top: "9.5vh", right: "1vw", bottom: "1vh" }}
      className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-40 overflow-y-auto"
    >
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {selectedAssetId ? "Properties" : "Scene Settings"}
        </span>
      </div>
      {selectedAssetId ? <PropertiesPanel /> : <SettingsPanel />}
    </aside>
  );
}

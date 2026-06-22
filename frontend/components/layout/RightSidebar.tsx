"use client";

import PropertiesPanel from "@/components/panels/PropertiesPanel";
import SettingsPanel from "@/components/panels/SettingsPanel";
import { useScene } from "@/store/sceneStore";
import { usePrefixEdit } from "@/store/usePrefixEdit";

export default function RightSidebar() {
  const { selectedAssetId } = useScene();
  const { phase } = usePrefixEdit();

  const hasActivePrefixEdit =
    phase === "editing_prefix" || phase === "regenerating";
  const showProperties = !!selectedAssetId || hasActivePrefixEdit;

  return (
    <aside
      style={{
        width: "15vw",
        top: "7.5vh",
        right: 0,
        bottom: 0,
      }}
      className="fixed bg-background border-l border-border z-40 overflow-y-auto"
    >
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold tracking-tight text-foreground">
          {showProperties ? "Properties" : "Scene Settings"}
        </span>
      </div>
      {showProperties ? <PropertiesPanel /> : <SettingsPanel />}
    </aside>
  );
}

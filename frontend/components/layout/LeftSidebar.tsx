"use client";

import AssetsPanel from "@/components/panels/AssetsPanel";
import ScenesPanel from "@/components/panels/ScenesPanel";
import ConstraintsPanel from "@/components/panels/ConstraintsPanel";

export default function LeftSidebar() {
  return (
    <aside
      style={{
        width: "15vw",
        top: "7.5vh",
        left: 0,
        bottom: 0,
      }}
      className="fixed bg-background border-r border-border z-40 overflow-y-auto"
    >
      <ScenesPanel />
      <AssetsPanel />
      <ConstraintsPanel />
    </aside>
  );
}

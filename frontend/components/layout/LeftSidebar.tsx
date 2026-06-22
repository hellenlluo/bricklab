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
      className="fixed bg-white dark:bg-zinc-900 border-r border-zinc-400 dark:border-zinc-600 z-40 overflow-y-auto"
    >
      <ScenesPanel />
      <AssetsPanel />
      <ConstraintsPanel />
    </aside>
  );
}

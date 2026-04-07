"use client";

import AssetsPanel from "@/components/panels/AssetsPanel";
import ScenesPanel from "@/components/panels/ScenesPanel";

export default function LeftSidebar() {
  return (
    <aside
      style={{ width: "15vw", top: "9.5vh", left: "1vw", bottom: "1vh" }}
      className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-40 overflow-y-auto"
    >
      <ScenesPanel />
      <AssetsPanel />
    </aside>
  );
}

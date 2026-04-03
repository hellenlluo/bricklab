"use client";

import { useState } from "react";
import Docs from "@/components/Docs";
import Generator from "@/components/Generator";
import Library from "@/components/Library";
import Exporter from "@/components/Exporter";
import Importer from "@/components/Importer";

type Panel = "Docs" | "Generator" | "Library" | "Exporter" | "Importer";

const NAV_ITEMS: Panel[] = [
  "Docs",
  "Generator",
  "Library",
  "Exporter",
  "Importer",
];

const PANEL_COMPONENTS: Record<Panel, React.ReactNode> = {
  Docs: <Docs />,
  Generator: <Generator />,
  Library: <Library />,
  Exporter: <Exporter />,
  Importer: <Importer />,
};

export default function TopNav() {
  const [activePanel, setActivePanel] = useState<Panel | null>(null);

  const handleButtonClick = (panel: Panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="relative w-full">
      <nav
        style={{ height: "7.5vh" }}
        className="w-full flex items-center justify-between px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800"
      >
        {/* Left: Title */}
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          BrickLab
        </span>

        {/* Right: Nav buttons */}
        <div className="flex items-center gap-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => handleButtonClick(item)}
              className={`px-4 py-1.5 rounded-md text-sm font-normal transition-colors ${
                activePanel === item
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>

      {/* Centered panel card with dimmed backdrop */}
      {activePanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setActivePanel(null)}
        >
          <div
            className="w-72 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {PANEL_COMPONENTS[activePanel]}
          </div>
        </div>
      )}
    </div>
  );
}

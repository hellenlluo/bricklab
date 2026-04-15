"use client";

import { useState, useEffect } from "react";
import Docs from "@/components/Docs";
import Generator from "@/components/Generator";
import Library from "@/components/Library";
import Exporter from "@/components/Exporter";

type Panel = "Docs" | "Generator" | "Library" | "Exporter";

const NAV_ITEMS: Panel[] = [
  "Docs",
  "Generator",
  "Library",
  "Exporter",
];

export default function TopNav() {
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const isGeneratorLocked = activePanel === "Generator";

  const closePanel = () => setActivePanel(null);

  const handleButtonClick = (panel: Panel) => {
    if (isGeneratorLocked) return;
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  useEffect(() => {
    if (!isGeneratorLocked) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isGeneratorLocked]);

  function renderPanel(panel: Panel) {
    switch (panel) {
      case "Library":
        return <Library onClose={closePanel} />;
      case "Docs":
        return <Docs />;
      case "Generator":
        return <Generator onClose={closePanel} />;
      case "Exporter":
        return <Exporter onClose={closePanel} />;
    }
  }

  return (
    <>
      <nav
        style={{ height: "7.5vh", top: "1vh", left: "1vw", right: "1vw" }}
        className="fixed flex items-center justify-between px-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-40"
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

      {/* Panel modal */}
      {activePanel && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center bg-black/40"
          style={{ top: "8.5vh" }}
          onClick={isGeneratorLocked ? undefined : closePanel}
        >
          <div
            className={`rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 ${
              activePanel === "Library" || activePanel === "Docs"
                ? "w-[40vw]"
                : activePanel === "Generator"
                  ? "w-[50vw]"
                  : activePanel === "Exporter"
                    ? "w-96"
                    : "w-72"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {renderPanel(activePanel)}
          </div>
        </div>
      )}
    </>
  );
}

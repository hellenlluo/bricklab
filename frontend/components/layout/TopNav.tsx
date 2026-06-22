"use client";

import { useState, useEffect } from "react";
import Docs from "@/components/Docs";
import Generator from "@/components/Generator";
import Library from "@/components/Library";
import Exporter from "@/components/Exporter";
import BrickPreview from "@/components/BrickPreview";

type Panel = "Docs" | "Generator" | "Library" | "Exporter";

const NAV_ITEMS: Panel[] = ["Docs", "Generator", "Library", "Exporter"];

export default function TopNav() {
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [generatorIsGenerating, setGeneratorIsGenerating] = useState(false);
  const isGeneratorLocked = generatorIsGenerating;

  const closePanel = () => {
    setActivePanel(null);
    setGeneratorIsGenerating(false);
  };

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
        return (
          <Generator
            onClose={closePanel}
            onGeneratingChange={setGeneratorIsGenerating}
          />
        );
      case "Exporter":
        return <Exporter onClose={closePanel} />;
    }
  }

  const sidebarWidth = "15vw";

  return (
    <>
      <nav
        style={{ height: "7.5vh", top: 0, left: 0, right: 0 }}
        className="relative fixed flex items-stretch bg-background border-b border-border z-40 pr-[15vw]"
      >
        {/* Left sidebar column */}
        <div
          style={{ width: sidebarWidth }}
          className="flex shrink-0 items-center px-3 border-r border-border"
        >
          <span className="inline-flex items-center gap-1.5 text-xl font-normal tracking-tight text-accent px-2 py-0.5 border border-accent bg-chart-1">
            <BrickPreview
              studsX={1}
              studsY={1}
              className="w-6 h-6 shrink-0"
              strokeWidth={0.5}
            />
            BrickLab
          </span>
        </div>

        {/* Center (canvas) */}
        <div className="min-w-0 flex-1" />

        {/* Nav items */}
        <div className="flex shrink-0 items-center gap-2 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => handleButtonClick(item)}
              className={`h-6.5 flex items-center justify-center px-2 rounded-none text-sm font-normal leading-none text-foreground transition-colors ${
                activePanel === item ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Right divider — absolutely positioned to match RightSidebar's fixed right:0 width:15vw */}
        <div
          className="absolute top-0 bottom-0 right-0 border-l border-border"
          style={{ width: sidebarWidth }}
          aria-hidden
        />
      </nav>

      {/* Panel modal */}
      {activePanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={isGeneratorLocked ? undefined : closePanel}
        >
          <div
            className={`rounded-none border border-border bg-background ${
              activePanel === "Library"
                ? "w-[calc(40vw-0.75rem)]"
                : activePanel === "Docs"
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

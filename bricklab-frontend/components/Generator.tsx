"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Tab = "text-to-3d" | "image-to-3d";

export default function Generator() {
  const [tab, setTab] = useState<Tab>("text-to-3d");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const tabClass = (t: Tab) =>
    `flex-1 py-1.5 text-sm font-normal transition-colors rounded-md ${
      tab === t
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800"
    }`;

  function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setHasResult(false);
    // Placeholder: simulate generation
    setTimeout(() => {
      setIsGenerating(false);
      setHasResult(true);
    }, 1500);
  }

  return (
    <div className="flex flex-col h-[70vh]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Generator
        </span>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-[1vw] px-[1vw] pt-2 pb-0">
        <button
          className={tabClass("text-to-3d")}
          onClick={() => setTab("text-to-3d")}
        >
          Text-to-3D
        </button>
        <button
          className={tabClass("image-to-3d")}
          onClick={() => setTab("image-to-3d")}
        >
          Image-to-3D
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {tab === "text-to-3d" && (
          <div className="flex flex-col h-full p-[1vw] gap-[1vw]">
            {/* Prompt input + Generate button */}
            <div className="flex gap-2">
              <Input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="Describe a 3D brick structure..."
                className="flex-1"
              />
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="whitespace-nowrap px-6"
              >
                {isGenerating ? "Generating…" : "Generate"}
              </Button>
            </div>

            {/* Viewport */}
            <div className="flex-1 min-h-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
              {isGenerating && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 animate-pulse">
                  Generating…
                </span>
              )}
              {!isGenerating && !hasResult && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  Preview
                </span>
              )}
              {!isGenerating && hasResult && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  [3D preview placeholder]
                </span>
              )}
            </div>
          </div>
        )}

        {tab === "image-to-3d" && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-zinc-400 dark:text-zinc-500">
              Coming soon
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

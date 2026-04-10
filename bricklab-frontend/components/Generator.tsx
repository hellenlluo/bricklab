"use client";

import { useState, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ParametricBrick from "@/components/ParametricBrick";
import { useScene } from "@/store/sceneStore";
import type { SceneAsset } from "@/store/sceneStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "text-to-3d" | "image-to-3d";

interface BrickData {
  h: number;
  w: number;
  x: number;
  y: number;
  z: number;
}

interface GeneratorProps {
  onClose: () => void;
}

const PREVIEW_FOV = 35;
const PREVIEW_PADDING = 1.35;

function computePreviewCamera(bricks: BrickData[]): {
  position: [number, number, number];
  target: [number, number, number];
} {
  if (bricks.length === 0) {
    return { position: [15, -15, 12], target: [0, 0, 0] };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const b of bricks) {
    minX = Math.min(minX, b.x);       maxX = Math.max(maxX, b.x + b.h);
    minY = Math.min(minY, b.y);       maxY = Math.max(maxY, b.y + b.w);
    minZ = Math.min(minZ, b.z);       maxZ = Math.max(maxZ, b.z + 1);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const target: [number, number, number] = [cx, -cy, cz];

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const radius = Math.sqrt(spanX * spanX + spanY * spanY + spanZ * spanZ) / 2;

  const halfFovRad = (PREVIEW_FOV * Math.PI) / 180 / 2;
  const dist = (radius * PREVIEW_PADDING) / Math.tan(halfFovRad);

  const iso = dist / Math.sqrt(3);
  const position: [number, number, number] = [cx + iso, -cy - iso, cz + iso];

  return { position, target };
}

function BrickPreviewScene({ bricks }: { bricks: BrickData[] }) {
  const { target } = useMemo(() => computePreviewCamera(bricks), [bricks]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, -5, 15]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls
        target={target}
        enableDamping
        dampingFactor={0.1}
      />
      <group>
        {bricks.map((b, i) => (
          <group key={i} position={[b.x, -b.y, b.z]}>
            <ParametricBrick studsX={b.h} studsY={b.w} color="#74a7fe" />
          </group>
        ))}
      </group>
    </>
  );
}

export default function Generator({ onClose }: GeneratorProps) {
  const { addAssetsAsGroup, assets, defaultBrickColor } = useScene();
  const [tab, setTab] = useState<Tab>("text-to-3d");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [bricks, setBricks] = useState<BrickData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const tabClass = (t: Tab) =>
    `flex-1 py-1.5 text-sm font-normal transition-colors rounded-md ${
      tab === t
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800"
    }`;

  async function handleGenerate() {
    if (!prompt.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setBricks([]);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Server error ${res.status}`);
      }
      const data: { bricks: BrickData[]; total_bricks: number } =
        await res.json();
      setBricks(data.bricks);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  }

  function handleAddToScene() {
    abortRef.current?.abort();
    abortRef.current = null;

    if (bricks.length > 0) {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      for (const b of bricks) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, -b.y);
        minZ = Math.min(minZ, b.z);
      }

      const ts = Date.now();
      const sceneAssets: SceneAsset[] = bricks.map((b, i) => ({
        id: `gen-${i}-${ts}`,
        name: `Brick ${assets.length + i + 1}`,
        type: "preset-brick",
        visible: true,
        selectable: true,
        position: [b.x - minX, -b.y - minY, b.z - minZ] as [number, number, number],
        materialColor: defaultBrickColor,
        materialRoughness: 0.88,
        materialMetalness: 0.2,
        preset: { studsX: b.h, studsY: b.w },
      }));
      const label = prompt.trim().slice(0, 20);
      addAssetsAsGroup(sceneAssets, `Generated (${label})`);
    }

    onClose();
  }

  const hasResult = bricks.length > 0;

  const { position: cameraPosition } = useMemo(
    () => computePreviewCamera(bricks),
    [bricks],
  );

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
                disabled={isGenerating}
              />
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="whitespace-nowrap shrink-0"
              >
                Generate
              </Button>
            </div>

            {/* Viewport */}
            <div className="relative flex-1 min-h-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
              {isGenerating && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 animate-pulse">
                  Generating…
                </span>
              )}
              {!isGenerating && error && (
                <span className="text-xs text-red-500 dark:text-red-400 px-4 text-center">
                  {error}
                </span>
              )}
              {!isGenerating && !error && !hasResult && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  Preview
                </span>
              )}
              {!isGenerating && hasResult && (
                <Canvas
                  camera={{
                    position: cameraPosition,
                    fov: 35,
                    up: [0, 0, 1],
                  }}
                  gl={{ antialias: true }}
                  style={{ position: "absolute", inset: 0 }}
                >
                  <color attach="background" args={["#f4f4f5"]} />
                  <BrickPreviewScene bricks={bricks} />
                </Canvas>
              )}
            </div>

            {/* Cancel / Add to Scene */}
            <div className="flex gap-2 justify-end">
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToScene}
                disabled={!hasResult}
              >
                Add to Scene
              </Button>
            </div>
          </div>
        )}

        {tab === "image-to-3d" && (
          <div className="flex flex-col h-full p-[1vw] gap-[1vw]">
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                Coming soon
              </span>
            </div>

            {/* Cancel / Add to Scene */}
            <div className="flex gap-2 justify-end">
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToScene}
                disabled={!hasResult}
              >
                Add to Scene
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

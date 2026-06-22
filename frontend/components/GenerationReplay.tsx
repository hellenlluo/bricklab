"use client";

import { useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import ParametricBrick from "@/components/ParametricBrick";
import type { GenerationHistoryEntry } from "@/store/sceneStore";

const PREVIEW_FOV = 35;
const PREVIEW_PADDING = 1.35;
const CURRENT_STEP_COLOR = "#96d35f";
const OTHER_BRICK_COLOR = "#74a7fe";

const BASE_STEPS_PER_SECOND = 6;
const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;
type Speed = (typeof SPEED_OPTIONS)[number];

function computeCamera(entries: GenerationHistoryEntry[]): {
  position: [number, number, number];
  target: [number, number, number];
} {
  if (entries.length === 0) {
    return { position: [15, -15, 12], target: [0, 0, 0] };
  }

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const b of entries) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.studsX);
    minY = Math.min(minY, b.y - b.studsY);
    maxY = Math.max(maxY, b.y);
    minZ = Math.min(minZ, b.z);
    maxZ = Math.max(maxZ, b.z + 1);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const target: [number, number, number] = [cx, cy, cz];

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const radius = Math.sqrt(spanX * spanX + spanY * spanY + spanZ * spanZ) / 2;

  const halfFovRad = (PREVIEW_FOV * Math.PI) / 180 / 2;
  const dist = (radius * PREVIEW_PADDING) / Math.tan(halfFovRad);

  const iso = dist / Math.sqrt(3);
  const position: [number, number, number] = [cx + iso, cy - iso, cz + iso];

  return { position, target };
}

function ReplayScene({
  entries,
  step,
}: {
  entries: GenerationHistoryEntry[];
  step: number;
}) {
  const visible = entries.slice(0, step + 1);
  const { target } = useMemo(() => computeCamera(entries), [entries]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, -5, 15]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls target={target} enableDamping dampingFactor={0.1} />
      <group>
        {visible.map((b, i) => (
          <group key={i} position={[b.x, b.y, b.z]}>
            <ParametricBrick
              studsX={b.studsX}
              studsY={b.studsY}
              color={i === step ? CURRENT_STEP_COLOR : OTHER_BRICK_COLOR}
            />
          </group>
        ))}
      </group>
    </>
  );
}

interface GenerationReplayProps {
  generationHistory: GenerationHistoryEntry[];
  groupName: string;
  onClose: () => void;
}

export default function GenerationReplay({
  generationHistory,
  onClose,
}: GenerationReplayProps) {
  const [step, setStep] = useState(generationHistory.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const maxStep = generationHistory.length - 1;
  const atEnd = step >= maxStep;

  const { position: cameraPosition } = useMemo(
    () => computeCamera(generationHistory),
    [generationHistory],
  );

  useEffect(() => {
    if (!isPlaying) return;
    if (step >= maxStep) return;
    const delay = 1000 / (BASE_STEPS_PER_SECOND * speed);
    const id = window.setTimeout(() => {
      const nextStep = Math.min(step + 1, maxStep);
      setStep(nextStep);
      if (nextStep >= maxStep) {
        setIsPlaying(false);
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [isPlaying, step, maxStep, speed]);

  function togglePlay() {
    if (atEnd) {
      setStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }

  function handleSliderPointerDown() {
    setIsPlaying(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="relative flex flex-col w-[60vw] h-[65vh] bg-white dark:bg-zinc-900 rounded-none shadow-2xl border border-zinc-400 dark:border-zinc-600 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-400 dark:border-zinc-600">
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Generation Replay
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-500 transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* 3D viewport */}
        <div className="flex-1 min-h-0 bg-zinc-100 dark:bg-zinc-800">
          <Canvas
            camera={{
              position: cameraPosition,
              fov: PREVIEW_FOV,
              up: [0, 0, 1],
            }}
            gl={{ antialias: true }}
            style={{ width: "100%", height: "100%" }}
          >
            <color attach="background" args={["#f4f4f5"]} />
            <ReplayScene entries={generationHistory} step={step} />
          </Canvas>
        </div>

        {/* Playback controls */}
        <div className="px-3 py-4 border-t border-zinc-400 dark:border-zinc-600 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={atEnd ? "Restart" : isPlaying ? "Pause" : "Play"}
              className="w-7 h-7 flex items-center justify-center rounded-none bg-accent text-white hover:bg-accent-dark transition-colors shrink-0"
            >
              {atEnd ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="4" y="5" width="3" height="14" rx="1" />
                  <path d="M19 5v14l-10-7z" />
                </svg>
              ) : isPlaying ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7 5v14l12-7z" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min={0}
              max={maxStep}
              value={step}
              onPointerDown={handleSliderPointerDown}
              onChange={(e) => setStep(Number(e.target.value))}
              className="flex-1 accent-accent cursor-pointer"
            />

            <div
              className="flex items-center gap-0.5 rounded-none border border-zinc-400 dark:border-zinc-500 p-0.5 shrink-0"
              data-no-deselect
            >
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`px-1.5 py-0.5 text-[10px] rounded-none leading-none transition-colors ${
                    speed === s
                      ? "bg-accent text-white"
                      : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-500">
            <span>
              Step {step + 1} of {generationHistory.length}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-none"
                  style={{ backgroundColor: CURRENT_STEP_COLOR }}
                />
                Current
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-none"
                  style={{ backgroundColor: OTHER_BRICK_COLOR }}
                />
                Placed
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

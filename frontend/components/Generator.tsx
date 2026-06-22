"use client";

import Image from "next/image";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ParametricBrick from "@/components/ParametricBrick";
import { useScene } from "@/store/sceneStore";
import type {
  SceneAsset,
  AssetCategory,
  GenerationHistoryEntry,
  ConstraintBox,
} from "@/store/sceneStore";
import { computeGenerationOffset } from "@/lib/prefixEditing";
import {
  uploadImage,
  predictMask,
  reconstruct as image3dReconstruct,
  revoxelize,
  type VoxelData,
  type ClickPoint,
} from "@/lib/image3dApi";
import {
  generateTextBricksStream,
  regenerateTextBricksFromPrefixStream,
} from "@/lib/text3dApi";

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
  onGeneratingChange?: (generating: boolean) => void;
}

const PREVIEW_FOV = 35;
const PREVIEW_PADDING = 1.35;

const WORLD_DIM = 20;
const CONSTRAINT_COLOR = "#FFAB91";
const CONSTRAINT_EDGE_COLOR = "#FF8A65";
const GRID_COLOR = "#7ec8e3";

// Fixed camera that shows the entire 20×20×20 workspace cube.
// Derivation (same formula as computePreviewCamera):
//   radius = WORLD_DIM * sqrt(3) / 2 ≈ 17.32
//   dist   = radius * PREVIEW_PADDING / tan(PREVIEW_FOV/2 in rad) ≈ 74.2
//   iso    = dist / sqrt(3) ≈ 42.8  → position offset from cube centre [10,−10,10]
const WORKSPACE_CAM_POS: [number, number, number] = [52.8, -52.8, 52.8];
const WORKSPACE_CAM_TARGET: [number, number, number] = [
  WORLD_DIM / 2,
  -WORLD_DIM / 2,
  WORLD_DIM / 2,
];
const TOOLBAR_BUTTON_CLASS =
  "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap py-0 leading-none";

function PreviewAxes() {
  const axes = useMemo(() => {
    const group = new THREE.Group();
    const d = WORLD_DIM * 0.2;
    const makeAxis = (color: number, to: [number, number, number]) => {
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...to)];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        depthTest: true,
      });
      return new THREE.Line(geom, mat);
    };
    group.add(makeAxis(0xff0000, [d, 0, 0]));
    group.add(makeAxis(0x00ff00, [0, d, 0]));
    group.add(makeAxis(0x0000ff, [0, 0, d]));
    return group;
  }, []);
  return <primitive object={axes} />;
}

function WorldBoundingBox() {
  return (
    <group position={[WORLD_DIM / 2, -WORLD_DIM / 2, WORLD_DIM / 2]}>
      <mesh>
        <boxGeometry args={[WORLD_DIM, WORLD_DIM, WORLD_DIM]} />
        <meshBasicMaterial
          color={GRID_COLOR}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(WORLD_DIM, WORLD_DIM, WORLD_DIM)]}
        />
        <lineBasicMaterial
          color={GRID_COLOR}
          transparent
          opacity={0.5}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </lineSegments>
      {[0, 1].flatMap((xi) =>
        [0, 1].flatMap((yi) =>
          [0, 1].map((zi) => (
            <mesh
              key={`${xi}-${yi}-${zi}`}
              position={[
                (xi - 0.5) * WORLD_DIM,
                (yi - 0.5) * WORLD_DIM,
                (zi - 0.5) * WORLD_DIM,
              ]}
            >
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial
                color={GRID_COLOR}
                polygonOffset
                polygonOffsetFactor={2}
                polygonOffsetUnits={2}
              />
            </mesh>
          )),
        ),
      )}
    </group>
  );
}

function ConstraintPreviewBox({ box }: { box: ConstraintBox }) {
  const cx = box.posX + box.sizeX / 2;
  const cy = -(box.posY + box.sizeY / 2);
  const cz = box.posZ + box.sizeZ / 2;

  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <boxGeometry args={[box.sizeX, box.sizeY, box.sizeZ]} />
        <meshBasicMaterial
          color={CONSTRAINT_COLOR}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(box.sizeX, box.sizeY, box.sizeZ)]}
        />
        <lineBasicMaterial
          color={CONSTRAINT_EDGE_COLOR}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </lineSegments>
      {[0, 1].flatMap((xi) =>
        [0, 1].flatMap((yi) =>
          [0, 1].map((zi) => (
            <mesh
              key={`cv-${xi}-${yi}-${zi}`}
              position={[
                (xi - 0.5) * box.sizeX,
                (yi - 0.5) * box.sizeY,
                (zi - 0.5) * box.sizeZ,
              ]}
            >
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshBasicMaterial
                color={CONSTRAINT_EDGE_COLOR}
                polygonOffset
                polygonOffsetFactor={1}
                polygonOffsetUnits={1}
              />
            </mesh>
          )),
        ),
      )}
    </group>
  );
}

const BRICK_COLOR = "#74a7fe";
const SELECTED_BRICK_COLOR = "#96d35f";
const COLLIDING_BRICK_COLOR = "#ff4444";

// Interactive translate gizmo for the currently selected brick. Snaps the
// brick back to the integer BrickGPT grid on release and commits the move.
function BrickEditGizmo({
  brick,
  index,
  onCommitMove,
}: {
  brick: BrickData;
  index: number;
  onCommitMove: (index: number, x: number, y: number, z: number) => void;
}) {
  const scene = useThree((s) => s.scene);
  const pivot = useMemo(() => new THREE.Group(), []);
  const lastPivot = useRef(new THREE.Vector3());

  // Centre the gizmo on the brick whenever the selection or its position
  // changes (scene-space: bricks extend +X, -Y, +Z from their corner).
  useEffect(() => {
    const center = new THREE.Vector3(
      brick.x + brick.h / 2,
      -brick.y - brick.w / 2,
      brick.z + 0.5,
    );
    pivot.position.copy(center);
    lastPivot.current.copy(center);
  }, [brick.x, brick.y, brick.z, brick.h, brick.w, pivot]);

  const handleChange = useCallback(() => {
    const delta = pivot.position.clone().sub(lastPivot.current);
    if (delta.lengthSq() === 0) return;
    const obj = scene.getObjectByName(`ebrick-${index}`);
    if (obj) obj.position.add(delta);
    lastPivot.current.copy(pivot.position);
  }, [pivot, scene, index]);

  const handleMouseUp = useCallback(() => {
    const obj = scene.getObjectByName(`ebrick-${index}`);
    if (!obj) return;
    // Convert scene-space corner back to BrickGPT grid coords and snap.
    const nx = Math.round(obj.position.x);
    const nz = Math.max(0, Math.round(obj.position.z));
    const ny = -Math.round(obj.position.y);
    obj.position.set(nx, -ny, nz);
    onCommitMove(index, nx, ny, nz);
  }, [scene, index, onCommitMove]);

  return (
    <>
      <primitive object={pivot} visible={false} />
      <TransformControls
        object={pivot}
        mode="translate"
        size={0.7}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
      />
    </>
  );
}

function BrickPreviewScene({
  bricks,
  rejectedBrick,
  constraintBoxes,
  editing = false,
  keepCount,
  selectedIndex = null,
  collidingIndices,
  onSelect,
  onCommitMove,
}: {
  bricks: BrickData[];
  rejectedBrick: BrickData | null;
  constraintBoxes: ConstraintBox[];
  editing?: boolean;
  keepCount?: number;
  selectedIndex?: number | null;
  collidingIndices?: Set<number>;
  onSelect?: (index: number | null) => void;
  onCommitMove?: (index: number, x: number, y: number, z: number) => void;
}) {
  const activeCount = editing
    ? Math.min(keepCount ?? bricks.length, bricks.length)
    : bricks.length;
  const activeBricks = bricks.slice(0, activeCount);
  const selectedBrick =
    editing && selectedIndex != null && selectedIndex < activeCount
      ? bricks[selectedIndex]
      : null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, -5, 15]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls
        makeDefault
        target={WORKSPACE_CAM_TARGET}
        enableDamping
        dampingFactor={0.1}
      />
      <group>
        {activeBricks.map((b, i) => {
          const isColliding = collidingIndices?.has(i) ?? false;
          const isSelected = editing && i === selectedIndex;
          const color = isColliding
            ? COLLIDING_BRICK_COLOR
            : isSelected
              ? SELECTED_BRICK_COLOR
              : BRICK_COLOR;
          return (
            <group
              key={i}
              name={`ebrick-${i}`}
              position={[b.x, -b.y, b.z]}
              onClick={
                editing
                  ? (e) => {
                      e.stopPropagation();
                      onSelect?.(i);
                    }
                  : undefined
              }
            >
              <ParametricBrick
                studsX={b.h}
                studsY={b.w}
                color={color}
                isSelected={isSelected}
              />
            </group>
          );
        })}
        {rejectedBrick && (
          <group
            key="rejected"
            position={[rejectedBrick.x, -rejectedBrick.y, rejectedBrick.z]}
          >
            <ParametricBrick
              studsX={rejectedBrick.h}
              studsY={rejectedBrick.w}
              color={COLLIDING_BRICK_COLOR}
            />
          </group>
        )}
      </group>
      {selectedBrick && onCommitMove && (
        <BrickEditGizmo
          key={selectedIndex}
          brick={selectedBrick}
          index={selectedIndex!}
          onCommitMove={onCommitMove}
        />
      )}
      {/* Always show the workspace cube so placement context is clear */}
      <WorldBoundingBox />
      <PreviewAxes />
      {constraintBoxes.map((box) => (
        <ConstraintPreviewBox key={box.id} box={box} />
      ))}
    </>
  );
}

export default function Generator({
  onClose,
  onGeneratingChange,
}: GeneratorProps) {
  const { addAssetsAsGroup, assets, defaultBrickColor, constraints } =
    useScene();
  const [tab, setTab] = useState<Tab>("text-to-3d");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);
  const [bricks, setBricks] = useState<BrickData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generationWarning, setGenerationWarning] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  // Streaming-specific state
  const [rejectedBrick, setRejectedBrick] = useState<BrickData | null>(null);
  const [streamStats, setStreamStats] = useState({
    accepted: 0,
    rejected: 0,
    rollbacks: 0,
  });
  const rejectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the current canvas mounted for streaming (vs. final).
  const [canvasKey, setCanvasKey] = useState(0);

  // ── Pause / edit / regenerate-from-prefix state ─────────────────────────
  const [selectedBrickIndex, setSelectedBrickIndex] = useState<number | null>(
    null,
  );
  // Number of leading bricks kept as the regeneration prefix. Sliding this
  // down "reverts" to an earlier generation step (later bricks are discarded
  // when regenerating).
  const [keepCount, setKeepCount] = useState(0);
  const [regenLoading, setRegenLoading] = useState(false);
  // Whether the user has actually changed anything since entering edit mode.
  // Drives the button label: false → "Continue Generation", true → "Regenerate".
  const [bricksModified, setBricksModified] = useState(false);

  // Keep `keepCount` pinned to the full brick list while generation is streaming,
  // so the slider always starts at the end when editing mode becomes available.
  useEffect(() => {
    const isEditing = bricks.length > 0 && !isGenerating && !regenLoading;
    if (!isEditing) setKeepCount(bricks.length);
  }, [bricks.length, isGenerating, regenLoading]);

  // Drop a stale selection if the kept prefix shrinks past it.
  useEffect(() => {
    if (selectedBrickIndex != null && selectedBrickIndex >= keepCount) {
      setSelectedBrickIndex(null);
    }
  }, [keepCount, selectedBrickIndex]);

  const collidingIndices = useMemo(() => {
    const set = new Set<number>();
    const isEditing = bricks.length > 0 && !isGenerating && !regenLoading;
    if (!isEditing) return set;
    const active = bricks.slice(0, keepCount);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        const xOverlap = a.x < b.x + b.h && b.x < a.x + a.h;
        const yOverlap = a.y < b.y + b.w && b.y < a.y + a.w;
        const zOverlap = a.z < b.z + 1 && b.z < a.z + 1;
        if (xOverlap && yOverlap && zOverlap) {
          set.add(i);
          set.add(j);
        }
      }
    }
    return set;
  }, [bricks, isGenerating, regenLoading, keepCount]);

  // ── Image-to-3D pipeline state ─────────────────────────────────────────
  type ImgStage =
    | "upload"
    | "encoding"
    | "segment"
    | "reconstructing"
    | "voxel-adjust";
  const [imgStage, setImgStage] = useState<ImgStage>("upload");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreviewUrl, setImgPreviewUrl] = useState<string | null>(null);
  const [imgImageId, setImgImageId] = useState<string | null>(null);
  const [imgPoints, setImgPoints] = useState<ClickPoint[]>([]);
  const [imgMaskOverlay, setImgMaskOverlay] = useState<string | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [imgPlyId, setImgPlyId] = useState<string | null>(null);
  const [imgVoxels, setImgVoxels] = useState<VoxelData[]>([]);
  const [imgDensity, setImgDensity] = useState(35);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgLoadingMsg, setImgLoadingMsg] = useState("");
  const densityToVoxelSize = (d: number) => 0.15 - (d / 100) * (0.15 - 0.02);
  const imgAbortRef = useRef<AbortController | null>(null);
  const imgFileInputRef = useRef<HTMLInputElement>(null);
  const segmentContainerRef = useRef<HTMLDivElement>(null);

  const [selectedConstraintIds, setSelectedConstraintIds] = useState<string[]>(
    [],
  );
  const [showConstraints, setShowConstraints] = useState(false);
  const [constraintDropdownOpen, setConstraintDropdownOpen] = useState(false);
  const constraintDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!constraintDropdownOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        constraintDropdownRef.current &&
        !constraintDropdownRef.current.contains(e.target as Node)
      ) {
        setConstraintDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [constraintDropdownOpen]);

  const selectedConstraints = constraints.filter((c) =>
    selectedConstraintIds.includes(c.id),
  );
  const selectedBoxes = selectedConstraints.flatMap((c) => c.boxes);

  const imgCenteredVoxels = useMemo(() => {
    if (imgVoxels.length === 0) return [] as VoxelData[];

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    for (const v of imgVoxels) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    return imgVoxels.map((v) => ({
      ...v,
      x: v.x - cx,
      y: v.y - cy,
      z: v.z - cz,
    }));
  }, [imgVoxels]);

  // Camera fitted to the voxel bounding box, locked to initial density so it
  // doesn't jump as the slider moves.
  const imgVoxelCamera = useMemo(() => {
    if (imgCenteredVoxels.length === 0) {
      return {
        position: [15, -15, 12] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
      };
    }
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;
    for (const v of imgCenteredVoxels) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x + 1);
      minY = Math.min(minY, -v.y - 1);
      maxY = Math.max(maxY, -v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z + 1);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const radius = Math.sqrt(spanX * spanX + spanY * spanY + spanZ * spanZ) / 2;
    const halfFovRad = (PREVIEW_FOV * Math.PI) / 180 / 2;
    const dist = (radius * PREVIEW_PADDING) / Math.tan(halfFovRad);
    const iso = dist / Math.sqrt(3);
    return {
      position: [cx + iso, cy - iso, cz + iso] as [number, number, number],
      target: [cx, cy, cz] as [number, number, number],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgStage]); // intentionally only recompute when stage changes to voxel-adjust

  const intersectionCount = useMemo(() => {
    if (bricks.length === 0 || selectedBoxes.length === 0) return 0;
    return bricks.filter((b) =>
      selectedBoxes.some(
        (box) =>
          b.x < box.posX + box.sizeX &&
          box.posX < b.x + b.h &&
          b.y < box.posY + box.sizeY &&
          box.posY < b.y + b.w &&
          b.z < box.posZ + box.sizeZ &&
          box.posZ < b.z + 1,
      ),
    ).length;
  }, [bricks, selectedBoxes]);

  // ── Image-to-3D handlers ──────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setImgPreviewUrl(URL.createObjectURL(file));
    setImgPoints([]);
    setImgMaskOverlay(null);
    setImgNaturalSize(null);
    setImgPlyId(null);
    setImgVoxels([]);
    setImgError(null);
    encodeImage(file);
  }

  async function encodeImage(file: File) {
    imgAbortRef.current?.abort();
    const controller = new AbortController();
    imgAbortRef.current = controller;

    setImgLoading(true);
    setImgLoadingMsg("Preparing image for segmentation…");
    setImgStage("encoding");

    try {
      const res = await uploadImage(file, controller.signal);
      setImgImageId(res.image_id);
      setImgStage("segment");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setImgError(e instanceof Error ? e.message : "Image encoding failed");
      setImgStage("upload");
    } finally {
      setImgLoading(false);
    }
  }

  function handleSegmentClick(
    e: React.MouseEvent<HTMLDivElement>,
    forceNegative = false,
  ) {
    if (imgStage !== "segment" || imgLoading || !imgNaturalSize) return;

    const container = segmentContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const { w: naturalW, h: naturalH } = imgNaturalSize;
    const scale = Math.min(rect.width / naturalW, rect.height / naturalH);
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    const offsetX = (rect.width - displayW) / 2;
    const offsetY = (rect.height - displayH) / 2;

    const imgX = Math.round((e.clientX - rect.left - offsetX) / scale);
    const imgY = Math.round((e.clientY - rect.top - offsetY) / scale);

    if (imgX < 0 || imgX >= naturalW || imgY < 0 || imgY >= naturalH) return;

    const label = forceNegative || e.altKey ? 0 : 1;
    const newPoints: ClickPoint[] = [...imgPoints, { x: imgX, y: imgY, label }];
    setImgPoints(newPoints);
    requestMaskPrediction(newPoints);
  }

  async function requestMaskPrediction(points: ClickPoint[]) {
    if (!imgImageId) return;
    imgAbortRef.current?.abort();
    const controller = new AbortController();
    imgAbortRef.current = controller;

    setImgLoading(true);
    setImgLoadingMsg("Predicting mask…");

    try {
      const res = await predictMask(imgImageId, points, controller.signal);
      setImgMaskOverlay(res.mask_b64);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setImgError(e instanceof Error ? e.message : "Mask prediction failed");
    } finally {
      setImgLoading(false);
    }
  }

  function handleUndoPoint() {
    const newPoints = imgPoints.slice(0, -1);
    setImgPoints(newPoints);
    if (newPoints.length === 0) {
      setImgMaskOverlay(null);
    } else {
      requestMaskPrediction(newPoints);
    }
  }

  function handleClearPoints() {
    setImgPoints([]);
    setImgMaskOverlay(null);
  }

  async function handleReconstruct() {
    if (imgImageId == null || imgPoints.length === 0) return;
    imgAbortRef.current?.abort();
    const controller = new AbortController();
    imgAbortRef.current = controller;

    setImgLoading(true);
    setImgLoadingMsg("Reconstructing 3D model…");
    setImgError(null);
    setImgStage("reconstructing");

    try {
      const res = await image3dReconstruct(
        imgImageId,
        42,
        densityToVoxelSize(imgDensity),
        controller.signal,
      );
      setImgPlyId(res.ply_id);
      setImgVoxels(res.voxels);
      setImgStage("voxel-adjust");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setImgError(e instanceof Error ? e.message : "3D reconstruction failed");
      setImgStage("segment");
    } finally {
      setImgLoading(false);
    }
  }

  const revoxelizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const handleDensityChange = useCallback(
    (newDensity: number) => {
      setImgDensity(newDensity);
      if (!imgPlyId) return;

      if (revoxelizeTimeoutRef.current)
        clearTimeout(revoxelizeTimeoutRef.current);
      revoxelizeTimeoutRef.current = setTimeout(async () => {
        imgAbortRef.current?.abort();
        const controller = new AbortController();
        imgAbortRef.current = controller;
        setImgLoading(true);
        setImgLoadingMsg("Re-voxelizing…");
        try {
          const res = await revoxelize(
            imgPlyId!,
            densityToVoxelSize(newDensity),
            controller.signal,
          );
          setImgVoxels(res.voxels);
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setImgError(e instanceof Error ? e.message : "Voxelization failed");
        } finally {
          setImgLoading(false);
        }
      }, 400);
    },
    [imgPlyId],
  );

  function handleImgAddToScene() {
    imgAbortRef.current?.abort();
    imgAbortRef.current = null;

    if (imgVoxels.length > 0) {
      const ts = Date.now();
      const category: AssetCategory = "image-to-3d";

      let vMinX = Infinity,
        vMinY = Infinity,
        vMinZ = Infinity;
      for (const v of imgVoxels) {
        vMinX = Math.min(vMinX, v.x);
        vMinY = Math.min(vMinY, v.y);
        vMinZ = Math.min(vMinZ, v.z);
      }

      const sceneAssets: SceneAsset[] = imgVoxels.map((v, i) => ({
        id: `img3d-${i}-${ts}`,
        name: `Voxel ${assets.length + i + 1}`,
        type: "preset-brick",
        visible: true,
        selectable: true,
        category,
        position: [v.x - vMinX, -(v.y - vMinY), v.z - vMinZ] as [
          number,
          number,
          number,
        ],
        materialColor: v.color,
        materialRoughness: 0.88,
        materialMetalness: 0.2,
        preset: { studsX: 1, studsY: 1 },
      }));
      addAssetsAsGroup(sceneAssets, "Image-to-3D");
    }

    onClose();
  }

  function handleImgReset() {
    imgAbortRef.current?.abort();
    imgAbortRef.current = null;
    if (imgFileInputRef.current) imgFileInputRef.current.value = "";
    setImgFile(null);
    setImgPreviewUrl(null);
    setImgImageId(null);
    setImgPoints([]);
    setImgMaskOverlay(null);
    setImgNaturalSize(null);
    setImgPlyId(null);
    setImgVoxels([]);
    setImgError(null);
    setImgLoading(false);
    setImgStage("upload");
  }

  // ── Text-to-3D handlers ─────────────────────────────────────────────

  const buildConstraintPayload = useCallback(
    () =>
      selectedConstraints.flatMap((c) =>
        c.boxes.map((box) => ({
          pos_x: box.posX,
          pos_y: box.posY,
          pos_z: box.posZ,
          size_x: box.sizeX,
          size_y: box.sizeY,
          size_z: box.sizeZ,
        })),
      ),
    [selectedConstraints],
  );

  async function handleGenerate() {
    if (!prompt.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setSelectedBrickIndex(null);
    setBricksModified(false);
    setBricks([]);
    setError(null);
    setGenerationWarning(null);
    setRejectedBrick(null);
    setStreamStats({ accepted: 0, rejected: 0, rollbacks: 0 });
    // New canvas key so it mounts fresh with the streaming camera.
    setCanvasKey((k) => k + 1);

    const constraintPayload = buildConstraintPayload();

    try {
      await generateTextBricksStream(
        prompt,
        constraintPayload,
        (event) => {
          if (event.type === "brick") {
            setBricks((prev) => [...prev, event.data]);
            setStreamStats((s) => ({ ...s, accepted: s.accepted + 1 }));
            // Clear any lingering rejected-brick flash on acceptance.
            if (rejectedTimerRef.current) {
              clearTimeout(rejectedTimerRef.current);
              rejectedTimerRef.current = null;
            }
            setRejectedBrick(null);
          } else if (event.type === "reject") {
            if (event.data) {
              setRejectedBrick(event.data);
              if (rejectedTimerRef.current)
                clearTimeout(rejectedTimerRef.current);
              rejectedTimerRef.current = setTimeout(
                () => setRejectedBrick(null),
                350,
              );
            }
            setStreamStats((s) => ({ ...s, rejected: s.rejected + 1 }));
          } else if (event.type === "rollback") {
            setBricks((prev) => prev.slice(0, event.keep_count));
            setStreamStats((s) => ({
              ...s,
              rollbacks: s.rollbacks + 1,
            }));
          } else if (event.type === "done") {
            if (event.warning) setGenerationWarning(event.warning);
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
        controller.signal,
      );
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
      if (rejectedTimerRef.current) {
        clearTimeout(rejectedTimerRef.current);
        rejectedTimerRef.current = null;
      }
      setRejectedBrick(null);
    }
  }

  // Pause the live stream, freezing the bricks placed so far. Editing mode
  // becomes active automatically once `isGenerating` goes false.
  function handlePause() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function handleBrickMove(index: number, x: number, y: number, z: number) {
    setBricks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, x, y, z } : b)),
    );
    setBricksModified(true);
  }

  function handleDeleteSelected() {
    if (selectedBrickIndex == null) return;
    setBricks((prev) => prev.filter((_, i) => i !== selectedBrickIndex));
    setKeepCount((c) => Math.max(0, c - 1));
    setSelectedBrickIndex(null);
    setBricksModified(true);
  }

  async function handleRegenerateFromHere() {
    const prefix = bricks.slice(0, keepCount);
    if (prefix.length === 0 || collidingIndices.size > 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRegenLoading(true);
    setError(null);
    setGenerationWarning(null);
    setSelectedBrickIndex(null);

    // Seed the canvas with the prefix — new bricks stream in after.
    setBricks(prefix);
    setStreamStats({ accepted: 0, rejected: 0, rollbacks: 0 });

    try {
      await regenerateTextBricksFromPrefixStream(
        prompt,
        prefix,
        buildConstraintPayload(),
        (event) => {
          if (event.type === "brick") {
            setBricks((prev) => [...prev, event.data]);
            setStreamStats((s) => ({ ...s, accepted: s.accepted + 1 }));
            if (rejectedTimerRef.current) {
              clearTimeout(rejectedTimerRef.current);
              rejectedTimerRef.current = null;
            }
            setRejectedBrick(null);
          } else if (event.type === "reject") {
            if (event.data) {
              setRejectedBrick(event.data);
              if (rejectedTimerRef.current)
                clearTimeout(rejectedTimerRef.current);
              rejectedTimerRef.current = setTimeout(
                () => setRejectedBrick(null),
                350,
              );
            }
            setStreamStats((s) => ({ ...s, rejected: s.rejected + 1 }));
          } else if (event.type === "rollback") {
            setBricks((prev) => prev.slice(0, event.keep_count));
            setStreamStats((s) => ({ ...s, rollbacks: s.rollbacks + 1 }));
          } else if (event.type === "done") {
            if (event.warning) setGenerationWarning(event.warning);
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
        controller.signal,
      );
      setBricksModified(false);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenLoading(false);
      if (rejectedTimerRef.current) {
        clearTimeout(rejectedTimerRef.current);
        rejectedTimerRef.current = null;
      }
      setRejectedBrick(null);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    imgAbortRef.current?.abort();
    imgAbortRef.current = null;
    onClose();
  }

  function handleAddToScene() {
    abortRef.current?.abort();
    abortRef.current = null;

    // When the user has reverted to an earlier step, only commit the kept prefix.
    const outBricks = editing ? bricks.slice(0, keepCount) : bricks;

    if (outBricks.length > 0) {
      const genOffset = computeGenerationOffset(outBricks);
      const { minX, minNegY, minZ } = genOffset;

      const category: AssetCategory =
        tab === "image-to-3d" ? "image-to-3d" : "text-to-3d";
      const ts = Date.now();
      const sceneAssets: SceneAsset[] = outBricks.map((b, i) => ({
        id: `gen-${i}-${ts}`,
        name: `Brick ${assets.length + i + 1}`,
        type: "preset-brick",
        visible: true,
        selectable: true,
        category,
        position: [b.x - minX, -b.y - minNegY, b.z - minZ] as [
          number,
          number,
          number,
        ],
        materialColor: defaultBrickColor,
        materialRoughness: 0.88,
        materialMetalness: 0.2,
        preset: { studsX: b.h, studsY: b.w },
      }));
      const generationHistory: GenerationHistoryEntry[] = outBricks.map((b) => ({
        x: b.x - minX,
        y: -b.y - minNegY,
        z: b.z - minZ,
        studsX: b.h,
        studsY: b.w,
      }));
      const label = prompt.trim().slice(0, 20);
      addAssetsAsGroup(
        sceneAssets,
        label,
        generationHistory,
        prompt,
        genOffset,
        selectedBoxes,
      );
    }

    onClose();
  }

  const hasResult = bricks.length > 0;

  // Editing mode is active whenever a result exists and no generation/regen is
  // running. No explicit toggle — it's always on after generation finishes.
  const editing = hasResult && !isGenerating && !regenLoading;

  const hasEdited = keepCount < bricks.length || bricksModified;

  return (
    <div className="flex flex-col h-[64vh]">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-400 dark:border-zinc-600">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Generator
        </span>
      </div>

      {/* Body: single two-column layout, divider runs header-to-bottom */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* ── LEFT: tabs + controls + actions ─────────────────────────── */}
        <div className="flex flex-col md:w-[28%] shrink-0 border-b border-zinc-400 dark:border-zinc-600 md:border-b-0 md:border-r">
          {/* Tab toggle */}
          <ul className="flex flex-col px-3 py-2 border-b border-zinc-400 dark:border-zinc-600">
            {(["text-to-3d", "image-to-3d"] as Tab[]).map((t) => (
              <li key={t}>
                <button
                  onClick={() => setTab(t)}
                  className={`w-full flex items-center px-2 py-1.5 rounded-none text-xs text-left transition-colors ${
                    tab === t
                      ? "bg-accent/10 text-accent"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {t === "text-to-3d" ? "Text-to-3D" : "Image-to-3D"}
                </button>
              </li>
            ))}
          </ul>

          {/* Tab-specific controls (scrollable) */}
          <div className="flex flex-col flex-1 gap-3 px-3 py-3 overflow-y-auto min-h-0">
            {tab === "text-to-3d" && (
              <>
                {/* Prompt */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Prompt
                  </span>
                  <Input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    placeholder="Describe a 3D brick structure..."
                    className="w-full !h-7 !py-0 !text-[10px] !leading-none"
                    disabled={isGenerating}
                  />
                </div>

                {/* Constraint selector */}
                {constraints.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Constraints
                    </span>
                    <div className="flex flex-col gap-2">
                      <div ref={constraintDropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setConstraintDropdownOpen((o) => !o)}
                          className={`flex w-full h-7 items-center gap-1.5 px-2 border border-zinc-400 dark:border-zinc-500 bg-white dark:bg-zinc-800 text-[10px] leading-none text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors ${
                            constraintDropdownOpen
                              ? "rounded-none border-b-0"
                              : "rounded-none"
                          }`}
                        >
                          <span
                            className="inline-block shrink-0 text-zinc-900 dark:text-zinc-100 transition-transform duration-200"
                            style={{
                              fontSize: "0.45rem",
                              transform: constraintDropdownOpen
                                ? "rotate(90deg)"
                                : "rotate(0deg)",
                              lineHeight: 1,
                            }}
                          >
                            ▶
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-500">
                            Select:
                          </span>
                          <span>
                            {selectedConstraintIds.length === 0
                              ? "None"
                              : `${selectedConstraintIds.length} selected`}
                          </span>
                        </button>
                        {constraintDropdownOpen && (
                          <div className="absolute top-full left-0 w-full bg-white dark:bg-zinc-900 border border-t-0 border-zinc-400 dark:border-zinc-600 rounded-none z-50 overflow-hidden">
                            <ul className="py-1">
                              {constraints.map((c) => {
                                const checked = selectedConstraintIds.includes(
                                  c.id,
                                );
                                return (
                                  <li key={c.id}>
                                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[10px] leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          setSelectedConstraintIds((prev) =>
                                            checked
                                              ? prev.filter((id) => id !== c.id)
                                              : [...prev, c.id],
                                          )
                                        }
                                        className="h-3 w-3 accent-zinc-700 dark:accent-zinc-400 cursor-pointer shrink-0"
                                      />
                                      <span className="truncate text-zinc-700 dark:text-zinc-200">
                                        {c.name}
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                      {selectedConstraintIds.length > 0 && (
                        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[10px] leading-none text-zinc-500 dark:text-zinc-500">
                          <input
                            type="checkbox"
                            checked={showConstraints}
                            onChange={(e) =>
                              setShowConstraints(e.target.checked)
                            }
                            className="h-3 w-3 accent-zinc-700 dark:accent-zinc-400 cursor-pointer shrink-0"
                          />
                          <span>Show in preview</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit / revert / regenerate controls — visible after generation */}
                {editing && (
                  <div className="flex flex-col gap-2 border border-zinc-400 dark:border-zinc-600 p-2">
                    <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                      Revert to an earlier step using the slider. Move or delete
                      bricks in the preview. Then regenerate from the edited prefix.
                    </p>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
                          Keep steps
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-500 tabular-nums">
                          {keepCount} / {bricks.length}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={bricks.length}
                        step={1}
                        value={keepCount}
                        onChange={(e) => {
                          setKeepCount(Number(e.target.value));
                          if (Number(e.target.value) < bricks.length)
                            setBricksModified(true);
                        }}
                        disabled={regenLoading}
                        className="w-full h-1 accent-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={handleDeleteSelected}
                        disabled={selectedBrickIndex == null || regenLoading}
                        className="w-full h-7 flex items-center justify-center rounded-none text-[10px] font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Delete selected brick
                      </button>

                      {collidingIndices.size > 0 && (
                        <p className="text-[10px] leading-snug text-red-600 dark:text-red-400">
                          {collidingIndices.size} brick
                          {collidingIndices.size !== 1 ? "s" : ""} overlap — fix
                          before regenerating.
                        </p>
                      )}

                      <Button
                        onClick={handleRegenerateFromHere}
                        disabled={
                          regenLoading ||
                          keepCount === 0 ||
                          collidingIndices.size > 0
                        }
                        className="w-full h-7 flex items-center justify-center"
                      >
                        {regenLoading
                          ? "Regenerating…"
                          : hasEdited
                            ? "Regenerate"
                            : "Continue Generation"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "image-to-3d" && (
              <>
                {/* Hidden file input */}
                <input
                  ref={imgFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                  disabled={imgLoading && imgStage !== "segment"}
                />

                {/* Upload / file name */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Image
                  </span>
                  <Button
                    type="button"
                    onClick={() => imgFileInputRef.current?.click()}
                    disabled={imgLoading && imgStage !== "segment"}
                    className="w-full h-7 flex items-center justify-center"
                  >
                    {imgFile ? "Change Image" : "Upload Image"}
                  </Button>
                  {imgFile && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate">
                      {imgFile.name}
                    </span>
                  )}
                </div>

                {/* Segment stage controls */}
                {imgStage === "segment" && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Selection
                    </span>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-500 leading-snug">
                      Click on the object to select it. Alt+click or right-click
                      to deselect regions.
                    </p>
                    {imgPoints.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleUndoPoint}
                          disabled={imgLoading}
                          className={TOOLBAR_BUTTON_CLASS}
                        >
                          Undo
                        </Button>
                        <Button
                          onClick={handleClearPoints}
                          disabled={imgLoading}
                          className={TOOLBAR_BUTTON_CLASS}
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={handleReconstruct}
                          disabled={imgLoading}
                          className={TOOLBAR_BUTTON_CLASS}
                        >
                          Reconstruct 3D
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Voxel-adjust controls */}
                {imgStage === "voxel-adjust" && (
                  <div className="flex flex-col gap-2">
                    {imgPlyId && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Brick density
                          </span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-500 tabular-nums">
                            {imgVoxels.length} bricks
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={1}
                          value={imgDensity}
                          onChange={(e) =>
                            handleDensityChange(parseInt(e.target.value))
                          }
                          className="w-full h-1 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
                          disabled={imgLoading}
                        />
                      </div>
                    )}
                    <Button
                      onClick={handleImgReset}
                      className="w-full h-7 flex items-center justify-center"
                    >
                      Start Over
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action buttons (pinned to bottom of left column) */}
          <div className="flex flex-col gap-2 px-3 py-3 border-t border-zinc-400 dark:border-zinc-600">
            {tab === "text-to-3d" && (
              <>
                {isGenerating ? (
                  <Button
                    onClick={handlePause}
                    className="w-full h-7 flex items-center justify-center"
                  >
                    Pause
                  </Button>
                ) : (
                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || regenLoading}
                    className="w-full h-7 flex items-center justify-center"
                  >
                    Generate
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancel}
                    className="flex-1 h-7 flex items-center justify-center"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddToScene}
                    disabled={!hasResult || isGenerating || regenLoading}
                    className="flex-1 h-7 flex items-center justify-center"
                  >
                    Add to Scene
                  </Button>
                </div>
              </>
            )}
            {tab === "image-to-3d" && (
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  className="flex-1 h-7 flex items-center justify-center"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImgAddToScene}
                  disabled={imgVoxels.length === 0}
                  className="flex-1 h-7 flex items-center justify-center"
                >
                  Add to Scene
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: preview ───────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0 p-3 gap-4">
          {tab === "text-to-3d" && (
            <>
              {/* Viewport */}
              <div className="relative flex-1 min-h-0 rounded-none border border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                {/* Empty / error states (only when no bricks to show) */}
                {!hasResult && isGenerating && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-500 animate-pulse">
                    Generating…
                  </span>
                )}
                {!hasResult && !isGenerating && error && (
                  <span className="text-xs text-red-500 dark:text-red-400 px-3 text-center">
                    {error}
                  </span>
                )}
                {!hasResult && !isGenerating && !error && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    Preview
                  </span>
                )}

                {/* 3-D canvas — visible as soon as the first brick arrives */}
                {hasResult && (
                  <Canvas
                    key={canvasKey}
                    camera={{
                      position: WORKSPACE_CAM_POS,
                      fov: PREVIEW_FOV,
                      up: [0, 0, 1],
                    }}
                    gl={{ antialias: true }}
                    style={{ position: "absolute", inset: 0 }}
                    onPointerMissed={
                      editing ? () => setSelectedBrickIndex(null) : undefined
                    }
                  >
                    <color attach="background" args={["#f4f4f5"]} />
                    <BrickPreviewScene
                      bricks={bricks}
                      rejectedBrick={rejectedBrick}
                      constraintBoxes={showConstraints ? selectedBoxes : []}
                      editing={editing}
                      keepCount={keepCount}
                      selectedIndex={selectedBrickIndex}
                      collidingIndices={collidingIndices}
                      onSelect={setSelectedBrickIndex}
                      onCommitMove={handleBrickMove}
                    />
                  </Canvas>
                )}

                {/* Edit-mode / regen-mode hint badge */}
                {(editing || regenLoading) && (
                  <div className="absolute top-2 left-2 pointer-events-none">
                    <span className="px-2 py-0.5 rounded-none bg-accent/90 text-white text-[10px] leading-none">
                      {regenLoading
                        ? `Regenerating from step ${bricks.length}…`
                        : `Editing prefix · ${keepCount} brick${keepCount !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                )}

                {/* Live generation stats overlay */}
                {(isGenerating || regenLoading) && hasResult && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-none bg-black/40 backdrop-blur-sm">
                      <span className="text-[10px] leading-none text-white/90 tabular-nums">
                        <span className="text-blue-300 font-medium">
                          {streamStats.accepted}
                        </span>{" "}
                        placed
                      </span>
                      <span className="text-white/30 text-[8px]">·</span>
                      <span className="text-[10px] leading-none text-white/90 tabular-nums">
                        <span className="text-red-300 font-medium">
                          {streamStats.rejected}
                        </span>{" "}
                        rejected
                      </span>
                      {streamStats.rollbacks > 0 && (
                        <>
                          <span className="text-white/30 text-[8px]">·</span>
                          <span className="text-[10px] leading-none text-white/90 tabular-nums">
                            <span className="text-amber-300 font-medium">
                              {streamStats.rollbacks}
                            </span>{" "}
                            rollback
                            {streamStats.rollbacks !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                      <span className="inline-block h-1.5 w-1.5 rounded-none bg-blue-400 animate-pulse ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Post-generation error (when bricks also exist) */}
                {!isGenerating && error && hasResult && (
                  <div className="absolute top-2 left-2 right-2">
                    <span className="text-xs text-red-500 dark:text-red-400">
                      {error}
                    </span>
                  </div>
                )}
              </div>

              {/* Partial-generation / resampling notice */}
              {generationWarning && (
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  {generationWarning}
                </p>
              )}

              {/* Intersection violation check */}
              {hasResult && intersectionCount > 0 && (
                <div className="px-2 py-1 rounded-none bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {intersectionCount} brick(s) intersect constraint volumes in
                    the output. Try regenerating or adjusting constraints.
                  </span>
                </div>
              )}
            </>
          )}

          {tab === "image-to-3d" && (
            <div className="relative flex-1 min-h-0 rounded-none border border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
              {/* Loading overlay */}
              {imgLoading && (
                <div
                  className={`absolute inset-0 flex items-center justify-center z-20 ${
                    imgStage === "segment" || imgStage === "voxel-adjust"
                      ? "bg-transparent"
                      : "bg-zinc-100/60 dark:bg-zinc-800/60"
                  }`}
                >
                  {imgStage !== "segment" && imgStage !== "voxel-adjust" && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-500 animate-pulse">
                      {imgLoadingMsg}
                    </span>
                  )}
                </div>
              )}

              {/* Error */}
              {!imgLoading && imgError && (
                <span className="text-xs text-red-500 dark:text-red-400 px-3 text-center">
                  {imgError}
                </span>
              )}

              {/* Empty state */}
              {imgStage === "upload" &&
                !imgPreviewUrl &&
                !imgLoading &&
                !imgError && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    Upload an image to begin
                  </span>
                )}

              {/* Image preview before processing starts */}
              {imgStage === "upload" && imgPreviewUrl && (
                <Image
                  src={imgPreviewUrl}
                  alt="Upload preview"
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain"
                />
              )}

              {/* Click-to-segment viewport */}
              {imgStage === "segment" && imgPreviewUrl && (
                <div
                  ref={segmentContainerRef}
                  className="absolute inset-0 cursor-crosshair select-none"
                  onClick={handleSegmentClick}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleSegmentClick(e, true);
                  }}
                >
                  <Image
                    src={imgPreviewUrl}
                    alt="Segment source"
                    fill
                    unoptimized
                    sizes="100vw"
                    className="pointer-events-none object-contain"
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      setImgNaturalSize({
                        w: el.naturalWidth,
                        h: el.naturalHeight,
                      });
                    }}
                  />
                  {imgMaskOverlay && (
                    <Image
                      src={`data:image/png;base64,${imgMaskOverlay}`}
                      alt="Segmentation overlay"
                      fill
                      unoptimized
                      sizes="100vw"
                      className="pointer-events-none object-contain"
                    />
                  )}
                  {imgNaturalSize && imgPoints.length > 0 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox={`0 0 ${imgNaturalSize.w} ${imgNaturalSize.h}`}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {imgPoints.map((p, i) => {
                        const r =
                          Math.max(imgNaturalSize.w, imgNaturalSize.h) * 0.007;
                        return (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={r}
                            fill={p.label === 1 ? "#10b981" : "#ef4444"}
                            stroke="white"
                            strokeWidth={r * 0.5}
                          />
                        );
                      })}
                    </svg>
                  )}
                </div>
              )}

              {/* Reconstructing placeholder */}
              {imgStage === "reconstructing" && !imgLoading && (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  Waiting for 3D reconstruction…
                </span>
              )}

              {/* 3D voxel preview */}
              {imgStage === "voxel-adjust" && imgCenteredVoxels.length > 0 && (
                <Canvas
                  camera={{
                    position: imgVoxelCamera.position,
                    fov: PREVIEW_FOV,
                    up: [0, 0, 1],
                  }}
                  gl={{ antialias: true }}
                  style={{ position: "absolute", inset: 0 }}
                >
                  <color attach="background" args={["#f4f4f5"]} />
                  <ambientLight intensity={0.4} />
                  <directionalLight position={[10, -5, 15]} intensity={1.2} />
                  <Environment preset="city" />
                  <OrbitControls
                    target={imgVoxelCamera.target}
                    enableDamping
                    dampingFactor={0.1}
                  />
                  <group>
                    {imgCenteredVoxels.map((v, i) => (
                      <group key={i} position={[v.x, -v.y, v.z]}>
                        <ParametricBrick
                          studsX={1}
                          studsY={1}
                          color={v.color}
                        />
                      </group>
                    ))}
                  </group>
                </Canvas>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

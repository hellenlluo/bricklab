"use client";

import Image from "next/image";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
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
import { generateTextBricks } from "@/lib/text3dApi";

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

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const b of bricks) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.h);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.w);
    minZ = Math.min(minZ, b.z);
    maxZ = Math.max(maxZ, b.z + 1);
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

const WORLD_DIM = 20;
const CONSTRAINT_COLOR = "#FFAB91";
const CONSTRAINT_EDGE_COLOR = "#FF8A65";
const GRID_COLOR = "#7ec8e3";
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

function BrickPreviewScene({
  bricks,
  constraintBoxes,
}: {
  bricks: BrickData[];
  constraintBoxes: ConstraintBox[];
}) {
  const { target } = useMemo(() => computePreviewCamera(bricks), [bricks]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, -5, 15]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls target={target} enableDamping dampingFactor={0.1} />
      <group>
        {bricks.map((b, i) => (
          <group key={i} position={[b.x, -b.y, b.z]}>
            <ParametricBrick studsX={b.h} studsY={b.w} color="#74a7fe" />
          </group>
        ))}
      </group>
      {constraintBoxes.length > 0 && (
        <>
          <WorldBoundingBox />
          {constraintBoxes.map((box) => (
            <ConstraintPreviewBox key={box.id} box={box} />
          ))}
          <PreviewAxes />
        </>
      )}
    </>
  );
}

export default function Generator({ onClose }: GeneratorProps) {
  const { addAssetsAsGroup, assets, defaultBrickColor, constraints } =
    useScene();
  const [tab, setTab] = useState<Tab>("text-to-3d");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [bricks, setBricks] = useState<BrickData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generationWarning, setGenerationWarning] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

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

  const tabClass = (t: Tab) =>
    `flex-1 py-1.5 text-sm font-normal transition-colors rounded-md ${
      tab === t
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800"
    }`;

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

  async function handleGenerate() {
    if (!prompt.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setBricks([]);
    setError(null);
    setGenerationWarning(null);

    const constraintPayload = selectedConstraints.flatMap((c) =>
      c.boxes.map((box) => ({
        pos_x: box.posX,
        pos_y: box.posY,
        pos_z: box.posZ,
        size_x: box.sizeX,
        size_y: box.sizeY,
        size_z: box.sizeZ,
      })),
    );

    try {
      const data = await generateTextBricks(
        prompt,
        constraintPayload,
        controller.signal,
      );
      setBricks(data.bricks);
      if (data.warning) setGenerationWarning(data.warning);
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
    imgAbortRef.current?.abort();
    imgAbortRef.current = null;
    onClose();
  }

  function handleAddToScene() {
    abortRef.current?.abort();
    abortRef.current = null;

    if (bricks.length > 0) {
      const genOffset = computeGenerationOffset(bricks);
      const { minX, minNegY, minZ } = genOffset;

      const category: AssetCategory =
        tab === "image-to-3d" ? "image-to-3d" : "text-to-3d";
      const ts = Date.now();
      const sceneAssets: SceneAsset[] = bricks.map((b, i) => ({
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
      const generationHistory: GenerationHistoryEntry[] = bricks.map((b) => ({
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

  const { position: cameraPosition } = useMemo(
    () => computePreviewCamera(bricks),
    [bricks],
  );

  return (
    <div className="flex flex-col h-[85vh]">
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
            {/* Prompt + constraints + Generate (single compact row height) */}
            <div className="flex items-center gap-2 min-w-0">
              <Input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="Describe a 3D brick structure..."
                className="min-w-0 flex-1 h-7 py-0 text-[10px] leading-none"
                disabled={isGenerating}
              />
              {constraints.length > 0 && (
                <>
                  <div
                    ref={constraintDropdownRef}
                    className="relative inline-flex flex-shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => setConstraintDropdownOpen((o) => !o)}
                      className={`flex h-7 items-center gap-1.5 px-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[10px] leading-none text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors ${
                        constraintDropdownOpen
                          ? "rounded-t-md rounded-b-none border-b-0"
                          : "rounded-md"
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
                      <span className="text-zinc-400 dark:text-zinc-500">
                        Constraints:
                      </span>
                      <span>
                        {selectedConstraintIds.length === 0
                          ? "None"
                          : `${selectedConstraintIds.length} selected`}
                      </span>
                    </button>
                    {constraintDropdownOpen && (
                      <div className="absolute top-full left-0 w-full bg-white dark:bg-zinc-900 border border-t-0 border-zinc-200 dark:border-zinc-800 rounded-b-xl z-50 overflow-hidden">
                        <ul className="py-1">
                          {constraints.map((c) => {
                            const checked = selectedConstraintIds.includes(
                              c.id,
                            );
                            return (
                              <li key={c.id}>
                                <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-[10px] leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
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
                    <label className="flex h-7 cursor-pointer select-none items-center gap-1.5 shrink-0 text-[10px] leading-none text-zinc-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={showConstraints}
                        onChange={(e) => setShowConstraints(e.target.checked)}
                        className="h-3 w-3 accent-zinc-700 dark:accent-zinc-400 cursor-pointer shrink-0"
                      />
                      <span className="whitespace-nowrap">Show in preview</span>
                    </label>
                  )}
                </>
              )}
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className={TOOLBAR_BUTTON_CLASS}
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
                  <BrickPreviewScene
                    bricks={bricks}
                    constraintBoxes={showConstraints ? selectedBoxes : []}
                  />
                </Canvas>
              )}
            </div>

            {/* Partial-generation / resampling notice */}
            {generationWarning && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {generationWarning}
              </p>
            )}

            {/* Intersection violation check */}
            {hasResult && intersectionCount > 0 && (
              <div className="px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <span className="text-xs text-red-600 dark:text-red-400">
                  {intersectionCount} brick(s) intersect constraint volumes in
                  the output. Try regenerating or adjusting constraints.
                </span>
              </div>
            )}

            {/* Cancel / Add to Scene */}
            <div className="flex gap-2 justify-end">
              <Button onClick={handleCancel} className={TOOLBAR_BUTTON_CLASS}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToScene}
                disabled={!hasResult}
                className={TOOLBAR_BUTTON_CLASS}
              >
                Add to Scene
              </Button>
            </div>
          </div>
        )}

        {tab === "image-to-3d" && (
          <div className="flex flex-col h-full p-[1vw] gap-[1vw]">
            {/* ── Toolbar ─────────────────────────────────────── */}
            <div className="flex items-center gap-2 min-w-0">
              <input
                ref={imgFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
                disabled={imgLoading && imgStage !== "segment"}
              />
              <Button
                type="button"
                onClick={() => imgFileInputRef.current?.click()}
                disabled={imgLoading && imgStage !== "segment"}
                className={TOOLBAR_BUTTON_CLASS}
              >
                {imgFile ? "Change Image" : "Upload Image"}
              </Button>
              {imgFile && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate min-w-0">
                  {imgFile.name}
                </span>
              )}
              <div className="flex-1" />
              {imgStage === "segment" && imgPoints.length > 0 && (
                <>
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
                </>
              )}
              {imgStage === "voxel-adjust" && (
                <Button
                  onClick={handleImgReset}
                  className={TOOLBAR_BUTTON_CLASS}
                >
                  Start Over
                </Button>
              )}
            </div>

            {/* ── Segment hint ────────────────────────────────── */}
            {imgStage === "segment" && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
                Click on the object to select it. Alt+click or right-click to
                deselect regions.
              </p>
            )}

            {/* ── Voxel density slider ────────────────────────── */}
            {imgStage === "voxel-adjust" && imgPlyId && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  Brick density
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={imgDensity}
                  onChange={(e) =>
                    handleDensityChange(parseInt(e.target.value))
                  }
                  className="flex-1 h-1 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
                  disabled={imgLoading}
                />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums w-14 text-right">
                  {imgVoxels.length} bricks
                </span>
              </div>
            )}

            {/* ── Viewport ────────────────────────────────────── */}
            <div className="relative flex-1 min-h-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
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
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 animate-pulse">
                      {imgLoadingMsg}
                    </span>
                  )}
                </div>
              )}

              {/* Error */}
              {!imgLoading && imgError && (
                <span className="text-xs text-red-500 dark:text-red-400 px-4 text-center">
                  {imgError}
                </span>
              )}

              {/* Empty state */}
              {imgStage === "upload" &&
                !imgPreviewUrl &&
                !imgLoading &&
                !imgError && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
                  {/* Point indicators via SVG overlay */}
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
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
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

            {/* Cancel / Add to Scene */}
            <div className="flex gap-2 justify-end">
              <Button onClick={handleCancel} className={TOOLBAR_BUTTON_CLASS}>
                Cancel
              </Button>
              <Button
                onClick={handleImgAddToScene}
                disabled={imgVoxels.length === 0}
                className={TOOLBAR_BUTTON_CLASS}
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

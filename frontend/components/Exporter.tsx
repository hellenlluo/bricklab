"use client";

import { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import JSZip from "jszip";
import { useScene } from "@/store/sceneStore";
import type { SceneData } from "@/store/sceneStore";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";

const STUD_SPACING = 1;
const BODY_HEIGHT = 1;
const STUD_RADIUS = 0.25;
const STUD_HEIGHT = 0.175;

const PLATE_THICKNESS = 0.5;
const PLATE_STUD_RADIUS = 0.25;
const PLATE_STUD_HEIGHT = 0.175;
const PLATE_STUD_SPACING = 1;

function mergedStudsGeo(
  positions: Array<[number, number, number]>,
  radius: number,
  height: number,
  segments: number,
): THREE.BufferGeometry {
  const template = new THREE.CylinderGeometry(radius, radius, height, segments);
  // Pre-compute the rotation matrix once (cylinder Y-axis → Z-axis)
  const rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const geos = positions.map(([x, y, z]) => {
    const clone = template.clone();
    const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(rotX);
    clone.applyMatrix4(m);
    return clone;
  });
  template.dispose();
  return mergeGeometries(geos);
}

function buildBrickGroup(
  studsX: number,
  studsY: number,
  color: string,
  roughness: number,
  metalness: number,
  name: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });

  const bodyGeo = new THREE.BoxGeometry(
    studsX * STUD_SPACING,
    studsY * STUD_SPACING,
    BODY_HEIGHT,
  );
  bodyGeo.applyMatrix4(
    new THREE.Matrix4().makeTranslation(
      (studsX * STUD_SPACING) / 2,
      -(studsY * STUD_SPACING) / 2,
      BODY_HEIGHT / 2,
    ),
  );

  const studPositions: Array<[number, number, number]> = [];
  for (let ix = 0; ix < studsX; ix++) {
    for (let iy = 0; iy < studsY; iy++) {
      studPositions.push([
        (ix + 0.5) * STUD_SPACING,
        -(iy + 0.5) * STUD_SPACING,
        BODY_HEIGHT + STUD_HEIGHT / 2,
      ]);
    }
  }
  const studsGeo = mergedStudsGeo(studPositions, STUD_RADIUS, STUD_HEIGHT, 12);

  const mesh = new THREE.Mesh(mergeGeometries([bodyGeo, studsGeo]), mat);
  mesh.name = name;
  group.add(mesh);

  return group;
}

function buildBaseplateGroup(
  plateSize: number,
  plateColor: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "Baseplate";

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(plateColor),
  });

  const slabGeo = new THREE.BoxGeometry(plateSize, plateSize, PLATE_THICKNESS);
  slabGeo.applyMatrix4(
    new THREE.Matrix4().makeTranslation(0, 0, -PLATE_THICKNESS / 2),
  );

  const studCount = Math.round(plateSize / PLATE_STUD_SPACING);
  const start = -(plateSize / 2) + PLATE_STUD_SPACING / 2;
  const studPositions: Array<[number, number, number]> = [];
  for (let ix = 0; ix < studCount; ix++) {
    for (let iy = 0; iy < studCount; iy++) {
      studPositions.push([
        start + ix * PLATE_STUD_SPACING,
        start + iy * PLATE_STUD_SPACING,
        PLATE_STUD_HEIGHT / 2,
      ]);
    }
  }

  // Single mesh: slab + all studs merged
  const mesh = new THREE.Mesh(
    mergeGeometries([
      slabGeo,
      mergedStudsGeo(studPositions, PLATE_STUD_RADIUS, PLATE_STUD_HEIGHT, 8),
    ]),
    mat,
  );
  mesh.name = "Baseplate";
  group.add(mesh);

  return group;
}

function buildThreeScene(
  sceneData: SceneData,
  includeBasePlate: boolean,
): THREE.Scene {
  const exportScene = new THREE.Scene();

  const root = new THREE.Group();
  root.name = sceneData.name;
  root.rotation.x = -Math.PI / 2;
  exportScene.add(root);

  if (includeBasePlate) {
    root.add(buildBaseplateGroup(sceneData.plateSize, sceneData.plateColor));
  }

  for (const asset of sceneData.assets) {
    if (!asset.visible) continue;
    if (asset.type === "preset-brick" && asset.preset) {
      const { studsX, studsY } = asset.preset;
      const brickGroup = buildBrickGroup(
        studsX,
        studsY,
        asset.materialColor ?? "#bfbfff",
        asset.materialRoughness ?? 0.88,
        asset.materialMetalness ?? 0.2,
        asset.name,
      );
      if (asset.position) {
        brickGroup.position.set(
          asset.position[0],
          asset.position[1],
          asset.position[2],
        );
      }
      root.add(brickGroup);
    }
  }

  return exportScene;
}

function buildMetadata(
  sceneData: SceneData,
  exportName: string,
  includeBasePlate: boolean,
) {
  const presetAssets = sceneData.assets.filter(
    (a) => a.type === "preset-brick" && a.preset,
  );

  const brickTypeMap = new Map<
    string,
    { studsX: number; studsY: number; count: number; label: string }
  >();
  for (const asset of presetAssets) {
    const { studsX, studsY } = asset.preset!;
    const key = `${studsX}x${studsY}`;
    if (!brickTypeMap.has(key)) {
      brickTypeMap.set(key, {
        studsX,
        studsY,
        count: 0,
        label: `${studsX}×${studsY}`,
      });
    }
    brickTypeMap.get(key)!.count++;
  }

  const modelAssets = sceneData.assets.filter((a) => a.type !== "preset-brick");
  const modelTypeMap = new Map<string, number>();
  for (const asset of modelAssets) {
    const key = asset.modelPath ?? asset.type;
    modelTypeMap.set(key, (modelTypeMap.get(key) ?? 0) + 1);
  }

  return {
    exportName,
    sceneName: sceneData.name,
    exportedAt: new Date().toISOString(),
    format: "GLB (glTF 2.0)",
    includesBasePlate: includeBasePlate,
    scene: {
      background: sceneData.sceneBackground,
      plateSize: sceneData.plateSize,
      plateColor: sceneData.plateColor,
    },
    bricks: {
      total: presetAssets.length,
      byType: Array.from(brickTypeMap.values()).sort(
        (a, b) => b.count - a.count,
      ),
    },
    models: {
      total: modelAssets.length,
      bySource: Object.fromEntries(modelTypeMap),
    },
    assets: sceneData.assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      category: a.category,
      position: a.position,
      color: a.materialColor,
      ...(a.preset
        ? { studsX: a.preset.studsX, studsY: a.preset.studsY }
        : { modelPath: a.modelPath }),
    })),
  };
}

// ── Format options ────────────────────────────────────────────────────────────

type ExportFormat = "glb-zip" | "gltf-zip" | "obj-zip" | "stl" | "json";

const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  ext: string;
  description: string;
}[] = [
  {
    id: "glb-zip",
    label: "GLB",
    ext: ".glb + .json → .zip",
    description: "Binary glTF 2.0",
  },
  {
    id: "gltf-zip",
    label: "GLTF",
    ext: ".gltf + .json → .zip",
    description: "Text glTF 2.0",
  },
  {
    id: "obj-zip",
    label: "OBJ",
    ext: ".obj + .json → .zip",
    description: "Wavefront OBJ",
  },
  {
    id: "stl",
    label: "STL",
    ext: ".stl",
    description: "Binary STL (ideal for 3D printing)",
  },
  {
    id: "json",
    label: "JSON",
    ext: ".json",
    description: "Metadata only (no geometry)",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface ExporterProps {
  onClose?: () => void;
}

export default function Exporter({ onClose }: ExporterProps) {
  const { scenes, activeSceneId } = useScene();
  const [selectedSceneId, setSelectedSceneId] = useState(activeSceneId);
  const [sceneDropdownOpen, setSceneDropdownOpen] = useState(false);
  const sceneDropdownRef = useRef<HTMLDivElement>(null);
  const [exportName, setExportName] = useState("Untitled Scene");
  const [includeBasePlate, setIncludeBasePlate] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("glb-zip");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScene =
    scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];

  useEffect(() => {
    if (!sceneDropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        sceneDropdownRef.current &&
        !sceneDropdownRef.current.contains(e.target as Node)
      ) {
        setSceneDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [sceneDropdownOpen]);
  const totalBrickCount = selectedScene.assets.length;

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    const name = exportName.trim() || "Untitled Scene";
    setIsExporting(true);
    setError(null);

    try {
      const metadata = buildMetadata(selectedScene, name, includeBasePlate);

      if (exportFormat === "json") {
        const blob = new Blob([JSON.stringify(metadata, null, 2)], {
          type: "application/json",
        });
        triggerDownload(blob, `${name}.metadata.json`);
        onClose?.();
        return;
      }

      const threeScene = buildThreeScene(selectedScene, includeBasePlate);

      if (exportFormat === "stl") {
        const stlExporter = new STLExporter();
        const stlString = stlExporter.parse(threeScene, { binary: false });
        const blob = new Blob([stlString], { type: "model/stl" });
        triggerDownload(blob, `${name}.stl`);
        onClose?.();
        return;
      }

      if (exportFormat === "obj-zip") {
        const objExporter = new OBJExporter();
        const objString = objExporter.parse(threeScene);
        const zip = new JSZip();
        zip.file(`${name}.obj`, objString);
        zip.file(`${name}.metadata.json`, JSON.stringify(metadata, null, 2));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, `${name}.zip`);
        onClose?.();
        return;
      }

      // GLB or GLTF
      const isBinary = exportFormat === "glb-zip";
      const gltfExporter = new GLTFExporter();
      const gltfResult = await new Promise<ArrayBuffer | object>(
        (resolve, reject) => {
          gltfExporter.parse(
            threeScene,
            (result) => resolve(result),
            (err) => reject(err),
            { binary: isBinary },
          );
        },
      );

      const zip = new JSZip();
      if (isBinary) {
        zip.file(`${name}.glb`, gltfResult as ArrayBuffer);
      } else {
        zip.file(`${name}.gltf`, JSON.stringify(gltfResult, null, 2));
      }
      zip.file(`${name}.metadata.json`, JSON.stringify(metadata, null, 2));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `${name}.zip`);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Exporter
        </span>
      </div>

      <div className="p-3 flex flex-col gap-4">
        {/* Scene selection */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Scene
          </span>
          <div ref={sceneDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setSceneDropdownOpen((o) => !o)}
              className={`flex w-full h-6.5 items-center gap-1.5 px-2 border border-border bg-background text-xs leading-none text-foreground hover:bg-muted/50 transition-colors ${
                sceneDropdownOpen ? "rounded-none border-b-0" : "rounded-none"
              }`}
            >
              <span
                className="inline-block shrink-0 text-foreground transition-transform duration-200"
                style={{
                  fontSize: "0.45rem",
                  transform: sceneDropdownOpen
                    ? "rotate(90deg)"
                    : "rotate(0deg)",
                  lineHeight: 1,
                }}
              >
                ▶
              </span>
              <span className="text-muted-foreground">Scene:</span>
              <span className="truncate">{selectedScene.name}</span>
              <span className="ml-auto text-muted-foreground shrink-0">
                {selectedScene.assets.length} asset
                {selectedScene.assets.length !== 1 ? "s" : ""}
              </span>
            </button>
            {sceneDropdownOpen && (
              <div className="absolute top-full left-0 w-full bg-background border border-t-0 border-border rounded-none z-50 overflow-hidden">
                <ul className="py-1">
                  {scenes.map((scene) => (
                    <li key={scene.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSceneId(scene.id);
                          setSceneDropdownOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                          scene.id === selectedSceneId
                            ? "text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        <span className="truncate">{scene.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          {scene.assets.length} obj
                          {scene.assets.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Export name */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Export name
          </span>
          <Input
            value={exportName}
            onChange={(e) => setExportName(e.target.value)}
            placeholder="Untitled Scene"
            className="w-full"
          />
        </div>

        {/* Format */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Format
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setExportFormat(fmt.id)}
                title={fmt.description}
                className={`h-6.5 flex items-center justify-center px-2.5 rounded-none text-xs font-medium leading-none border transition-colors ${
                  exportFormat === fmt.id
                    ? "bg-accent text-white border-accent hover:bg-accent-dark"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.description}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Options
          </span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={includeBasePlate}
              onCheckedChange={(v) => setIncludeBasePlate(v as boolean)}
              className="size-3.5"
            />
            <span className="text-xs text-muted-foreground">
              Include base plate
            </span>
          </label>
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-1 rounded-none bg-accent/25 border border-accent px-3 py-2.5">
          <span className="text-xs font-medium text-accent mb-0.5">
            Summary
          </span>
          <div className="flex justify-between text-xs">
            <span className="text-accent">Total bricks</span>
            <span className="text-accent tabular-nums">{totalBrickCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-accent">Format</span>
            <span className="text-accent">
              {FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.ext}
            </span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        {/* Export button */}
        <Button
          onClick={handleExport}
          disabled={isExporting || !exportName.trim()}
          className="w-full !h-6.5 !py-0 flex items-center justify-center"
        >
          {isExporting
            ? "Exporting…"
            : `Export as ${FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.label}`}
        </Button>
      </div>
    </div>
  );
}

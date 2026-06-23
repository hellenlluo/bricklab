"use client";

import { Suspense, useMemo, useEffect, useCallback, useRef, memo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  TransformControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useScene, type SceneAsset, type BrickGroup } from "@/store/sceneStore";
import { usePrefixEdit } from "@/store/usePrefixEdit";
import type { GenerationOffset } from "@/lib/prefixEditing";
import Baseplate from "./Baseplate";
import ParametricBrick, { BODY_HEIGHT } from "@/components/ParametricBrick";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

const BRICKGPT_WORLD_DIM = 20;
const BRICKGPT_GRID_COLOR = "#7ec8e3";

useGLTF.preload("/brick.glb");

function CameraUp({ up }: { up: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(up[0], up[1], up[2]);
    camera.lookAt(0, 0, 0);
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function BrickGPTWorldBox({ offset }: { offset: GenerationOffset }) {
  const cx = BRICKGPT_WORLD_DIM / 2 - offset.minX;
  const cy = -(BRICKGPT_WORLD_DIM / 2) - offset.minNegY;
  const cz = BRICKGPT_WORLD_DIM / 2 - offset.minZ;

  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <boxGeometry
          args={[BRICKGPT_WORLD_DIM, BRICKGPT_WORLD_DIM, BRICKGPT_WORLD_DIM]}
        />
        <meshBasicMaterial
          color={BRICKGPT_GRID_COLOR}
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
          args={[
            new THREE.BoxGeometry(
              BRICKGPT_WORLD_DIM,
              BRICKGPT_WORLD_DIM,
              BRICKGPT_WORLD_DIM,
            ),
          ]}
        />
        <lineBasicMaterial
          color={BRICKGPT_GRID_COLOR}
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
              key={`bw-${xi}-${yi}-${zi}`}
              position={[
                (xi - 0.5) * BRICKGPT_WORLD_DIM,
                (yi - 0.5) * BRICKGPT_WORLD_DIM,
                (zi - 0.5) * BRICKGPT_WORLD_DIM,
              ]}
            >
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial
                color={BRICKGPT_GRID_COLOR}
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

function applyMaterialOverrides(
  root: THREE.Object3D,
  color: string | undefined,
  roughness: number | undefined,
  metalness: number | undefined,
  colorOverride?: string,
) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material)
      ? (mesh.material as THREE.Material[])
      : [mesh.material as THREE.Material];
    mats.forEach((mat) => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return;
      const c = colorOverride ?? color;
      if (c !== undefined) mat.color.set(c);
      if (roughness !== undefined) mat.roughness = roughness;
      if (metalness !== undefined) mat.metalness = metalness;
      mat.polygonOffset = !!colorOverride;
      mat.polygonOffsetFactor = colorOverride ? -4 : 0;
      mat.polygonOffsetUnits = colorOverride ? -4 : 0;
      mat.needsUpdate = true;
    });
  });
}

function BrickModel({
  asset,
  onSelect,
  selectionColor,
}: {
  asset: SceneAsset;
  onSelect: (id: string, shiftKey: boolean, doubleClick: boolean) => void;
  selectionColor?: string;
}) {
  const { scene } = useGLTF(asset.modelPath!);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = (mesh.material as THREE.Material[]).map((m) =>
          m.clone(),
        );
      } else if (mesh.material) {
        mesh.material = (mesh.material as THREE.Material).clone();
      }
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    applyMaterialOverrides(
      cloned,
      asset.materialColor,
      asset.materialRoughness,
      asset.materialMetalness,
      selectionColor,
    );
  }, [
    cloned,
    asset.materialColor,
    asset.materialRoughness,
    asset.materialMetalness,
    selectionColor,
  ]);

  return (
    <group
      name={asset.id}
      position={asset.position ?? [0, 0, 0]}
      renderOrder={selectionColor ? 1 : 0}
      onClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false)
          onSelect(asset.id, e.nativeEvent.shiftKey, false);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false) onSelect(asset.id, false, true);
      }}
    >
      <primitive object={cloned} rotation={[Math.PI / 2, 0, 0]} castShadow />
    </group>
  );
}

function PlaceholderBox({
  asset,
  onSelect,
  selectionColor,
}: {
  asset: SceneAsset;
  onSelect: (id: string, shiftKey: boolean, doubleClick: boolean) => void;
  selectionColor?: string;
}) {
  return (
    <mesh
      name={asset.id}
      position={asset.position ?? [0, 0, 0]}
      renderOrder={selectionColor ? 1 : 0}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false)
          onSelect(asset.id, e.nativeEvent.shiftKey, false);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false) onSelect(asset.id, false, true);
      }}
    >
      <boxGeometry args={[1, 1.2, 2]} />
      <meshStandardMaterial
        color={selectionColor ?? asset.materialColor ?? "#284a7a"}
        roughness={asset.materialRoughness ?? 0.88}
        metalness={asset.materialMetalness ?? 0.0}
        polygonOffset={!!selectionColor}
        polygonOffsetFactor={selectionColor ? -4 : 0}
        polygonOffsetUnits={selectionColor ? -4 : 0}
      />
    </mesh>
  );
}

function ParametricBrickWrapper({
  asset,
  onSelect,
  selectionColor,
}: {
  asset: SceneAsset;
  onSelect: (id: string, shiftKey: boolean, doubleClick: boolean) => void;
  selectionColor?: string;
}) {
  const { studsX, studsY } = asset.preset!;
  const cx = studsX / 2;
  const cy = studsY / 2;
  const cz = BODY_HEIGHT / 2;
  const [px, py, pz] = asset.position ?? [0, 0, 0];
  return (
    <group
      name={asset.id}
      position={[px + cx, py - cy, pz + cz]}
      renderOrder={selectionColor ? 1 : 0}
      onClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false)
          onSelect(asset.id, e.nativeEvent.shiftKey, false);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false) onSelect(asset.id, false, true);
      }}
    >
      <group position={[-cx, cy, -cz]}>
        <ParametricBrick
          studsX={studsX}
          studsY={studsY}
          color={selectionColor ?? asset.materialColor}
          roughness={asset.materialRoughness}
          metalness={asset.materialMetalness}
          isSelected={!!selectionColor}
        />
      </group>
    </group>
  );
}

function PlacedAssets({
  assets,
  isPrimary = false,
}: {
  assets: SceneAsset[];
  isPrimary?: boolean;
}) {
  const {
    selectAsset,
    toggleGroupSelection,
    toggleAssetSelection,
    selectedAssetIds,
    selectionColor: selectionHighlight,
    selectGroup,
    groupSelected,
    removeSelectedAssets,
    pasteAssets,
    undo,
    groups,
  } = useScene();

  const clipboardRef = useRef<{
    assets: SceneAsset[];
    groups: BrickGroup[];
  } | null>(null);
  const placed = assets.filter((a) => a.visible && a.position);

  // Tracks which group we are currently "inside" (Figma-style drill-down).
  // Using a ref so changes don't trigger re-renders — selection state handles that.
  const focusedGroupId = useRef<string | null>(null);

  // Returns the ancestor chain for a brick, outermost group first.
  // e.g. brick in GroupB (inside GroupA) → ["GroupA", "GroupB"]
  function getAncestorChain(assetId: string): string[] {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset?.groupId) return [];
    const chain: string[] = [];
    let cur: string | undefined = asset.groupId;
    while (cur) {
      chain.unshift(cur);
      const grp = groups.find((g) => g.id === cur);
      cur = grp?.parentGroupId;
    }
    return chain; // [outermost, ..., immediate parent]
  }

  function handleSelect(id: string, shiftKey: boolean, doubleClick: boolean) {
    const chain = getAncestorChain(id);

    if (shiftKey) {
      if (chain.length === 0) {
        toggleAssetSelection(id);
        return;
      }
      const focusIdx = chain.indexOf(focusedGroupId.current ?? "");
      toggleGroupSelection(focusIdx !== -1 ? chain[focusIdx] : chain[0]);
      return;
    }

    if (chain.length === 0) {
      // Ungrouped brick — plain select
      selectAsset(id);
      focusedGroupId.current = null;
      return;
    }

    // Index of the currently focused group within this brick's ancestor chain
    const focusIdx = chain.indexOf(focusedGroupId.current ?? "");

    if (!doubleClick) {
      // Single click
      if (focusIdx !== -1) {
        // Already inside this hierarchy — stay at the same level
        selectGroup(chain[focusIdx]);
      } else {
        // Different hierarchy or no focus — jump to outermost group
        focusedGroupId.current = chain[0];
        selectGroup(chain[0]);
      }
    } else {
      // Double click — advance one level deeper
      if (focusIdx === chain.length - 1) {
        // Already at the immediate parent group → select the individual brick
        selectAsset(id);
        focusedGroupId.current = null;
      } else if (focusIdx !== -1) {
        // Step into the next group in the chain
        const nextId = chain[focusIdx + 1];
        focusedGroupId.current = nextId;
        selectGroup(nextId);
      } else {
        // Focus was outside this chain (shouldn't normally happen) — go to outermost
        focusedGroupId.current = chain[0];
        selectGroup(chain[0]);
      }
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore shortcuts when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // ⌘G / Ctrl+G — group selected
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        groupSelected();
        return;
      }
      // ⌘Z / Ctrl+Z — undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      // ⌘C / Ctrl+C — copy selected
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (selectedAssetIds.length === 0) return;
        e.preventDefault();
        const copiedAssets = assets.filter((a) =>
          selectedAssetIds.includes(a.id),
        );
        // Collect all groups referenced by selected assets, plus parent groups
        const groupIdSet = new Set<string>();
        copiedAssets.forEach((a) => {
          if (a.groupId) groupIdSet.add(a.groupId);
        });
        // Walk up the group hierarchy to include parent groups
        let changed = true;
        while (changed) {
          changed = false;
          groups.forEach((g) => {
            if (
              groupIdSet.has(g.id) &&
              g.parentGroupId &&
              !groupIdSet.has(g.parentGroupId)
            ) {
              groupIdSet.add(g.parentGroupId);
              changed = true;
            }
          });
        }
        const copiedGroups = groups.filter((g) => groupIdSet.has(g.id));
        clipboardRef.current = { assets: copiedAssets, groups: copiedGroups };
        return;
      }
      // ⌘V / Ctrl+V — paste copied assets at their original positions
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        if (!clipboardRef.current) return;
        pasteAssets(clipboardRef.current.assets, clipboardRef.current.groups);
        return;
      }
      // Delete / Backspace — delete selected assets
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelectedAssets();
      }
    }
    if (!isPrimary) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isPrimary,
    groupSelected,
    undo,
    removeSelectedAssets,
    pasteAssets,
    assets,
    selectedAssetIds,
    groups,
  ]);

  return (
    <>
      {placed.map((asset) => {
        const selectionColor =
          selectedAssetIds.includes(asset.id) && asset.selectable !== false
            ? selectionHighlight
            : undefined;
        if (asset.type === "preset-brick" && asset.preset) {
          return (
            <ParametricBrickWrapper
              key={asset.id}
              asset={asset}
              onSelect={handleSelect}
              selectionColor={selectionColor}
            />
          );
        }
        if (asset.modelPath) {
          return (
            <Suspense fallback={null} key={asset.id}>
              <BrickModel
                asset={asset}
                onSelect={handleSelect}
                selectionColor={selectionColor}
              />
            </Suspense>
          );
        }
        return (
          <PlaceholderBox
            key={asset.id}
            asset={asset}
            onSelect={handleSelect}
            selectionColor={selectionColor}
          />
        );
      })}
    </>
  );
}

function getAssetCenter(asset: SceneAsset): [number, number, number] {
  const [px, py, pz] = asset.position ?? [0, 0, 0];
  if (asset.type === "preset-brick" && asset.preset) {
    return [
      px + asset.preset.studsX / 2,
      py - asset.preset.studsY / 2,
      pz + BODY_HEIGHT / 2,
    ];
  }
  return [px, py, pz];
}

function getAssetOffsets(asset: SceneAsset) {
  if (asset.type === "preset-brick" && asset.preset) {
    return {
      cx: asset.preset.studsX / 2,
      cy: asset.preset.studsY / 2,
      cz: BODY_HEIGHT / 2,
    };
  }
  return { cx: 0, cy: 0, cz: 0 };
}

function getAssetWeight(asset: SceneAsset) {
  if (asset.type === "preset-brick" && asset.preset) {
    return asset.preset.studsX * asset.preset.studsY;
  }
  return 1;
}

function clampToBrickGPTWorld(
  x: number,
  y: number,
  z: number,
  studsX: number,
  studsY: number,
  offset: GenerationOffset,
): [number, number, number] {
  const minX = -offset.minX;
  const maxX = BRICKGPT_WORLD_DIM - offset.minX - studsX;
  const minY = studsY - BRICKGPT_WORLD_DIM - offset.minNegY;
  const maxY = -offset.minNegY;
  const minZ = -offset.minZ;
  const maxZ = BRICKGPT_WORLD_DIM - 1 - offset.minZ;
  return [
    Math.max(minX, Math.min(maxX, x)),
    Math.max(minY, Math.min(maxY, y)),
    Math.max(minZ, Math.min(maxZ, z)),
  ];
}

function SceneControls({
  viewportType,
  disableTransform = false,
}: {
  viewportType: string;
  disableTransform?: boolean;
}) {
  const {
    selectedAssetIds,
    updateAsset,
    captureUndoSnapshot,
    plateSize,
    assets,
    maxCameraDistance,
  } = useScene();
  const prefixEdit = usePrefixEdit();
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const orbRef = useRef<OrbitControlsImpl>(null);
  const selectionPivot = useMemo(() => new THREE.Group(), []);
  const lastPivotPositionRef = useRef(new THREE.Vector3());
  const prevViewportTypeRef = useRef(viewportType);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    if (prevViewportTypeRef.current === viewportType && orb.object === camera) {
      prevViewportTypeRef.current = viewportType;
      return;
    }
    prevViewportTypeRef.current = viewportType;
    const d = Math.max(plateSize, 30) * 1.8;
    const iso = d / Math.sqrt(3);
    type V3 = [number, number, number];
    let pos: V3;
    let up: V3 = [0, 0, 1];
    switch (viewportType) {
      case "Top":
        pos = [0, 0, d];
        up = [0, 1, 0];
        break;
      case "Front":
        pos = [0, -d, 0];
        break;
      case "Back":
        pos = [0, d, 0];
        break;
      case "Left":
        pos = [-d, 0, 0];
        break;
      case "Right":
        pos = [d, 0, 0];
        break;
      case "Iso NE":
        pos = [iso, -iso, iso];
        break;
      case "Iso NW":
        pos = [-iso, -iso, iso];
        break;
      case "Iso SE":
        pos = [iso, iso, iso];
        break;
      case "Iso SW":
        pos = [-iso, iso, iso];
        break;
      default:
        pos = [30, -30, 20];
        break;
    }
    camera.up.set(...up);
    camera.position.set(...pos);
    orb.target.set(0, 0, 0);
    orb.update();
  }, [viewportType, plateSize, camera]);

  const selectedAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          selectedAssetIds.includes(asset.id) &&
          asset.visible &&
          asset.selectable !== false &&
          asset.position,
      ),
    [assets, selectedAssetIds],
  );
  const hasTransformSelection = selectedAssets.length > 0;
  const shouldShowTransformControls =
    hasTransformSelection && !!selectionPivot.parent;

  useEffect(() => {
    if (!hasTransformSelection) return;
    const totalWeight = selectedAssets.reduce(
      (sum, asset) => sum + getAssetWeight(asset),
      0,
    );
    const center = selectedAssets.reduce((acc, asset) => {
      const [x, y, z] = getAssetCenter(asset);
      const weight = getAssetWeight(asset);
      acc.x += x * weight;
      acc.y += y * weight;
      acc.z += z * weight;
      return acc;
    }, new THREE.Vector3());
    center.divideScalar(totalWeight || 1);
    selectionPivot.position.copy(center);
    lastPivotPositionRef.current.copy(center);
  }, [hasTransformSelection, selectedAssets, selectionPivot]);

  const handleChange = useCallback(() => {
    if (!hasTransformSelection) return;

    const delta = selectionPivot.position
      .clone()
      .sub(lastPivotPositionRef.current);
    if (delta.lengthSq() === 0) return;

    // Compute the minimum world-space bottom (obj.position.z - cz) across all
    // selected objects, then clamp delta.z so no brick goes below the plate (z=0).
    let minBottom = Infinity;
    selectedAssets.forEach((asset) => {
      const obj = scene.getObjectByName(asset.id);
      if (!obj) return;
      const { cz } = getAssetOffsets(asset);
      minBottom = Math.min(minBottom, obj.position.z - cz);
    });
    if (isFinite(minBottom)) {
      delta.z = Math.max(delta.z, -minBottom);
    }

    selectedAssets.forEach((asset) => {
      const obj = scene.getObjectByName(asset.id);
      if (obj) obj.position.add(delta);
    });

    // Write the clamped pivot position back so that subsequent delta calculations
    // stay accurate and the gizmo cannot drift below the plate.
    selectionPivot.position.copy(lastPivotPositionRef.current).add(delta);
    lastPivotPositionRef.current.copy(selectionPivot.position);
  }, [hasTransformSelection, scene, selectedAssets, selectionPivot]);

  const handleMouseUp = useCallback(() => {
    if (!hasTransformSelection) return;

    const peOffset = prefixEdit.generationOffset;
    const peGroupId = prefixEdit.groupId;
    const peActive =
      prefixEdit.phase === "editing_prefix" || prefixEdit.phase === "error";

    const candidates = selectedAssets
      .map((asset) => {
        const obj = scene.getObjectByName(asset.id);
        if (!obj) return null;
        const { cx, cy, cz } = getAssetOffsets(asset);
        return {
          id: asset.id,
          asset,
          obj,
          cx,
          cy,
          cz,
          x: Math.round(obj.position.x - cx),
          y: Math.round(obj.position.y + cy),
          z: Math.round(obj.position.z - cz),
          prevPosition: (asset.position ?? [0, 0, 0]) as [
            number,
            number,
            number,
          ],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const minZ = candidates.reduce((m, c) => Math.min(m, c.z), Infinity);
    const zShift = minZ < 0 ? -minZ : 0;

    const movedAssets = candidates
      .map(({ id, asset, obj, cx, cy, cz, x, y, z, prevPosition }) => {
        let fx = x,
          fy = y,
          fz = z + zShift;
        if (
          peActive &&
          peOffset &&
          asset.groupId === peGroupId &&
          asset.preset
        ) {
          [fx, fy, fz] = clampToBrickGPTWorld(
            fx,
            fy,
            fz,
            asset.preset.studsX,
            asset.preset.studsY,
            peOffset,
          );
        }
        // Always write the snapped integer position back to the 3D object so
        // that a slow drag that stays within the same grid cell still visually
        // snaps. Without this, obj.position keeps a fractional offset because
        // no state change is triggered when the grid cell hasn't changed.
        obj.position.set(fx + cx, fy - cy, fz + cz);
        if (
          prevPosition[0] === fx &&
          prevPosition[1] === fy &&
          prevPosition[2] === fz
        )
          return null;
        return { id, position: [fx, fy, fz] as [number, number, number] };
      })
      .filter(
        (a): a is { id: string; position: [number, number, number] } =>
          a !== null,
      );

    if (movedAssets.length === 0) return;
    captureUndoSnapshot();
    movedAssets.forEach(({ id, position }) => updateAsset(id, { position }));
  }, [
    captureUndoSnapshot,
    hasTransformSelection,
    scene,
    selectedAssets,
    updateAsset,
    prefixEdit,
  ]);

  const isPerspective = viewportType === "Perspective";

  return (
    <>
      <primitive object={selectionPivot} visible={false} />
      {!disableTransform && shouldShowTransformControls && (
        <TransformControls
          object={selectionPivot}
          size={0.5}
          onChange={handleChange}
          onMouseUp={handleMouseUp}
        />
      )}
      <OrbitControls
        ref={orbRef}
        makeDefault
        enableRotate={isPerspective}
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={maxCameraDistance}
        panSpeed={0.8}
        zoomSpeed={1.2}
        rotateSpeed={0.6}
        touches={
          isPerspective
            ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
            : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
        }
        mouseButtons={
          isPerspective
            ? {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
              }
            : {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
              }
        }
      />
    </>
  );
}

function PrefixEditWorldBox() {
  const { generationOffset, phase } = usePrefixEdit();
  if (phase !== "editing_prefix" && phase !== "error") return null;
  if (!generationOffset) return null;
  return <BrickGPTWorldBox offset={generationOffset} />;
}

function ShadowLight({ plateSize }: { plateSize: number }) {
  const ref = useRef<THREE.DirectionalLight>(null);

  // Frustum half-extent — covers the full plate plus padding for tall stacks.
  const half = plateSize * 0.75;
  // Push the light far enough out that the depth range covers the whole plate
  // for any baseplate size, then refit the depth bounds to match.
  const lightDist = Math.max(40, plateSize * 1.2);
  const farPlane = lightDist * 2.5;

  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = farPlane;
    cam.updateProjectionMatrix();
    light.shadow.needsUpdate = true;
  }, [half, farPlane]);

  return (
    <directionalLight
      ref={ref}
      position={[lightDist * 0.55, -lightDist * 0.3, lightDist * 0.85]}
      intensity={1.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
    />
  );
}

const VIEWPORT_DEFAULTS: Record<
  string,
  { position: [number, number, number]; up: [number, number, number] }
> = {
  Perspective: { position: [30, -30, 20], up: [0, 0, 1] },
  Top: { position: [0, 0, 90], up: [0, 1, 0] },
  Front: { position: [0, -90, 0], up: [0, 0, 1] },
};

const SceneViewport = memo(function SceneViewport({
  viewportType,
  isPrimary = false,
  label,
  labelAtTop = false,
}: {
  viewportType: string;
  isPrimary?: boolean;
  label: string;
  labelAtTop?: boolean;
}) {
  const { assets, sceneBackground, selectAsset, plateSize, plateColor } =
    useScene();
  const cam = VIEWPORT_DEFAULTS[viewportType] ?? VIEWPORT_DEFAULTS.Perspective;

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: cam.position, fov: 35 }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true }}
        onPointerMissed={() => selectAsset(null)}
      >
        <color attach="background" args={[sceneBackground]} />
        <CameraUp up={cam.up} />
        <ambientLight intensity={0.35} />
        <ShadowLight plateSize={plateSize} />
        <Baseplate size={plateSize} color={plateColor} />
        <Environment preset="city" />
        <SceneControls
          viewportType={viewportType}
          disableTransform={!isPrimary}
        />
        <PlacedAssets assets={assets} isPrimary={isPrimary} />
        <PrefixEditWorldBox />
      </Canvas>
      <div
        className={`absolute left-2 text-[10px] text-white/40 pointer-events-none select-none font-mono uppercase tracking-widest ${labelAtTop ? "top-2" : "bottom-2"}`}
      >
        {label}
      </div>
    </div>
  );
});

export default function SceneCanvas() {
  return (
    <div
      data-no-deselect
      className="fixed z-0"
      style={{ top: "7.5vh", left: "15vw", right: "15vw", bottom: 0 }}
    >
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={400 / 7} minSize={15}>
          <SceneViewport
            viewportType="Perspective"
            isPrimary
            label="Perspective"
            labelAtTop
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={300 / 7} minSize={15}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={50} minSize={15}>
              <SceneViewport viewportType="Top" label="Top" />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={15}>
              <SceneViewport viewportType="Front" label="Front" />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

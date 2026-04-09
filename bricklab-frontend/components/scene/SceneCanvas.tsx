"use client";

import { Suspense, useMemo, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  TransformControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useScene, type SceneAsset } from "@/store/sceneStore";
import Baseplate from "./Baseplate";
import Gizmo from "./Gizmo";
import ParametricBrick, { BODY_HEIGHT } from "@/components/ParametricBrick";

useGLTF.preload("/brick.glb");

function ZUpCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 0, 1);
  }, [camera]);
  return null;
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

function PlacedAssets({ assets }: { assets: SceneAsset[] }) {
  const {
    selectAsset,
    toggleAssetSelection,
    selectedAssetIds,
    selectionColor: selectionHighlight,
    selectGroup,
    groupSelected,
    groups,
  } = useScene();
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
    if (shiftKey) {
      toggleAssetSelection(id);
      return;
    }

    const chain = getAncestorChain(id);

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

  // ⌘G / Ctrl+G to group selected bricks
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        groupSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groupSelected]);

  return (
    <>
      {placed.map((asset) => {
        const selectionColor = selectedAssetIds.includes(asset.id)
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

function SceneControls() {
  const {
    selectedAssetId,
    selectedAssetIds,
    updateAsset,
    plateSize,
    assets,
    maxCameraDistance,
    viewportType,
  } = useScene();
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const orbRef = useRef<OrbitControlsImpl>(null);
  const selectionPivot = useMemo(() => new THREE.Group(), []);
  const lastPivotPositionRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
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
  const isMultiSelection = selectedAssets.length > 1;
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const rawObj =
    selectedAsset?.visible &&
    selectedAsset?.selectable !== false &&
    selectedAssetId
      ? scene.getObjectByName(selectedAssetId)
      : null;
  const selectedObject = isMultiSelection
    ? selectionPivot
    : rawObj?.parent
      ? rawObj
      : undefined;

  useEffect(() => {
    if (!isMultiSelection) return;
    if (selectedAssets.length === 0) return;
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
  }, [isMultiSelection, selectedAssets, selectionPivot]);

  const handleChange = useCallback(() => {
    if (isMultiSelection) {
      const delta = selectionPivot.position
        .clone()
        .sub(lastPivotPositionRef.current);
      if (delta.lengthSq() === 0) return;
      selectedAssetIds.forEach((id) => {
        const obj = scene.getObjectByName(id);
        if (obj) obj.position.add(delta);
      });
      lastPivotPositionRef.current.copy(selectionPivot.position);
      return;
    }

    const obj = selectedAssetId ? scene.getObjectByName(selectedAssetId) : null;
    if (!obj) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    const { cx, cy, cz } = asset
      ? getAssetOffsets(asset)
      : { cx: 0, cy: 0, cz: 0 };
    obj.position.x = Math.round(obj.position.x - cx) + cx;
    obj.position.y = Math.round(obj.position.y + cy) - cy;
    obj.position.z = Math.max(cz, Math.round(obj.position.z - cz) + cz);
  }, [
    assets,
    isMultiSelection,
    scene,
    selectedAssetId,
    selectedAssetIds,
    selectionPivot,
  ]);

  const handleMouseUp = useCallback(() => {
    if (isMultiSelection) {
      selectedAssets.forEach((asset) => {
        const obj = scene.getObjectByName(asset.id);
        if (!obj) return;
        const { cx, cy, cz } = getAssetOffsets(asset);
        const x = Math.round(obj.position.x - cx);
        const y = Math.round(obj.position.y + cy);
        const z = Math.max(0, Math.round(obj.position.z - cz));
        updateAsset(asset.id, { position: [x, y, z] });
      });
      return;
    }

    const obj = selectedAssetId ? scene.getObjectByName(selectedAssetId) : null;
    if (!obj || !selectedAssetId) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    const { cx, cy, cz } = asset
      ? getAssetOffsets(asset)
      : { cx: 0, cy: 0, cz: 0 };
    const x = Math.round(obj.position.x - cx);
    const y = Math.round(obj.position.y + cy);
    const z = Math.max(0, Math.round(obj.position.z - cz));
    updateAsset(selectedAssetId, { position: [x, y, z] });
  }, [
    assets,
    isMultiSelection,
    scene,
    selectedAssetId,
    selectedAssets,
    updateAsset,
  ]);

  const isPerspective = viewportType === "Perspective";

  return (
    <>
      {isMultiSelection && (
        <primitive object={selectionPivot} visible={false} />
      )}
      {selectedObject && (
        <TransformControls
          object={selectedObject}
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

export default function SceneCanvas() {
  const {
    assets,
    sceneBackground,
    selectAsset,
    plateSize,
    plateColor,
    viewportType,
  } = useScene();
  const isPerspective = viewportType === "Perspective";

  return (
    <div data-no-deselect className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [30, -30, 20], fov: 35, up: [0, 0, 1] }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true }}
        onPointerMissed={() => selectAsset(null)}
      >
        <color attach="background" args={[sceneBackground]} />
        <ZUpCamera />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[10, -5, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Baseplate size={plateSize} color={plateColor} />
        <Environment preset="city" />
        <SceneControls />
        <PlacedAssets assets={assets} />
        <Gizmo interactive={isPerspective} />
      </Canvas>
    </div>
  );
}

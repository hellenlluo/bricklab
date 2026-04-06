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
  emissive?: string,
) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material)
      ? (mesh.material as THREE.Material[])
      : [mesh.material as THREE.Material];
    mats.forEach((mat) => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return;
      if (color !== undefined) mat.color.set(color);
      if (roughness !== undefined) mat.roughness = roughness;
      if (metalness !== undefined) mat.metalness = metalness;
      mat.emissive.set(emissive ?? "black");
      mat.emissiveIntensity = emissive ? 0.4 : 1;
      mat.needsUpdate = true;
    });
  });
}

function BrickModel({
  asset,
  onSelect,
  emissive,
}: {
  asset: SceneAsset;
  onSelect: (id: string) => void;
  emissive?: string;
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
      emissive,
    );
  }, [
    cloned,
    asset.materialColor,
    asset.materialRoughness,
    asset.materialMetalness,
    emissive,
  ]);

  return (
    <group
      name={asset.id}
      position={asset.position ?? [0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false) onSelect(asset.id);
      }}
    >
      <primitive object={cloned} rotation={[Math.PI / 2, 0, 0]} castShadow />
    </group>
  );
}

function PlaceholderBox({
  asset,
  onSelect,
  emissive,
}: {
  asset: SceneAsset;
  onSelect: (id: string) => void;
  emissive?: string;
}) {
  return (
    <mesh
      name={asset.id}
      position={asset.position ?? [0, 0, 0]}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false) onSelect(asset.id);
      }}
    >
      <boxGeometry args={[1, 1.2, 2]} />
      <meshStandardMaterial
        color={asset.materialColor ?? "#284a7a"}
        roughness={asset.materialRoughness ?? 0.88}
        metalness={asset.materialMetalness ?? 0.0}
        emissive={emissive ?? "black"}
        emissiveIntensity={emissive ? 0.4 : 1}
      />
    </mesh>
  );
}

function ParametricBrickWrapper({
  asset,
  onSelect,
  emissive,
}: {
  asset: SceneAsset;
  onSelect: (id: string) => void;
  emissive?: string;
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
      onClick={(e) => {
        e.stopPropagation();
        if (asset.selectable !== false) onSelect(asset.id);
      }}
    >
      <group position={[-cx, cy, -cz]}>
        <ParametricBrick
          studsX={studsX}
          studsY={studsY}
          color={asset.materialColor}
          roughness={asset.materialRoughness}
          metalness={asset.materialMetalness}
          emissive={emissive}
        />
      </group>
    </group>
  );
}

function PlacedAssets({ assets }: { assets: SceneAsset[] }) {
  const { selectAsset, selectedAssetId, selectionHighlightColor } = useScene();
  const placed = assets.filter((a) => a.visible && a.position);
  return (
    <>
      {placed.map((asset) => {
        const emissive = asset.id === selectedAssetId ? selectionHighlightColor : undefined;
        if (asset.type === "preset-brick" && asset.preset) {
          return (
            <ParametricBrickWrapper
              key={asset.id}
              asset={asset}
              onSelect={selectAsset}
              emissive={emissive}
            />
          );
        }
        if (asset.modelPath) {
          return (
            <Suspense fallback={null} key={asset.id}>
              <BrickModel asset={asset} onSelect={selectAsset} emissive={emissive} />
            </Suspense>
          );
        }
        return (
          <PlaceholderBox key={asset.id} asset={asset} onSelect={selectAsset} emissive={emissive} />
        );
      })}
    </>
  );
}

function SceneControls() {
  const { selectedAssetId, updateAsset, plateSize, assets, maxCameraDistance, viewportType } = useScene();
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const orbRef = useRef<any>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const d = Math.max(plateSize, 30) * 1.8;
    const iso = d / Math.sqrt(3);
    type V3 = [number, number, number];
    let pos: V3;
    let up: V3 = [0, 0, 1];
    switch (viewportType) {
      case "Top":   pos = [0, 0, d];      up = [0, 1, 0]; break;
      case "Front": pos = [0, -d, 0];                     break;
      case "Back":  pos = [0,  d, 0];                     break;
      case "Left":  pos = [-d, 0, 0];                     break;
      case "Right": pos = [ d, 0, 0];                     break;
      case "Iso NE": pos = [ iso, -iso, iso]; break;
      case "Iso NW": pos = [-iso, -iso, iso]; break;
      case "Iso SE": pos = [ iso,  iso, iso]; break;
      case "Iso SW": pos = [-iso,  iso, iso]; break;
      default:      pos = [30, -30, 20];                  break;
    }
    camera.up.set(...up);
    camera.position.set(...pos);
    orb.target.set(0, 0, 0);
    orb.update();
  }, [viewportType, plateSize, camera]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const rawObj =
    selectedAsset?.visible && selectedAsset?.selectable !== false && selectedAssetId
      ? scene.getObjectByName(selectedAssetId)
      : null;
  const selectedObject = rawObj?.parent ? rawObj : undefined;

  const handleChange = useCallback(() => {
    const obj = selectedAssetId ? scene.getObjectByName(selectedAssetId) : null;
    if (!obj) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    const cx = asset?.type === "preset-brick" && asset.preset ? asset.preset.studsX / 2 : 0;
    const cy = asset?.type === "preset-brick" && asset.preset ? asset.preset.studsY / 2 : 0;
    const cz = asset?.type === "preset-brick" && asset.preset ? BODY_HEIGHT / 2 : 0;
    obj.position.x = Math.round(obj.position.x - cx) + cx;
    obj.position.y = Math.round(obj.position.y + cy) - cy;
    obj.position.z = Math.max(cz, Math.round(obj.position.z - cz) + cz);
  }, [scene, selectedAssetId, assets]);

  const handleMouseUp = useCallback(() => {
    const obj = selectedAssetId ? scene.getObjectByName(selectedAssetId) : null;
    if (!obj || !selectedAssetId) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    const cx = asset?.type === "preset-brick" && asset.preset ? asset.preset.studsX / 2 : 0;
    const cy = asset?.type === "preset-brick" && asset.preset ? asset.preset.studsY / 2 : 0;
    const cz = asset?.type === "preset-brick" && asset.preset ? BODY_HEIGHT / 2 : 0;
    const x = Math.round(obj.position.x - cx);
    const y = Math.round(obj.position.y + cy);
    const z = Math.max(0, Math.round(obj.position.z - cz));
    updateAsset(selectedAssetId, { position: [x, y, z] });
  }, [scene, selectedAssetId, updateAsset, assets]);

  const isPerspective = viewportType === "Perspective";

  return (
    <>
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
        touches={isPerspective
          ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
          : { ONE: THREE.TOUCH.PAN,    TWO: THREE.TOUCH.DOLLY_PAN }
        }
        mouseButtons={isPerspective
          ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
          : { LEFT: THREE.MOUSE.PAN,    MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
        }
      />
    </>
  );
}

export default function SceneCanvas() {
  const { assets, sceneBackground, selectAsset, plateSize, plateColor, viewportType } =
    useScene();
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

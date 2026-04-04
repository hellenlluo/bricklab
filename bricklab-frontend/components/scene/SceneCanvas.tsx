"use client";

import { Suspense, useMemo, useEffect, useCallback } from "react";
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
      mat.needsUpdate = true;
    });
  });
}

function BrickModel({
  asset,
  onSelect,
}: {
  asset: SceneAsset;
  onSelect: (id: string) => void;
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
    );
  }, [
    cloned,
    asset.materialColor,
    asset.materialRoughness,
    asset.materialMetalness,
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
}: {
  asset: SceneAsset;
  onSelect: (id: string) => void;
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
      />
    </mesh>
  );
}

function PlacedAssets({ assets }: { assets: SceneAsset[] }) {
  const { selectAsset } = useScene();
  const placed = assets.filter((a) => a.visible && a.position);
  return (
    <>
      {placed.map((asset) =>
        asset.modelPath ? (
          <Suspense fallback={null} key={asset.id}>
            <BrickModel asset={asset} onSelect={selectAsset} />
          </Suspense>
        ) : (
          <PlaceholderBox key={asset.id} asset={asset} onSelect={selectAsset} />
        ),
      )}
    </>
  );
}

function SceneControls() {
  const { selectedAssetId, updateAsset, plateSize, assets } = useScene();
  const scene = useThree((s) => s.scene);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const rawObj =
    selectedAsset?.visible && selectedAssetId
      ? scene.getObjectByName(selectedAssetId)
      : null;
  const selectedObject = rawObj?.parent ? rawObj : undefined;

  const handleChange = useCallback(() => {
    const obj = selectedAssetId ? scene.getObjectByName(selectedAssetId) : null;
    if (!obj) return;
    obj.position.x = Math.round(obj.position.x);
    obj.position.y = Math.round(obj.position.y);
    obj.position.z = Math.max(0, Math.round(obj.position.z));
  }, [scene, selectedAssetId]);

  const handleMouseUp = useCallback(() => {
    const obj = selectedAssetId ? scene.getObjectByName(selectedAssetId) : null;
    if (!obj || !selectedAssetId) return;
    const x = Math.round(obj.position.x);
    const y = Math.round(obj.position.y);
    const z = Math.max(0, Math.round(obj.position.z));
    updateAsset(selectedAssetId, { position: [x, y, z] });
  }, [scene, selectedAssetId, updateAsset]);

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
        makeDefault
        enableRotate
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={plateSize * 2}
        panSpeed={0.8}
        zoomSpeed={1.2}
        rotateSpeed={0.6}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </>
  );
}

export default function SceneCanvas() {
  const { assets, sceneBackground, selectAsset, plateSize, plateColor } =
    useScene();

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
        <Gizmo />
      </Canvas>
    </div>
  );
}

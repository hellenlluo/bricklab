"use client";

import { Suspense, useMemo, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, useGLTF } from "@react-three/drei";
import { useScene, type SceneAsset } from "@/store/sceneStore";

// Preload the real brick model as soon as the module loads
useGLTF.preload("/brick.glb");

/** Sets Z as the camera up axis so the scene uses Z-up convention. */
function ZUpCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 0, 1);
  }, [camera]);
  return null;
}

function BrickModel({ asset }: { asset: SceneAsset }) {
  const { scene } = useGLTF(asset.modelPath!);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return (
    <primitive
      object={cloned}
      position={asset.position ?? [0, 0, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={10}
      castShadow
    />
  );
}

function PlaceholderBox({ asset }: { asset: SceneAsset }) {
  return (
    <mesh position={asset.position ?? [0, 0, 0]} castShadow>
      <boxGeometry args={[1, 1.2, 2]} />
      <meshStandardMaterial color="#90abd0" />
    </mesh>
  );
}

function PlacedAssets({ assets }: { assets: SceneAsset[] }) {
  const placed = assets.filter((a) => a.visible && a.position);
  return (
    <>
      {placed.map((asset) =>
        asset.modelPath ? (
          <Suspense fallback={null} key={asset.id}>
            <BrickModel asset={asset} />
          </Suspense>
        ) : (
          <PlaceholderBox key={asset.id} asset={asset} />
        )
      )}
    </>
  );
}

export default function SceneCanvas() {
  const { assets, sceneBackground } = useScene();

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [4, -4, 4], fov: 45, up: [0, 0, 1] }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[sceneBackground]} />
        <ZUpCamera />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, -5, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Grid
          args={[20, 20]}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          cellColor="#a1a1aa"
          sectionColor="#52525b"
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid
        />
        <Environment preset="city" />
        <OrbitControls
          makeDefault
          enableRotate
          enablePan
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={100}
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
        <PlacedAssets assets={assets} />
      </Canvas>
    </div>
  );
}

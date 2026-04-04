"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";

export default function SceneCanvas() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Grid
          args={[20, 20]}
          position={[0, 0, 0]}
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
          minDistance={1}
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
      </Canvas>
    </div>
  );
}

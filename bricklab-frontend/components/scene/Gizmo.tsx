"use client";

import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport } from "@react-three/drei";

type Controls = { target?: THREE.Vector3; update?: () => void } | null;

export default function Gizmo() {
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as Controls;
  const gap = 55;
  const marginX = Math.round(size.width * 0.16) + gap;
  const marginY = Math.round(size.height * 0.085) + gap;

  return (
    <GizmoHelper
      alignment="top-left"
      margin={[marginX, marginY]}
      onTarget={() => controls?.target?.clone() ?? new THREE.Vector3()}
      onUpdate={() => controls?.update?.()}
    >
      <mesh scale={new THREE.Vector3(0.75, 0.75, 0.75)}>
        <GizmoViewport
          axisColors={["#ff3653", "#8adb00", "#2c8fff"]}
          labelColor="white"
        />
      </mesh>
    </GizmoHelper>
  );
}

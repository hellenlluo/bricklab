"use client";

import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";

const PLATE_SIZE = 50;
const PLATE_THICKNESS = 0.5;
const STUD_RADIUS = 0.25;
const STUD_HEIGHT = 0.175;
const STUD_SPACING = 1;

export default function Baseplate() {
  const studCount = Math.round(PLATE_SIZE / STUD_SPACING);
  const total = studCount * studCount;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let idx = 0;
    const start = -(PLATE_SIZE / 2) + STUD_SPACING / 2;
    for (let ix = 0; ix < studCount; ix++) {
      const x = start + ix * STUD_SPACING;
      for (let iy = 0; iy < studCount; iy++) {
        const y = start + iy * STUD_SPACING;
        // Stud base sits flush on top surface (z=0), center at z=STUD_HEIGHT/2
        dummy.position.set(x, y, STUD_HEIGHT / 2);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy, studCount]);

  return (
    <group>
      {/* Plate slab: top surface at z=0, bottom at z=-PLATE_THICKNESS */}
      <mesh position={[0, 0, -PLATE_THICKNESS / 2]} receiveShadow>
        <boxGeometry args={[PLATE_SIZE, PLATE_SIZE, PLATE_THICKNESS]} />
        <meshStandardMaterial color="#4a7c59" />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, total]} castShadow receiveShadow>
        <cylinderGeometry args={[STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 8]} />
        <meshStandardMaterial color="#4a7c59" />
      </instancedMesh>
    </group>
  );
}

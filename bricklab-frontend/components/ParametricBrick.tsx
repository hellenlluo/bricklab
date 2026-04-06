"use client";

const STUD_SPACING = 1;
export const BODY_HEIGHT = 1;
const STUD_RADIUS = 0.25;
const STUD_HEIGHT = 0.175;

export interface ParametricBrickProps {
  studsX: number;
  studsY: number;
  color?: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  isSelected?: boolean;
}

export default function ParametricBrick({
  studsX,
  studsY,
  color = "#bfbfff",
  roughness = 0.88,
  metalness = 0.2,
  emissive = "black",
  emissiveIntensity = 0.25,
  isSelected = false,
}: ParametricBrickProps) {
  const studs: React.ReactElement[] = [];

  for (let ix = 0; ix < studsX; ix++) {
    for (let iy = 0; iy < studsY; iy++) {
      studs.push(
        <mesh
          key={`${ix}-${iy}`}
          position={[
            (ix + 0.5) * STUD_SPACING,
            -(iy + 0.5) * STUD_SPACING,
            BODY_HEIGHT + STUD_HEIGHT / 2,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 12]} />
          <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity} polygonOffset={isSelected} polygonOffsetFactor={isSelected ? -4 : 0} polygonOffsetUnits={isSelected ? -4 : 0} />
        </mesh>,
      );
    }
  }

  return (
    <group>
      {}
      <mesh
        position={[
          (studsX * STUD_SPACING) / 2,
          -(studsY * STUD_SPACING) / 2,
          BODY_HEIGHT / 2,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[studsX * STUD_SPACING, studsY * STUD_SPACING, BODY_HEIGHT]}
        />
        <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity} polygonOffset={isSelected} polygonOffsetFactor={isSelected ? -4 : 0} polygonOffsetUnits={isSelected ? -4 : 0} />
      </mesh>
      {studs}
    </group>
  );
}

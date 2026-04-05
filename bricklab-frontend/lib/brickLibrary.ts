export interface BrickDefinition {
  id: string;
  name: string;
  type: "preset-brick";
  modelPath: string;
  studsX: number;
  studsY: number;
}

export const BRICK_LIBRARY: BrickDefinition[] = [
  {
    id: "brick-1x1",
    name: "1×1",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 1,
    studsY: 1,
  },
  {
    id: "brick-2x1",
    name: "2×1",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 2,
    studsY: 1,
  },
  {
    id: "brick-6x1",
    name: "6×1",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 6,
    studsY: 1,
  },
  {
    id: "brick-12x1",
    name: "12×1",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 12,
    studsY: 1,
  },
  {
    id: "brick-2x2",
    name: "2×2",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 2,
    studsY: 2,
  },
  {
    id: "brick-4x2",
    name: "4×2",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 4,
    studsY: 2,
  },
  {
    id: "brick-6x2",
    name: "6×2",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 6,
    studsY: 2,
  },
  {
    id: "brick-6x4",
    name: "6×4",
    type: "preset-brick",
    modelPath: "/brick.glb",
    studsX: 6,
    studsY: 4,
  },
];

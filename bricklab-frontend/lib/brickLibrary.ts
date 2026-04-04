export interface BrickDefinition {
  id: string;
  name: string;
  /** Path relative to /public. Undefined means placeholder — no real model yet. */
  modelPath?: string;
  type: string;
}

export const BRICK_LIBRARY: BrickDefinition[] = [
  { id: "brick-1x1", name: "1×1", modelPath: "/brick.glb", type: "brick" },
  { id: "brick-ph-2", name: "Placeholder Brick 2", type: "brick" },
  { id: "brick-ph-3", name: "Placeholder Brick 3", type: "brick" },
  { id: "brick-ph-4", name: "Placeholder Brick 4", type: "brick" },
  { id: "brick-ph-5", name: "Placeholder Brick 5", type: "brick" },
  { id: "brick-ph-6", name: "Placeholder Brick 6", type: "brick" },
  { id: "brick-ph-7", name: "Placeholder Brick 7", type: "brick" },
  { id: "brick-ph-8", name: "Placeholder Brick 8", type: "brick" },
];

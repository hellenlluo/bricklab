export interface BrickDefinition {
  id: string;
  name: string;
  modelPath?: string;
  type: string;
}

export const BRICK_LIBRARY: BrickDefinition[] = [
  { id: "brick-1x1", name: "1×1", modelPath: "/brick.glb", type: "1x1 brick" },
  { id: "brick-ph-2", name: "Coming soon", type: "brick" },
  { id: "brick-ph-3", name: "Coming soon", type: "brick" },
  { id: "brick-ph-4", name: "Coming soon", type: "brick" },
  { id: "brick-ph-5", name: "Coming soon", type: "brick" },
  { id: "brick-ph-6", name: "Coming soon", type: "brick" },
  { id: "brick-ph-7", name: "Coming soon", type: "brick" },
  { id: "brick-ph-8", name: "Coming soon", type: "brick" },
];

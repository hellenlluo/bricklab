import type { SceneAsset } from "@/store/sceneStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackendBrick {
  h: number;
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface GenerationOffset {
  minX: number;
  minNegY: number;
  minZ: number;
}

export type PrefixEditPhase =
  | "idle"
  | "reverted_preview"
  | "editing_prefix"
  | "regenerating"
  | "error";

const VALID_BRICK_DIMS = new Set([
  "1x1", "1x2", "2x1", "1x4", "4x1", "1x6", "6x1", "1x8", "8x1",
  "2x2", "2x4", "4x2", "2x6", "6x2",
]);

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Compute the generation offset from raw backend bricks.
 *
 * The offset places the top-left corner of the bounding box (viewed from
 * the +Z axis) at the scene origin:
 *   sceneX = b.x - minX          →  left edge at X = 0
 *   sceneY = -b.y - maxNegY      →  top edge at Y = 0  (bricks extend -Y)
 *   sceneZ = b.z - minZ          →  base at Z = 0
 *
 * `minNegY` stores max(-b.y) (i.e. -min(b.y)) so the field doubles as the
 * Y anchor for the round-trip conversion in `sceneAssetsToBackendBricks`.
 */
export function computeGenerationOffset(
  bricks: BackendBrick[],
): GenerationOffset {
  let minX = Infinity;
  let maxNegY = -Infinity;
  let minZ = Infinity;
  for (const b of bricks) {
    minX = Math.min(minX, b.x);
    maxNegY = Math.max(maxNegY, -b.y);
    minZ = Math.min(minZ, b.z);
  }
  return { minX, minNegY: maxNegY, minZ };
}

/**
 * Convert scene-space assets back to BrickGPT backend bricks using the
 * stored generation offset.
 *
 * Scene -> Backend:
 *   backendX = sceneX + offset.minX
 *   backendY = -(sceneY + offset.minNegY)
 *   backendZ = sceneZ + offset.minZ
 *   h = studsX,  w = studsY
 */
export function sceneAssetsToBackendBricks(
  assets: SceneAsset[],
  offset: GenerationOffset,
): BackendBrick[] {
  return assets
    .filter((a) => a.preset && a.position)
    .map((a) => ({
      h: a.preset!.studsX,
      w: a.preset!.studsY,
      x: Math.round(a.position![0] + offset.minX),
      y: Math.round(-(a.position![1] + offset.minNegY)),
      z: Math.round(a.position![2] + offset.minZ),
    }));
}

/**
 * Strip UI-only fields from scene assets and validate that every brick's
 * dimensions belong to BrickGPT's library. Returns only the geometric data.
 */
export function normalizeEditableBricks(
  assets: SceneAsset[],
): { valid: SceneAsset[]; invalid: SceneAsset[] } {
  const valid: SceneAsset[] = [];
  const invalid: SceneAsset[] = [];
  for (const a of assets) {
    if (!a.preset || !a.position) {
      invalid.push(a);
      continue;
    }
    const key = `${a.preset.studsX}x${a.preset.studsY}`;
    if (VALID_BRICK_DIMS.has(key)) {
      valid.push(a);
    } else {
      invalid.push(a);
    }
  }
  return { valid, invalid };
}

/**
 * Produce an ordered list of backend bricks for prefix regeneration.
 *
 * BrickGPT is autoregressive — the order of bricks in the prefix is
 * semantically meaningful.  We preserve the original generation order
 * (recorded in `originalAssets`) so the model sees a prefix consistent
 * with what it would have produced itself.  Bricks that the user deleted
 * are simply omitted; remaining bricks keep their original sequence
 * position even if they were moved in the scene.
 */
export function derivePrefixOrder(
  originalAssets: SceneAsset[],
  editedAssets: SceneAsset[],
  offset: GenerationOffset,
): BackendBrick[] {
  const editedById = new Map<string, SceneAsset>();
  for (const a of editedAssets) editedById.set(a.id, a);

  // Walk original order; pick edited version of each surviving brick.
  const ordered: SceneAsset[] = [];
  for (const orig of originalAssets) {
    const edited = editedById.get(orig.id);
    if (edited) ordered.push(edited);
  }

  // Append any bricks the user added that weren't in the original set.
  const origIds = new Set(originalAssets.map((a) => a.id));
  for (const a of editedAssets) {
    if (!origIds.has(a.id)) ordered.push(a);
  }

  return sceneAssetsToBackendBricks(ordered, offset);
}

/**
 * Convert backend bricks into scene assets and history entries for
 * integrating a regeneration result back into the scene store.
 */
export function backendBricksToScene(
  bricks: BackendBrick[],
  defaults: {
    defaultColor: string;
    category: SceneAsset["category"];
    idPrefix: string;
    startingIndex: number;
  },
): { assets: SceneAsset[]; history: GenerationHistoryEntry[] } {
  const offset = computeGenerationOffset(bricks);

  const assets: SceneAsset[] = bricks.map((b, i) => ({
    id: `${defaults.idPrefix}-${i}-${Date.now()}`,
    name: `Brick ${defaults.startingIndex + i + 1}`,
    type: "preset-brick",
    visible: true,
    selectable: true,
    category: defaults.category,
    position: [
      b.x - offset.minX,
      -b.y - offset.minNegY,
      b.z - offset.minZ,
    ] as [number, number, number],
    materialColor: defaults.defaultColor,
    materialRoughness: 0.88,
    materialMetalness: 0.2,
    preset: { studsX: b.h, studsY: b.w },
  }));

  const history: GenerationHistoryEntry[] = bricks.map((b) => ({
    x: b.x - offset.minX,
    y: -b.y - offset.minNegY,
    z: b.z - offset.minZ,
    studsX: b.h,
    studsY: b.w,
  }));

  return { assets, history };
}

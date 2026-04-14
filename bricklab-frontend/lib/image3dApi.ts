/**
 * Frontend service layer for the image-to-3D pipeline.
 *
 * Flow: uploadImage → predictMask (per click) → reconstruct → revoxelize.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResponse {
  image_id: string;
}

export interface ClickPoint {
  x: number;
  y: number;
  label: number; // 1 = foreground, 0 = background
}

export interface PredictResponse {
  mask_b64: string;
}

export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface ReconstructResponse {
  ply_id: string;
  voxels: VoxelData[];
}

export interface VoxelizeResponse {
  voxels: VoxelData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Server error ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Upload an image and pre-compute its SAM embedding for fast segmentation. */
export async function uploadImage(
  file: File,
  signal?: AbortSignal,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("image", file);

  const res = await fetch(`${API_URL}/image3d/upload`, {
    method: "POST",
    body: form,
    signal,
  });
  await assertOk(res);
  return res.json();
}

/** Run SAM mask decoder with click-point prompts and get a mask overlay. */
export async function predictMask(
  imageId: string,
  points: ClickPoint[],
  signal?: AbortSignal,
): Promise<PredictResponse> {
  const res = await fetch(`${API_URL}/image3d/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_id: imageId,
      points: points.map((p) => ({ x: p.x, y: p.y })),
      labels: points.map((p) => p.label),
    }),
    signal,
  });
  await assertOk(res);
  return res.json();
}

/** Run TripoSR 3D reconstruction with the last predicted mask. */
export async function reconstruct(
  imageId: string,
  seed: number = 42,
  voxelSize: number = 0.05,
  signal?: AbortSignal,
): Promise<ReconstructResponse> {
  const params = new URLSearchParams({
    image_id: imageId,
    seed: String(seed),
    voxel_size: String(voxelSize),
  });

  const res = await fetch(`${API_URL}/image3d/reconstruct?${params}`, {
    method: "POST",
    signal,
  });
  await assertOk(res);
  return res.json();
}

/** Re-voxelize an existing PLY at a different brick density. */
export async function revoxelize(
  plyId: string,
  voxelSize: number,
  signal?: AbortSignal,
): Promise<VoxelizeResponse> {
  const res = await fetch(`${API_URL}/image3d/voxelize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ply_id: plyId, voxel_size: voxelSize }),
    signal,
  });
  await assertOk(res);
  return res.json();
}

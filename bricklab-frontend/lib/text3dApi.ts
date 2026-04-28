/**
 * Frontend service layer for text-to-3D brick generation.
 */

import type { BackendBrick } from "./prefixEditing";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface BackendConstraint {
  pos_x: number;
  pos_y: number;
  pos_z: number;
  size_x: number;
  size_y: number;
  size_z: number;
}

export interface GenerateBricksResponse {
  bricks: BackendBrick[];
  total_bricks: number;
  partial: boolean;
  warning: string | null;
}

export interface RegenerateFromPrefixResponse extends GenerateBricksResponse {
  prefix_count: number;
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Server error ${res.status}`);
  }
}

export async function generateTextBricks(
  prompt: string,
  constraints: BackendConstraint[],
  signal?: AbortSignal,
): Promise<GenerateBricksResponse> {
  const res = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, constraints }),
    signal,
  });
  await assertOk(res);
  return res.json();
}

export async function regenerateTextBricksFromPrefix(
  prompt: string,
  prefixBricks: BackendBrick[],
  constraints: BackendConstraint[],
  signal?: AbortSignal,
): Promise<RegenerateFromPrefixResponse> {
  const res = await fetch(`${API_URL}/generate/regenerate-from-prefix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      prefix_bricks: prefixBricks,
      constraints,
    }),
    signal,
  });
  await assertOk(res);
  return res.json();
}

/**
 * Frontend service layer for the text-to-3D pipeline.
 *
 * Flow: generateTextBricks → (user edits) → regenerateTextBricksFromPrefix.
 */

import type { BackendBrick } from "./prefixEditing";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/** Generate a brick structure from a natural-language prompt and optional constraint volumes. */
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

/** Continue generation from an edited brick prefix, appending new bricks after the user's changes. */
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

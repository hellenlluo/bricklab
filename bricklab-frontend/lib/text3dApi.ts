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
// Streaming types
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "brick"; data: BackendBrick }
  | { type: "reject"; data: BackendBrick | null; reason: string }
  | { type: "rollback"; keep_count: number }
  | {
      type: "done";
      partial: boolean;
      warning: string | null;
      total_bricks: number;
    }
  | { type: "error"; message: string };

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

/**
 * Stream brick generation as Server-Sent Events via a POST fetch.
 * Calls *onEvent* for every event until a "done" or "error" event is received.
 */
export async function generateTextBricksStream(
  prompt: string,
  constraints: BackendConstraint[],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, constraints }),
    signal,
  });
  await assertOk(res);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE lines end with \n; double-newline separates events.
      const lines = buffer.split("\n");
      // Keep the last (possibly incomplete) segment.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        const event = JSON.parse(raw) as StreamEvent;
        onEvent(event);
        if (event.type === "done" || event.type === "error") return;
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

/**
 * Stream continuation generation from an edited prefix as Server-Sent Events.
 *
 * Only bricks added **after** the prefix are emitted as ``brick`` events —
 * the prefix is assumed to already be in the caller's state.  The ``done``
 * event additionally carries ``prefix_count``.
 */
export async function regenerateTextBricksFromPrefixStream(
  prompt: string,
  prefixBricks: BackendBrick[],
  constraints: BackendConstraint[],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/generate/regenerate-from-prefix/stream`, {
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

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        const event = JSON.parse(raw) as StreamEvent;
        onEvent(event);
        if (event.type === "done" || event.type === "error") return;
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
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

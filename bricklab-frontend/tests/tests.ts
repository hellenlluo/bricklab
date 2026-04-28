/**
 * Comprehensive frontend tests for BrickLab's core app behaviors.
 *
 * Covers:
 * - generation/prefix-edit coordinate transforms and validation
 * - image-to-3D API request formatting and error handling
 * - input validation logic used by scene settings panels
 *
 * Run with: npx vitest run tests/tests.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeGenerationOffset,
  sceneAssetsToBackendBricks,
  normalizeEditableBricks,
  derivePrefixOrder,
  backendBricksToScene,
  type BackendBrick,
} from "../lib/prefixEditing";
import {
  uploadImage,
  predictMask,
  reconstruct,
  revoxelize,
} from "../lib/image3dApi";
import {
  generateTextBricks,
  regenerateTextBricksFromPrefix,
} from "../lib/text3dApi";
import type { SceneAsset } from "../store/sceneStore";

function makeBrick(x: number, y: number, z: number, h = 1, w = 1): BackendBrick {
  return { h, w, x, y, z };
}

function makeAsset(
  id: string,
  studsX: number,
  studsY: number,
  position: [number, number, number] = [0, 0, 0],
): SceneAsset {
  return {
    id,
    name: id,
    type: "preset-brick",
    visible: true,
    selectable: true,
    category: "text-to-3d",
    materialColor: "#ff0000",
    materialRoughness: 0.88,
    materialMetalness: 0.2,
    position,
    preset: { studsX, studsY },
  };
}

// ---------------------------------------------------------------------------
// Core generation / prefix-edit transforms
// ---------------------------------------------------------------------------

describe("computeGenerationOffset", () => {
  it("anchors bounding box with minX, max(-y), and minZ", () => {
    const bricks = [makeBrick(3, -2, 5), makeBrick(7, -5, 9)];
    const offset = computeGenerationOffset(bricks);
    expect(offset.minX).toBe(3);
    expect(offset.minNegY).toBe(5);
    expect(offset.minZ).toBe(5);
  });

  it("handles single-brick and co-located-brick edge cases", () => {
    expect(computeGenerationOffset([makeBrick(1, -3, 2)])).toEqual({
      minX: 1,
      minNegY: 3,
      minZ: 2,
    });
    expect(computeGenerationOffset([makeBrick(4, -1, 4), makeBrick(4, -1, 4)])).toEqual({
      minX: 4,
      minNegY: 1,
      minZ: 4,
    });
  });
});

describe("normalizeEditableBricks", () => {
  it("accepts supported dimensions and rejects unsupported ones", () => {
    const assets = [
      makeAsset("a", 2, 4),
      makeAsset("b", 3, 3),
      makeAsset("c", 1, 1),
    ];
    const { valid, invalid } = normalizeEditableBricks(assets);
    expect(valid.map((a) => a.id)).toEqual(["a", "c"]);
    expect(invalid.map((a) => a.id)).toEqual(["b"]);
  });

  it("rejects assets missing preset or position", () => {
    const bad = [
      { ...makeAsset("x", 1, 1), preset: undefined } as unknown as SceneAsset,
      { ...makeAsset("y", 1, 2), position: undefined } as unknown as SceneAsset,
    ];
    const { valid, invalid } = normalizeEditableBricks(bad);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(2);
  });
});

describe("sceneAssetsToBackendBricks", () => {
  it("round-trips backend coordinates without drift", () => {
    const original = makeBrick(3, -1, 5, 2, 4);
    const offset = computeGenerationOffset([original]);
    const scenePos: [number, number, number] = [
      original.x - offset.minX,
      -original.y - offset.minNegY,
      original.z - offset.minZ,
    ];
    const asset = makeAsset("r", 2, 4, scenePos);
    expect(sceneAssetsToBackendBricks([asset], offset)[0]).toEqual({
      h: 2,
      w: 4,
      x: 3,
      y: -1,
      z: 5,
    });
  });
});

describe("derivePrefixOrder", () => {
  const offset = { minX: 0, minNegY: 0, minZ: 0 };

  it("preserves original order while omitting deleted bricks", () => {
    const orig = [makeAsset("a", 1, 1), makeAsset("b", 2, 2), makeAsset("c", 1, 2)];
    const edited = [makeAsset("a", 1, 1), makeAsset("c", 1, 2)];
    const result = derivePrefixOrder(orig, edited, offset);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ h: 1, w: 1 });
    expect(result[1]).toMatchObject({ h: 1, w: 2 });
  });

  it("appends newly added bricks at the end", () => {
    const orig = [makeAsset("a", 1, 1)];
    const edited = [makeAsset("a", 1, 1), makeAsset("new", 2, 2, [1, 0, 1])];
    const result = derivePrefixOrder(orig, edited, offset);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ h: 2, w: 2 });
  });
});

describe("backendBricksToScene", () => {
  it("maps backend coordinates to scene positions with Y-flip", () => {
    const bricks = [makeBrick(3, -2, 5), makeBrick(5, -4, 7, 1, 2)];
    const { assets } = backendBricksToScene(bricks, {
      defaultColor: "#ff0000",
      category: "text-to-3d",
      idPrefix: "t",
      startingIndex: 0,
    });
    expect(assets[0].position).toEqual([0, -2, 0]);
    expect(assets[1].position).toEqual([2, 0, 2]);
  });

  it("produces matching history entries", () => {
    const bricks = [makeBrick(0, 0, 0, 2, 4)];
    const { assets, history } = backendBricksToScene(bricks, {
      defaultColor: "#aabbcc",
      category: "text-to-3d",
      idPrefix: "h",
      startingIndex: 5,
    });
    expect(history).toHaveLength(1);
    expect(history[0].studsX).toBe(assets[0].preset!.studsX);
    expect(history[0].studsY).toBe(assets[0].preset!.studsY);
  });
});

// ---------------------------------------------------------------------------
// API client behavior for image-to-3D flow
// ---------------------------------------------------------------------------

describe("image3dApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploadImage sends a multipart request to the upload endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ image_id: "img-1" }), { status: 200 }),
    );

    const file = new File(["png"], "chair.png", { type: "image/png" });
    const result = await uploadImage(file);

    expect(result).toEqual({ image_id: "img-1" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8000/image3d/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    const sentFile = (init?.body as FormData).get("image") as File;
    expect(sentFile.name).toBe("chair.png");
  });

  it("predictMask serializes click points into points and labels arrays", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ mask_b64: "abc" }), { status: 200 }),
    );

    await predictMask("img-1", [
      { x: 10, y: 20, label: 1 },
      { x: 30, y: 40, label: 0 },
    ]);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      image_id: "img-1",
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      labels: [1, 0],
    });
  });

  it("reconstruct sends query params for image id, seed, and voxel size", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ply_id: "ply-1", voxels: [] }), { status: 200 }),
    );

    await reconstruct("img-7", 99, 0.075);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/image3d/reconstruct?");
    expect(String(url)).toContain("image_id=img-7");
    expect(String(url)).toContain("seed=99");
    expect(String(url)).toContain("voxel_size=0.075");
    expect(init?.method).toBe("POST");
  });

  it("revoxelize posts JSON to the voxelize endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ voxels: [] }), { status: 200 }),
    );

    await revoxelize("ply-9", 0.08);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8000/image3d/voxelize");
    expect(JSON.parse(String(init?.body))).toEqual({
      ply_id: "ply-9",
      voxel_size: 0.08,
    });
  });

  it("throws server response text for failed requests", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("mask missing", { status: 404 }));

    await expect(reconstruct("missing")).rejects.toThrow("mask missing");
  });

  it("falls back to a generic status error when the response body is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));

    await expect(revoxelize("ply-1", 0.05)).rejects.toThrow("Server error 500");
  });
});

// ---------------------------------------------------------------------------
// API client behavior for text-to-3D flow
// ---------------------------------------------------------------------------

describe("text3dApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("generateTextBricks posts prompt and constraints to the generate endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          bricks: [{ h: 1, w: 2, x: 0, y: 0, z: 0 }],
          total_bricks: 1,
          partial: false,
          warning: null,
        }),
        { status: 200 },
      ),
    );

    const result = await generateTextBricks("small tower", [
      { pos_x: 1, pos_y: 2, pos_z: 0, size_x: 3, size_y: 4, size_z: 5 },
    ]);

    expect(result.total_bricks).toBe(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8000/generate");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: "small tower",
      constraints: [
        { pos_x: 1, pos_y: 2, pos_z: 0, size_x: 3, size_y: 4, size_z: 5 },
      ],
    });
  });

  it("regenerateTextBricksFromPrefix posts prompt, prefix bricks, and constraints", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          bricks: [
            { h: 1, w: 2, x: 0, y: 0, z: 0 },
            { h: 2, w: 2, x: 1, y: 0, z: 0 },
          ],
          total_bricks: 2,
          prefix_count: 1,
          partial: false,
          warning: null,
        }),
        { status: 200 },
      ),
    );

    const prefixBricks = [makeBrick(0, 0, 0, 1, 2)];
    const result = await regenerateTextBricksFromPrefix("extend wall", prefixBricks, []);

    expect(result.prefix_count).toBe(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8000/generate/regenerate-from-prefix");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: "extend wall",
      prefix_bricks: [{ h: 1, w: 2, x: 0, y: 0, z: 0 }],
      constraints: [],
    });
  });

  it("throws server response text for failed generation requests", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("bad prompt", { status: 400 }));

    await expect(generateTextBricks("bad prompt", [])).rejects.toThrow("bad prompt");
  });
});

// ---------------------------------------------------------------------------
// Input validation logic shared across settings/properties flows
// ---------------------------------------------------------------------------

describe("hex color validation regex", () => {
  const FULL_HEX = /^#[0-9a-fA-F]{6}$/;
  const PARTIAL_HEX = /^#[0-9a-fA-F]{0,6}$/;

  it("FULL_HEX accepts valid full colors and rejects malformed inputs", () => {
    expect(FULL_HEX.test("#ff0000")).toBe(true);
    expect(FULL_HEX.test("#AABBCC")).toBe(true);
    expect(FULL_HEX.test("#fff")).toBe(false);
    expect(FULL_HEX.test("ff0000")).toBe(false);
    expect(FULL_HEX.test("#gggggg")).toBe(false);
  });

  it("PARTIAL_HEX allows intermediate typing states but blocks invalid chars", () => {
    expect(PARTIAL_HEX.test("#")).toBe(true);
    expect(PARTIAL_HEX.test("#ab")).toBe(true);
    expect(PARTIAL_HEX.test("#ff0000")).toBe(true);
    expect(PARTIAL_HEX.test("#xyz")).toBe(false);
    expect(PARTIAL_HEX.test("notahex")).toBe(false);
  });
});

function normalizePlateSize(size: number): number {
  const rounded = Math.max(2, Math.round(size));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

describe("normalizePlateSize", () => {
  it("rounds odd values up, preserves even values, and enforces a minimum of 2", () => {
    expect(normalizePlateSize(5)).toBe(6);
    expect(normalizePlateSize(6)).toBe(6);
    expect(normalizePlateSize(0)).toBe(2);
    expect(normalizePlateSize(-10)).toBe(2);
  });

  it("rounds floats before the even-number rule", () => {
    expect(normalizePlateSize(4.6)).toBe(6);
    expect(normalizePlateSize(4.4)).toBe(4);
  });
});

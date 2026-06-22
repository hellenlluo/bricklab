"use client";

import React, { createContext, useContext, useState, useRef } from "react";
import type { GenerationOffset } from "@/lib/prefixEditing";

export type AssetCategory = "primitive" | "text-to-3d" | "image-to-3d";

export interface SceneAsset {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
  category?: AssetCategory;
  groupId?: string;
  modelPath?: string;
  position?: [number, number, number];
  materialColor?: string;
  materialRoughness?: number;
  materialMetalness?: number;
  preset?: {
    studsX: number;
    studsY: number;
  };
}

export interface GenerationHistoryEntry {
  x: number;
  y: number;
  z: number;
  studsX: number;
  studsY: number;
}

export interface BrickGroup {
  id: string;
  name: string;
  category?: AssetCategory;
  parentGroupId?: string;
  generationHistory?: GenerationHistoryEntry[];
  originalPrompt?: string;
  generationOffset?: GenerationOffset;
  originalConstraints?: ConstraintBox[];
}

export interface CustomBrickDefinition {
  id: string;
  name: string;
  studsX: number;
  studsY: number;
}

export interface ConstraintBox {
  id: string;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  posX: number;
  posY: number;
  posZ: number;
}

export interface Constraint {
  id: string;
  name: string;
  boxes: ConstraintBox[];
}

export interface SceneData {
  id: string;
  name: string;
  assets: SceneAsset[];
  groups: BrickGroup[];
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  sceneBackground: string;
  plateSize: number;
  plateColor: string;
  maxCameraDistance: number;
}

const DEFAULT_SCENE_ID = "scene-default";

function normalizePlateSize(size: number): number {
  const rounded = Math.max(2, Math.round(size));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function createDefaultScene(id: string, name: string): SceneData {
  return {
    id,
    name,
    assets: [],
    groups: [],
    selectedAssetId: null,
    selectedAssetIds: [],
    sceneBackground: "#7d6f82",
    plateSize: 50,
    plateColor: "#ebebeb",
    maxCameraDistance: 100,
  };
}

function collectGroupMemberIds(
  groupId: string,
  sceneAssets: SceneAsset[],
  sceneGroups: BrickGroup[],
): string[] {
  const direct = sceneAssets
    .filter((a) => a.groupId === groupId)
    .map((a) => a.id);
  const childIds = sceneGroups
    .filter((g) => g.parentGroupId === groupId)
    .flatMap((g) => collectGroupMemberIds(g.id, sceneAssets, sceneGroups));
  return [...direct, ...childIds];
}

function inferGroupCategory(
  sceneAssets: SceneAsset[],
): AssetCategory | undefined {
  const categories = new Set(
    sceneAssets.map((asset) => asset.category).filter(Boolean),
  );
  return categories.size === 1
    ? (Array.from(categories)[0] as AssetCategory)
    : undefined;
}

function getNextPastedName(name: string, usedNames: Set<string>): string {
  let suffix = 2;
  let nextName = `${name} ${suffix}`;
  while (usedNames.has(nextName)) {
    suffix += 1;
    nextName = `${name} ${suffix}`;
  }
  usedNames.add(nextName);
  return nextName;
}

interface SceneStore {
  // Multi-scene management
  scenes: SceneData[];
  activeSceneId: string;
  addScene: () => void;
  removeScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  setActiveScene: (id: string) => void;
  // Per-scene state (proxied from active scene)
  assets: SceneAsset[];
  addAsset: (asset: SceneAsset) => void;
  addAssetsAsGroup: (
    assets: SceneAsset[],
    groupName: string,
    generationHistory?: GenerationHistoryEntry[],
    originalPrompt?: string,
    generationOffset?: GenerationOffset,
    originalConstraints?: ConstraintBox[],
  ) => void;
  removeAsset: (id: string) => void;
  removeSelectedAssets: () => void;
  removeGroup: (groupId: string) => void;
  updateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  decomposeBrick: (id: string) => void;
  groups: BrickGroup[];
  groupSelected: () => void;
  ungroupAssets: (groupId: string) => void;
  updateGroup: (groupId: string, name: string) => void;
  moveAssetToGroup: (
    assetId: string,
    targetGroupId: string | undefined,
  ) => void;
  revertGroupToStep: (groupId: string, k: number) => void;
  replaceGroupGeneration: (
    groupId: string,
    newAssets: SceneAsset[],
    newHistory: GenerationHistoryEntry[],
    newOffset?: GenerationOffset,
  ) => void;
  pasteAssets: (
    clipboardAssets: SceneAsset[],
    clipboardGroups: BrickGroup[],
  ) => void;
  undo: () => void;
  captureUndoSnapshot: () => void;
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  selectAsset: (id: string | null) => void;
  selectAssets: (ids: string[]) => void;
  peekAsset: (id: string) => void;
  selectGroup: (groupId: string) => void;
  toggleGroupSelection: (groupId: string) => void;
  toggleAssetSelection: (id: string) => void;
  rotateSelectedAssets: (direction: "cw" | "ccw") => void;
  sceneBackground: string;
  setSceneBackground: (color: string) => void;
  plateSize: number;
  setPlateSize: (size: number) => void;
  plateColor: string;
  setPlateColor: (color: string) => void;
  maxCameraDistance: number;
  setMaxCameraDistance: (d: number) => void;
  // Constraints (global)
  constraints: Constraint[];
  addConstraint: (constraint: Constraint) => void;
  updateConstraint: (id: string, updates: Partial<Constraint>) => void;
  removeConstraint: (id: string) => void;
  // Global settings
  customBricks: CustomBrickDefinition[];
  addCustomBrick: (brick: CustomBrickDefinition) => void;
  removeCustomBrick: (id: string) => void;
  defaultBrickColor: string;
  setDefaultBrickColor: (color: string) => void;
  selectionColor: string;
  setSelectionColor: (color: string) => void;
  viewportType: string;
  setViewportType: (v: string) => void;
}

const SceneContext = createContext<SceneStore | null>(null);

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const [scenes, setScenes] = useState<SceneData[]>([
    createDefaultScene(DEFAULT_SCENE_ID, "Scene 1"),
  ]);
  const [activeSceneId, setActiveSceneId] = useState<string>(DEFAULT_SCENE_ID);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [customBricks, setCustomBricks] = useState<CustomBrickDefinition[]>([]);
  const [defaultBrickColor, setDefaultBrickColor] = useState<string>("#a8c6fe");
  const [selectionColor, setSelectionColor] = useState<string>("#ff8c82");
  const [viewportType, setViewportType] = useState<string>("Perspective");

  // Undo stack — stores up to 20 active-scene snapshots
  const undoStackRef = useRef<SceneData[]>([]);

  // Derive active scene data
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const {
    assets,
    groups,
    selectedAssetId,
    selectedAssetIds,
    sceneBackground,
    plateSize,
    plateColor,
    maxCameraDistance,
  } = activeScene;

  function pushUndo() {
    const snapshot = activeScene;
    undoStackRef.current = [...undoStackRef.current.slice(-19), snapshot];
  }

  function pasteAssets(
    clipboardAssets: SceneAsset[],
    clipboardGroups: BrickGroup[],
  ) {
    if (clipboardAssets.length === 0) return;
    pushUndo();
    // eslint-disable-next-line react-hooks/purity
    const ts = Date.now();

    updateActiveScene((s) => {
      const usedAssetNames = new Set(s.assets.map((asset) => asset.name));
      const usedGroupNames = new Set(s.groups.map((group) => group.name));

      // Map old group IDs → new group IDs
      const groupIdMap = new Map<string, string>();
      clipboardGroups.forEach((g, i) => {
        groupIdMap.set(g.id, `group-paste-${ts}-${i}`);
      });

      const newGroups: BrickGroup[] = clipboardGroups.map((g, i) => ({
        ...g,
        id: `group-paste-${ts}-${i}`,
        name: getNextPastedName(g.name, usedGroupNames),
        parentGroupId: g.parentGroupId
          ? groupIdMap.get(g.parentGroupId)
          : undefined,
      }));

      const newAssets: SceneAsset[] = clipboardAssets.map((a, i) => ({
        ...a,
        id: `paste-${ts}-${i}`,
        name: getNextPastedName(a.name, usedAssetNames),
        groupId: a.groupId ? groupIdMap.get(a.groupId) : undefined,
      }));

      const newAssetIds = newAssets.map((a) => a.id);

      return {
        ...s,
        assets: [...s.assets, ...newAssets],
        groups: [...s.groups, ...newGroups],
        selectedAssetId: newAssetIds[newAssetIds.length - 1] ?? null,
        selectedAssetIds: newAssetIds,
      };
    });
  }

  function undo() {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setScenes((scenes) =>
      scenes.map((s) =>
        s.id === activeSceneId
          ? { ...prev, selectedAssetId: null, selectedAssetIds: [] }
          : s,
      ),
    );
  }

  function captureUndoSnapshot() {
    pushUndo();
  }

  function updateActiveScene(updater: (scene: SceneData) => SceneData) {
    setScenes((prev) =>
      prev.map((s) => (s.id === activeSceneId ? updater(s) : s)),
    );
  }

  // ── Multi-scene management ─────────────────────────────────────────────────

  function addScene() {
    const id = `scene-${Date.now()}`;
    const name = `Scene ${scenes.length + 1}`;
    setScenes((prev) => [...prev, createDefaultScene(id, name)]);
    setActiveSceneId(id);
  }

  function removeScene(id: string) {
    if (scenes.length <= 1) return;
    setScenes((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next;
    });
    setActiveSceneId((prev) => {
      if (prev !== id) return prev;
      const remaining = scenes.filter((s) => s.id !== id);
      return remaining[0]?.id ?? DEFAULT_SCENE_ID;
    });
  }

  function renameScene(id: string, name: string) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function setActiveScene(id: string) {
    setActiveSceneId(id);
  }

  // ── Constraints ────────────────────────────────────────────────────────────

  function addConstraint(constraint: Constraint) {
    setConstraints((prev) => [...prev, constraint]);
  }

  function updateConstraint(id: string, updates: Partial<Constraint>) {
    setConstraints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  }

  function removeConstraint(id: string) {
    setConstraints((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Global settings ────────────────────────────────────────────────────────

  function addCustomBrick(brick: CustomBrickDefinition) {
    setCustomBricks((prev) => [...prev, brick]);
  }

  function removeCustomBrick(id: string) {
    setCustomBricks((prev) => prev.filter((b) => b.id !== id));
  }

  // ── Per-scene helpers ──────────────────────────────────────────────────────

  function updatePlateSize(size: number) {
    const normalizedSize = normalizePlateSize(size);
    updateActiveScene((s) => ({
      ...s,
      plateSize: normalizedSize,
      maxCameraDistance: Math.max(normalizedSize, 50) * 2,
    }));
  }

  function addAsset(asset: SceneAsset) {
    pushUndo();
    updateActiveScene((s) => ({ ...s, assets: [...s.assets, asset] }));
  }

  function addAssetsAsGroup(
    newAssets: SceneAsset[],
    groupName: string,
    generationHistory?: GenerationHistoryEntry[],
    originalPrompt?: string,
    genOffset?: GenerationOffset,
    originalConstraints?: ConstraintBox[],
  ) {
    pushUndo();
    const groupId = `group-${Date.now()}`;
    const group: BrickGroup = {
      id: groupId,
      name: groupName,
      category: inferGroupCategory(newAssets),
      generationHistory,
      originalPrompt,
      generationOffset: genOffset,
      originalConstraints,
    };
    updateActiveScene((s) => ({
      ...s,
      assets: [...s.assets, ...newAssets.map((a) => ({ ...a, groupId }))],
      groups: [...s.groups, group],
    }));
  }

  function removeAsset(id: string) {
    pushUndo();
    updateActiveScene((s) => ({
      ...s,
      assets: s.assets.filter((a) => a.id !== id),
      selectedAssetId: s.selectedAssetId === id ? null : s.selectedAssetId,
      selectedAssetIds: s.selectedAssetIds.filter((x) => x !== id),
    }));
  }

  function removeSelectedAssets() {
    const ids = new Set(selectedAssetIds);
    if (ids.size === 0) return;
    pushUndo();
    updateActiveScene((s) => ({
      ...s,
      assets: s.assets.filter((a) => !ids.has(a.id)),
      selectedAssetId: null,
      selectedAssetIds: [],
    }));
  }

  function removeGroup(groupId: string) {
    pushUndo();
    updateActiveScene((s) => {
      function collectAssetIds(gId: string): string[] {
        const direct = s.assets
          .filter((a) => a.groupId === gId)
          .map((a) => a.id);
        const childGroupIds = s.groups
          .filter((g) => g.parentGroupId === gId)
          .map((g) => g.id);
        return [...direct, ...childGroupIds.flatMap(collectAssetIds)];
      }
      function collectGroupIds(gId: string): string[] {
        const childGroupIds = s.groups
          .filter((g) => g.parentGroupId === gId)
          .map((g) => g.id);
        return [gId, ...childGroupIds.flatMap(collectGroupIds)];
      }
      const assetIdsToRemove = new Set(collectAssetIds(groupId));
      const groupIdsToRemove = new Set(collectGroupIds(groupId));
      return {
        ...s,
        assets: s.assets.filter((a) => !assetIdsToRemove.has(a.id)),
        groups: s.groups.filter((g) => !groupIdsToRemove.has(g.id)),
        selectedAssetId: null,
        selectedAssetIds: [],
      };
    });
  }

  function groupSelected() {
    if (selectedAssetIds.length < 2) return;
    pushUndo();
    const ids = selectedAssetIds;

    function collectAllAssetIds(gId: string): string[] {
      const direct = assets.filter((a) => a.groupId === gId).map((a) => a.id);
      const childIds = groups
        .filter((g) => g.parentGroupId === gId)
        .flatMap((g) => collectAllAssetIds(g.id));
      return [...direct, ...childIds];
    }

    function isFullyInSelection(gId: string): boolean {
      const directs = assets.filter((a) => a.groupId === gId);
      const children = groups.filter((g) => g.parentGroupId === gId);
      if (directs.length === 0 && children.length === 0) return false;
      return (
        directs.every((a) => ids.includes(a.id)) &&
        children.every((g) => isFullyInSelection(g.id))
      );
    }

    const groupsToNest = groups.filter(
      (g) => !g.parentGroupId && isFullyInSelection(g.id),
    );

    const nestedMemberIds = new Set(
      groupsToNest.flatMap((g) => collectAllAssetIds(g.id)),
    );
    const looseBrickIds = ids.filter((id) => !nestedMemberIds.has(id));

    if (groupsToNest.length + looseBrickIds.length < 2) return;

    const groupId = `group-${Date.now()}`;
    const newGroup: BrickGroup = {
      id: groupId,
      name: `Group ${groups.length + 1}`,
    };

    updateActiveScene((s) => ({
      ...s,
      groups: [
        ...s.groups.map((g) =>
          groupsToNest.some((ng) => ng.id === g.id)
            ? { ...g, parentGroupId: groupId }
            : g,
        ),
        newGroup,
      ],
      assets: s.assets.map((a) =>
        looseBrickIds.includes(a.id) ? { ...a, groupId } : a,
      ),
    }));
  }

  function ungroupAssets(groupId: string) {
    pushUndo();
    const group = groups.find((g) => g.id === groupId);
    const parentId = group?.parentGroupId;
    updateActiveScene((s) => ({
      ...s,
      assets: s.assets.map((a) =>
        a.groupId === groupId ? { ...a, groupId: parentId } : a,
      ),
      groups: s.groups
        .filter((g) => g.id !== groupId)
        .map((g) =>
          g.parentGroupId === groupId ? { ...g, parentGroupId: parentId } : g,
        ),
    }));
  }

  function updateGroup(groupId: string, name: string) {
    updateActiveScene((s) => ({
      ...s,
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
    }));
  }

  function moveAssetToGroup(
    assetId: string,
    targetGroupId: string | undefined,
  ) {
    pushUndo();
    updateActiveScene((s) => ({
      ...s,
      assets: s.assets.map((a) =>
        a.id === assetId ? { ...a, groupId: targetGroupId } : a,
      ),
    }));
  }

  function revertGroupToStep(groupId: string, k: number) {
    pushUndo();
    updateActiveScene((s) => {
      const group = s.groups.find((g) => g.id === groupId);
      if (!group?.generationHistory) return s;

      const memberAssets = s.assets.filter((a) => a.groupId === groupId);
      const keepIds = new Set(memberAssets.slice(0, k + 1).map((a) => a.id));
      const selectedIds = memberAssets
        .filter((a) => keepIds.has(a.id))
        .map((a) => a.id);

      return {
        ...s,
        assets: s.assets.filter(
          (a) => a.groupId !== groupId || keepIds.has(a.id),
        ),
        groups: s.groups.map((g) =>
          g.id === groupId
            ? { ...g, generationHistory: g.generationHistory!.slice(0, k + 1) }
            : g,
        ),
        selectedAssetId: selectedIds[selectedIds.length - 1] ?? null,
        selectedAssetIds: selectedIds,
      };
    });
  }

  function replaceGroupGeneration(
    groupId: string,
    newAssets: SceneAsset[],
    newHistory: GenerationHistoryEntry[],
    newOffset?: GenerationOffset,
  ) {
    pushUndo();
    updateActiveScene((s) => {
      const otherAssets = s.assets.filter((a) => a.groupId !== groupId);
      const taggedAssets = newAssets.map((a) => ({ ...a, groupId }));
      const selectedIds = taggedAssets.map((a) => a.id);

      return {
        ...s,
        assets: [...otherAssets, ...taggedAssets],
        groups: s.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                category: g.category ?? inferGroupCategory(newAssets),
                generationHistory: newHistory,
                ...(newOffset ? { generationOffset: newOffset } : {}),
              }
            : g,
        ),
        selectedAssetId: selectedIds[selectedIds.length - 1] ?? null,
        selectedAssetIds: selectedIds,
      };
    });
  }

  function selectGroup(groupId: string) {
    const ids = collectGroupMemberIds(groupId, assets, groups);
    updateActiveScene((s) => ({
      ...s,
      selectedAssetIds: ids,
      selectedAssetId: ids[ids.length - 1] ?? null,
    }));
  }

  function toggleGroupSelection(groupId: string) {
    updateActiveScene((s) => {
      const groupIds = collectGroupMemberIds(groupId, s.assets, s.groups);
      if (groupIds.length === 0) return s;

      const selectedSet = new Set(s.selectedAssetIds);
      const isFullySelected = groupIds.every((id) => selectedSet.has(id));

      if (isFullySelected) {
        const groupIdSet = new Set(groupIds);
        const next = s.selectedAssetIds.filter((id) => !groupIdSet.has(id));
        return {
          ...s,
          selectedAssetIds: next,
          selectedAssetId: next.includes(s.selectedAssetId ?? "")
            ? s.selectedAssetId
            : (next[next.length - 1] ?? null),
        };
      }

      const next = [...s.selectedAssetIds];
      groupIds.forEach((id) => {
        if (!selectedSet.has(id)) next.push(id);
      });
      return {
        ...s,
        selectedAssetIds: next,
        selectedAssetId: groupIds[groupIds.length - 1] ?? s.selectedAssetId,
      };
    });
  }

  function updateAsset(id: string, updates: Partial<SceneAsset>) {
    updateActiveScene((s) => {
      const updatedAssets = s.assets.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      );
      if (updates.selectable === false) {
        // Remove from scene highlight/gizmo
        return {
          ...s,
          assets: updatedAssets,
          selectedAssetIds: s.selectedAssetIds.filter((x) => x !== id),
        };
      }
      if (
        updates.selectable === true &&
        s.selectedAssetId === id &&
        !s.selectedAssetIds.includes(id)
      ) {
        // Restore highlight when selectable is turned back on for the focused asset
        return {
          ...s,
          assets: updatedAssets,
          selectedAssetIds: [id],
        };
      }
      return { ...s, assets: updatedAssets };
    });
  }

  function decomposeBrick(id: string) {
    pushUndo();
    updateActiveScene((s) => {
      const brick = s.assets.find((a) => a.id === id);
      if (!brick?.preset) return s;
      const { studsX, studsY } = brick.preset;
      if (studsX === 1 && studsY === 1) return s;
      const [bx, by, bz] = brick.position ?? [0, 0, 0];
      const subBricks: SceneAsset[] = [];
      const ts = Date.now();
      for (let ix = 0; ix < studsX; ix++) {
        for (let iy = 0; iy < studsY; iy++) {
          subBricks.push({
            id: `${id}-d${ix}-${iy}-${ts}`,
            name: `${brick.name} (1×1)`,
            type: "preset-brick",
            visible: true,
            selectable: true,
            category: brick.category,
            modelPath: brick.modelPath,
            position: [bx + ix, by - iy, bz],
            materialColor: brick.materialColor,
            materialRoughness: brick.materialRoughness,
            materialMetalness: brick.materialMetalness,
            preset: { studsX: 1, studsY: 1 },
          });
        }
      }
      return {
        ...s,
        assets: [...s.assets.filter((a) => a.id !== id), ...subBricks],
        selectedAssetId: null,
        selectedAssetIds: [],
      };
    });
  }

  function rotateSelectedAssets(direction: "cw" | "ccw") {
    const ids = selectedAssetIds;
    if (ids.length === 0) return;
    pushUndo();

    const selected = assets.filter(
      (a) => ids.includes(a.id) && a.preset && a.position,
    );
    if (selected.length === 0) return;

    // Bounding box in world coords.
    // position[0] = X (right), position[1] = Y (top-row anchor).
    // Each brick occupies [px, px+studsX) in X and [py-studsY+1, py] in Y.
    const minX = Math.min(...selected.map((a) => a.position![0]));
    const maxX = Math.max(
      ...selected.map((a) => a.position![0] + a.preset!.studsX),
    );
    const minY = Math.min(
      ...selected.map((a) => a.position![1] - a.preset!.studsY + 1),
    );
    const maxY = Math.max(...selected.map((a) => a.position![1]));

    const groupW = maxX - minX;
    const groupH = maxY - minY + 1;

    const cx = groupW / 2;
    const cy = groupH / 2;

    updateActiveScene((s) => {
      const mapped = s.assets.map((a) => {
        if (!ids.includes(a.id) || !a.preset || !a.position) return a;
        const [px, py, pz] = a.position;
        const { studsX, studsY } = a.preset;

        const rx = px - minX;
        const ry = maxY - py;

        // Brick center in grid space.
        const bcx = rx + studsX / 2;
        const bcy = ry + studsY / 2;

        // Rotate brick center around bounding-box center (cx, cy).
        // Grid space has Y going down, so visual CW (from +Z) is:
        //   CW:  (cx - (y-cy), cy + (x-cx))
        //   CCW: (cx + (y-cy), cy - (x-cx))
        const rotCx = direction === "cw" ? cx - (bcy - cy) : cx + (bcy - cy);
        const rotCy = direction === "cw" ? cy + (bcx - cx) : cy - (bcx - cx);

        // New top-left in grid space (studs swap after 90° rotation).
        const newRx = rotCx - studsY / 2;
        const newRy = rotCy - studsX / 2;

        return {
          ...a,
          position: [minX + newRx, maxY - newRy, pz] as [
            number,
            number,
            number,
          ],
          preset: { studsX: studsY, studsY: studsX },
        };
      });

      // When groupW and groupH have different parities, center rotation
      // produces half-integer positions. Round to keep positions on-grid.
      const sample = mapped.find((a) => ids.includes(a.id) && a.position);
      if (sample) {
        const fracX = sample.position![0] - Math.round(sample.position![0]);
        const fracY = sample.position![1] - Math.round(sample.position![1]);
        if (fracX !== 0 || fracY !== 0) {
          return {
            ...s,
            assets: mapped.map((a) => {
              if (!ids.includes(a.id) || !a.position) return a;
              return {
                ...a,
                position: [
                  Math.round(a.position[0]),
                  Math.round(a.position[1]),
                  a.position[2],
                ] as [number, number, number],
              };
            }),
          };
        }
      }

      return { ...s, assets: mapped };
    });
  }

  function selectAsset(id: string | null) {
    updateActiveScene((s) => ({
      ...s,
      selectedAssetId: id,
      selectedAssetIds: id ? [id] : [],
    }));
  }

  function selectAssets(ids: string[]) {
    updateActiveScene((s) => ({
      ...s,
      selectedAssetId: ids[ids.length - 1] ?? null,
      selectedAssetIds: ids,
    }));
  }

  // Show an asset's properties without highlighting it or showing the gizmo.
  // Used for non-selectable assets clicked from the Assets Panel.
  function peekAsset(id: string) {
    updateActiveScene((s) => ({
      ...s,
      selectedAssetId: id,
      selectedAssetIds: [],
    }));
  }

  function toggleAssetSelection(id: string) {
    updateActiveScene((s) => {
      const isAlreadySelected = s.selectedAssetIds.includes(id);
      if (isAlreadySelected) {
        const next = s.selectedAssetIds.filter((x) => x !== id);
        return {
          ...s,
          selectedAssetIds: next,
          selectedAssetId:
            s.selectedAssetId === id
              ? (next[next.length - 1] ?? null)
              : s.selectedAssetId,
        };
      } else {
        return {
          ...s,
          selectedAssetIds: [...s.selectedAssetIds, id],
          selectedAssetId: id,
        };
      }
    });
  }

  return (
    <SceneContext.Provider
      value={{
        scenes,
        activeSceneId,
        addScene,
        removeScene,
        renameScene,
        setActiveScene,
        assets,
        addAsset,
        addAssetsAsGroup,
        removeAsset,
        removeSelectedAssets,
        removeGroup,
        updateAsset,
        decomposeBrick,
        groups,
        groupSelected,
        ungroupAssets,
        updateGroup,
        moveAssetToGroup,
        revertGroupToStep,
        replaceGroupGeneration,
        pasteAssets,
        undo,
        captureUndoSnapshot,
        selectedAssetId,
        selectedAssetIds,
        selectAsset,
        selectAssets,
        peekAsset,
        selectGroup,
        toggleGroupSelection,
        toggleAssetSelection,
        rotateSelectedAssets,
        sceneBackground,
        setSceneBackground: (color: string) =>
          updateActiveScene((s) => ({ ...s, sceneBackground: color })),
        plateSize,
        setPlateSize: updatePlateSize,
        plateColor,
        setPlateColor: (color: string) =>
          updateActiveScene((s) => ({ ...s, plateColor: color })),
        maxCameraDistance,
        setMaxCameraDistance: (d: number) =>
          updateActiveScene((s) => ({ ...s, maxCameraDistance: d })),
        constraints,
        addConstraint,
        updateConstraint,
        removeConstraint,
        customBricks,
        addCustomBrick,
        removeCustomBrick,
        defaultBrickColor,
        setDefaultBrickColor,
        selectionColor,
        setSelectionColor,
        viewportType,
        setViewportType,
      }}
    >
      {children}
    </SceneContext.Provider>
  );
}

export function useScene() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used within SceneProvider");
  return ctx;
}

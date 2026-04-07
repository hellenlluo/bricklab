"use client";

import React, { createContext, useContext, useState } from "react";

export interface SceneAsset {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
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

export interface BrickGroup {
  id: string;
  name: string;
  parentGroupId?: string;
}

export interface CustomBrickDefinition {
  id: string;
  name: string;
  studsX: number;
  studsY: number;
}

interface SceneStore {
  assets: SceneAsset[];
  addAsset: (asset: SceneAsset) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  decomposeBrick: (id: string) => void;
  groups: BrickGroup[];
  groupSelected: () => void;
  ungroupAssets: (groupId: string) => void;
  updateGroup: (groupId: string, name: string) => void;
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  selectAsset: (id: string | null) => void;
  selectGroup: (groupId: string) => void;
  toggleAssetSelection: (id: string) => void;
  sceneBackground: string;
  setSceneBackground: (color: string) => void;
  plateSize: number;
  setPlateSize: (size: number) => void;
  plateColor: string;
  setPlateColor: (color: string) => void;
  maxCameraDistance: number;
  setMaxCameraDistance: (d: number) => void;
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
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [groups, setGroups] = useState<BrickGroup[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [sceneBackground, setSceneBackground] = useState<string>("#232323");
  const [plateSize, setPlateSize] = useState<number>(50);
  const [plateColor, setPlateColor] = useState<string>("#ebebeb");
  const [maxCameraDistance, setMaxCameraDistance] = useState<number>(100);
  const [customBricks, setCustomBricks] = useState<CustomBrickDefinition[]>([]);
  const [defaultBrickColor, setDefaultBrickColor] = useState<string>("#bfbfff");
  const [selectionColor, setSelectionColor] = useState<string>("#ff8c82");
  const [viewportType, setViewportType] = useState<string>("Perspective");

  function updatePlateSize(size: number) {
    setPlateSize(size);
    setMaxCameraDistance(Math.max(size, 50) * 2);
  }

  function addCustomBrick(brick: CustomBrickDefinition) {
    setCustomBricks((prev) => [...prev, brick]);
  }

  function removeCustomBrick(id: string) {
    setCustomBricks((prev) => prev.filter((b) => b.id !== id));
  }

  function addAsset(asset: SceneAsset) {
    setAssets((prev) => [...prev, asset]);
  }

  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelectedAssetId((prev) => (prev === id ? null : prev));
    setSelectedAssetIds((prev) => prev.filter((x) => x !== id));
  }

  function groupSelected() {
    if (selectedAssetIds.length < 2) return;
    const ids = selectedAssetIds;

    // Recursively collect all asset IDs in a group (direct + through child groups)
    function collectAllAssetIds(gId: string): string[] {
      const direct = assets.filter((a) => a.groupId === gId).map((a) => a.id);
      const childIds = groups.filter((g) => g.parentGroupId === gId).flatMap((g) => collectAllAssetIds(g.id));
      return [...direct, ...childIds];
    }

    // Does every asset in this group (recursively) appear in ids?
    function isFullyInSelection(gId: string): boolean {
      const directs = assets.filter((a) => a.groupId === gId);
      const children = groups.filter((g) => g.parentGroupId === gId);
      if (directs.length === 0 && children.length === 0) return false;
      return (
        directs.every((a) => ids.includes(a.id)) &&
        children.every((g) => isFullyInSelection(g.id))
      );
    }

    // Top-level groups whose entire membership is selected → nest them
    const groupsToNest = groups.filter(
      (g) => !g.parentGroupId && isFullyInSelection(g.id),
    );

    // Bricks not already covered by a group being nested → direct children of new group
    const nestedMemberIds = new Set(
      groupsToNest.flatMap((g) => collectAllAssetIds(g.id)),
    );
    const looseBrickIds = ids.filter((id) => !nestedMemberIds.has(id));

    if (groupsToNest.length + looseBrickIds.length < 2) return;

    const groupId = `group-${Date.now()}`;
    const newGroup: BrickGroup = { id: groupId, name: `Group ${groups.length + 1}` };

    setGroups((prev) => [
      ...prev.map((g) =>
        groupsToNest.some((ng) => ng.id === g.id)
          ? { ...g, parentGroupId: groupId }
          : g,
      ),
      newGroup,
    ]);
    setAssets((prev) =>
      prev.map((a) => (looseBrickIds.includes(a.id) ? { ...a, groupId } : a)),
    );
  }

  function ungroupAssets(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    const parentId = group?.parentGroupId;
    // Promote direct brick members up to the parent (or root)
    setAssets((prev) =>
      prev.map((a) => (a.groupId === groupId ? { ...a, groupId: parentId } : a)),
    );
    // Promote child groups up to the parent (or root) and remove the target group
    setGroups((prev) =>
      prev
        .filter((g) => g.id !== groupId)
        .map((g) =>
          g.parentGroupId === groupId ? { ...g, parentGroupId: parentId } : g,
        ),
    );
  }

  function updateGroup(groupId: string, name: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
  }

  function selectGroup(groupId: string) {
    function collectIds(gId: string): string[] {
      const direct = assets.filter((a) => a.groupId === gId).map((a) => a.id);
      const childIds = groups
        .filter((g) => g.parentGroupId === gId)
        .flatMap((g) => collectIds(g.id));
      return [...direct, ...childIds];
    }
    const ids = collectIds(groupId);
    setSelectedAssetIds(ids);
    setSelectedAssetId(ids[ids.length - 1] ?? null);
  }

  function updateAsset(id: string, updates: Partial<SceneAsset>) {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  }

  function decomposeBrick(id: string) {
    setAssets((prev) => {
      const brick = prev.find((a) => a.id === id);
      if (!brick?.preset) return prev;
      const { studsX, studsY } = brick.preset;
      if (studsX === 1 && studsY === 1) return prev;
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
            modelPath: brick.modelPath,
            position: [bx + ix, by - iy, bz],
            materialColor: brick.materialColor,
            materialRoughness: brick.materialRoughness,
            materialMetalness: brick.materialMetalness,
            preset: { studsX: 1, studsY: 1 },
          });
        }
      }
      return [...prev.filter((a) => a.id !== id), ...subBricks];
    });
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
  }

  function selectAsset(id: string | null) {
    setSelectedAssetId(id);
    setSelectedAssetIds(id ? [id] : []);
  }

  function toggleAssetSelection(id: string) {
    const isAlreadySelected = selectedAssetIds.includes(id);
    if (isAlreadySelected) {
      const next = selectedAssetIds.filter((x) => x !== id);
      setSelectedAssetIds(next);
      if (selectedAssetId === id) {
        setSelectedAssetId(next[next.length - 1] ?? null);
      }
    } else {
      setSelectedAssetIds((prev) => [...prev, id]);
      setSelectedAssetId(id);
    }
  }

  return (
    <SceneContext.Provider
      value={{
        assets,
        addAsset,
        removeAsset,
        updateAsset,
        decomposeBrick,
        groups,
        groupSelected,
        ungroupAssets,
        updateGroup,
        selectedAssetId,
        selectedAssetIds,
        selectAsset,
        selectGroup,
        toggleAssetSelection,
        sceneBackground,
        setSceneBackground,
        plateSize,
        setPlateSize: updatePlateSize,
        plateColor,
        setPlateColor,
        maxCameraDistance,
        setMaxCameraDistance,
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

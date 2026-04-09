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

function createDefaultScene(id: string, name: string): SceneData {
  return {
    id,
    name,
    assets: [],
    groups: [],
    selectedAssetId: null,
    selectedAssetIds: [],
    sceneBackground: "#232323",
    plateSize: 50,
    plateColor: "#ebebeb",
    maxCameraDistance: 100,
  };
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
  const [customBricks, setCustomBricks] = useState<CustomBrickDefinition[]>([]);
  const [defaultBrickColor, setDefaultBrickColor] = useState<string>("#bfbfff");
  const [selectionColor, setSelectionColor] = useState<string>("#ff8c82");
  const [viewportType, setViewportType] = useState<string>("Perspective");

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

  // ── Global settings ────────────────────────────────────────────────────────

  function addCustomBrick(brick: CustomBrickDefinition) {
    setCustomBricks((prev) => [...prev, brick]);
  }

  function removeCustomBrick(id: string) {
    setCustomBricks((prev) => prev.filter((b) => b.id !== id));
  }

  // ── Per-scene helpers ──────────────────────────────────────────────────────

  function updatePlateSize(size: number) {
    updateActiveScene((s) => ({
      ...s,
      plateSize: size,
      maxCameraDistance: Math.max(size, 50) * 2,
    }));
  }

  function addAsset(asset: SceneAsset) {
    updateActiveScene((s) => ({ ...s, assets: [...s.assets, asset] }));
  }

  function removeAsset(id: string) {
    updateActiveScene((s) => ({
      ...s,
      assets: s.assets.filter((a) => a.id !== id),
      selectedAssetId: s.selectedAssetId === id ? null : s.selectedAssetId,
      selectedAssetIds: s.selectedAssetIds.filter((x) => x !== id),
    }));
  }

  function groupSelected() {
    if (selectedAssetIds.length < 2) return;
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

  function selectGroup(groupId: string) {
    function collectIds(gId: string): string[] {
      const direct = assets.filter((a) => a.groupId === gId).map((a) => a.id);
      const childIds = groups
        .filter((g) => g.parentGroupId === gId)
        .flatMap((g) => collectIds(g.id));
      return [...direct, ...childIds];
    }
    const ids = collectIds(groupId);
    updateActiveScene((s) => ({
      ...s,
      selectedAssetIds: ids,
      selectedAssetId: ids[ids.length - 1] ?? null,
    }));
  }

  function updateAsset(id: string, updates: Partial<SceneAsset>) {
    updateActiveScene((s) => ({
      ...s,
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  }

  function decomposeBrick(id: string) {
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

  function selectAsset(id: string | null) {
    updateActiveScene((s) => ({
      ...s,
      selectedAssetId: id,
      selectedAssetIds: id ? [id] : [],
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

"use client";

import React, { createContext, useContext, useState } from "react";

export interface SceneAsset {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
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
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  selectAsset: (id: string | null) => void;
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
  selectionHighlightColor: string;
  setSelectionHighlightColor: (color: string) => void;
  viewportType: string;
  setViewportType: (v: string) => void;
}

const SceneContext = createContext<SceneStore | null>(null);

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [sceneBackground, setSceneBackground] = useState<string>("#232323");
  const [plateSize, setPlateSize] = useState<number>(50);
  const [plateColor, setPlateColor] = useState<string>("#ebebeb");
  const [maxCameraDistance, setMaxCameraDistance] = useState<number>(100);
  const [customBricks, setCustomBricks] = useState<CustomBrickDefinition[]>([]);
  const [selectionHighlightColor, setSelectionHighlightColor] = useState<string>("#ff8c82");
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
        selectedAssetId,
        selectedAssetIds,
        selectAsset,
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
        selectionHighlightColor,
        setSelectionHighlightColor,
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

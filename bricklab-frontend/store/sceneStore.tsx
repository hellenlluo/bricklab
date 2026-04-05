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
  selectAsset: (id: string | null) => void;
  sceneBackground: string;
  setSceneBackground: (color: string) => void;
  plateSize: number;
  setPlateSize: (size: number) => void;
  plateColor: string;
  setPlateColor: (color: string) => void;
  customBricks: CustomBrickDefinition[];
  addCustomBrick: (brick: CustomBrickDefinition) => void;
  removeCustomBrick: (id: string) => void;
}

const SceneContext = createContext<SceneStore | null>(null);

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [sceneBackground, setSceneBackground] = useState<string>("#232323");
  const [plateSize, setPlateSize] = useState<number>(50);
  const [plateColor, setPlateColor] = useState<string>("#ebebeb");
  const [customBricks, setCustomBricks] = useState<CustomBrickDefinition[]>([]);

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
            position: [bx + ix, by + iy, bz],
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
  }

  function selectAsset(id: string | null) {
    setSelectedAssetId(id);
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
        selectAsset,
        sceneBackground,
        setSceneBackground,
        plateSize,
        setPlateSize,
        plateColor,
        setPlateColor,
        customBricks,
        addCustomBrick,
        removeCustomBrick,
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

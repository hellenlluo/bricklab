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
}

interface SceneStore {
  assets: SceneAsset[];
  addAsset: (asset: SceneAsset) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  selectedAssetId: string | null;
  selectAsset: (id: string | null) => void;
  sceneBackground: string;
  setSceneBackground: (color: string) => void;
  plateSize: number;
  setPlateSize: (size: number) => void;
  plateColor: string;
  setPlateColor: (color: string) => void;
}

const SceneContext = createContext<SceneStore | null>(null);

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [sceneBackground, setSceneBackground] = useState<string>("#232323");
  const [plateSize, setPlateSize] = useState<number>(50);
  const [plateColor, setPlateColor] = useState<string>("#ebebeb");

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
        selectedAssetId,
        selectAsset,
        sceneBackground,
        setSceneBackground,
        plateSize,
        setPlateSize,
        plateColor,
        setPlateColor,
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

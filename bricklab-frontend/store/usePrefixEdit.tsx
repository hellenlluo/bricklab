"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useScene } from "@/store/sceneStore";
import type { GenerationHistoryEntry, SceneAsset } from "@/store/sceneStore";
import type { PrefixEditPhase, GenerationOffset, BackendBrick } from "@/lib/prefixEditing";
import {
  normalizeEditableBricks,
  derivePrefixOrder,
  backendBricksToScene,
  computeGenerationOffset,
} from "@/lib/prefixEditing";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PrefixEditValue {
  phase: PrefixEditPhase;
  groupId: string | null;
  revertedStepIndex: number;
  errorMessage: string | null;
  startPrefixEdit: (groupId: string, stepK: number) => void;
  cancelEdit: () => void;
  regenerateFromPrefix: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface PrefixEditState {
  phase: PrefixEditPhase;
  groupId: string | null;
  revertedStepIndex: number;
  originalHistory: GenerationHistoryEntry[];
  originalAssets: SceneAsset[];
  originalPrompt: string;
  generationOffset: GenerationOffset;
  errorMessage: string | null;
}

const INITIAL_STATE: PrefixEditState = {
  phase: "idle",
  groupId: null,
  revertedStepIndex: -1,
  originalHistory: [],
  originalAssets: [],
  originalPrompt: "",
  generationOffset: { minX: 0, minNegY: 0, minZ: 0 },
  errorMessage: null,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PrefixEditContext = createContext<PrefixEditValue | null>(null);

export function PrefixEditProvider({ children }: { children: React.ReactNode }) {
  const {
    assets,
    groups,
    revertGroupToStep,
    replaceGroupGeneration,
    defaultBrickColor,
    constraints,
  } = useScene();

  const [state, setState] = useState<PrefixEditState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const startPrefixEdit = useCallback(
    (groupId: string, stepK: number) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group?.generationHistory || !group.originalPrompt || !group.generationOffset) {
        return;
      }

      const savedHistory = group.generationHistory.map((e) => ({ ...e }));
      const savedAssets = assets
        .filter((a) => a.groupId === groupId)
        .map((a) => ({ ...a }));

      setState({
        phase: "editing_prefix",
        groupId,
        revertedStepIndex: stepK,
        originalHistory: savedHistory,
        originalAssets: savedAssets,
        originalPrompt: group.originalPrompt,
        generationOffset: { ...group.generationOffset },
        errorMessage: null,
      });

      revertGroupToStep(groupId, stepK);
    },
    [groups, assets, revertGroupToStep],
  );

  const cancelEdit = useCallback(() => {
    if (state.phase !== "editing_prefix" || !state.groupId) {
      setState(INITIAL_STATE);
      return;
    }

    replaceGroupGeneration(
      state.groupId,
      state.originalAssets,
      state.originalHistory,
      state.generationOffset,
    );
    setState(INITIAL_STATE);
  }, [state, replaceGroupGeneration]);

  const regenerateFromPrefix = useCallback(async () => {
    if (state.phase !== "editing_prefix" || !state.groupId) return;

    const groupAssets = assets.filter((a) => a.groupId === state.groupId);
    const { valid, invalid } = normalizeEditableBricks(groupAssets);

    if (valid.length === 0) {
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: "No valid bricks to use as prefix.",
      }));
      return;
    }
    if (invalid.length > 0) {
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: `${invalid.length} brick(s) have invalid dimensions and were excluded.`,
      }));
      return;
    }

    const orderedBricks = derivePrefixOrder(
      state.originalAssets,
      valid,
      state.generationOffset,
    );

    setState((s) => ({ ...s, phase: "regenerating", errorMessage: null }));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const constraintPayload = constraints.flatMap((c) =>
      c.boxes.map((box) => ({
        pos_x: box.posX,
        pos_y: box.posY,
        pos_z: box.posZ,
        size_x: box.sizeX,
        size_y: box.sizeY,
        size_z: box.sizeZ,
      })),
    );

    try {
      const res = await fetch(`${API_URL}/generate/regenerate-from-prefix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: state.originalPrompt,
          prefix_bricks: orderedBricks,
          constraints: constraintPayload,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Server error ${res.status}`);
      }

      const data: {
        bricks: BackendBrick[];
        total_bricks: number;
        prefix_count: number;
        partial: boolean;
        warning: string | null;
      } = await res.json();

      const newOffset = computeGenerationOffset(data.bricks);
      const { assets: newSceneAssets, history: newHistory } = backendBricksToScene(
        data.bricks,
        {
          defaultColor: defaultBrickColor,
          category: "text-to-3d",
          idPrefix: "regen",
          startingIndex: 0,
        },
      );

      replaceGroupGeneration(state.groupId!, newSceneAssets, newHistory, newOffset);

      setState(INITIAL_STATE);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: e instanceof Error ? e.message : "Regeneration failed",
      }));
    }
  }, [
    state,
    assets,
    constraints,
    defaultBrickColor,
    replaceGroupGeneration,
  ]);

  const value: PrefixEditValue = {
    phase: state.phase,
    groupId: state.groupId,
    revertedStepIndex: state.revertedStepIndex,
    errorMessage: state.errorMessage,
    startPrefixEdit,
    cancelEdit,
    regenerateFromPrefix,
  };

  return (
    <PrefixEditContext.Provider value={value}>
      {children}
    </PrefixEditContext.Provider>
  );
}

export function usePrefixEdit(): PrefixEditValue {
  const ctx = useContext(PrefixEditContext);
  if (!ctx) throw new Error("usePrefixEdit must be used within PrefixEditProvider");
  return ctx;
}

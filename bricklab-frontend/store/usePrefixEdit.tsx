"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useScene } from "@/store/sceneStore";
import type { GenerationHistoryEntry, SceneAsset, ConstraintBox } from "@/store/sceneStore";
import type {
  PrefixEditPhase,
  GenerationOffset,
  BackendBrick,
} from "@/lib/prefixEditing";
import {
  normalizeEditableBricks,
  derivePrefixOrder,
  backendBricksToScene,
  computeGenerationOffset,
} from "@/lib/prefixEditing";
import { regenerateTextBricksFromPrefix } from "@/lib/text3dApi";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PrefixEditValue {
  phase: PrefixEditPhase;
  groupId: string | null;
  revertedStepIndex: number;
  errorMessage: string | null;
  generationOffset: GenerationOffset | null;
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
  originalConstraints: ConstraintBox[];
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
  originalConstraints: [],
  errorMessage: null,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PrefixEditContext = createContext<PrefixEditValue | null>(null);

export function PrefixEditProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    assets,
    groups,
    revertGroupToStep,
    replaceGroupGeneration,
    defaultBrickColor,
  } = useScene();

  const [state, setState] = useState<PrefixEditState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const startPrefixEdit = useCallback(
    (groupId: string, stepK: number) => {
      const group = groups.find((g) => g.id === groupId);
      if (
        !group?.generationHistory ||
        !group.originalPrompt ||
        !group.generationOffset
      ) {
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
        originalConstraints: group.originalConstraints
          ? group.originalConstraints.map((b) => ({ ...b }))
          : [],
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

    const constraintPayload = state.originalConstraints.map((box) => ({
      pos_x: box.posX,
      pos_y: box.posY,
      pos_z: box.posZ,
      size_x: box.sizeX,
      size_y: box.sizeY,
      size_z: box.sizeZ,
    }));

    try {
      const data = await regenerateTextBricksFromPrefix(
        state.originalPrompt,
        orderedBricks,
        constraintPayload,
        controller.signal,
      );

      const newOffset = computeGenerationOffset(data.bricks);
      const { assets: newSceneAssets, history: newHistory } =
        backendBricksToScene(data.bricks, {
          defaultColor: defaultBrickColor,
          category: "text-to-3d",
          idPrefix: "regen",
          startingIndex: 0,
        });

      replaceGroupGeneration(
        state.groupId!,
        newSceneAssets,
        newHistory,
        newOffset,
      );

      setState(INITIAL_STATE);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: e instanceof Error ? e.message : "Regeneration failed",
      }));
    }
  }, [state, assets, defaultBrickColor, replaceGroupGeneration]);

  const value: PrefixEditValue = {
    phase: state.phase,
    groupId: state.groupId,
    revertedStepIndex: state.revertedStepIndex,
    errorMessage: state.errorMessage,
    generationOffset: state.phase !== "idle" ? state.generationOffset : null,
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
  if (!ctx)
    throw new Error("usePrefixEdit must be used within PrefixEditProvider");
  return ctx;
}

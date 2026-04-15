"use client";

import { useState } from "react";
import { useScene, type AssetCategory, type BrickGroup, type SceneAsset } from "@/store/sceneStore";
import { usePrefixEdit } from "@/store/usePrefixEdit";
import Texture from "./Texture";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import GenerationReplay from "@/components/GenerationReplay";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function TextValue({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onChange(draft.trim() || value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full"
    />
  );
}

function getCategoryLabel(category: AssetCategory | undefined, fallback: string) {
  if (category === "text-to-3d") return "Text-to-3d";
  if (category === "image-to-3d") return "Image-to-3d";
  return fallback;
}

function isPrefixEditBlocking(phase: ReturnType<typeof usePrefixEdit>["phase"]) {
  return phase === "editing_prefix" || phase === "regenerating";
}

function isGroupUnmoved(group: BrickGroup, members: SceneAsset[]): boolean {
  if (!group.generationHistory || !group.generationOffset) return false;
  const history = group.generationHistory;
  for (const asset of members) {
    if (!asset.position || !asset.preset) return false;
    const match = history.some(
      (h) =>
        h.x === asset.position![0] &&
        h.y === asset.position![1] &&
        h.z === asset.position![2] &&
        h.studsX === asset.preset!.studsX &&
        h.studsY === asset.preset!.studsY,
    );
    if (!match) return false;
  }
  return true;
}

function NumberValue({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <Input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseFloat(draft);
        if (!isNaN(n)) onChange(Math.round(n));
        else setDraft(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full"
    />
  );
}

function collectGroupAssetIds(
  groupId: string,
  assets: { id: string; groupId?: string }[],
  groups: { id: string; parentGroupId?: string }[],
): string[] {
  const direct = assets.filter((a) => a.groupId === groupId).map((a) => a.id);
  const childIds = groups
    .filter((g) => g.parentGroupId === groupId)
    .flatMap((g) => collectGroupAssetIds(g.id, assets, groups));
  return [...direct, ...childIds];
}

export default function PropertiesPanel() {
  const {
    assets,
    selectedAssetId,
    selectedAssetIds,
    updateAsset,
    removeAsset,
    removeSelectedAssets,
    removeGroup,
    decomposeBrick,
    rotateSelectedAssets,
    groups,
    updateGroup,
    selectAsset,
  } = useScene();

  const prefixEdit = usePrefixEdit();

  const asset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const [replayOpen, setReplayOpen] = useState(false);

  const selectedGroup: BrickGroup | null = (() => {
    if (selectedAssetIds.length < 2) return null;
    const selSet = new Set(selectedAssetIds);
    for (const group of groups) {
      const memberIds = collectGroupAssetIds(group.id, assets, groups);
      if (
        memberIds.length === selSet.size &&
        memberIds.every((id) => selSet.has(id))
      ) {
        return group;
      }
    }
    return null;
  })();

  // True when 2+ bricks are selected but they don't form a complete named group
  const isMultiUngrouped = selectedAssetIds.length > 1 && !selectedGroup;
  const multiAssets = isMultiUngrouped
    ? assets.filter((a) => selectedAssetIds.includes(a.id))
    : [];

  const groupAssets = selectedGroup
    ? assets.filter((a) => selectedAssetIds.includes(a.id))
    : [];

  const colorKey = selectedGroup
    ? `group-${selectedGroup.id}`
    : isMultiUngrouped
      ? `multi-${[...selectedAssetIds].sort().join(",")}`
      : (asset?.id ?? null);
  const referenceColor = selectedGroup
    ? (groupAssets[0]?.materialColor ?? "#bfbfff")
    : isMultiUngrouped
      ? (multiAssets[0]?.materialColor ?? "#bfbfff")
      : (asset?.materialColor ?? "#bfbfff");

  const [colorDraftKey, setColorDraftKey] = useState<string | null>(colorKey);
  const [colorDraft, setColorDraft] = useState(referenceColor);
  if (colorDraftKey !== colorKey) {
    setColorDraftKey(colorKey);
    setColorDraft(referenceColor);
  }

  // ── Edit-from-here banner (only when the editing group is selected) ──────

  const isEditingThisGroup =
    prefixEdit.phase !== "idle" &&
    prefixEdit.groupId !== null &&
    selectedGroup?.id === prefixEdit.groupId;

  const editBanner = isEditingThisGroup ? (
    prefixEdit.phase === "regenerating" ? (
      <div data-no-deselect className="mt-3 px-2.5">
        <div className="w-full py-1 rounded-md text-center text-[10px] font-medium text-[#74a7fe] border border-[#74a7fe] bg-[#74a7fe]/10 animate-pulse transition-colors">
          Regenerating from prefix…
        </div>
      </div>
    ) : (
      <div
        data-no-deselect
        className="mx-2.5 mt-3 min-w-0 p-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30"
      >
        {prefixEdit.phase === "editing_prefix" && (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-left text-[10px] leading-tight font-semibold text-[#74a7fe]">
              Paused at step {prefixEdit.revertedStepIndex + 1}
            </span>
            <div className="grid w-full min-w-0 grid-cols-2 gap-1.5">
              <button
                onClick={prefixEdit.regenerateFromPrefix}
                className="min-w-0 px-2 py-1 rounded text-center text-white text-[10px] transition-colors bg-[#74a7fe] hover:bg-[#5a93f0]"
              >
                Regenerate
              </button>
              <button
                onClick={prefixEdit.cancelEdit}
                className="min-w-0 px-2 py-1 rounded text-center bg-zinc-700 text-white text-[10px] hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {prefixEdit.phase === "error" && (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] leading-tight font-semibold text-red-800 dark:text-red-300">
              Regeneration failed
            </span>
            <span className="text-[10px] leading-tight text-red-700 dark:text-red-400 break-words">
              {prefixEdit.errorMessage}
            </span>
            <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 pt-0.5">
              <button
                onClick={prefixEdit.regenerateFromPrefix}
                className="min-w-0 px-2 py-1 rounded text-center text-white text-[10px] transition-colors bg-[#74a7fe] hover:bg-[#5a93f0]"
              >
                Retry
              </button>
              <button
                onClick={prefixEdit.cancelEdit}
                className="min-w-0 px-2 py-1 rounded text-center bg-zinc-700 text-white text-[10px] hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  ) : null;

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!asset && !selectedGroup) {
    return (
      <div data-no-deselect>
        <div className="px-2.5 py-3 text-xs text-zinc-400 dark:text-zinc-500 italic">
          Select an asset to view its properties.
        </div>
      </div>
    );
  }

  // ── Group mode ────────────────────────────────────────────────────────────

  if (selectedGroup) {
    const allVisible = groupAssets.every((a) => a.visible);
    const allSelectable = groupAssets.every((a) => a.selectable ?? true);

    const groupMinPos = groupAssets.reduce(
      (min, a) => {
        const p = a.position ?? [0, 0, 0];
        return [
          Math.min(min[0], p[0]),
          Math.min(min[1], p[1]),
          Math.min(min[2], p[2]),
        ] as [number, number, number];
      },
      [Infinity, Infinity, Infinity] as [number, number, number],
    );

    function updateGroupPosition(axis: number, newVal: number) {
      const delta = newVal - groupMinPos[axis];
      for (const a of groupAssets) {
        const p = a.position ?? [0, 0, 0];
        const next = [...p] as [number, number, number];
        next[axis] = p[axis] + delta;
        updateAsset(a.id, { position: next });
      }
    }

    function updateAllAssets(updates: Record<string, unknown>) {
      for (const a of groupAssets) {
        updateAsset(a.id, updates);
      }
    }

    const refRoughness = groupAssets[0]?.materialRoughness;
    const refMetalness = groupAssets[0]?.materialMetalness;

    const findGeneratedGroup = (g: BrickGroup): BrickGroup | null => {
      if (g.generationHistory && g.generationHistory.length > 0) return g;
      if (g.parentGroupId) {
        const parent = groups.find((gr) => gr.id === g.parentGroupId);
        if (parent) return findGeneratedGroup(parent);
      }
      return null;
    };
    const genGroup = findGeneratedGroup(selectedGroup);
    const groupCategory =
      selectedGroup.category ??
      (() => {
        const categories = new Set(groupAssets.map((asset) => asset.category).filter(Boolean));
        return categories.size === 1
          ? (Array.from(categories)[0] as AssetCategory)
          : undefined;
      })();

    return (
      <div data-no-deselect>
        {editBanner}
        <div className="px-2.5 py-2 flex flex-col gap-3">
        <Field label="Group Name">
          <TextValue
            key={selectedGroup.name}
            value={selectedGroup.name}
            onChange={(v) => updateGroup(selectedGroup.id, v)}
          />
        </Field>

        <Field label="Category">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {getCategoryLabel(groupCategory, "Group")}
          </span>
        </Field>

        {genGroup && (
          <Field label="Generation Process">
            <Button
              onClick={() => setReplayOpen(true)}
              className="w-full"
            >
              Replay
            </Button>
            {replayOpen && (
              <GenerationReplay
                generationHistory={genGroup.generationHistory!}
                groupName={genGroup.name}
                groupId={genGroup.id}
                canPrefixEdit={
                  !!genGroup.originalPrompt &&
                  !!genGroup.generationOffset &&
                  !isPrefixEditBlocking(prefixEdit.phase) &&
                  isGroupUnmoved(genGroup, groupAssets)
                }
                onPrefixEdit={prefixEdit.startPrefixEdit}
                onClose={() => setReplayOpen(false)}
              />
            )}
          </Field>
        )}

        <Field label="Visibility">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisible}
              onChange={(e) => updateAllAssets({ visible: e.target.checked })}
              className="w-3.5 h-3.5 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {allVisible ? "Visible" : "Hidden"}
            </span>
          </label>
        </Field>

        <Field label="Selectability">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelectable}
              onChange={(e) => updateAllAssets({ selectable: e.target.checked })}
              className="w-3.5 h-3.5 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {allSelectable ? "Selectable" : "Not selectable"}
            </span>
          </label>
        </Field>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Position
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <div key={axis} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
                  {axis}
                </span>
                <NumberValue
                  key={groupMinPos[i]}
                  value={groupMinPos[i]}
                  onChange={(v) => updateGroupPosition(i, v)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Rotation
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <Button onClick={() => rotateSelectedAssets("ccw")} className="w-full">
              90° CCW
            </Button>
            <Button onClick={() => rotateSelectedAssets("cw")} className="w-full">
              90° CW
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Color
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorDraft}
              onChange={(e) => {
                setColorDraft(e.target.value);
                updateAllAssets({ materialColor: e.target.value });
              }}
              className="w-7 h-7 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent p-0.5"
            />
            <Input
              type="text"
              value={colorDraft}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                  setColorDraft(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v))
                    updateAllAssets({ materialColor: v });
                }
              }}
              onBlur={() => {
                if (!/^#[0-9a-fA-F]{6}$/.test(colorDraft))
                  setColorDraft(referenceColor);
              }}
              maxLength={7}
              className="w-full font-mono"
            />
          </div>
        </div>

        <Texture
          roughness={refRoughness}
          metalness={refMetalness}
          onRoughnessChange={(v) => updateAllAssets({ materialRoughness: v })}
          onMetalnessChange={(v) => updateAllAssets({ materialMetalness: v })}
        />

        <button
          onClick={() => removeGroup(selectedGroup.id)}
          className="w-full mt-2 py-1 rounded-md text-[10px] font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
        >
          Delete Group
        </button>
        </div>
      </div>
    );
  }

  // ── Multi-select (ungrouped) mode ─────────────────────────────────────────

  if (isMultiUngrouped) {
    const multiMinPos = multiAssets.reduce(
      (min, a) => {
        const p = a.position ?? [0, 0, 0];
        return [
          Math.min(min[0], p[0]),
          Math.min(min[1], p[1]),
          Math.min(min[2], p[2]),
        ] as [number, number, number];
      },
      [Infinity, Infinity, Infinity] as [number, number, number],
    );

    function updateMultiPosition(axis: number, newVal: number) {
      const delta = newVal - multiMinPos[axis];
      for (const a of multiAssets) {
        const p = a.position ?? [0, 0, 0];
        const next = [...p] as [number, number, number];
        next[axis] = p[axis] + delta;
        updateAsset(a.id, { position: next });
      }
    }

    function updateMultiAssets(updates: Record<string, unknown>) {
      for (const a of multiAssets) updateAsset(a.id, updates);
    }

    const colors = multiAssets.map((a) => a.materialColor ?? "#bfbfff");
    const colorIsMixed = !colors.every((c) => c === colors[0]);

    const roughnesses = multiAssets.map((a) => a.materialRoughness ?? 0.88);
    const roughnessIsMixed = !roughnesses.every((r) => r === roughnesses[0]);
    const avgRoughness = roughnesses.reduce((s, r) => s + r, 0) / roughnesses.length;

    const metalnesses = multiAssets.map((a) => a.materialMetalness ?? 0.0);
    const metalnessIsMixed = !metalnesses.every((m) => m === metalnesses[0]);
    const avgMetalness = metalnesses.reduce((s, m) => s + m, 0) / metalnesses.length;

    const allPreset = multiAssets.every((a) => a.type === "preset-brick" && a.preset);

    return (
      <div data-no-deselect>
        <div className="px-2.5 py-2 flex flex-col gap-3">

          <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {multiAssets.length} Selected
          </span>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Position</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <div key={axis} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">{axis}</span>
                  <NumberValue
                    key={multiMinPos[i]}
                    value={multiMinPos[i]}
                    onChange={(v) => updateMultiPosition(i, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          {allPreset && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Rotation</span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button onClick={() => rotateSelectedAssets("ccw")} className="w-full">90° CCW</Button>
                <Button onClick={() => rotateSelectedAssets("cw")} className="w-full">90° CW</Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorDraft}
                onChange={(e) => {
                  setColorDraft(e.target.value);
                  updateMultiAssets({ materialColor: e.target.value });
                }}
                className="w-7 h-7 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent p-0.5 shrink-0"
              />
              {colorIsMixed ? (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">Mixed</span>
              ) : (
                <Input
                  type="text"
                  value={colorDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setColorDraft(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v))
                        updateMultiAssets({ materialColor: v });
                    }
                  }}
                  onBlur={() => {
                    if (!/^#[0-9a-fA-F]{6}$/.test(colorDraft))
                      setColorDraft(referenceColor);
                  }}
                  maxLength={7}
                  className="w-full font-mono"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {([
              { label: "Roughness", values: roughnesses, isMixed: roughnessIsMixed, avg: avgRoughness, key: "materialRoughness" },
              { label: "Metalness", values: metalnesses, isMixed: metalnessIsMixed, avg: avgMetalness, key: "materialMetalness" },
            ] as const).map(({ label, values, isMixed, avg, key }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                    {isMixed
                      ? <span className="italic text-zinc-400 dark:text-zinc-500">Mixed</span>
                      : values[0].toFixed(2)
                    }
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMixed ? avg : values[0]}
                  onChange={(e) => updateMultiAssets({ [key]: parseFloat(e.target.value) })}
                  className="w-full h-1 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => removeSelectedAssets()}
            className="w-full mt-2 py-1 rounded-md text-[10px] font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            Delete All Selected
          </button>

        </div>
      </div>
    );
  }

  // ── Single asset mode ─────────────────────────────────────────────────────

  const pos = asset!.position ?? [0, 0, 0];
  const singleAsset = asset!;

  return (
    <div data-no-deselect>
      <div className="px-2.5 py-2 flex flex-col gap-3">
      <Field label="Name">
        <TextValue
          key={singleAsset.name}
          value={singleAsset.name}
          onChange={(v) => updateAsset(singleAsset.id, { name: v })}
        />
      </Field>

      <Field label="Category">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {getCategoryLabel(singleAsset.category, "Primitive")}
        </span>
      </Field>

      {(() => {
        if (!singleAsset.groupId) return null;
        const findGen = (gId: string): typeof groups[number] | null => {
          const g = groups.find((gr) => gr.id === gId);
          if (!g) return null;
          if (g.generationHistory && g.generationHistory.length > 0) return g;
          if (g.parentGroupId) return findGen(g.parentGroupId);
          return null;
        };
        const genGroup = findGen(singleAsset.groupId);
        if (!genGroup) return null;
        const genGroupMembers = assets.filter((a) => a.groupId === genGroup.id);
        return (
          <Field label="Generation Process">
            <Button
              onClick={() => setReplayOpen(true)}
              className="w-full"
            >
              Replay
            </Button>
            {replayOpen && (
              <GenerationReplay
                generationHistory={genGroup.generationHistory!}
                groupName={genGroup.name}
                groupId={genGroup.id}
                canPrefixEdit={
                  !!genGroup.originalPrompt &&
                  !!genGroup.generationOffset &&
                  !isPrefixEditBlocking(prefixEdit.phase) &&
                  isGroupUnmoved(genGroup, genGroupMembers)
                }
                onPrefixEdit={prefixEdit.startPrefixEdit}
                onClose={() => setReplayOpen(false)}
              />
            )}
          </Field>
        );
      })()}

      <Field label="Visibility">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={singleAsset.visible}
            onChange={(e) =>
              updateAsset(singleAsset.id, { visible: e.target.checked })
            }
            className="w-3.5 h-3.5 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {singleAsset.visible ? "Visible" : "Hidden"}
          </span>
        </label>
      </Field>

      <Field label="Selectability">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={singleAsset.selectable ?? true}
            onChange={(e) =>
              updateAsset(singleAsset.id, { selectable: e.target.checked })
            }
            className="w-3.5 h-3.5 accent-zinc-700 dark:accent-zinc-400 cursor-pointer"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {(singleAsset.selectable ?? true) ? "Selectable" : "Not selectable"}
          </span>
        </label>
      </Field>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Position
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(["X", "Y", "Z"] as const).map((axis, i) => (
            <div key={axis} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
                {axis}
              </span>
              <NumberValue
                key={pos[i]}
                value={pos[i]}
                onChange={(v) => {
                  const next: [number, number, number] = [...pos] as [
                    number,
                    number,
                    number,
                  ];
                  next[i] = v;
                  updateAsset(singleAsset.id, { position: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {(() => {
        const isMulti = selectedAssetIds.length > 1;
        const selectedPresetAssets = isMulti
          ? assets.filter(
              (a) =>
                selectedAssetIds.includes(a.id) && a.type === "preset-brick",
            )
          : [];
        const showForGroup =
          isMulti && selectedPresetAssets.length === selectedAssetIds.length;
        const showForSingle =
          !isMulti && singleAsset.type === "preset-brick" && singleAsset.preset;

        if (!showForGroup && !showForSingle) return null;

        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              Rotation
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <Button onClick={() => rotateSelectedAssets("ccw")} className="w-full">
                90° CCW
              </Button>
              <Button onClick={() => rotateSelectedAssets("cw")} className="w-full">
                90° CW
              </Button>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={singleAsset.materialColor ?? "#bfbfff"}
            onChange={(e) => {
              updateAsset(singleAsset.id, { materialColor: e.target.value });
              setColorDraft(e.target.value);
            }}
            className="w-7 h-7 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent p-0.5"
          />
          <Input
            type="text"
            value={colorDraft}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                setColorDraft(v);
                if (/^#[0-9a-fA-F]{6}$/.test(v))
                  updateAsset(singleAsset.id, { materialColor: v });
              }
            }}
            onBlur={() => {
              if (!/^#[0-9a-fA-F]{6}$/.test(colorDraft))
                setColorDraft(singleAsset.materialColor ?? "#bfbfff");
            }}
            maxLength={7}
            className="w-full font-mono"
          />
        </div>
      </div>

      <Texture
        roughness={singleAsset.materialRoughness}
        metalness={singleAsset.materialMetalness}
        onRoughnessChange={(v) =>
          updateAsset(singleAsset.id, { materialRoughness: v })
        }
        onMetalnessChange={(v) =>
          updateAsset(singleAsset.id, { materialMetalness: v })
        }
      />

      {singleAsset.type === "preset-brick" &&
        singleAsset.preset &&
        (singleAsset.preset.studsX > 1 || singleAsset.preset.studsY > 1) && (
          <Button onClick={() => decomposeBrick(singleAsset.id)} className="w-full">
            Decompose
          </Button>
        )}

      <button
        onClick={() => {
          selectAsset(null);
          removeAsset(singleAsset.id);
        }}
        className="w-full mt-2 py-1 rounded-md text-[10px] font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
      >
        Delete Brick
      </button>

      </div>
    </div>
  );
}

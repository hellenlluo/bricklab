"use client";

import { useState } from "react";
import {
  useScene,
  type AssetCategory,
  type BrickGroup,
} from "@/store/sceneStore";
import Texture from "./Texture";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import GenerationReplay from "@/components/GenerationReplay";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
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

function getCategoryLabel(
  category: AssetCategory | undefined,
  fallback: string,
) {
  if (category === "text-to-3d") return "Text-to-3d";
  if (category === "image-to-3d") return "Image-to-3d";
  return fallback;
}

function NumberValue({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <Input
      type="number"
      min={min}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseFloat(draft);
        if (!isNaN(n)) {
          const rounded = Math.round(n);
          const clamped = min !== undefined ? Math.max(min, rounded) : rounded;
          onChange(clamped);
          if (clamped !== rounded) setDraft(String(clamped));
        } else setDraft(String(value));
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

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!asset && !selectedGroup) {
    return (
      <div data-no-deselect>
        <div className="px-3 py-3 text-xs text-muted-foreground italic">
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
        const categories = new Set(
          groupAssets.map((asset) => asset.category).filter(Boolean),
        );
        return categories.size === 1
          ? (Array.from(categories)[0] as AssetCategory)
          : undefined;
      })();

    return (
      <div data-no-deselect>
        <div className="px-3 py-2 flex flex-col gap-3">
          <Field label="Group Name">
            <TextValue
              key={selectedGroup.name}
              value={selectedGroup.name}
              onChange={(v) => updateGroup(selectedGroup.id, v)}
            />
          </Field>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={allVisible}
                onCheckedChange={(v) =>
                  updateAllAssets({ visible: v as boolean })
                }
                className="size-3.5"
              />
              <span className="text-xs text-muted-foreground">
                {allVisible ? "Visible" : "Hidden"}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={allSelectable}
                onCheckedChange={(v) =>
                  updateAllAssets({ selectable: v as boolean })
                }
                className="size-3.5"
              />
              <span className="text-xs text-muted-foreground">
                {allSelectable ? "Selectable" : "Not selectable"}
              </span>
            </label>
          </div>

          <Field label="Category">
            <span className="text-xs text-muted-foreground">
              {getCategoryLabel(groupCategory, "Group")}
            </span>
          </Field>

          {genGroup && (
            <Field label="Generation Process">
              <Button onClick={() => setReplayOpen(true)} className="w-full">
                Replay
              </Button>
              {replayOpen && (
                <GenerationReplay
                  generationHistory={genGroup.generationHistory!}
                  groupName={genGroup.name}
                  onClose={() => setReplayOpen(false)}
                />
              )}
            </Field>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Position</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <div key={axis} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground text-center">
                    {axis}
                  </span>
                  <NumberValue
                    key={groupMinPos[i]}
                    value={groupMinPos[i]}
                    onChange={(v) => updateGroupPosition(i, v)}
                    min={i === 2 ? 0 : undefined}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Rotation</span>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                onClick={() => rotateSelectedAssets("ccw")}
                className="w-full"
              >
                90° CCW
              </Button>
              <Button
                onClick={() => rotateSelectedAssets("cw")}
                className="w-full"
              >
                90° CW
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorDraft}
                onChange={(e) => {
                  setColorDraft(e.target.value);
                  updateAllAssets({ materialColor: e.target.value });
                }}
                className="w-6.5 h-6.5 rounded-none cursor-pointer border border-border bg-transparent p-0.5"
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

          <div className="-mx-3 px-3 pt-2 border-t border-border">
            <button
              onClick={() => removeGroup(selectedGroup.id)}
              className="w-full h-6.5 flex items-center justify-center rounded-none text-xs font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors leading-none"
            >
              Delete Group
            </button>
          </div>
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
    const avgRoughness =
      roughnesses.reduce((s, r) => s + r, 0) / roughnesses.length;

    const metalnesses = multiAssets.map((a) => a.materialMetalness ?? 0.0);
    const metalnessIsMixed = !metalnesses.every((m) => m === metalnesses[0]);
    const avgMetalness =
      metalnesses.reduce((s, m) => s + m, 0) / metalnesses.length;

    const allPreset = multiAssets.every(
      (a) => a.type === "preset-brick" && a.preset,
    );

    return (
      <div data-no-deselect>
        <div className="px-3 py-2 flex flex-col gap-3">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            {multiAssets.length} Selected
          </span>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Position</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <div key={axis} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground text-center">
                    {axis}
                  </span>
                  <NumberValue
                    key={multiMinPos[i]}
                    value={multiMinPos[i]}
                    onChange={(v) => updateMultiPosition(i, v)}
                    min={i === 2 ? 0 : undefined}
                  />
                </div>
              ))}
            </div>
          </div>

          {allPreset && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">
                Rotation
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  onClick={() => rotateSelectedAssets("ccw")}
                  className="w-full"
                >
                  90° CCW
                </Button>
                <Button
                  onClick={() => rotateSelectedAssets("cw")}
                  className="w-full"
                >
                  90° CW
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorDraft}
                onChange={(e) => {
                  setColorDraft(e.target.value);
                  updateMultiAssets({ materialColor: e.target.value });
                }}
                className="w-6.5 h-6.5 rounded-none cursor-pointer border border-border bg-transparent p-0.5 shrink-0"
              />
              {colorIsMixed ? (
                <span className="text-[10px] text-muted-foreground italic">
                  Mixed
                </span>
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
            {(
              [
                {
                  label: "Roughness",
                  values: roughnesses,
                  isMixed: roughnessIsMixed,
                  avg: avgRoughness,
                  key: "materialRoughness",
                },
                {
                  label: "Metalness",
                  values: metalnesses,
                  isMixed: metalnessIsMixed,
                  avg: avgMetalness,
                  key: "materialMetalness",
                },
              ] as const
            ).map(({ label, values, isMixed, avg, key }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    {isMixed ? (
                      <span className="italic text-muted-foreground">
                        Mixed
                      </span>
                    ) : (
                      values[0].toFixed(2)
                    )}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[isMixed ? avg : values[0]]}
                  onValueChange={([v]) => updateMultiAssets({ [key]: v })}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          <div className="-mx-3 px-3 pt-2 border-t border-border">
            <button
              onClick={() => removeSelectedAssets()}
              className="w-full h-6.5 flex items-center justify-center rounded-none text-xs font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors leading-none"
            >
              Delete All Selected
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Single asset mode ─────────────────────────────────────────────────────

  const pos = asset!.position ?? [0, 0, 0];
  const singleAsset = asset!;

  return (
    <div data-no-deselect>
      <div className="px-3 py-2 flex flex-col gap-3">
        <Field label="Name">
          <TextValue
            key={singleAsset.name}
            value={singleAsset.name}
            onChange={(v) => updateAsset(singleAsset.id, { name: v })}
          />
        </Field>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={singleAsset.visible}
              onCheckedChange={(v) =>
                updateAsset(singleAsset.id, { visible: v as boolean })
              }
              className="size-3.5"
            />
            <span className="text-xs text-muted-foreground">
              {singleAsset.visible ? "Visible" : "Hidden"}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={singleAsset.selectable ?? true}
              onCheckedChange={(v) =>
                updateAsset(singleAsset.id, { selectable: v as boolean })
              }
              className="size-3.5"
            />
            <span className="text-xs text-muted-foreground">
              {(singleAsset.selectable ?? true)
                ? "Selectable"
                : "Not selectable"}
            </span>
          </label>
        </div>

        <Field label="Category">
          <span className="text-xs text-muted-foreground">
            {getCategoryLabel(singleAsset.category, "Primitive")}
          </span>
        </Field>

        {(() => {
          if (!singleAsset.groupId) return null;
          const findGen = (gId: string): (typeof groups)[number] | null => {
            const g = groups.find((gr) => gr.id === gId);
            if (!g) return null;
            if (g.generationHistory && g.generationHistory.length > 0) return g;
            if (g.parentGroupId) return findGen(g.parentGroupId);
            return null;
          };
          const genGroup = findGen(singleAsset.groupId);
          if (!genGroup) return null;
          return (
            <Field label="Generation Process">
              <Button onClick={() => setReplayOpen(true)} className="w-full">
                Replay
              </Button>
              {replayOpen && (
                <GenerationReplay
                  generationHistory={genGroup.generationHistory!}
                  groupName={genGroup.name}
                  onClose={() => setReplayOpen(false)}
                />
              )}
            </Field>
          );
        })()}

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Position</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <div key={axis} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground text-center">
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
                  min={i === 2 ? 0 : undefined}
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
            !isMulti &&
            singleAsset.type === "preset-brick" &&
            singleAsset.preset;

          if (!showForGroup && !showForSingle) return null;

          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">
                Rotation
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  onClick={() => rotateSelectedAssets("ccw")}
                  className="w-full"
                >
                  90° CCW
                </Button>
                <Button
                  onClick={() => rotateSelectedAssets("cw")}
                  className="w-full"
                >
                  90° CW
                </Button>
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={singleAsset.materialColor ?? "#bfbfff"}
              onChange={(e) => {
                updateAsset(singleAsset.id, { materialColor: e.target.value });
                setColorDraft(e.target.value);
              }}
              className="w-6.5 h-6.5 rounded-none cursor-pointer border border-border bg-transparent p-0.5"
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

        <div className="flex flex-col gap-3 -mx-3 px-3 pt-3 border-t border-border">
          {singleAsset.type === "preset-brick" &&
            singleAsset.preset &&
            (singleAsset.preset.studsX > 1 ||
              singleAsset.preset.studsY > 1) && (
              <Button
                onClick={() => decomposeBrick(singleAsset.id)}
                className="w-full"
              >
                Decompose
              </Button>
            )}

          <button
            onClick={() => {
              selectAsset(null);
              removeAsset(singleAsset.id);
            }}
            className="w-full h-6.5 flex items-center justify-center rounded-none text-xs font-medium text-red-500 border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors leading-none"
          >
            Delete Brick
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useScene, type BrickGroup } from "@/store/sceneStore";
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
    decomposeBrick,
    rotateSelectedAssets,
    groups,
    updateGroup,
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

  const colorKey = selectedGroup ? `group-${selectedGroup.id}` : (asset?.id ?? null);
  const groupAssets = selectedGroup
    ? assets.filter((a) => selectedAssetIds.includes(a.id))
    : [];
  const referenceColor = selectedGroup
    ? (groupAssets[0]?.materialColor ?? "#bfbfff")
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
      <div
        data-no-deselect
        className="px-3 py-4 text-xs text-zinc-400 dark:text-zinc-500 italic"
      >
        Select an asset to view its properties.
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

    return (
      <div data-no-deselect className="px-3 py-3 flex flex-col gap-4">
        <Field label="Group Name">
          <TextValue
            key={selectedGroup.name}
            value={selectedGroup.name}
            onChange={(v) => updateGroup(selectedGroup.id, v)}
          />
        </Field>

        <Field label="Category">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            Group
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
      </div>
    );
  }

  // ── Single asset mode ─────────────────────────────────────────────────────

  const pos = asset!.position ?? [0, 0, 0];
  const singleAsset = asset!;

  return (
    <div data-no-deselect className="px-3 py-3 flex flex-col gap-4">
      <Field label="Name">
        <TextValue
          key={singleAsset.name}
          value={singleAsset.name}
          onChange={(v) => updateAsset(singleAsset.id, { name: v })}
        />
      </Field>

      <Field label="Category">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {singleAsset.category === "text-to-3d"
            ? "Text to 3D"
            : singleAsset.category === "image-to-3d"
              ? "Image to 3D"
              : "Primitive"}
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

    </div>
  );
}

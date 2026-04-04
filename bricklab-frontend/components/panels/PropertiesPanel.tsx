"use client";

import { useState } from "react";
import { useScene } from "@/store/sceneStore";
import Texture from "./Texture";

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
    <input
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
      className="text-xs bg-[#F5F5F5] dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 w-full"
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
    <input
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
      className="text-xs bg-[#F5F5F5] dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 w-full"
    />
  );
}

export default function PropertiesPanel() {
  const { assets, selectedAssetId, updateAsset } = useScene();
  const asset = assets.find((a) => a.id === selectedAssetId) ?? null;

  // Reset draft when switching assets (render-time derived state, no effect needed).
  const [colorDraftAssetId, setColorDraftAssetId] = useState<string | null>(asset?.id ?? null);
  const [colorDraft, setColorDraft] = useState(asset?.materialColor ?? "#bfbfff");
  if (colorDraftAssetId !== (asset?.id ?? null)) {
    setColorDraftAssetId(asset?.id ?? null);
    setColorDraft(asset?.materialColor ?? "#bfbfff");
  }

  if (!asset) {
    return (
      <div
        data-no-deselect
        className="px-3 py-4 text-xs text-zinc-400 dark:text-zinc-500 italic"
      >
        Select an asset to view its properties.
      </div>
    );
  }

  const pos = asset.position ?? [0, 0, 0];

  return (
    <div data-no-deselect className="px-3 py-3 flex flex-col gap-3">
      <Field label="Name">
        <TextValue
          key={asset.name}
          value={asset.name}
          onChange={(v) => updateAsset(asset.id, { name: v })}
        />
      </Field>

      <Field label="Type">
        <span className="text-xs text-zinc-600 dark:text-zinc-400 px-2 py-1">
          {asset.type}
        </span>
      </Field>

      {asset.modelPath && (
        <Field label="Model">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1 truncate">
            {asset.modelPath}
          </span>
        </Field>
      )}

      <Field label="Visibility">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={asset.visible}
            onChange={(e) => updateAsset(asset.id, { visible: e.target.checked })}
            className="w-3.5 h-3.5 accent-zinc-600 dark:accent-zinc-400 cursor-pointer"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {asset.visible ? "Visible" : "Hidden"}
          </span>
        </label>
      </Field>

      <Field label="Selectability">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={asset.selectable ?? true}
            onChange={(e) => updateAsset(asset.id, { selectable: e.target.checked })}
            className="w-3.5 h-3.5 accent-zinc-600 dark:accent-zinc-400 cursor-pointer"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {(asset.selectable ?? true) ? "Selectable" : "Not selectable"}
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
                  updateAsset(asset.id, { position: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={asset.materialColor ?? "#bfbfff"}
            onChange={(e) => {
              updateAsset(asset.id, { materialColor: e.target.value });
              setColorDraft(e.target.value);
            }}
            className="w-7 h-7 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent p-0.5"
          />
          <input
            type="text"
            value={colorDraft}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                setColorDraft(v);
                // Only push to Three.js once the hex is complete to avoid
                // THREE.Color warnings on partial strings like "#0000".
                if (/^#[0-9a-fA-F]{6}$/.test(v))
                  updateAsset(asset.id, { materialColor: v });
              }
            }}
            onBlur={() => {
              if (!/^#[0-9a-fA-F]{6}$/.test(colorDraft))
                setColorDraft(asset.materialColor ?? "#bfbfff");
            }}
            maxLength={7}
            className="text-xs bg-[#F5F5F5] dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 w-full font-mono"
          />
        </div>
      </div>

      <Texture
        roughness={asset.materialRoughness}
        metalness={asset.materialMetalness}
        onRoughnessChange={(v) =>
          updateAsset(asset.id, { materialRoughness: v })
        }
        onMetalnessChange={(v) =>
          updateAsset(asset.id, { materialMetalness: v })
        }
      />

    </div>
  );
}

"use client";

import { useState } from "react";
import { useScene } from "@/store/sceneStore";

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

      <Field label="Visible">
        <button
          onClick={() => updateAsset(asset.id, { visible: !asset.visible })}
          className={`self-start text-xs px-2 py-1 rounded border transition-colors ${
            asset.visible
              ? "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
              : "border-zinc-300 dark:border-zinc-600 bg-[#F5F5F5] dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {asset.visible ? "Visible" : "Hidden"}
        </button>
      </Field>

      <div className="flex flex-col gap-1.5">
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

      {asset.modelPath && (
        <Field label="Model">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1 truncate">
            {asset.modelPath}
          </span>
        </Field>
      )}
    </div>
  );
}

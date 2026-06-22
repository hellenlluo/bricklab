"use client";

import { Slider } from "@/components/ui/slider";

interface SliderRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, onChange }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

interface TextureProps {
  roughness: number | undefined;
  metalness: number | undefined;
  onRoughnessChange: (v: number) => void;
  onMetalnessChange: (v: number) => void;
}

export default function Texture({
  roughness,
  metalness,
  onRoughnessChange,
  onMetalnessChange,
}: TextureProps) {
  return (
    <div className="flex flex-col gap-2">
      <SliderRow
        label="Roughness"
        value={roughness ?? 0.88}
        onChange={onRoughnessChange}
      />
      <SliderRow
        label="Metalness"
        value={metalness ?? 0.0}
        onChange={onMetalnessChange}
      />
    </div>
  );
}

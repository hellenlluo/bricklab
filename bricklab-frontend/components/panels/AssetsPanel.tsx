"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useScene } from "@/store/sceneStore";

export default function AssetsPanel() {
  const { assets, updateAsset, selectedAssetId, selectAsset } = useScene();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clear selection when clicking outside the panel
  useEffect(() => {
    if (!expanded) return;
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        !(target as Element).closest?.('[data-no-deselect]')
      ) {
        selectAsset(null);
      }
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [expanded, selectAsset]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => asset.name.toLowerCase().includes(q));
  }, [assets, search]);

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingValue(name);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit(id: string) {
    const trimmed = editingValue.trim();
    if (trimmed) updateAsset(id, { name: trimmed });
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") commitEdit(id);
    if (e.key === "Escape") setEditingId(null);
  }

  function handleToggle() {
    if (expanded) selectAsset(null);
    setExpanded((v) => !v);
  }

  return (
    <div ref={dropdownRef} className="border-b border-zinc-200 dark:border-zinc-800">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-[#F5F5F5] dark:bg-zinc-800 px-2 py-1.5 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
        />
      </div>

      {/* Collapsible header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F5F5F5] dark:hover:bg-zinc-800 transition-colors"
      >
        {/* Black triangle indicator */}
        <span
          className="inline-block text-zinc-900 dark:text-zinc-100 transition-transform duration-200"
          style={{
            fontSize: "0.5rem",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            lineHeight: 1,
          }}
        >
          ▶
        </span>
        <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Assets
        </span>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {assets.length}
        </span>
      </button>

      {/* Collapsible list */}
      {expanded && (
        <ul className="pb-2" onClick={() => selectAsset(null)}>
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
              {search ? "No matches" : "No assets in scene"}
            </li>
          ) : (
            filtered.map((asset) => (
              <li
                key={asset.id}
                onClick={(e) => { e.stopPropagation(); selectAsset(asset.id); }}
                className={`flex items-center gap-2 mx-3 px-2 py-1.5 text-xs rounded-md cursor-default group transition-colors ${
                  selectedAssetId === asset.id
                    ? "bg-[#F5F5F5] dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800"
                }`}
              >
                {editingId === asset.id ? (
                  <input
                    ref={inputRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => commitEdit(asset.id)}
                    onKeyDown={(e) => handleKeyDown(e, asset.id)}
                    className="flex-1 min-w-0 bg-transparent outline-none border-b border-black dark:border-white text-xs text-zinc-800 dark:text-zinc-100 leading-none p-0 m-0 h-[1em]"
                    autoFocus
                  />
                ) : (
                  <span
                    className="truncate flex-1"
                    onDoubleClick={() => startEdit(asset.id, asset.name)}
                    title="Double-click to rename"
                  >
                    {asset.name}
                  </span>
                )}
                <span className="text-zinc-400 dark:text-zinc-600 shrink-0">
                  {asset.type}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

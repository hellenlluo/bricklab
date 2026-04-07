"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useScene } from "@/store/sceneStore";

export default function AssetsPanel() {
  const {
    assets,
    updateAsset,
    selectedAssetId,
    selectedAssetIds,
    selectAsset,
    toggleAssetSelection,
    groups,
    ungroupAssets,
    selectGroup,
    updateGroup,
  } = useScene();
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
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
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !(target as Element).closest?.("[data-no-deselect]")
      ) {
        selectAsset(null);
      }
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [expanded, selectAsset]);

  const q = search.trim().toLowerCase();

  // Ungrouped assets (no groupId), filtered
  const ungroupedAssets = useMemo(() => {
    const base = assets.filter((a) => !a.groupId);
    if (!q) return base;
    return base.filter((a) => a.name.toLowerCase().includes(q));
  }, [assets, q]);

  // Assets per group, filtered
  const groupedAssets = useMemo(() => {
    const map: Record<string, typeof assets> = {};
    for (const g of groups) {
      const members = assets.filter((a) => a.groupId === g.id);
      if (!q || g.name.toLowerCase().includes(q) || members.some((a) => a.name.toLowerCase().includes(q))) {
        map[g.id] = members;
      }
    }
    return map;
  }, [assets, groups, q]);

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingValue(name);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit(id: string, isGroup = false) {
    const trimmed = editingValue.trim();
    if (trimmed) {
      if (isGroup) {
        updateGroup(id, trimmed);
      } else {
        updateAsset(id, { name: trimmed });
      }
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string, isGroup = false) {
    if (e.key === "Enter") commitEdit(id, isGroup);
    if (e.key === "Escape") setEditingId(null);
  }

  function toggleGroupExpanded(groupId: string) {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function isGroupSelected(groupId: string) {
    const members = assets.filter((a) => a.groupId === groupId).map((a) => a.id);
    return members.length > 0 && members.every((id) => selectedAssetIds.includes(id));
  }

  function handleToggle() {
    if (expanded) selectAsset(null);
    setExpanded((v) => !v);
  }

  const totalCount = assets.length;

  return (
    <div
      ref={dropdownRef}
      className="border-b border-zinc-200 dark:border-zinc-800"
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
        />
      </div>

      {/* Collapsible header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
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
          {totalCount}
        </span>
      </button>

      {/* Collapsible list */}
      {expanded && (
        <ul className="pb-2" onClick={() => selectAsset(null)}>
          {groups.length === 0 && ungroupedAssets.length === 0 && (
            <li className="px-4 py-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
              {search ? "No matches" : "No assets in scene"}
            </li>
          )}

          {/* Groups */}
          {groups.map((group) => {
            const members = groupedAssets[group.id];
            if (!members) return null;
            const grpSelected = isGroupSelected(group.id);
            const isOpen = expandedGroups[group.id] ?? false;

            return (
              <li key={group.id}>
                {/* Group row */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    selectGroup(group.id);
                  }}
                  className={`flex items-center gap-1 mx-3 px-2 py-1.5 text-xs cursor-default group transition-colors ${isOpen ? "rounded-t-md" : "rounded-md"} ${
                    grpSelected
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {/* Expand toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupExpanded(group.id);
                    }}
                    className="shrink-0 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                    style={{ fontSize: "0.45rem", lineHeight: 1 }}
                  >
                    {isOpen ? "▼" : "▶"}
                  </button>

                  {/* Group icon */}
                  <svg className="shrink-0 w-3 h-3 text-zinc-400 dark:text-zinc-500" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="5" width="14" height="9" rx="1.5" fillOpacity="0.4" />
                    <rect x="1" y="2" width="6" height="4" rx="1" fillOpacity="0.7" />
                  </svg>

                  {/* Name / edit */}
                  {editingId === group.id ? (
                    <input
                      ref={inputRef}
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => commitEdit(group.id, true)}
                      onKeyDown={(e) => handleKeyDown(e, group.id, true)}
                      className="flex-1 min-w-0 bg-transparent outline-none border-b border-black dark:border-white text-xs text-zinc-800 dark:text-zinc-100 leading-none p-0 m-0 h-[1em]"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="truncate flex-1 font-medium"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(group.id, group.name);
                      }}
                      title="Double-click to rename"
                    >
                      {group.name}
                    </span>
                  )}                  <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                    {members.length}
                  </span>

                  {/* Ungroup button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ungroupAssets(group.id);
                    }}
                    className="shrink-0 ml-1 w-4 h-4 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity text-[9px]"
                    title="Ungroup"
                  >
                    ✕
                  </button>
                </div>

                {/* Children */}
                {isOpen && (
                  <ul>
                    {members.map((asset, idx) => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        depth={1}
                        isLast={idx === members.length - 1}
                        editingId={editingId}
                        editingValue={editingValue}
                        inputRef={inputRef}
                        selectedAssetIds={selectedAssetIds}
                        onSelect={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            toggleAssetSelection(asset.id);
                          } else {
                            selectAsset(asset.id);
                          }
                        }}
                        onStartEdit={() => startEdit(asset.id, asset.name)}
                        onEditChange={(v) => setEditingValue(v)}
                        onCommitEdit={() => commitEdit(asset.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onKeyDown={(e) => handleKeyDown(e, asset.id)}
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}

          {/* Ungrouped assets */}
          {ungroupedAssets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              depth={0}
              editingId={editingId}
              editingValue={editingValue}
              inputRef={inputRef}
              selectedAssetIds={selectedAssetIds}
              onSelect={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  toggleAssetSelection(asset.id);
                } else {
                  selectAsset(asset.id);
                }
              }}
              onStartEdit={() => startEdit(asset.id, asset.name)}
              onEditChange={(v) => setEditingValue(v)}
              onCommitEdit={() => commitEdit(asset.id)}
              onCancelEdit={() => setEditingId(null)}
              onKeyDown={(e) => handleKeyDown(e, asset.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  depth,
  isLast = false,
  editingId,
  editingValue,
  inputRef,
  selectedAssetIds,
  onSelect,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onKeyDown,
}: {
  asset: { id: string; name: string };
  depth: number;
  isLast?: boolean;
  editingId: string | null;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedAssetIds: string[];
  onSelect: (e: React.MouseEvent) => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <li
      onClick={onSelect}
      style={{ paddingLeft: depth === 1 ? "2rem" : undefined }}
      className={`flex items-center gap-2 mx-3 px-2 py-1.5 text-xs cursor-default group transition-colors ${depth === 1 ? (isLast ? "rounded-b-md" : "rounded-none") : "rounded-md"} ${
        selectedAssetIds.includes(asset.id)
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {editingId === asset.id ? (
        <input
          ref={inputRef}
          value={editingValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent outline-none border-b border-black dark:border-white text-xs text-zinc-800 dark:text-zinc-100 leading-none p-0 m-0 h-[1em]"
          autoFocus
        />
      ) : (
        <span
          className="truncate flex-1"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          title="Double-click to rename"
        >
          {asset.name}
        </span>
      )}
    </li>
  );
}

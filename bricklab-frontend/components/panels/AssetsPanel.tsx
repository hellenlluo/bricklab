"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useScene, type BrickGroup, type SceneAsset } from "@/store/sceneStore";

// ─── Module-level helpers ────────────────────────────────────────────────────

function isGroupFullySelected(
  groupId: string,
  allGroups: BrickGroup[],
  allAssets: SceneAsset[],
  selectedIds: string[],
): boolean {
  const directs = allAssets.filter((a) => a.groupId === groupId);
  const children = allGroups.filter((g) => g.parentGroupId === groupId);
  if (directs.length === 0 && children.length === 0) return false;
  return (
    directs.every((a) => selectedIds.includes(a.id)) &&
    children.every((g) =>
      isGroupFullySelected(g.id, allGroups, allAssets, selectedIds),
    )
  );
}

// ─── Shared callbacks bundled to avoid deep prop-drilling ────────────────────

interface GroupRowShared {
  editingId: string | null;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedAssetIds: string[];
  allGroups: BrickGroup[];
  allAssets: SceneAsset[];
  expandedGroups: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onUngroup: (id: string) => void;
  onSelectAsset: (id: string, shiftKey: boolean) => void;
  onStartEdit: (id: string, name: string) => void;
  onEditChange: (v: string) => void;
  onCommitEdit: (id: string, isGroup: boolean) => void;
  onCancelEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent, id: string, isGroup?: boolean) => void;
}

// ─── GroupRow (recursive) ────────────────────────────────────────────────────

function GroupRow({
  group,
  depth,
  isLastInParent,
  shared,
}: {
  group: BrickGroup;
  depth: number;
  isLastInParent: boolean;
  shared: GroupRowShared;
}) {
  const {
    editingId,
    editingValue,
    inputRef,
    selectedAssetIds,
    allGroups,
    allAssets,
    expandedGroups,
    onToggleExpand,
    onSelectGroup,
    onUngroup,
    onSelectAsset,
    onStartEdit,
    onEditChange,
    onCommitEdit,
    onCancelEdit,
    onKeyDown,
  } = shared;

  const isOpen = expandedGroups[group.id] ?? false;
  const childGroups = allGroups.filter((g) => g.parentGroupId === group.id);
  const directMembers = allAssets.filter((a) => a.groupId === group.id);
  const totalChildren = childGroups.length + directMembers.length;
  const grpSelected = isGroupFullySelected(
    group.id,
    allGroups,
    allAssets,
    selectedAssetIds,
  );

  const indentStyle =
    depth > 0 ? { paddingLeft: `${depth * 2}rem` } : undefined;

  const headerRounding = isOpen
    ? "rounded-t-md"
    : isLastInParent && depth > 0
      ? "rounded-b-md"
      : "rounded-md";

  return (
    <li>
      {/* Group header row */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectGroup(group.id);
        }}
        style={indentStyle}
        className={`flex items-center gap-1 mx-3 px-2 py-1.5 text-xs cursor-default group transition-colors ${headerRounding} ${
          grpSelected
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(group.id);
          }}
          className="shrink-0 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
          style={{ fontSize: "0.45rem", lineHeight: 1 }}
        >
          {isOpen ? "▼" : "▶"}
        </button>

        <svg
          className="shrink-0 w-3 h-3 text-zinc-400 dark:text-zinc-500"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <rect x="1" y="5" width="14" height="9" rx="1.5" fillOpacity="0.4" />
          <rect x="1" y="2" width="6" height="4" rx="1" fillOpacity="0.7" />
        </svg>

        {editingId === group.id ? (
          <input
            ref={inputRef}
            value={editingValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onCommitEdit(group.id, true)}
            onKeyDown={(e) => onKeyDown(e, group.id, true)}
            className="flex-1 min-w-0 bg-transparent outline-none border-b border-black dark:border-white text-xs text-zinc-800 dark:text-zinc-100 leading-none p-0 m-0 h-[1em]"
            autoFocus
          />
        ) : (
          <span
            className="truncate flex-1 font-medium"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit(group.id, group.name);
            }}
            title="Double-click to rename"
          >
            {group.name}
          </span>
        )}

        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
          {totalChildren}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUngroup(group.id);
          }}
          className="shrink-0 ml-1 w-4 h-4 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity text-[9px]"
          title="Ungroup"
        >
          ✕
        </button>
      </div>

      {/* Expanded children */}
      {isOpen && totalChildren > 0 && (
        <ul>
          {/* Child groups first */}
          {childGroups.map((childGroup, idx) => (
            <GroupRow
              key={childGroup.id}
              group={childGroup}
              depth={depth + 1}
              isLastInParent={
                idx === childGroups.length - 1 && directMembers.length === 0
              }
              shared={shared}
            />
          ))}
          {/* Direct brick members */}
          {directMembers.map((asset, idx) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              depth={depth + 1}
              isLast={idx === directMembers.length - 1}
              isPrevSelected={selectedAssetIds.includes(directMembers[idx - 1]?.id)}
              isNextSelected={selectedAssetIds.includes(directMembers[idx + 1]?.id)}
              editingId={editingId}
              editingValue={editingValue}
              inputRef={inputRef}
              selectedAssetIds={selectedAssetIds}
              onSelect={(e) => {
                e.stopPropagation();
                onSelectAsset(asset.id, e.shiftKey);
              }}
              onStartEdit={() => onStartEdit(asset.id, asset.name)}
              onEditChange={onEditChange}
              onCommitEdit={() => onCommitEdit(asset.id, false)}
              onCancelEdit={onCancelEdit}
              onKeyDown={(e) => onKeyDown(e, asset.id)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── AssetsPanel ─────────────────────────────────────────────────────────────

export default function AssetsPanel() {
  const {
    assets,
    updateAsset,
    selectedAssetIds,
    selectAsset,
    toggleAssetSelection,
    groups,
    ungroupAssets,
    selectGroup,
    updateGroup,
  } = useScene();
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const topLevelGroups = useMemo(
    () => groups.filter((g) => !g.parentGroupId),
    [groups],
  );

  const ungroupedAssets = useMemo(() => {
    const base = assets.filter((a) => !a.groupId);
    if (!q) return base;
    return base.filter((a) => a.name.toLowerCase().includes(q));
  }, [assets, q]);

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingValue(name);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit(id: string, isGroup: boolean) {
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

  function handleToggle() {
    if (expanded) selectAsset(null);
    setExpanded((v) => !v);
  }

  // Bundle all shared callbacks once (stable references per render)
  const shared: GroupRowShared = {
    editingId,
    editingValue,
    inputRef,
    selectedAssetIds,
    allGroups: groups,
    allAssets: assets,
    expandedGroups,
    onToggleExpand: (id) =>
      setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] })),
    onSelectGroup: selectGroup,
    onUngroup: ungroupAssets,
    onSelectAsset: (id, shiftKey) => {
      if (shiftKey) toggleAssetSelection(id);
      else selectAsset(id);
    },
    onStartEdit: startEdit,
    onEditChange: setEditingValue,
    onCommitEdit: commitEdit,
    onCancelEdit: () => setEditingId(null),
    onKeyDown: handleKeyDown,
  };

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
          {assets.length}
        </span>
      </button>

      {/* Collapsible list */}
      {expanded && (
        <ul className="pb-2" onClick={() => selectAsset(null)}>
          {topLevelGroups.length === 0 && ungroupedAssets.length === 0 && (
            <li className="px-4 py-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
              {search ? "No matches" : "No assets in scene"}
            </li>
          )}

          {/* Groups (recursive) */}
          {topLevelGroups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              depth={0}
              isLastInParent={false}
              shared={shared}
            />
          ))}

          {/* Ungrouped assets */}
          {ungroupedAssets.map((asset, idx) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              depth={0}
              isPrevSelected={selectedAssetIds.includes(ungroupedAssets[idx - 1]?.id)}
              isNextSelected={selectedAssetIds.includes(ungroupedAssets[idx + 1]?.id)}
              editingId={editingId}
              editingValue={editingValue}
              inputRef={inputRef}
              selectedAssetIds={selectedAssetIds}
              onSelect={(e) => {
                e.stopPropagation();
                if (e.shiftKey) toggleAssetSelection(asset.id);
                else selectAsset(asset.id);
              }}
              onStartEdit={() => startEdit(asset.id, asset.name)}
              onEditChange={setEditingValue}
              onCommitEdit={() => commitEdit(asset.id, false)}
              onCancelEdit={() => setEditingId(null)}
              onKeyDown={(e) => handleKeyDown(e, asset.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── AssetRow ─────────────────────────────────────────────────────────────────

function AssetRow({
  asset,
  depth,
  isLast = false,
  isPrevSelected = false,
  isNextSelected = false,
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
  isPrevSelected?: boolean;
  isNextSelected?: boolean;
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
  const isSelected = selectedAssetIds.includes(asset.id);
  const rounding = isSelected
    ? !isPrevSelected && !isNextSelected
      ? "rounded-md"
      : !isPrevSelected
        ? "rounded-t-md"
        : !isNextSelected
          ? "rounded-b-md"
          : "rounded-none"
    : depth === 0
      ? "rounded-md"
      : isLast
        ? "rounded-b-md"
        : "rounded-none";
  const indentStyle =
    depth > 0 ? { paddingLeft: `${depth * 2}rem` } : undefined;

  return (
    <li
      onClick={onSelect}
      style={indentStyle}
      className={`flex items-center gap-2 mx-3 px-2 py-1.5 text-xs cursor-default group transition-colors ${rounding} ${
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
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            } else onKeyDown(e);
          }}
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

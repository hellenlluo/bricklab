"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useScene, type BrickGroup, type SceneAsset } from "@/store/sceneStore";
import Input from "@/components/ui/Input";

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

function getSelectedRounding(
  isSelected: boolean,
  prevSelected: boolean,
  nextSelected: boolean,
) {
  if (!isSelected) return null;
  if (!prevSelected && !nextSelected) return "rounded-none";
  if (!prevSelected) return "rounded-none";
  if (!nextSelected) return "rounded-none";
  return "rounded-none";
}

function buildVisibleRows(
  parentGroupId: string | undefined,
  allGroups: BrickGroup[],
  allAssets: SceneAsset[],
  expandedGroups: Record<string, boolean>,
  selectedIds: string[],
): Array<{ key: string; selected: boolean }> {
  const childGroups = allGroups.filter(
    (g) => g.parentGroupId === parentGroupId,
  );
  const directMembers = allAssets.filter((a) => a.groupId === parentGroupId);
  const rows: Array<{ key: string; selected: boolean }> = [];

  childGroups.forEach((group) => {
    rows.push({
      key: `group:${group.id}`,
      selected: isGroupFullySelected(
        group.id,
        allGroups,
        allAssets,
        selectedIds,
      ),
    });
    if (expandedGroups[group.id]) {
      rows.push(
        ...buildVisibleRows(
          group.id,
          allGroups,
          allAssets,
          expandedGroups,
          selectedIds,
        ),
      );
    }
  });

  directMembers.forEach((asset) => {
    rows.push({
      key: `asset:${asset.id}`,
      selected: selectedIds.includes(asset.id),
    });
  });

  return rows;
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
  selectedAdjacency: Record<string, { prev: boolean; next: boolean }>;
  onToggleExpand: (id: string) => void;
  onSelectGroup: (id: string, shiftKey: boolean) => void;
  onUngroup: (id: string) => void;
  onSelectAsset: (id: string, shiftKey: boolean) => void;
  onStartEdit: (id: string, name: string) => void;
  onEditChange: (v: string) => void;
  onCommitEdit: (id: string, isGroup: boolean) => void;
  onCancelEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent, id: string, isGroup?: boolean) => void;
  onMoveToGroup: (assetId: string, groupId: string) => void;
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
    onMoveToGroup,
  } = shared;

  const [isDragOver, setIsDragOver] = useState(false);

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
  const rowKey = `group:${group.id}`;
  const adjacency = shared.selectedAdjacency[rowKey] ?? {
    prev: false,
    next: false,
  };
  const selectedRounding = getSelectedRounding(
    grpSelected,
    adjacency.prev,
    adjacency.next,
  );

  const headerRounding = isOpen
    ? "rounded-none"
    : isLastInParent && depth > 0
      ? "rounded-none"
      : "rounded-none";

  return (
    <li>
      {/* Group header row */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectGroup(group.id, e.shiftKey);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const assetId = e.dataTransfer.getData(
            "application/x-brick-asset-id",
          );
          if (
            assetId &&
            !allAssets.some((a) => a.id === assetId && a.groupId === group.id)
          ) {
            onMoveToGroup(assetId, group.id);
          }
        }}
        style={indentStyle}
        className={`flex items-center gap-1 mx-2.5 px-2 h-8 text-xs cursor-default group transition-colors text-foreground ${selectedRounding ?? headerRounding} ${
          isDragOver
            ? "ring-2 ring-[#74a7fe] bg-blue-50 dark:bg-blue-900/20"
            : grpSelected
              ? "bg-muted"
              : "hover:bg-muted"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(group.id);
          }}
          className="shrink-0 text-xs leading-none text-muted-foreground hover:text-foreground"
        >
          {isOpen ? "▼" : "▶"}
        </button>

        <svg
          className="shrink-0 w-3 h-3 text-muted-foreground"
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
            className="flex-1 min-w-0 bg-transparent outline-none text-xs text-foreground leading-none p-0 m-0"
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

        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {totalChildren}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUngroup(group.id);
          }}
          className="shrink-0 ml-1 w-4 h-4 flex items-center justify-center rounded-none text-xs leading-none text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
              selectedAdjacency={shared.selectedAdjacency}
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
    peekAsset,
    toggleAssetSelection,
    toggleGroupSelection,
    groups,
    ungroupAssets,
    selectGroup,
    updateGroup,
    moveAssetToGroup,
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
    selectedAdjacency: useMemo(() => {
      const rows = buildVisibleRows(
        undefined,
        groups,
        assets,
        expandedGroups,
        selectedAssetIds,
      );
      const adjacency: Record<string, { prev: boolean; next: boolean }> = {};
      rows.forEach((row, idx) => {
        adjacency[row.key] = {
          prev: rows[idx - 1]?.selected ?? false,
          next: rows[idx + 1]?.selected ?? false,
        };
      });
      return adjacency;
    }, [groups, assets, expandedGroups, selectedAssetIds]),
    onToggleExpand: (id) =>
      setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] })),
    onSelectGroup: (id, shiftKey) => {
      if (shiftKey) toggleGroupSelection(id);
      else selectGroup(id);
    },
    onUngroup: ungroupAssets,
    onSelectAsset: (id, shiftKey) => {
      const a = assets.find((x) => x.id === id);
      if (a?.selectable === false) {
        peekAsset(id);
        return;
      }
      if (shiftKey) toggleAssetSelection(id);
      else selectAsset(id);
    },
    onStartEdit: startEdit,
    onEditChange: setEditingValue,
    onCommitEdit: commitEdit,
    onCancelEdit: () => setEditingId(null),
    onKeyDown: handleKeyDown,
    onMoveToGroup: (assetId: string, groupId: string) =>
      moveAssetToGroup(assetId, groupId),
  };

  return (
    <div ref={dropdownRef} className="border-b border-border pb-2">
      {/* Search */}
      <div className="px-2.5 pt-3 pb-2">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="w-full"
        />
      </div>

      {/* Collapsible header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-2.5 h-8 text-left leading-none hover:bg-muted transition-colors"
      >
        <span
          className="inline-block text-xs text-foreground transition-transform duration-200"
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            lineHeight: 1,
          }}
        >
          ▶
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Assets
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {assets.length}
        </span>
      </button>

      {/* Collapsible list */}
      {expanded && (
        <ul onClick={() => selectAsset(null)}>
          {topLevelGroups.length === 0 && ungroupedAssets.length === 0 && (
            <li className="px-2.5 py-2 text-xs text-muted-foreground italic">
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
          {ungroupedAssets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              depth={0}
              editingId={editingId}
              editingValue={editingValue}
              inputRef={inputRef}
              selectedAssetIds={selectedAssetIds}
              selectedAdjacency={shared.selectedAdjacency}
              onSelect={(e) => {
                e.stopPropagation();
                if (asset.selectable === false) {
                  peekAsset(asset.id);
                  return;
                }
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
  editingId,
  editingValue,
  inputRef,
  selectedAssetIds,
  selectedAdjacency,
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
  selectedAdjacency: Record<string, { prev: boolean; next: boolean }>;
  onSelect: (e: React.MouseEvent) => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const isSelected = selectedAssetIds.includes(asset.id);
  const adjacency = selectedAdjacency[`asset:${asset.id}`] ?? {
    prev: false,
    next: false,
  };
  const rounding =
    getSelectedRounding(isSelected, adjacency.prev, adjacency.next) ??
    (depth === 0 ? "rounded-none" : isLast ? "rounded-none" : "rounded-none");
  const indentStyle =
    depth > 0 ? { paddingLeft: `${depth * 2}rem` } : undefined;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-brick-asset-id", asset.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      style={indentStyle}
      className={`flex items-center gap-2 mx-2.5 px-2 h-8 text-xs cursor-default group transition-colors text-foreground ${rounding} ${
        selectedAssetIds.includes(asset.id) ? "bg-muted" : "hover:bg-muted"
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
          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-foreground leading-none p-0 m-0"
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

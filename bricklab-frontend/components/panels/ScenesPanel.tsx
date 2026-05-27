"use client";

import { useState, useRef, useEffect } from "react";
import { useScene } from "@/store/sceneStore";
import Button from "@/components/ui/Button";

export default function ScenesPanel() {
  const {
    scenes,
    activeSceneId,
    addScene,
    removeScene,
    renameScene,
    setActiveScene,
  } = useScene();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingValue(name);
  }

  function commitEdit(id: string) {
    const trimmed = editingValue.trim();
    if (trimmed) renameScene(id, trimmed);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit(id);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Scenes
        </span>
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-500">
          {scenes.length}
        </span>
        <Button onClick={addScene} title="Add Scene">
          + New
        </Button>
      </div>

      {/* Scene list */}
      <ul className="flex flex-col pb-2">
        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          const isEditing = editingId === scene.id;
          return (
            <li key={scene.id}>
              <div
                onClick={() => setActiveScene(scene.id)}
                className={`flex items-center gap-1.5 mx-3 px-2 py-1.5 rounded-none cursor-default group transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {/* Name / edit input */}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => commitEdit(scene.id)}
                    onKeyDown={(e) => handleKeyDown(e, scene.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent outline-none border-b border-black dark:border-white text-xs text-zinc-800 dark:text-zinc-100 leading-none p-0 m-0 h-[1em]"
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 text-xs truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEdit(scene.id, scene.name);
                    }}
                  >
                    {scene.name}
                  </span>
                )}

                {/* Asset count badge */}
                {!isEditing && (
                  <span className="shrink-0 text-[9px] text-zinc-500 dark:text-zinc-500 tabular-nums">
                    {scene.assets.length}
                  </span>
                )}

                {/* Delete button (hidden unless hovered, disabled when only one scene) */}
                {!isEditing && scenes.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScene(scene.id);
                    }}
                    title="Delete scene"
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-500 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    style={{ fontSize: "0.6rem", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Divider */}
      <div className="border-t border-zinc-400 dark:border-zinc-600" />
    </div>
  );
}

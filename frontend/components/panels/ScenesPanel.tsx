"use client";

import { useState, useRef, useEffect } from "react";
import { useScene } from "@/store/sceneStore";
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
      <div className="flex items-center gap-2 px-2.5 pt-3 pb-1.5">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Scenes
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {scenes.length}
        </span>
        <button
          onClick={addScene}
          title="Add Scene"
          className="h-5 px-2 flex items-center text-xs leading-none rounded-none border transition-colors border-accent bg-accent/25 text-accent hover:bg-accent/35"
        >
          +
        </button>
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
                className={`flex items-center gap-1.5 mx-2.5 px-2 h-8 rounded-none cursor-default group text-foreground transition-colors ${
                  isActive ? "bg-muted" : "hover:bg-muted"
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
                    className="flex-1 min-w-0 bg-transparent outline-none text-xs text-foreground leading-none p-0 m-0"
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
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-xs leading-none text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-all"
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
      <div className="border-t border-border" />
    </div>
  );
}

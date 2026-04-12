"use client";

import { useState } from "react";
import { useScene } from "@/store/sceneStore";
import type { Constraint } from "@/store/sceneStore";
import Button from "@/components/ui/Button";
import ConstraintBuilder from "@/components/ConstraintBuilder";

export default function ConstraintsPanel() {
  const { constraints, removeConstraint } = useScene();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(
    null,
  );

  function handleNew() {
    setEditingConstraint(null);
    setBuilderOpen(true);
  }

  function handleEdit(constraint: Constraint) {
    setEditingConstraint(constraint);
    setBuilderOpen(true);
  }

  function handleClose() {
    setBuilderOpen(false);
    setEditingConstraint(null);
  }

  return (
    <>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
          <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Constraints
          </span>
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
            {constraints.length}
          </span>
          <Button onClick={handleNew} title="Add Constraint">
            + New
          </Button>
        </div>

        {/* Constraint list */}
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {constraints.map((c) => (
            <li key={c.id}>
              <div
                onClick={() => handleEdit(c)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-default group transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="flex-1 min-w-0 text-xs truncate">
                  {c.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeConstraint(c.id);
                  }}
                  title="Delete constraint"
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  style={{ fontSize: "0.6rem", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-800" />
      </div>

      {builderOpen && (
        <ConstraintBuilder
          existing={editingConstraint}
          onClose={handleClose}
        />
      )}
    </>
  );
}

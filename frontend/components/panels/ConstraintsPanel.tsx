"use client";

import { useState } from "react";
import { useScene } from "@/store/sceneStore";
import type { Constraint } from "@/store/sceneStore";
import ConstraintBuilder from "../ConstraintBuilder";

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
        <div className="flex items-end gap-2 px-3 pt-3 pb-1.5">
          <span className="text-xs font-semibold tracking-tight text-foreground">
            Constraints
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {constraints.length}
          </span>
          <button
            onClick={handleNew}
            title="Add Constraint"
            className="h-5 px-2 flex items-center text-[10px] leading-none rounded-none border transition-colors border-accent bg-accent/25 text-accent hover:bg-accent/35"
          >
            + New
          </button>
        </div>

        {/* Constraint list */}
        <ul className="flex flex-col gap-0.5 pb-2">
          {constraints.map((c) => (
            <li key={c.id}>
              <div
                onClick={() => handleEdit(c)}
                className="flex items-center gap-1.5 mx-3 px-2 py-1.5 rounded-none cursor-default group transition-colors text-muted-foreground hover:bg-muted"
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
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-all"
                  style={{ fontSize: "0.6rem", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="border-t border-border" />
      </div>

      {builderOpen && (
        <ConstraintBuilder existing={editingConstraint} onClose={handleClose} />
      )}
    </>
  );
}

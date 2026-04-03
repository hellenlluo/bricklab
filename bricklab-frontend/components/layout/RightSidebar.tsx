"use client";

export default function RightSidebar() {
  return (
    <aside
      style={{ width: "15vw" }}
      className="h-full flex-shrink-0 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800"
    >
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Properties
        </span>
      </div>
    </aside>
  );
}

"use client";

export default function RightSidebar() {
  return (
    <aside
      style={{ width: "15vw", top: "9.5vh", right: "1vw", bottom: "1vh" }}
      className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-40 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Properties
        </span>
      </div>
    </aside>
  );
}

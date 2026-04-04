"use client";

export default function ToolBar() {
  return (
    <div
      style={{
        height: "5vh",
        width: "35vw",
        bottom: "5vh",
        left: "50%",
        transform: "translateX(-50%)",
      }}
      className="fixed flex items-center justify-center px-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-40"
    />
  );
}

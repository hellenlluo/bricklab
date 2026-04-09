function Divider() {
  return <hr className="border-zinc-200 dark:border-zinc-800 my-3" />;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
      {children}
    </h3>
  );
}

function ShortcutRow({
  keys,
  action,
  note,
}: {
  keys: string[];
  action: string;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div>
        <span className="text-xs text-zinc-700 dark:text-zinc-300">
          {action}
        </span>
        {note && (
          <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {note}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 ml-4 flex-shrink-0">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-700 dark:text-zinc-300 leading-tight">
              {k}
            </kbd>
            {i < keys.length - 1 && (
              <span className="text-[10px] text-zinc-400">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="flex flex-col h-[60vh]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Docs
        </span>
      </div>

      {/* Content */}
      <div className="overflow-y-auto px-4 py-3 flex-1">
        {/* Shortcuts — main section */}
        <SectionHeader>Keyboard &amp; mouse shortcuts</SectionHeader>

        <ShortcutRow keys={["⌘ / Ctrl", "G"]} action="Group selected bricks" />

        <ShortcutRow keys={["Left drag"]} action="Orbit camera" />
        <ShortcutRow keys={["Right drag"]} action="Pan camera" />
        <ShortcutRow keys={["Scroll"]} action="Zoom in / out" />

        <ShortcutRow keys={["Click"]} action="Select brick" />
        <ShortcutRow keys={["Shift", "Click"]} action="Add to selection" />
        <ShortcutRow
          keys={["Double-click"]}
          action="Drill into group"
          note="Continue double-clicking to reach individual bricks inside nested groups"
        />
        <ShortcutRow keys={["Click empty"]} action="Deselect all" />

        <ShortcutRow keys={["Enter"]} action="Confirm rename / input" />
        <ShortcutRow keys={["Escape"]} action="Cancel rename / input" />
        <ShortcutRow keys={["Double-click name"]} action="Rename" />

        {/* Feature notes */}
        <div className="flex flex-col gap-4 mt-4">
          <div>
            <SectionHeader>Library</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Browse preset bricks or define a custom brick size. Clicking a
              card adds the brick to the active scene at the origin.
            </p>
          </div>

          <div>
            <SectionHeader>Quick Add Toolbar</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Pin up to 6 brick types for one-click placement. Open the ▶
              selector at the left of the toolbar to change which bricks are
              pinned.
            </p>
          </div>

          <div>
            <SectionHeader>Groups</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Select multiple bricks and press ⌘G / Ctrl+G to group them. Groups
              appear as collapsible nodes in the Assets panel. Hover a group row
              and click ✕ to ungroup.
            </p>
          </div>

          <div>
            <SectionHeader>Properties &amp; Scene Settings</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Select a brick to reveal its properties on the right sidebar. When
              nothing is selected the panel shows scene-wide settings. Brick
              coordinates refer to the top-left corner of the brick as seen from
              the positive Z axis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

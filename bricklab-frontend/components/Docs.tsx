import { useEffect, useRef, useState } from "react";

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
      <div className="min-w-0">
        <span className="text-xs text-zinc-700 dark:text-zinc-300">
          {action}
        </span>
        {note && (
          <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {note}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
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

function ShortcutColumn({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-w-0">{children}</div>;
}

export default function Docs() {
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    const shortcutsElement = shortcutsRef.current;
    if (!shortcutsElement) return;

    const updateContentHeight = () => {
      setContentHeight(shortcutsElement.offsetHeight + 24);
    };

    updateContentHeight();

    const resizeObserver = new ResizeObserver(updateContentHeight);
    resizeObserver.observe(shortcutsElement);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Docs
        </span>
      </div>

      {/* Content */}
      <div
        className="overflow-y-auto px-3 py-3"
        style={contentHeight ? { height: `${contentHeight}px` } : undefined}
      >
        <div ref={shortcutsRef}>
          <SectionHeader>Keyboard &amp; mouse shortcuts</SectionHeader>

          <div className="grid grid-cols-2 gap-x-5 gap-y-0">
            {/* Left column — camera & selection */}
            <ShortcutColumn>
              <ShortcutRow keys={["Left drag"]} action="Orbit camera" />
              <ShortcutRow keys={["Right drag"]} action="Pan camera" />
              <ShortcutRow keys={["Scroll"]} action="Zoom in / out" />
              <ShortcutRow keys={["Click"]} action="Select brick" />
              <ShortcutRow
                keys={["Shift", "Click"]}
                action="Multi-select / add to selection"
              />
              <ShortcutRow
                keys={["Double-click"]}
                action="Drill into group"
                note="Repeat to reach nested bricks"
              />
              <ShortcutRow keys={["Click empty"]} action="Deselect all" />
              <ShortcutRow
                keys={["Alt", "Click"]}
                action="Mark background point"
                note="Image-to-3D segmentation only"
              />
            </ShortcutColumn>

            {/* Right column — actions & editing */}
            <ShortcutColumn>
              <ShortcutRow keys={["⌘ / Ctrl", "G"]} action="Group selected" />
              <ShortcutRow keys={["⌘ / Ctrl", "Z"]} action="Undo" />
              <ShortcutRow keys={["⌘ / Ctrl", "C"]} action="Copy selected" />
              <ShortcutRow
                keys={["⌘ / Ctrl", "V"]}
                action="Paste copied assets"
              />
              <ShortcutRow keys={["Del / ⌫"]} action="Remove selected" />
              <ShortcutRow keys={["Enter"]} action="Confirm input" />
              <ShortcutRow keys={["Escape"]} action="Cancel input" />
              <ShortcutRow keys={["Dbl-click name"]} action="Rename" />
            </ShortcutColumn>
          </div>
        </div>

        {/* Feature notes */}
        <div className="flex flex-col gap-4 mt-5">
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
            <SectionHeader>Exporter</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Export the current scene or individual bricks. Choose a format and
              click <em>Download</em>.
            </p>
          </div>

          <div>
            <SectionHeader>Scenes</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Manage multiple scenes from the left sidebar. Click a scene to
              switch to it, double-click the name to rename, or click <em>✕</em>{" "}
              to delete.
            </p>
          </div>

          <div>
            <SectionHeader>Assets &amp; Groups</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              The Assets panel lists every brick and group in the active scene.
              Select multiple bricks and press ⌘G / Ctrl+G to group them. Drag
              an asset onto a group to move it inside. Hover a group row and
              click <em>✕</em> to ungroup.
            </p>
          </div>

          <div>
            <SectionHeader>Constraints</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Define bounding-box constraints that limit where the text-to-3D
              generator may place bricks. Open the <em>Constraints</em> panel in
              the left sidebar to create, select, or delete constraints.
            </p>
          </div>

          <div>
            <SectionHeader>Coordinate System &amp; Grid</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Brick positions use the top-left corner of the brick when viewed
              from the positive Z axis. Group positions use the top-left corner
              of the selected group bounding box from that same top-down view.
              Baseplate sizes are restricted to even numbers so brick placements
              stay aligned to the stud grid and do not shift onto half-stud
              offsets after a size change.
            </p>
          </div>

          <div>
            <SectionHeader>Properties &amp; Scene Settings</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Select a brick (or group of bricks) to reveal its properties on
              the right sidebar. The panel shows scene-wide settings when
              nothing is selected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

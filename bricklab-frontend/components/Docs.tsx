import { useLayoutEffect, useRef, useState } from "react";

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
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-400 dark:border-zinc-600 last:border-0">
      <div className="min-w-0">
        <span className="text-xs text-zinc-700 dark:text-zinc-300">
          {action}
        </span>
        {note && (
          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500 mt-0.5">
            {note}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-600 rounded-none text-zinc-700 dark:text-zinc-300 leading-tight">
              {k}
            </kbd>
            {i < keys.length - 1 && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-500">
                +
              </span>
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
  const cardHeaderRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const [isMeasured, setIsMeasured] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      if (
        !cardHeaderRef.current ||
        !scrollAreaRef.current ||
        !shortcutsRef.current
      )
        return;
      const headerHeight = cardHeaderRef.current.offsetHeight;
      const shortcutsHeight = shortcutsRef.current.offsetHeight;
      const scrollStyle = window.getComputedStyle(scrollAreaRef.current);
      const paddingTop = Number.parseFloat(scrollStyle.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(scrollStyle.paddingBottom) || 0;
      setCardHeight(
        Math.ceil(headerHeight + paddingTop + shortcutsHeight + paddingBottom),
      );
      setIsMeasured(true);
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      className={`flex flex-col ${isMeasured ? "" : "invisible"}`}
      style={cardHeight ? { height: `${cardHeight}px` } : undefined}
    >
      {/* Header */}
      <div
        ref={cardHeaderRef}
        className="px-3 py-3 border-b border-zinc-400 dark:border-zinc-600"
      >
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Docs
        </span>
      </div>

      {/* Content */}
      <div
        ref={scrollAreaRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
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
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              Browse a catalog of preset brick sizes or enter custom width and
              height values to define your own. Clicking any brick card
              immediately adds it to the active scene at the world origin (0, 0,
              0). From there, reposition it by dragging in the viewport, typing
              exact coordinates into the right sidebar, or using the Properties
              panel. Custom dimensions are remembered for the session, so you
              can quickly add several bricks of the same unusual size in a row.
            </p>
          </div>

          <div>
            <SectionHeader>Quick Add Toolbar</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              The toolbar across the bottom of the viewport gives you up to 6
              pinned brick slots for one-click placement without opening the
              Library. Click the ▶ selector at the far left to open the pin
              picker and swap any slot to a different brick size. Each slot
              retains your last choice across placements, so your most-used
              sizes stay readily accessible. Pinned bricks are added at the
              origin, just like Library cards.
            </p>
          </div>

          <div>
            <SectionHeader>Exporter</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              Export the entire scene or only the currently selected bricks.
              Pick an output format from the dropdown — available options
              include common 3D mesh formats as well as instruction-friendly
              layouts suited for step-by-step build guides — then click{" "}
              <em>Download</em> to save the file locally. If nothing is selected
              the full scene is exported. Large scenes may take a moment to
              package; the button shows a loading state while the file is being
              prepared.
            </p>
          </div>

          <div>
            <SectionHeader>Scenes</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              The left sidebar lets you manage as many scenes as you need. Click
              a scene row to switch to it — all panels, the viewport, and the
              asset list update immediately. Double-click the scene name to
              rename it inline and press Enter to confirm. Click <em>✕</em> on a
              row to delete that scene permanently (this cannot be undone). Each
              scene stores its own brick layout, baseplate dimensions,
              background color, and last camera position independently, so you
              can maintain separate designs without them interfering with each
              other.
            </p>
          </div>

          <div>
            <SectionHeader>Assets &amp; Groups</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              The Assets panel on the left lists every top-level brick and group
              in the active scene. Select one or more bricks in the viewport or
              in the list, then press ⌘G / Ctrl+G to collect them into a named
              group. You can drag any asset row onto a group row to nest it
              inside. To dissolve a group without deleting its contents, hover
              the group row and click <em>✕</em> (ungroup). Groups support
              arbitrary nesting, so you can build complex hierarchies — for
              example, grouping wheels into an axle assembly and then grouping
              axle assemblies into a chassis — and move or copy entire
              sub-assemblies as a single unit.
            </p>
          </div>

          <div>
            <SectionHeader>Constraints</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              Constraints are named bounding boxes that tell the AI generator
              exactly where it is allowed to place bricks. Open the{" "}
              <em>Constraints</em> panel in the left sidebar to draw a new box
              by entering its position, width, depth, and height, then save it
              with a memorable name. In the Generator panel, select a saved
              constraint from the dropdown before clicking Generate; the model
              will confine all output bricks to that volume. This is especially
              useful when you want generated structures to fit a specific gap in
              an existing build or to stay within a defined footprint.
            </p>
          </div>

          <div>
            <SectionHeader>Coordinate System &amp; Grid</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              All brick positions are measured from the brick&apos;s top-left
              corner when the scene is viewed from directly above (looking down
              the positive Z axis). Group positions similarly reference the
              top-left corner of the group&apos;s bounding box in that same
              top-down projection. Baseplate sizes are restricted to even
              numbers to keep every brick snapped to a whole-stud grid position
              — odd values would cause the grid to shift by half a stud whenever
              the baseplate is resized. The XYZ axes indicator shown in the
              viewport&apos;s corner updates as you orbit, making it easy to
              stay oriented when inspecting the model from unusual angles.
            </p>
          </div>

          <div>
            <SectionHeader>Properties &amp; Scene Settings</SectionHeader>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              Selecting one or more bricks (or a group) fills the right sidebar
              with that element&apos;s editable properties: X / Y / Z position,
              width, height, color, and layer order. When multiple bricks with
              differing values are selected, the field shows a placeholder and
              any value you type is applied uniformly to all of them. With
              nothing selected, the sidebar switches to scene-wide settings such
              as baseplate size and background color. All property changes take
              effect immediately in the viewport and are fully undoable with ⌘Z
              / Ctrl+Z.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

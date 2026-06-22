"use client";

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useScene } from "@/store/sceneStore";
import type { Constraint, ConstraintBox } from "@/store/sceneStore";

const WORLD_DIM = 20;
const BUILDER_CAM_POS: [number, number, number] = [52.8, -52.8, 52.8];
const BUILDER_FOV = 35;
const CONSTRAINT_COLOR = "#FFAB91";
const CONSTRAINT_EDGE_COLOR = "#FF8A65";
const GRID_COLOR = "#7ec8e3";
const CONTROL_INPUT_CLASS = "";
const CONTROL_BUTTON_CLASS = "flex items-center justify-center shrink-0";

interface ConstraintBuilderProps {
  existing: Constraint | null;
  onClose: () => void;
}

function BoundingGrid() {
  return (
    <group position={[WORLD_DIM / 2, -WORLD_DIM / 2, WORLD_DIM / 2]}>
      <mesh>
        <boxGeometry args={[WORLD_DIM, WORLD_DIM, WORLD_DIM]} />
        <meshBasicMaterial
          color={GRID_COLOR}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(WORLD_DIM, WORLD_DIM, WORLD_DIM)]}
        />
        <lineBasicMaterial
          color={GRID_COLOR}
          transparent
          opacity={0.5}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </lineSegments>
      {[0, 1].flatMap((xi) =>
        [0, 1].flatMap((yi) =>
          [0, 1].map((zi) => (
            <mesh
              key={`${xi}-${yi}-${zi}`}
              position={[
                (xi - 0.5) * WORLD_DIM,
                (yi - 0.5) * WORLD_DIM,
                (zi - 0.5) * WORLD_DIM,
              ]}
            >
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial
                color={GRID_COLOR}
                polygonOffset
                polygonOffsetFactor={2}
                polygonOffsetUnits={2}
              />
            </mesh>
          )),
        ),
      )}
    </group>
  );
}

function BuilderAxes() {
  const axes = useMemo(() => {
    const group = new THREE.Group();
    const d = WORLD_DIM * 0.2;
    const makeAxis = (color: number, to: [number, number, number]) => {
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...to)];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        depthTest: true,
      });
      return new THREE.Line(geom, mat);
    };
    group.add(makeAxis(0xff0000, [d, 0, 0]));
    group.add(makeAxis(0x00ff00, [0, d, 0]));
    group.add(makeAxis(0x0000ff, [0, 0, d]));
    return group;
  }, []);
  return <primitive object={axes} />;
}

const noRaycast = () => {};

function ConstraintBoxMesh({
  box,
  isSelected,
  onSelect,
}: {
  box: ConstraintBox;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cx = box.posX + box.sizeX / 2;
  const cy = -(box.posY + box.sizeY / 2);
  const cz = box.posZ + box.sizeZ / 2;

  return (
    <group
      name={`cbox-${box.id}`}
      position={[cx, cy, cz]}
      onClick={
        isSelected
          ? undefined
          : (e) => {
              e.stopPropagation();
              onSelect();
            }
      }
    >
      <mesh raycast={isSelected ? noRaycast : undefined}>
        <boxGeometry args={[box.sizeX, box.sizeY, box.sizeZ]} />
        <meshBasicMaterial
          color={CONSTRAINT_COLOR}
          transparent
          opacity={isSelected ? 0.3 : 0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(box.sizeX, box.sizeY, box.sizeZ)]}
        />
        <lineBasicMaterial
          color={CONSTRAINT_EDGE_COLOR}
          linewidth={isSelected ? 2 : 1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </lineSegments>
      {[0, 1].flatMap((xi) =>
        [0, 1].flatMap((yi) =>
          [0, 1].map((zi) => (
            <mesh
              key={`cv-${xi}-${yi}-${zi}`}
              raycast={isSelected ? noRaycast : undefined}
              position={[
                (xi - 0.5) * box.sizeX,
                (yi - 0.5) * box.sizeY,
                (zi - 0.5) * box.sizeZ,
              ]}
            >
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshBasicMaterial
                color={CONSTRAINT_EDGE_COLOR}
                polygonOffset
                polygonOffsetFactor={1}
                polygonOffsetUnits={1}
              />
            </mesh>
          )),
        ),
      )}
    </group>
  );
}

function BuilderControls({
  boxes,
  selectedBoxId,
  onBoxMove,
}: {
  boxes: ConstraintBox[];
  selectedBoxId: string | null;
  onBoxMove: (id: string, x: number, y: number, z: number) => void;
}) {
  const orbRef = useRef<OrbitControlsImpl>(null);
  const [handle] = useState(() => new THREE.Group());
  const selectedBoxRef = useRef<ConstraintBox | null>(null);
  const isDragging = useRef(false);
  const { invalidate } = useThree();

  const selectedBox = boxes.find((b) => b.id === selectedBoxId) ?? null;

  useEffect(() => {
    selectedBoxRef.current = selectedBox;
  }, [selectedBox]);

  useEffect(() => {
    if (selectedBox) {
      handle.position.set(
        selectedBox.posX + selectedBox.sizeX / 2,
        -(selectedBox.posY + selectedBox.sizeY / 2),
        selectedBox.posZ + selectedBox.sizeZ / 2,
      );
      invalidate();
    }
  }, [selectedBox, handle, invalidate]);

  const handleDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleChange = useCallback(() => {
    const box = selectedBoxRef.current;
    if (!box || !isDragging.current) return;
    const { sizeX, sizeY, sizeZ } = box;
    const pos = handle.position;
    pos.set(
      Math.max(sizeX / 2, Math.min(WORLD_DIM - sizeX / 2, pos.x)),
      Math.max(-(WORLD_DIM - sizeY / 2), Math.min(-sizeY / 2, pos.y)),
      Math.max(sizeZ / 2, Math.min(WORLD_DIM - sizeZ / 2, pos.z)),
    );
    const newX = Math.max(
      0,
      Math.min(WORLD_DIM - sizeX, Math.round(pos.x - sizeX / 2)),
    );
    const newY = Math.max(
      0,
      Math.min(WORLD_DIM - sizeY, Math.round(-pos.y - sizeY / 2)),
    );
    const newZ = Math.max(
      0,
      Math.min(WORLD_DIM - sizeZ, Math.round(pos.z - sizeZ / 2)),
    );
    if (newX !== box.posX || newY !== box.posY || newZ !== box.posZ) {
      onBoxMove(box.id, newX, newY, newZ);
    }
  }, [handle, onBoxMove]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    orb.target.set(WORLD_DIM / 2, -WORLD_DIM / 2, WORLD_DIM / 2);
    orb.update();
  }, []);

  return (
    <>
      <primitive object={handle} />
      <TransformControls
        object={handle}
        size={0.5}
        visible={!!selectedBox}
        showX={!!selectedBox}
        showY={!!selectedBox}
        showZ={!!selectedBox}
        enabled={!!selectedBox}
        onMouseDown={handleDragStart}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
      />
      <OrbitControls
        ref={orbRef}
        makeDefault
        enableDamping
        dampingFactor={0.1}
      />
    </>
  );
}

function BuilderScene({
  boxes,
  selectedBoxId,
  onSelectBox,
  onBoxMove,
}: {
  boxes: ConstraintBox[];
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  onBoxMove: (id: string, x: number, y: number, z: number) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, -10, 25]} intensity={1} />
      <BuilderControls
        boxes={boxes}
        selectedBoxId={selectedBoxId}
        onBoxMove={onBoxMove}
      />
      <BoundingGrid />
      {boxes.map((box) => (
        <ConstraintBoxMesh
          key={box.id}
          box={box}
          isSelected={box.id === selectedBoxId}
          onSelect={() => onSelectBox(box.id)}
        />
      ))}
      <BuilderAxes />
    </>
  );
}

function clampDim(val: number) {
  return Math.max(1, Math.min(WORLD_DIM, val));
}

function getDefaultConstraintName(constraints: Constraint[]) {
  const usedNumbers = new Set(
    constraints.flatMap((constraint) => {
      const match = /^Constraint (\d+)$/.exec(constraint.name.trim());
      return match ? [parseInt(match[1], 10)] : [];
    }),
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return `Constraint ${nextNumber}`;
}

export default function ConstraintBuilder({
  existing,
  onClose,
}: ConstraintBuilderProps) {
  const { constraints, addConstraint, updateConstraint } = useScene();
  const defaultName = existing?.name ?? getDefaultConstraintName(constraints);

  const [name, setName] = useState(defaultName);
  const [boxes, setBoxes] = useState<ConstraintBox[]>(existing?.boxes ?? []);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  const [newSizeX, setNewSizeX] = useState(4);
  const [newSizeY, setNewSizeY] = useState(4);
  const [newSizeZ, setNewSizeZ] = useState(4);
  const portalReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  function handleAddBox() {
    const sx = clampDim(newSizeX);
    const sy = clampDim(newSizeY);
    const sz = clampDim(newSizeZ);
    const px = Math.round(
      Math.max(0, Math.min(WORLD_DIM - sx, (WORLD_DIM - sx) / 2)),
    );
    const py = Math.round(
      Math.max(0, Math.min(WORLD_DIM - sy, (WORLD_DIM - sy) / 2)),
    );
    const pz = Math.round(
      Math.max(0, Math.min(WORLD_DIM - sz, (WORLD_DIM - sz) / 2)),
    );
    const id = `box-${Date.now()}`;
    const newBox: ConstraintBox = {
      id,
      sizeX: sx,
      sizeY: sy,
      sizeZ: sz,
      posX: px,
      posY: py,
      posZ: pz,
    };
    setBoxes((prev) => [...prev, newBox]);
    setSelectedBoxId(id);
  }

  function handleRemoveBox(id: string) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedBoxId((prev) => (prev === id ? null : prev));
  }

  function handleBoxMove(id: string, x: number, y: number, z: number) {
    setBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, posX: x, posY: y, posZ: z } : b)),
    );
  }

  function handleBoxSizeChange(id: string, axis: "x" | "y" | "z", raw: string) {
    const val = clampDim(parseInt(raw) || 1);
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b };
        if (axis === "x") updated.sizeX = val;
        if (axis === "y") updated.sizeY = val;
        if (axis === "z") updated.sizeZ = val;
        updated.posX = Math.min(updated.posX, WORLD_DIM - updated.sizeX);
        updated.posY = Math.min(updated.posY, WORLD_DIM - updated.sizeY);
        updated.posZ = Math.min(updated.posZ, WORLD_DIM - updated.sizeZ);
        return updated;
      }),
    );
  }

  function handleSave() {
    const constraintName = name.trim() || defaultName;
    if (existing) {
      updateConstraint(existing.id, { name: constraintName, boxes });
    } else {
      addConstraint({
        id: `constraint-${Date.now()}`,
        name: constraintName,
        boxes,
      });
    }
    onClose();
  }

  const modal = (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center bg-black/40"
      style={{ top: "7.5vh" }}
      onClick={onClose}
    >
      <div
        className="w-[44vw] rounded-none border border-border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-[64vh]">
          {/* Header */}
          <div className="px-3 py-3 border-b border-border">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {existing ? "Edit Constraint" : "New Constraint"}
            </span>
          </div>

          {/* Name + Add Box controls */}
          <div className="flex gap-2 px-3 pt-3 pb-0 items-end">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-muted-foreground">Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Constraint name"
                className={CONTROL_INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <label className="text-[10px] text-muted-foreground text-center w-full">
                X
              </label>
              <Input
                type="number"
                min={1}
                max={WORLD_DIM}
                value={newSizeX}
                onChange={(e) =>
                  setNewSizeX(clampDim(parseInt(e.target.value) || 1))
                }
                className={`w-14 text-center ${CONTROL_INPUT_CLASS}`}
              />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <label className="text-[10px] text-muted-foreground text-center w-full">
                Y
              </label>
              <Input
                type="number"
                min={1}
                max={WORLD_DIM}
                value={newSizeY}
                onChange={(e) =>
                  setNewSizeY(clampDim(parseInt(e.target.value) || 1))
                }
                className={`w-14 text-center ${CONTROL_INPUT_CLASS}`}
              />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <label className="text-[10px] text-muted-foreground text-center w-full">
                Z
              </label>
              <Input
                type="number"
                min={1}
                max={WORLD_DIM}
                value={newSizeZ}
                onChange={(e) =>
                  setNewSizeZ(clampDim(parseInt(e.target.value) || 1))
                }
                className={`w-14 text-center ${CONTROL_INPUT_CLASS}`}
              />
            </div>
            <Button
              onClick={handleAddBox}
              className={`whitespace-nowrap ${CONTROL_BUTTON_CLASS}`}
            >
              + Add Box
            </Button>
          </div>

          {/* 3D Viewport */}
          <div className="relative flex-1 min-h-0 mx-3 mt-3 mb-3 rounded-none border border-border bg-muted overflow-hidden">
            {/* Box selector + details overlay */}
            {boxes.length > 0 && (
              <div className="absolute top-2 left-2 z-10 flex gap-2 items-center h-9 px-2.5 rounded-none bg-background/90 border border-border backdrop-blur-sm">
                <select
                  value={selectedBoxId ?? ""}
                  onChange={(e) => setSelectedBoxId(e.target.value || null)}
                  className="text-xs bg-transparent outline-none text-foreground cursor-pointer"
                >
                  <option value="">Select a constraint box</option>
                  {boxes.map((box, idx) => (
                    <option key={box.id} value={box.id}>
                      Box {idx + 1} ({box.sizeX}×{box.sizeY}×{box.sizeZ})
                    </option>
                  ))}
                </select>
                {selectedBox && (
                  <>
                    <div className="flex gap-1 items-center">
                      <Input
                        type="number"
                        min={1}
                        max={WORLD_DIM}
                        value={selectedBox.sizeX}
                        onChange={(e) =>
                          handleBoxSizeChange(
                            selectedBox.id,
                            "x",
                            e.target.value,
                          )
                        }
                        className="w-12 text-center"
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        min={1}
                        max={WORLD_DIM}
                        value={selectedBox.sizeY}
                        onChange={(e) =>
                          handleBoxSizeChange(
                            selectedBox.id,
                            "y",
                            e.target.value,
                          )
                        }
                        className="w-12 text-center"
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        min={1}
                        max={WORLD_DIM}
                        value={selectedBox.sizeZ}
                        onChange={(e) =>
                          handleBoxSizeChange(
                            selectedBox.id,
                            "z",
                            e.target.value,
                          )
                        }
                        className="w-12 text-center"
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      ({selectedBox.posX}, {selectedBox.posY},{" "}
                      {selectedBox.posZ})
                    </span>
                    <button
                      onClick={() => handleRemoveBox(selectedBox.id)}
                      title="Delete box"
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      style={{ fontSize: "0.55rem", lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            )}
            <Canvas
              camera={{
                position: BUILDER_CAM_POS,
                fov: BUILDER_FOV,
                up: [0, 0, 1],
              }}
              gl={{ antialias: true }}
              style={{ width: "100%", height: "100%" }}
              onPointerMissed={() => setSelectedBoxId(null)}
            >
              <color attach="background" args={["#f4f4f5"]} />
              <BuilderScene
                boxes={boxes}
                selectedBoxId={selectedBoxId}
                onSelectBox={setSelectedBoxId}
                onBoxMove={handleBoxMove}
              />
            </Canvas>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end px-3 pb-3">
            <Button onClick={onClose} className={CONTROL_BUTTON_CLASS}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={boxes.length === 0}
              className={CONTROL_BUTTON_CLASS}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!portalReady) return null;
  return createPortal(modal, document.body);
}

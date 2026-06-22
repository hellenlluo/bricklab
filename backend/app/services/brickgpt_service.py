"""Lazy-loading singleton wrapper around BrickGPT inference.

Constraint enforcement is integrated directly into BrickGPT's per-brick
rejection-sampling loop so that invalid placements are never committed to
the scene state.  The approach monkey-patches ``_try_adding_brick`` on the
model instance for the duration of a constrained call, letting the existing
rollback / temperature-escalation machinery handle resampling automatically.
"""

import sys
import threading
from collections import Counter
from pathlib import Path
from typing import Callable, TypedDict

BRICKGPT_SRC = Path(__file__).resolve().parents[2] / "external" / "BrickGPT" / "src"
if str(BRICKGPT_SRC) not in sys.path:
    sys.path.insert(0, str(BRICKGPT_SRC))

from brickgpt.data import Brick, BrickStructure  # noqa: E402
from brickgpt.models import BrickGPT, BrickGPTConfig  # noqa: E402

_model: BrickGPT | None = None
_model_lock = threading.Lock()

# Threshold for the total number of constraint-caused rejections above which
# the returned result is flagged as potentially incomplete.
_CONSTRAINT_REJECTION_WARNING_THRESHOLD = 200


class _ConstraintBox(TypedDict):
    """Axis-aligned bounding box representing an exclusion volume."""
    pos_x: float
    pos_y: float
    pos_z: float
    size_x: float
    size_y: float
    size_z: float


def get_model() -> BrickGPT:
    """Return the shared BrickGPT instance, creating it on first call."""
    global _model
    if _model is None:
        cfg = BrickGPTConfig(
            model_name_or_path="AvaLovelace/BrickGPT",
            use_gurobi=False,
            device="auto",
        )
        _model = BrickGPT(cfg)
    return _model


def _brick_intersects_constraint(
    h: int,
    w: int,
    x: int,
    y: int,
    z: int,
    box: _ConstraintBox,
) -> bool:
    """Return True if the brick volume overlaps the AABB exclusion box.

    Brick occupies:  x∈[x, x+h),  y∈[y, y+w),  z∈[z, z+1)
    Box occupies:    x∈[px, px+sx), y∈[py, py+sy), z∈[pz, pz+sz)
    Two intervals [a,b) and [c,d) overlap iff a < d and c < b.
    """
    px, py, pz = box["pos_x"], box["pos_y"], box["pos_z"]
    sx, sy, sz = box["size_x"], box["size_y"], box["size_z"]

    return (
        x < px + sx and px < x + h
        and y < py + sy and py < y + w
        and z < pz + sz and pz < z + 1
    )


def _brick_in_any_constraint(
    h: int, w: int, x: int, y: int, z: int, boxes: list[_ConstraintBox]
) -> bool:
    return any(_brick_intersects_constraint(h, w, x, y, z, box) for box in boxes)


def generate_bricks(
    prompt: str,
    constraints: list[_ConstraintBox] | None = None,
) -> dict:
    """Run BrickGPT inference with inline spatial-constraint rejection.

    When *constraints* is non-empty, each candidate brick placement is
    checked for intersection with every exclusion volume **inside**
    BrickGPT's own rejection-sampling loop.  A violation causes the LLM
    state to roll back and a new candidate to be sampled, ensuring that
    invalid placements are never materialised.

    A lightweight post-generation sweep removes any bricks that still
    violate constraints (possible when the per-brick retry budget is
    exhausted) so the caller always receives a clean result.

    Returns ``{"bricks": [...], "partial": bool, "warning": str | None}``.
    """
    model = get_model()

    if not constraints:
        with _model_lock:
            output = model(prompt)
        return {
            "bricks": [
                {"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z}
                for b in output["bricks"].bricks
            ],
            "partial": False,
            "warning": None,
        }

    # --- Constrained path: inject constraint check into rejection loop -------

    orig_try = BrickGPT._try_adding_brick
    constraint_boxes = constraints

    def _constrained_try_adding_brick(brick_str, bricks, rejected_bricks):
        result = orig_try(brick_str, bricks, rejected_bricks)
        if result != "success":
            return result
        try:
            brick = Brick.from_txt(brick_str)
        except ValueError:
            return "ill_formatted"
        if _brick_in_any_constraint(
            brick.h, brick.w, brick.x, brick.y, brick.z, constraint_boxes
        ):
            return "constraint_violation"
        return "success"

    with _model_lock:
        model._try_adding_brick = _constrained_try_adding_brick
        try:
            output = model(prompt)
        finally:
            try:
                del model._try_adding_brick
            except AttributeError:
                pass

    brick_structure = output["bricks"]
    constraint_rejections = output["rejection_reasons"].get(
        "constraint_violation", 0
    )

    # Safety sweep — catch any bricks that slipped through when the per-brick
    # retry budget was exhausted.
    accepted: list[dict] = []
    post_sweep_removals = 0
    for b in brick_structure.bricks:
        if _brick_in_any_constraint(
            b.h, b.w, b.x, b.y, b.z, constraint_boxes
        ):
            post_sweep_removals += 1
        else:
            accepted.append(
                {"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z}
            )

    total_rejections = constraint_rejections + post_sweep_removals
    partial = total_rejections > 0
    warning: str | None = None
    if total_rejections >= _CONSTRAINT_REJECTION_WARNING_THRESHOLD:
        warning = (
            f"Constraint enforcement required {total_rejections} brick "
            "rejection(s). The returned structure may be incomplete due to "
            "overly restrictive constraints."
        )
    elif total_rejections > 0:
        warning = (
            f"{total_rejections} brick placement(s) were re-sampled during "
            "generation due to constraint violations."
        )

    return {"bricks": accepted, "partial": partial, "warning": warning}


def generate_from_prefix(
    prompt: str,
    prefix_bricks: list[dict],
    constraints: list[_ConstraintBox] | None = None,
) -> dict:
    """Continue BrickGPT generation from an edited prefix.

    Builds a ``BrickStructure`` from *prefix_bricks* and feeds it to
    BrickGPT with the same stability-rollback loop that normal generation
    uses, so physically unstable continuations are re-attempted.

    Returns ``{"bricks": [...], "prefix_count": int, "partial": bool,
    "warning": str | None}``.  The ``bricks`` list contains **all** bricks
    (prefix + newly generated).
    """
    model = get_model()
    prefix_count = len(prefix_bricks)

    # Re-normalize so the prefix starts at z=0 (the model's training
    # distribution always begins structures on the ground plane).
    z_min = min((b["z"] for b in prefix_bricks), default=0)
    prefix_objs = [
        Brick(h=b["h"], w=b["w"], x=b["x"], y=b["y"], z=b["z"] - z_min)
        for b in prefix_bricks
    ]

    constraint_boxes = constraints or []
    if z_min != 0 and constraint_boxes:
        constraint_boxes = [
            {**box, "pos_z": box["pos_z"] - z_min}
            for box in constraint_boxes
        ]

    # Optionally patch _try_adding_brick for constraint enforcement.
    orig_try = BrickGPT._try_adding_brick

    def _constrained_try(brick_str, bricks, rejected_bricks):
        result = orig_try(brick_str, bricks, rejected_bricks)
        if result != "success":
            return result
        try:
            brick = Brick.from_txt(brick_str)
        except ValueError:
            return "ill_formatted"
        if _brick_in_any_constraint(
            brick.h, brick.w, brick.x, brick.y, brick.z, constraint_boxes
        ):
            return "constraint_violation"
        return "success"

    total_rejection_reasons: Counter = Counter()

    with _model_lock:
        if constraint_boxes:
            model._try_adding_brick = _constrained_try
        try:
            # Mirror the stability-rollback loop from BrickGPT.__call__
            starting = BrickStructure(list(prefix_objs))
            structure: BrickStructure | None = None

            for _regen in range(model.max_regenerations + 1):
                structure, reasons = model._generate_structure(
                    prompt, starting_bricks=starting,
                )
                total_rejection_reasons.update(reasons)

                if model.max_regenerations == 0 or model._is_stable(structure):
                    break

                # Roll back to last stable point, but never below the prefix.
                # If the prefix contains colliding bricks, connectivity scoring
                # raises ValueError — accept the current output as-is.
                try:
                    rollback = model._remove_all_bricks_after_first_unstable_brick(
                        structure,
                    )
                except ValueError:
                    break
                if len(rollback) < prefix_count:
                    rollback = BrickStructure(list(prefix_objs))
                starting = rollback
        finally:
            if constraint_boxes:
                try:
                    del model._try_adding_brick
                except AttributeError:
                    pass

    assert structure is not None

    # Post-generation constraint sweep (still in normalized coords)
    accepted: list[dict] = []
    post_sweep_removals = 0
    for b in structure.bricks:
        if constraint_boxes and _brick_in_any_constraint(
            b.h, b.w, b.x, b.y, b.z, constraint_boxes
        ):
            post_sweep_removals += 1
        else:
            # Shift z back to the original coordinate space
            accepted.append(
                {"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z + z_min}
            )

    constraint_rejections = total_rejection_reasons.get(
        "constraint_violation", 0
    )
    total_rejections = constraint_rejections + post_sweep_removals
    partial = total_rejections > 0
    warning: str | None = None
    if total_rejections >= _CONSTRAINT_REJECTION_WARNING_THRESHOLD:
        warning = (
            f"Constraint enforcement required {total_rejections} brick "
            "rejection(s). The returned structure may be incomplete due to "
            "overly restrictive constraints."
        )
    elif total_rejections > 0:
        warning = (
            f"{total_rejections} brick placement(s) were re-sampled during "
            "generation due to constraint violations."
        )

    return {
        "bricks": accepted,
        "prefix_count": prefix_count,
        "partial": partial,
        "warning": warning,
    }


# ---------------------------------------------------------------------------
# Streaming generation
# ---------------------------------------------------------------------------

def generate_from_prefix_streaming(
    prompt: str,
    prefix_bricks: list[dict],
    constraints: list[_ConstraintBox] | None,
    on_event: Callable[[dict], None],
) -> None:
    """Stream BrickGPT continuation from an edited prefix as brick-by-brick SSE.

    Emits the same event types as ``generate_bricks_streaming`` but only for
    bricks added **after** the prefix.  Rollback ``keep_count`` values are
    expressed as total brick indices (prefix + generated so far) so the
    frontend can slice its full list.

    The ``done`` event also includes ``"prefix_count"`` so the caller knows
    which leading bricks were fixed vs. generated.
    """
    model = get_model()
    prefix_count = len(prefix_bricks)

    # Re-normalize so the prefix starts at z=0 (model training distribution).
    z_min = min((b["z"] for b in prefix_bricks), default=0)
    prefix_objs = [
        Brick(h=b["h"], w=b["w"], x=b["x"], y=b["y"], z=b["z"] - z_min)
        for b in prefix_bricks
    ]

    constraint_boxes = constraints or []
    if z_min != 0 and constraint_boxes:
        constraint_boxes = [
            {**box, "pos_z": box["pos_z"] - z_min}
            for box in constraint_boxes
        ]

    orig_try = BrickGPT._try_adding_brick

    def _streaming_try(brick_str: str, bricks, rejected_bricks) -> str:
        result = orig_try(brick_str, bricks, rejected_bricks)

        if result == "success" and constraint_boxes:
            try:
                b = Brick.from_txt(brick_str)
                if _brick_in_any_constraint(b.h, b.w, b.x, b.y, b.z, constraint_boxes):
                    result = "constraint_violation"
            except Exception:
                pass

        try:
            b = Brick.from_txt(brick_str)
            # Shift z back to original coordinate space for the event payload.
            brick_dict: dict | None = {
                "h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z + z_min,
            }
        except Exception:
            brick_dict = None

        if result == "success":
            on_event({"type": "brick", "data": brick_dict})
        elif brick_dict is not None:
            on_event({"type": "reject", "data": brick_dict, "reason": result})

        return result

    rejection_reasons: Counter = Counter()

    with _model_lock:
        model._try_adding_brick = _streaming_try
        try:
            starting = BrickStructure(list(prefix_objs))
            structure: BrickStructure | None = None

            for _ in range(model.max_regenerations + 1):
                structure, reasons = model._generate_structure(
                    prompt, starting_bricks=starting,
                )
                rejection_reasons.update(reasons)

                if model.max_regenerations == 0 or model._is_stable(structure):
                    break

                try:
                    rollback = model._remove_all_bricks_after_first_unstable_brick(
                        structure,
                    )
                except ValueError:
                    break

                # Never roll back below the prefix.
                if len(rollback.bricks) < prefix_count:
                    rollback = BrickStructure(list(prefix_objs))

                # keep_count is total bricks to keep (prefix + surviving new bricks).
                on_event({"type": "rollback", "keep_count": len(rollback.bricks)})
                starting = rollback
        finally:
            try:
                del model._try_adding_brick
            except AttributeError:
                pass

    assert structure is not None

    # Post-generation constraint sweep (only for new bricks after the prefix).
    accepted_new: list[dict] = []
    post_sweep_removals = 0
    for b in structure.bricks[prefix_count:]:
        if constraint_boxes and _brick_in_any_constraint(
            b.h, b.w, b.x, b.y, b.z, constraint_boxes
        ):
            post_sweep_removals += 1
        else:
            accepted_new.append(
                {"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z + z_min}
            )

    total_rejections = (
        rejection_reasons.get("constraint_violation", 0) + post_sweep_removals
    )
    partial = total_rejections > 0
    warning: str | None = None
    if total_rejections >= _CONSTRAINT_REJECTION_WARNING_THRESHOLD:
        warning = (
            f"Constraint enforcement required {total_rejections} brick "
            "rejection(s). The returned structure may be incomplete due to "
            "overly restrictive constraints."
        )
    elif total_rejections > 0:
        warning = (
            f"{total_rejections} brick placement(s) were re-sampled during "
            "generation due to constraint violations."
        )

    on_event({
        "type": "done",
        "partial": partial,
        "warning": warning,
        "total_bricks": prefix_count + len(accepted_new),
        "prefix_count": prefix_count,
    })


def generate_bricks_streaming(
    prompt: str,
    constraints: list[_ConstraintBox] | None,
    on_event: Callable[[dict], None],
) -> None:
    """Run BrickGPT inference and fire *on_event* as each brick is resolved.

    Events emitted (all called from the executor thread; *on_event* must be
    thread-safe, e.g. ``loop.call_soon_threadsafe``):

    * ``{"type": "brick",    "data": {"h":…,"w":…,"x":…,"y":…,"z":…}}``
      — a brick was accepted and added to the structure.
    * ``{"type": "reject",   "data": {…}|None, "reason": str}``
      — a candidate brick was rejected during per-brick sampling.
      *data* is ``None`` when the candidate could not be parsed.
    * ``{"type": "rollback", "keep_count": int}``
      — the structure was physically unstable; bricks after index
      *keep_count* have been discarded and generation continues from
      the rollback point.
    * ``{"type": "done",     "partial": bool, "warning": str|None,
                              "total_bricks": int}``
      — generation finished (always the last event).
    """
    model = get_model()
    constraint_boxes = constraints or []
    orig_try = BrickGPT._try_adding_brick

    def _streaming_try(brick_str: str, bricks, rejected_bricks) -> str:
        result = orig_try(brick_str, bricks, rejected_bricks)

        # Constraint check (same logic as the constrained path).
        if result == "success" and constraint_boxes:
            try:
                b = Brick.from_txt(brick_str)
                if _brick_in_any_constraint(b.h, b.w, b.x, b.y, b.z, constraint_boxes):
                    result = "constraint_violation"
            except Exception:
                pass

        # Parse for event payload.
        try:
            b = Brick.from_txt(brick_str)
            brick_dict: dict | None = {"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z}
        except Exception:
            brick_dict = None

        if result == "success":
            on_event({"type": "brick", "data": brick_dict})
        elif brick_dict is not None:
            on_event({"type": "reject", "data": brick_dict, "reason": result})

        return result

    rejection_reasons: Counter = Counter()

    with _model_lock:
        model._try_adding_brick = _streaming_try
        try:
            starting = BrickStructure([])
            structure: BrickStructure | None = None

            for _ in range(model.max_regenerations + 1):
                structure, reasons = model._generate_structure(
                    prompt, starting_bricks=starting,
                )
                rejection_reasons.update(reasons)

                if model.max_regenerations == 0 or model._is_stable(structure):
                    break

                try:
                    rollback = model._remove_all_bricks_after_first_unstable_brick(structure)
                except ValueError:
                    break

                on_event({"type": "rollback", "keep_count": len(rollback.bricks)})
                starting = rollback
        finally:
            try:
                del model._try_adding_brick
            except AttributeError:
                pass

    assert structure is not None

    # Post-generation constraint sweep.
    accepted: list[dict] = []
    post_sweep_removals = 0
    for b in structure.bricks:
        if constraint_boxes and _brick_in_any_constraint(
            b.h, b.w, b.x, b.y, b.z, constraint_boxes
        ):
            post_sweep_removals += 1
        else:
            accepted.append({"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z})

    total_rejections = rejection_reasons.get("constraint_violation", 0) + post_sweep_removals
    partial = total_rejections > 0
    warning: str | None = None
    if total_rejections >= _CONSTRAINT_REJECTION_WARNING_THRESHOLD:
        warning = (
            f"Constraint enforcement required {total_rejections} brick "
            "rejection(s). The returned structure may be incomplete due to "
            "overly restrictive constraints."
        )
    elif total_rejections > 0:
        warning = (
            f"{total_rejections} brick placement(s) were re-sampled during "
            "generation due to constraint violations."
        )

    on_event({
        "type": "done",
        "partial": partial,
        "warning": warning,
        "total_bricks": len(accepted),
    })

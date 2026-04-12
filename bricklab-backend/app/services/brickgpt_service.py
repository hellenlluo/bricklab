"""Lazy-loading singleton wrapper around BrickGPT inference.

Constraint enforcement is integrated directly into BrickGPT's per-brick
rejection-sampling loop so that invalid placements are never committed to
the scene state.  The approach monkey-patches ``_try_adding_brick`` on the
model instance for the duration of a constrained call, letting the existing
rollback / temperature-escalation machinery handle resampling automatically.
"""

import sys
import threading
from pathlib import Path
from typing import TypedDict

BRICKGPT_SRC = Path(__file__).resolve().parents[2] / "external" / "BrickGPT" / "src"
if str(BRICKGPT_SRC) not in sys.path:
    sys.path.insert(0, str(BRICKGPT_SRC))

from brickgpt.data import Brick
from brickgpt.models import BrickGPT, BrickGPTConfig

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

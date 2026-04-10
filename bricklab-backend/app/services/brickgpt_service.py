"""Lazy-loading singleton wrapper around BrickGPT inference."""

import sys
from pathlib import Path

BRICKGPT_SRC = Path(__file__).resolve().parents[2] / "external" / "BrickGPT" / "src"
if str(BRICKGPT_SRC) not in sys.path:
    sys.path.insert(0, str(BRICKGPT_SRC))

from brickgpt.models import BrickGPT, BrickGPTConfig

_model: BrickGPT | None = None


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


def generate_bricks(prompt: str) -> list[dict]:
    """Run BrickGPT inference and return a list of brick dicts."""
    model = get_model()
    output = model(prompt)
    brick_structure = output["bricks"]
    return [
        {"h": b.h, "w": b.w, "x": b.x, "y": b.y, "z": b.z}
        for b in brick_structure.bricks
    ]

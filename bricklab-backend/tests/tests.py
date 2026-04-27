"""
Comprehensive backend tests for BrickLab's core behaviors.

Covers:
  - Image-to-3D preprocessing, error handling, and voxelization output
  - Constraint intersection logic and constrained generation behavior
  - Router validation and response-schema guarantees for image and text flows

Run with:
  cd bricklab-backend
  .venv/bin/pytest tests/tests.py -v
"""

import base64
import re
from types import SimpleNamespace

import numpy as np
import pytest
from PIL import Image as PILImage

from app.services.image3d_service import (
    _mask_to_overlay_b64,
    _prepare_masked_image,
    predict_mask,
)


def _brick(h: int, w: int, x: int, y: int, z: int) -> SimpleNamespace:
    return SimpleNamespace(h=h, w=w, x=x, y=y, z=z)


# ---------------------------------------------------------------------------
# Image preprocessing and output generation
# ---------------------------------------------------------------------------


def test_overlay_returns_valid_png_base64():
    image_np = np.zeros((100, 100, 3), dtype=np.uint8)
    mask = np.zeros((100, 100), dtype=bool)
    mask[20:80, 20:80] = True

    result = _mask_to_overlay_b64(image_np, mask)

    decoded = base64.b64decode(result)
    assert decoded[:4] == b"\x89PNG"


def test_overlay_empty_mask_does_not_crash():
    image_np = np.zeros((50, 50, 3), dtype=np.uint8)
    mask = np.zeros((50, 50), dtype=bool)

    result = _mask_to_overlay_b64(image_np, mask)
    assert isinstance(result, str) and len(result) > 0


def test_prepare_masked_image_returns_pil_image():
    image_np = np.random.randint(0, 255, (200, 200, 3), dtype=np.uint8)
    mask = np.zeros((200, 200), dtype=bool)
    mask[50:150, 50:150] = True

    result = _prepare_masked_image(image_np, mask)
    assert isinstance(result, PILImage.Image)
    assert result.size[0] > 0 and result.size[1] > 0


def test_prepare_masked_image_empty_mask_fallback():
    image_np = np.zeros((100, 100, 3), dtype=np.uint8)
    mask = np.zeros((100, 100), dtype=bool)

    result = _prepare_masked_image(image_np, mask)
    assert isinstance(result, PILImage.Image)


def test_predict_mask_without_upload_raises_file_not_found():
    with pytest.raises(FileNotFoundError, match="not encoded"):
        predict_mask("nonexistent-uuid", [{"x": 50, "y": 50}], [1])


# ---------------------------------------------------------------------------
# Constraint handling in generation service
# ---------------------------------------------------------------------------


def test_brick_intersects_constraint_detects_overlap():
    from app.services.brickgpt_service import _brick_intersects_constraint

    box = {"pos_x": 1, "pos_y": 1, "pos_z": 0, "size_x": 2, "size_y": 2, "size_z": 2}
    assert _brick_intersects_constraint(2, 2, 0, 0, 0, box) is True


def test_brick_intersects_constraint_treats_touching_edge_as_non_overlap():
    from app.services.brickgpt_service import _brick_intersects_constraint

    box = {"pos_x": 2, "pos_y": 0, "pos_z": 0, "size_x": 2, "size_y": 2, "size_z": 2}
    assert _brick_intersects_constraint(2, 2, 0, 0, 0, box) is False


def test_generate_bricks_without_constraints_maps_model_output(monkeypatch):
    import app.services.brickgpt_service as svc

    class FakeModel:
        def __call__(self, prompt):
            assert prompt == "tower"
            return {"bricks": SimpleNamespace(bricks=[_brick(2, 4, 1, -2, 3)])}

    monkeypatch.setattr(svc, "get_model", lambda: FakeModel())

    result = svc.generate_bricks("tower")

    assert result == {
        "bricks": [{"h": 2, "w": 4, "x": 1, "y": -2, "z": 3}],
        "partial": False,
        "warning": None,
    }


def test_generate_bricks_with_constraints_filters_invalid_bricks(monkeypatch):
    import app.services.brickgpt_service as svc

    class FakeModel:
        def __call__(self, prompt):
            return {
                "bricks": SimpleNamespace(
                    bricks=[
                        _brick(1, 1, 0, 0, 0),  # inside exclusion box
                        _brick(1, 1, 5, 5, 0),  # survives
                    ]
                ),
                "rejection_reasons": {"constraint_violation": 1},
            }

    monkeypatch.setattr(svc, "get_model", lambda: FakeModel())

    constraints = [
        {"pos_x": 0, "pos_y": 0, "pos_z": 0, "size_x": 2, "size_y": 2, "size_z": 2}
    ]
    result = svc.generate_bricks("chair", constraints)

    assert result["bricks"] == [{"h": 1, "w": 1, "x": 5, "y": 5, "z": 0}]
    assert result["partial"] is True
    assert "re-sampled" in result["warning"]


# ---------------------------------------------------------------------------
# Router validation and response consistency
# ---------------------------------------------------------------------------


def test_image_upload_empty_body_returns_400():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(
        "/image3d/upload",
        files={"image": ("empty.png", b"", "image/png")},
    )

    assert resp.status_code == 400


def test_image_predict_missing_upload_maps_to_404(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    import app.services.image3d_service as image3d_service

    def fake_predict(*_args, **_kwargs):
        raise FileNotFoundError("Image missing")

    monkeypatch.setattr(image3d_service, "predict_mask", fake_predict)

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(
        "/image3d/predict",
        json={"image_id": "missing", "points": [{"x": 1, "y": 2}], "labels": [1]},
    )

    assert resp.status_code == 404
    assert "Image missing" in resp.text


def test_generate_missing_prompt_returns_422():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post("/generate", json={"constraints": []})

    assert resp.status_code == 422


def test_generate_response_has_required_fields(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    import app.services.brickgpt_service as brickgpt_service

    def fake_generate(prompt, constraints):
        assert prompt == "a simple house"
        assert constraints == []
        return {
            "bricks": [{"h": 1, "w": 1, "x": 0, "y": 0, "z": 0}],
            "partial": False,
            "warning": None,
        }

    monkeypatch.setattr(brickgpt_service, "generate_bricks", fake_generate)

    client = TestClient(app)
    resp = client.post("/generate", json={"prompt": "a simple house", "constraints": []})

    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "bricks": [{"h": 1, "w": 1, "x": 0, "y": 0, "z": 0}],
        "total_bricks": 1,
        "partial": False,
        "warning": None,
    }


def test_regenerate_from_prefix_returns_total_and_prefix_count(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    import app.services.brickgpt_service as brickgpt_service

    def fake_regenerate(prompt, prefix_bricks, constraints):
        assert prompt == "extend wall"
        assert prefix_bricks == [{"h": 1, "w": 2, "x": 0, "y": 0, "z": 0}]
        assert constraints is None
        return {
            "bricks": [
                {"h": 1, "w": 2, "x": 0, "y": 0, "z": 0},
                {"h": 1, "w": 1, "x": 1, "y": 0, "z": 0},
            ],
            "prefix_count": 1,
            "partial": False,
            "warning": None,
        }

    monkeypatch.setattr(brickgpt_service, "generate_from_prefix", fake_regenerate)

    client = TestClient(app)
    resp = client.post(
        "/generate/regenerate-from-prefix",
        json={
            "prompt": "extend wall",
            "prefix_bricks": [{"h": 1, "w": 2, "x": 0, "y": 0, "z": 0}],
            "constraints": [],
        },
    )

    assert resp.status_code == 200
    assert resp.json()["total_bricks"] == 2
    assert resp.json()["prefix_count"] == 1


# ---------------------------------------------------------------------------
# Voxelization behavior
# ---------------------------------------------------------------------------


def test_voxelize_normalizes_to_origin(tmp_path, monkeypatch):
    import trimesh
    import app.services.image3d_service as svc

    box = trimesh.creation.box(extents=[0.3, 0.3, 0.3])
    box.apply_translation([5.0, 5.0, 5.0])
    ply_path = tmp_path / "norm_test.ply"
    box.export(str(ply_path))

    monkeypatch.setattr(svc, "_TMP_DIR", tmp_path)
    voxels = svc.voxelize("norm_test", voxel_size=0.1)

    if voxels:
        assert min(v["x"] for v in voxels) == 0
        assert min(v["y"] for v in voxels) == 0
        assert min(v["z"] for v in voxels) == 0


def test_voxelize_hex_colors_are_valid(tmp_path, monkeypatch):
    import trimesh
    import app.services.image3d_service as svc

    box = trimesh.creation.box(extents=[0.2, 0.2, 0.2])
    ply_path = tmp_path / "color_test.ply"
    box.export(str(ply_path))

    monkeypatch.setattr(svc, "_TMP_DIR", tmp_path)
    voxels = svc.voxelize("color_test", voxel_size=0.1)

    hex_re = re.compile(r"^#[0-9a-f]{6}$")
    for v in voxels:
        assert hex_re.match(v["color"]), f"Invalid hex color: {v['color']}"


def test_voxelize_missing_ply_raises():
    import app.services.image3d_service as svc

    with pytest.raises(FileNotFoundError):
        svc.voxelize("this-does-not-exist", voxel_size=0.05)

"""Image-to-3D service: interactive segmentation, 3D reconstruction, voxelization.

Uses SAM's point-prompt interface so the user can click on objects in the
image to segment them, then feeds the masked image to TripoSR for 3D
reconstruction.

Pipeline:
1. upload_and_encode  – Save image, run SAM image encoder, cache embedding.
2. predict_mask       – Accept click-point prompts, run SAM mask decoder
                        (fast, ~50 ms), return overlay + save mask.
3. reconstruct        – Feed masked image to TripoSR → color mesh → PLY.
4. voxelize           – Open3D voxelization of the PLY → colored brick list.
"""

import base64
import io
import sys
import tempfile
import threading
import uuid
from pathlib import Path
from typing import TypedDict

# ---------------------------------------------------------------------------
# Path setup for vendored TripoSR
# ---------------------------------------------------------------------------

_TRIPOSR_ROOT = Path(__file__).resolve().parents[2] / "external" / "TripoSR"
if str(_TRIPOSR_ROOT) not in sys.path:
    sys.path.insert(0, str(_TRIPOSR_ROOT))

# ---------------------------------------------------------------------------
# Lazy singletons
# ---------------------------------------------------------------------------

_sam_predictor = None
_sam_lock = threading.Lock()

_tsr_model = None
_tsr_lock = threading.Lock()

_TMP_DIR = Path(tempfile.gettempdir()) / "bricklab_image3d"
_TMP_DIR.mkdir(parents=True, exist_ok=True)

_embedding_cache: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class UploadResult(TypedDict):
    image_id: str


class PredictResult(TypedDict):
    mask_b64: str


class VoxelEntry(TypedDict):
    x: int
    y: int
    z: int
    color: str


class ReconstructResult(TypedDict):
    ply_id: str
    voxels: list[VoxelEntry]


# ---------------------------------------------------------------------------
# SAM predictor (lazy load)
# ---------------------------------------------------------------------------

def _get_sam_predictor():
    """Load SAM predictor for interactive point-prompt segmentation."""
    global _sam_predictor
    if _sam_predictor is not None:
        return _sam_predictor

    try:
        from segment_anything import SamPredictor, sam_model_registry
    except ImportError:
        raise ImportError(
            "segment-anything is required for interactive segmentation. "
            "Install with: pip install segment-anything"
        )

    sam_ckpt = Path(__file__).resolve().parents[2] / "external" / "sam_vit_h.pth"
    if not sam_ckpt.exists():
        raise FileNotFoundError(
            f"SAM checkpoint not found at {sam_ckpt}. "
            "Download from https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
        )

    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    sam = sam_model_registry["vit_h"](checkpoint=str(sam_ckpt))
    sam.to(device=device)
    _sam_predictor = SamPredictor(sam)
    return _sam_predictor


def _mask_to_overlay_b64(image_np, mask) -> str:
    """Render a transparent PNG mask overlay for the source image."""
    import numpy as np
    from PIL import Image

    overlay = np.zeros((*mask.shape, 4), dtype=np.uint8)
    color = np.array([72, 144, 255], dtype=np.uint8)
    contour = np.zeros_like(mask)
    contour[1:] |= mask[:-1] != mask[1:]
    contour[:-1] |= mask[1:] != mask[:-1]
    contour[:, 1:] |= mask[:, :-1] != mask[:, 1:]
    contour[:, :-1] |= mask[:, 1:] != mask[:, :-1]

    overlay[mask] = np.array([*color, 110], dtype=np.uint8)
    overlay[contour] = np.array([*color, 255], dtype=np.uint8)

    buf = io.BytesIO()
    Image.fromarray(overlay, mode="RGBA").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------------------
# Public API — segmentation
# ---------------------------------------------------------------------------

def upload_and_encode(image_bytes: bytes) -> UploadResult:
    """Save the image and pre-compute the SAM image embedding.

    Returns an ``image_id`` used for all subsequent calls.  The embedding is
    cached so that ``predict_mask`` only needs to run the lightweight mask
    decoder (~50 ms) per click.
    """
    import numpy as np
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image)

    img_id = str(uuid.uuid4())
    img_path = _TMP_DIR / f"{img_id}.png"
    image.save(img_path)

    with _sam_lock:
        predictor = _get_sam_predictor()
        predictor.set_image(image_np)
        _embedding_cache[img_id] = {
            "features": predictor.features.cpu().clone(),
            "original_size": predictor.original_size,
            "input_size": predictor.input_size,
        }

    return {"image_id": img_id}


def predict_mask(
    image_id: str,
    points: list[dict],
    labels: list[int],
) -> PredictResult:
    """Run SAM mask decoder with point prompts and return the overlay.

    *points* is a list of ``{"x": int, "y": int}`` in image-pixel coords.
    *labels* is a parallel list of 1 (foreground) or 0 (background).

    The best mask (highest predicted IoU) is saved for later use by
    ``reconstruct``.
    """
    import numpy as np
    from PIL import Image

    if image_id not in _embedding_cache:
        raise FileNotFoundError(f"Image {image_id} not encoded — call upload first")

    img_path = _TMP_DIR / f"{image_id}.png"
    image_np = np.array(Image.open(img_path).convert("RGB"))

    point_coords = np.array([[p["x"], p["y"]] for p in points])
    point_labels = np.array(labels)

    cache = _embedding_cache[image_id]

    with _sam_lock:
        predictor = _get_sam_predictor()
        predictor.features = cache["features"].to(predictor.device)
        predictor.original_size = cache["original_size"]
        predictor.input_size = cache["input_size"]
        predictor.is_image_set = True

        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True,
        )

    best_mask = masks[np.argmax(scores)]  # type: ignore[arg-type]

    mask_dir = _TMP_DIR / image_id
    mask_dir.mkdir(exist_ok=True)
    Image.fromarray((best_mask * 255).astype(np.uint8)).save(mask_dir / "mask.png")

    overlay_b64 = _mask_to_overlay_b64(image_np, best_mask)
    return {"mask_b64": overlay_b64}


# ---------------------------------------------------------------------------
# TripoSR model (lazy load)
# ---------------------------------------------------------------------------

def _get_tsr_model():
    """Load TripoSR model (lazy singleton). Downloads weights from HF on first run."""
    global _tsr_model
    if _tsr_model is not None:
        return _tsr_model

    import torch
    from tsr.system import TSR  # pyright: ignore[reportMissingImports]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.renderer.set_chunk_size(8192)
    model.to(device)
    _tsr_model = model
    return _tsr_model


def _prepare_masked_image(image_np, mask):
    """Apply the SAM mask to isolate the foreground on a gray background.

    TripoSR expects the subject isolated and centered with a neutral background.
    We use the mask as alpha, crop to the foreground bounding box, pad to square,
    and resize the foreground to ~85 % of the frame.
    """
    import numpy as np
    from PIL import Image

    rgba = np.concatenate(
        [image_np, (mask.astype(np.uint8) * 255)[..., None]],
        axis=-1,
    )

    alpha = np.where(rgba[..., 3] > 0)
    if len(alpha[0]) == 0:
        return Image.fromarray(image_np)

    y1, y2, x1, x2 = alpha[0].min(), alpha[0].max(), alpha[1].min(), alpha[1].max()
    fg = rgba[y1:y2, x1:x2]

    size = max(fg.shape[0], fg.shape[1])
    ph0, pw0 = (size - fg.shape[0]) // 2, (size - fg.shape[1]) // 2
    ph1, pw1 = size - fg.shape[0] - ph0, size - fg.shape[1] - pw0
    padded = np.pad(fg, ((ph0, ph1), (pw0, pw1), (0, 0)), constant_values=0)

    ratio = 0.85
    new_size = int(padded.shape[0] / ratio)
    ph0, pw0 = (new_size - size) // 2, (new_size - size) // 2
    ph1, pw1 = new_size - size - ph0, new_size - size - pw0
    padded = np.pad(padded, ((ph0, ph1), (pw0, pw1), (0, 0)), constant_values=0)

    rgb = padded[..., :3].astype(np.float32) / 255.0
    a = padded[..., 3:4].astype(np.float32) / 255.0
    composited = rgb * a + 0.5 * (1 - a)

    return Image.fromarray((composited * 255).astype(np.uint8))


# ---------------------------------------------------------------------------
# 3D reconstruction
# ---------------------------------------------------------------------------

def reconstruct(
    image_id: str,
    seed: int = 42,
    voxel_size: float = 0.05,
) -> ReconstructResult:
    """Run TripoSR reconstruction with the most-recently predicted mask.

    Returns a ``ply_id`` (for re-voxelization) and an initial voxel list.
    """
    import numpy as np
    import torch
    from PIL import Image

    img_path = _TMP_DIR / f"{image_id}.png"
    mask_path = _TMP_DIR / image_id / "mask.png"
    if not img_path.exists():
        raise FileNotFoundError(f"Image {image_id} not found")
    if not mask_path.exists():
        raise FileNotFoundError("No mask predicted yet — click on the image first")

    image_np = np.array(Image.open(img_path).convert("RGB"))
    mask = np.array(Image.open(mask_path).convert("L")) > 0

    prepped = _prepare_masked_image(image_np, mask)

    with _tsr_lock:
        model = _get_tsr_model()
        device = next(model.parameters()).device
        device_str = str(device)

        if seed is not None:
            torch.manual_seed(seed)

        with torch.no_grad():
            scene_codes = model([prepped], device=device_str)
            mesh = model.extract_mesh(scene_codes, has_vertex_color=True, resolution=256)[0]

    ply_id = str(uuid.uuid4())
    ply_path = _TMP_DIR / f"{ply_id}.ply"
    mesh.export(str(ply_path))

    voxels = voxelize(ply_id, voxel_size)
    return {"ply_id": ply_id, "voxels": voxels}


# ---------------------------------------------------------------------------
# Voxelization
# ---------------------------------------------------------------------------

def voxelize(ply_id: str, voxel_size: float = 0.05) -> list[VoxelEntry]:
    """Load a color PLY/mesh and voxelize it with Open3D.

    The grid is normalized so that minimum coordinates start at 0.
    """
    import numpy as np
    import open3d as o3d
    import trimesh as tm

    ply_path = _TMP_DIR / f"{ply_id}.ply"
    if not ply_path.exists():
        raise FileNotFoundError(f"PLY {ply_id} not found")

    tri_mesh = tm.load(str(ply_path), force="mesh")

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(tri_mesh.vertices)

    if tri_mesh.visual and hasattr(tri_mesh.visual, "vertex_colors"):
        vc = np.array(tri_mesh.visual.vertex_colors)
        if vc.shape[1] >= 3:
            pcd.colors = o3d.utility.Vector3dVector(vc[:, :3].astype(np.float64) / 255.0)

    if not pcd.has_colors():
        pcd.paint_uniform_color([0.6, 0.6, 0.8])

    voxel_grid = o3d.geometry.VoxelGrid.create_from_point_cloud(pcd, voxel_size=voxel_size)
    voxels = voxel_grid.get_voxels()
    if len(voxels) == 0:
        return []

    indices = np.array([v.grid_index for v in voxels])
    colors = np.array([v.color for v in voxels])

    mins = indices.min(axis=0)
    indices = indices - mins

    entries: list[VoxelEntry] = []
    for idx, col in zip(indices, colors):
        r, g, b = (np.clip(col, 0, 1) * 255).astype(int)
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        entries.append({"x": int(idx[0]), "y": int(idx[1]), "z": int(idx[2]), "color": hex_color})

    return entries

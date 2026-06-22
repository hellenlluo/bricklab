"""Image-to-3D router: upload → click-to-segment → TripoSR reconstruct → voxelize."""

import asyncio

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/image3d", tags=["image3d"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    image_id: str


class PointPrompt(BaseModel):
    x: int
    y: int


class PredictRequest(BaseModel):
    image_id: str
    points: list[PointPrompt]
    labels: list[int]


class PredictResponse(BaseModel):
    mask_b64: str


class VoxelData(BaseModel):
    x: int
    y: int
    z: int
    color: str


class ReconstructResponse(BaseModel):
    ply_id: str
    voxels: list[VoxelData]


class VoxelizeRequest(BaseModel):
    ply_id: str
    voxel_size: float = 0.05


class VoxelizeResponse(BaseModel):
    voxels: list[VoxelData]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=UploadResponse)
async def upload_image(image: UploadFile = File(...)):
    """Upload an image and pre-compute its SAM embedding."""
    from app.services.image3d_service import upload_and_encode

    contents = await image.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file upload")

    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, upload_and_encode, contents)
    except (FileNotFoundError, ImportError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return UploadResponse(image_id=result["image_id"])


@router.post("/predict", response_model=PredictResponse)
async def predict_mask(req: PredictRequest):
    """Run SAM mask decoder with click-point prompts.

    Each point has (x, y) in image-pixel coordinates.  Labels: 1 = foreground
    (left-click), 0 = background (alt/right-click).

    Returns a base64-encoded JPEG overlay showing the predicted mask.
    """
    from app.services.image3d_service import predict_mask as _predict_mask

    points = [{"x": p.x, "y": p.y} for p in req.points]

    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None, _predict_mask, req.image_id, points, req.labels,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return PredictResponse(mask_b64=result["mask_b64"])


@router.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct(image_id: str, seed: int = 42, voxel_size: float = 0.05):
    """Run TripoSR 3D reconstruction using the last predicted mask.

    Returns a ``ply_id`` (for re-voxelization) and the initial list of
    colored voxels at the requested ``voxel_size``.
    """
    from app.services.image3d_service import reconstruct as _reconstruct

    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None, _reconstruct, image_id, seed, voxel_size,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (ImportError, RuntimeError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return ReconstructResponse(ply_id=result["ply_id"], voxels=result["voxels"])


@router.post("/voxelize", response_model=VoxelizeResponse)
async def voxelize(req: VoxelizeRequest):
    """Re-voxelize an existing PLY at a different density."""
    from app.services.image3d_service import voxelize as _voxelize

    loop = asyncio.get_running_loop()
    try:
        voxels = await loop.run_in_executor(None, _voxelize, req.ply_id, req.voxel_size)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return VoxelizeResponse(voxels=voxels)

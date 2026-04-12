import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/generate", tags=["generate"])


class BrickData(BaseModel):
    h: int
    w: int
    x: int
    y: int
    z: int


class ConstraintBoxPayload(BaseModel):
    """Axis-aligned bounding box defining an exclusion volume in brick-grid space.

    posX/Y/Z is the minimum-corner of the box (same grid space as brick x/y/z).
    sizeX/Y/Z are the box extents in stud units.
    """
    pos_x: float
    pos_y: float
    pos_z: float
    size_x: float
    size_y: float
    size_z: float


class GenerateRequest(BaseModel):
    prompt: str
    constraints: list[ConstraintBoxPayload] = []


class GenerateResponse(BaseModel):
    bricks: list[BrickData]
    total_bricks: int
    partial: bool = False
    warning: str | None = None


@router.post("", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    """
    Submit a natural-language prompt and run BrickGPT inference.
    Any constraint boxes are enforced as exclusion volumes: bricks intersecting
    them are rejected. Returns the generated brick structure as a list of
    positioned bricks, plus a warning if constraints caused partial generation.
    """
    from app.services.brickgpt_service import generate_bricks

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        generate_bricks,
        req.prompt,
        [c.model_dump() for c in req.constraints],
    )
    return GenerateResponse(
        bricks=result["bricks"],
        total_bricks=len(result["bricks"]),
        partial=result["partial"],
        warning=result["warning"],
    )

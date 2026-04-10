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


class GenerateRequest(BaseModel):
    prompt: str


class GenerateResponse(BaseModel):
    bricks: list[BrickData]
    total_bricks: int


@router.post("", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    """
    Submit a natural-language prompt and run BrickGPT inference.
    Returns the generated brick structure as a list of positioned bricks.
    """
    from app.services.brickgpt_service import generate_bricks

    loop = asyncio.get_running_loop()
    bricks = await loop.run_in_executor(None, generate_bricks, req.prompt)
    return GenerateResponse(bricks=bricks, total_bricks=len(bricks))

import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
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


class RegenerateFromPrefixRequest(BaseModel):
    prompt: str
    prefix_bricks: list[BrickData]
    constraints: list[ConstraintBoxPayload] = []


class RegenerateFromPrefixResponse(BaseModel):
    bricks: list[BrickData]
    total_bricks: int
    prefix_count: int
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


@router.post("/stream")
async def generate_stream(req: GenerateRequest) -> StreamingResponse:
    """
    Stream BrickGPT generation as Server-Sent Events.

    Each event is a JSON object on a ``data:`` line followed by two newlines.
    Event shapes:

    * ``{"type": "brick",    "data": {"h":…,"w":…,"x":…,"y":…,"z":…}}``
    * ``{"type": "reject",   "data": {…}|null, "reason": string}``
    * ``{"type": "rollback", "keep_count": number}``
    * ``{"type": "done",     "partial": bool, "warning": string|null,
                              "total_bricks": number}``
    * ``{"type": "error",    "message": string}``
    """
    from app.services.brickgpt_service import generate_bricks_streaming

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict] = asyncio.Queue()

    def on_event(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def run_generation() -> None:
        try:
            await loop.run_in_executor(
                None,
                generate_bricks_streaming,
                req.prompt,
                [c.model_dump() for c in req.constraints],
                on_event,
            )
        except Exception as exc:
            loop.call_soon_threadsafe(
                queue.put_nowait, {"type": "error", "message": str(exc)}
            )

    async def event_generator():
        task = asyncio.create_task(run_generation())
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("done", "error"):
                    break
        finally:
            task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/regenerate-from-prefix/stream")
async def regenerate_from_prefix_stream(req: RegenerateFromPrefixRequest) -> StreamingResponse:
    """Stream continuation generation from an edited prefix as Server-Sent Events.

    Same event protocol as ``/stream``.  The ``done`` event additionally
    carries ``"prefix_count"`` so the client knows how many leading bricks
    were fixed.  Only bricks added **after** the prefix are emitted as
    ``brick`` events — the prefix is assumed to already be present in the
    client's state.
    """
    from app.services.brickgpt_service import generate_from_prefix_streaming

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict] = asyncio.Queue()

    def on_event(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def run_generation() -> None:
        try:
            await loop.run_in_executor(
                None,
                generate_from_prefix_streaming,
                req.prompt,
                [b.model_dump() for b in req.prefix_bricks],
                [c.model_dump() for c in req.constraints] if req.constraints else None,
                on_event,
            )
        except Exception as exc:
            loop.call_soon_threadsafe(
                queue.put_nowait, {"type": "error", "message": str(exc)}
            )

    async def event_generator():
        task = asyncio.create_task(run_generation())
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("done", "error"):
                    break
        finally:
            task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/regenerate-from-prefix", response_model=RegenerateFromPrefixResponse)
async def regenerate_from_prefix(
    req: RegenerateFromPrefixRequest,
) -> RegenerateFromPrefixResponse:
    """Continue generation from an edited brick prefix.

    Accepts a prompt, a list of prefix bricks (the user's edited state), and
    optional constraint boxes.  The backend feeds the prefix to BrickGPT as
    ``starting_bricks`` and autoregressively generates the continuation.
    Returns the full brick list (prefix + generated).
    """
    from app.services.brickgpt_service import generate_from_prefix

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        generate_from_prefix,
        req.prompt,
        [b.model_dump() for b in req.prefix_bricks],
        [c.model_dump() for c in req.constraints] if req.constraints else None,
    )
    return RegenerateFromPrefixResponse(
        bricks=result["bricks"],
        total_bricks=len(result["bricks"]),
        prefix_count=result["prefix_count"],
        partial=result["partial"],
        warning=result["warning"],
    )

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/generate", tags=["generate"])


class GenerateRequest(BaseModel):
    prompt: str


class GenerateResponse(BaseModel):
    session_id: str
    message: str


@router.post("", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    """
    Submit a natural-language prompt to kick off BrickGPT generation.
    Returns a session_id used to stream results via the WebSocket endpoint.
    """
    import uuid
    session_id = str(uuid.uuid4())
    # TODO: enqueue inference task keyed by session_id
    return GenerateResponse(session_id=session_id, message="Generation queued.")

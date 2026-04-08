from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter(tags=["session"])


class RegenerateRequest(BaseModel):
    token_sequence: list[int]


@router.websocket("/ws/session/{session_id}")
async def session_stream(websocket: WebSocket, session_id: str) -> None:
    """
    Bidirectional WebSocket for a generation session.
    - Server streams brick events to the client as JSON.
    - Client can send an edited token sequence to pause and resubmit.

    Event shapes (server → client):
        {"type": "brick", "data": <brick_dict>}
        {"type": "done"}
        {"type": "error", "message": <str>}

    Command shapes (client → server):
        {"type": "pause"}
        {"type": "edit", "token_sequence": [...]}
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "pause":
                # TODO: signal the running inference task to pause
                await websocket.send_json({"type": "paused"})

            elif event_type == "edit":
                # TODO: replace token history and resume generation
                await websocket.send_json({"type": "resuming"})

    except WebSocketDisconnect:
        pass  # client disconnected cleanly


@router.post("/regenerate/{session_id}")
async def regenerate(session_id: str, req: RegenerateRequest) -> dict:
    """
    REST alternative to the WS edit command.
    Submits an edited token sequence and triggers continued generation.
    """
    # TODO: validate session exists, run feasibility check, resume inference
    return {"session_id": session_id, "status": "regenerating", "tokens_received": len(req.token_sequence)}

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/metrics", tags=["metrics"])


class Metrics(BaseModel):
    session_id: str
    brick_count: int
    feasibility_score: float | None  # None until stability analysis is run


@router.get("/{session_id}", response_model=Metrics)
async def get_metrics(session_id: str) -> Metrics:
    """
    Return quantitative metrics for a completed or in-progress generation session.
    Includes brick count and structural feasibility score.
    """
    # TODO: look up session state and compute/return real metrics
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

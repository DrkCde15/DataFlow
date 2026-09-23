from fastapi import APIRouter

from ..models import HealthStatus

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthStatus)
def health_check() -> HealthStatus:
    return HealthStatus(status="ok")

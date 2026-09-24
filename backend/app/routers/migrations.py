from fastapi import APIRouter, Query

from .. import repository
from ..models import MigrationReport

router = APIRouter(prefix="/api/migrations", tags=["migrations"])


@router.post("/connection-strings", response_model=MigrationReport)
def migrate_connection_strings(
    dry_run: bool = Query(default=False),
) -> MigrationReport:
    return repository.migrate_connection_strings(dry_run=dry_run)

from fastapi import APIRouter, HTTPException

from .. import repository
from ..models import ConnectionCreate, ConnectionSummary, ConnectionUpdate

router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("", response_model=list[ConnectionSummary])
def list_connections() -> list[ConnectionSummary]:
    return repository.list_connections()


@router.post("", response_model=ConnectionSummary, status_code=201)
def create_connection(payload: ConnectionCreate) -> ConnectionSummary:
    return repository.create_connection(
        payload.name, payload.type, payload.connection_string
    )


@router.get("/{connection_id}", response_model=ConnectionSummary)
def get_connection(connection_id: str) -> ConnectionSummary:
    connection = repository.get_connection_record(connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection


@router.put("/{connection_id}", response_model=ConnectionSummary)
def update_connection(
    connection_id: str, payload: ConnectionUpdate
) -> ConnectionSummary:
    connection = repository.update_connection(
        connection_id, payload.name, payload.type, payload.connection_string
    )
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection


@router.delete("/{connection_id}", status_code=204)
def delete_connection(connection_id: str) -> None:
    usage = repository.connection_usage(connection_id)
    if usage:
        names = ", ".join(usage)
        raise HTTPException(
            status_code=409,
            detail=f"Connection is used by: {names}",
        )
    if not repository.delete_connection(connection_id):
        raise HTTPException(status_code=404, detail="Connection not found")

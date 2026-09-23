import json
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from typing import Any

from .database import get_connection

WorkflowDict = dict[str, Any]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_workflow(row: sqlite3.Row) -> WorkflowDict:
    return {
        "id": row["id"],
        "name": row["name"],
        "nodes": json.loads(row["nodes"]),
        "edges": json.loads(row["edges"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _parse_summary(row: sqlite3.Row) -> WorkflowDict:
    nodes = json.loads(row["nodes"])
    edges = json.loads(row["edges"])
    return {
        "id": row["id"],
        "name": row["name"],
        "node_count": len(nodes),
        "edge_count": len(edges),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_workflows() -> list[WorkflowDict]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM workflows ORDER BY updated_at DESC"
        ).fetchall()
    return [_parse_summary(row) for row in rows]


def get_workflow(workflow_id: str) -> WorkflowDict | None:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT * FROM workflows WHERE id = ?", (workflow_id,)
        ).fetchone()
    if row is None:
        return None
    return _parse_workflow(row)


def create_workflow(
    name: str, nodes: list[WorkflowDict], edges: list[WorkflowDict]
) -> WorkflowDict:
    workflow_id = uuid.uuid4().hex
    now = _now()
    with closing(get_connection()) as connection:
        with connection:
            connection.execute(
                """
                INSERT INTO workflows (id, name, nodes, edges, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (workflow_id, name, json.dumps(nodes), json.dumps(edges), now, now),
            )
    created = get_workflow(workflow_id)
    assert created is not None
    return created


def update_workflow(
    workflow_id: str,
    name: str | None,
    nodes: list[WorkflowDict] | None,
    edges: list[WorkflowDict] | None,
) -> WorkflowDict | None:
    existing = get_workflow(workflow_id)
    if existing is None:
        return None

    merged_name = name if name is not None else existing["name"]
    merged_nodes = nodes if nodes is not None else existing["nodes"]
    merged_edges = edges if edges is not None else existing["edges"]

    with closing(get_connection()) as connection:
        with connection:
            connection.execute(
                """
                UPDATE workflows
                SET name = ?, nodes = ?, edges = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    merged_name,
                    json.dumps(merged_nodes),
                    json.dumps(merged_edges),
                    _now(),
                    workflow_id,
                ),
            )

    updated = get_workflow(workflow_id)
    assert updated is not None
    return updated


def delete_workflow(workflow_id: str) -> bool:
    with closing(get_connection()) as connection:
        with connection:
            cursor = connection.execute(
                "DELETE FROM workflows WHERE id = ?", (workflow_id,)
            )
    return cursor.rowcount > 0

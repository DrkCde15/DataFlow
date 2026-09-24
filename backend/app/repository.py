import json
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from typing import Any

from .database import UPLOAD_DIR, get_connection

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


def _collect_file_ids(nodes: list[WorkflowDict]) -> list[str]:
    file_ids: list[str] = []
    for node in nodes:
        data = node.get("data")
        if not isinstance(data, dict):
            continue
        config = data.get("config")
        if not isinstance(config, dict):
            continue
        file_ref = config.get("file")
        if isinstance(file_ref, dict) and isinstance(file_ref.get("id"), str):
            file_ids.append(file_ref["id"])
    return file_ids


def _parse_nodes_column(raw: str) -> list[WorkflowDict]:
    try:
        nodes = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    return nodes if isinstance(nodes, list) else []


def delete_workflow(workflow_id: str) -> bool:
    existing = get_workflow(workflow_id)
    if existing is None:
        return False

    removed_files = set(_collect_file_ids(existing["nodes"]))

    with closing(get_connection()) as connection:
        with connection:
            connection.execute(
                "DELETE FROM workflows WHERE id = ?", (workflow_id,)
            )
            rows = connection.execute("SELECT nodes FROM workflows").fetchall()

    still_used: set[str] = set()
    for row in rows:
        still_used.update(_collect_file_ids(_parse_nodes_column(row["nodes"])))

    for file_id in removed_files - still_used:
        try:
            (UPLOAD_DIR / file_id).unlink(missing_ok=True)
        except OSError:
            pass

    return True

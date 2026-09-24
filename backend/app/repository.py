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


def _row_to_connection(row: sqlite3.Row) -> WorkflowDict:
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_connections() -> list[WorkflowDict]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            "SELECT * FROM connections ORDER BY updated_at DESC"
        ).fetchall()
    return [_row_to_connection(row) for row in rows]


def get_connection_record(connection_id: str) -> WorkflowDict | None:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT * FROM connections WHERE id = ?", (connection_id,)
        ).fetchone()
    if row is None:
        return None
    return _row_to_connection(row)


def create_connection(
    name: str, type: str, connection_string: str
) -> WorkflowDict:
    connection_id = uuid.uuid4().hex
    now = _now()
    with closing(get_connection()) as connection:
        with connection:
            connection.execute(
                """
                INSERT INTO connections (id, name, type, connection_string, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (connection_id, name, type, connection_string, now, now),
            )
    created = get_connection_record(connection_id)
    assert created is not None
    return created


def update_connection(
    connection_id: str,
    name: str | None,
    type: str | None,
    connection_string: str | None,
) -> WorkflowDict | None:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT * FROM connections WHERE id = ?", (connection_id,)
        ).fetchone()
        if row is None:
            return None

        merged_name = name if name is not None else row["name"]
        merged_type = type if type is not None else row["type"]
        merged_secret = (
            connection_string
            if connection_string is not None
            else row["connection_string"]
        )

        with connection:
            connection.execute(
                """
                UPDATE connections
                SET name = ?, type = ?, connection_string = ?, updated_at = ?
                WHERE id = ?
                """,
                (merged_name, merged_type, merged_secret, _now(), connection_id),
            )

    updated = get_connection_record(connection_id)
    assert updated is not None
    return updated


def connection_usage(connection_id: str) -> list[str]:
    names: list[str] = []
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT name, nodes FROM workflows").fetchall()
    for row in rows:
        for node in _parse_nodes_column(row["nodes"]):
            data = node.get("data")
            if not isinstance(data, dict):
                continue
            config = data.get("config")
            if not isinstance(config, dict):
                continue
            if config.get("connection_id") == connection_id:
                names.append(row["name"])
                break
    return names


def delete_connection(connection_id: str) -> bool:
    with closing(get_connection()) as connection:
        with connection:
            cursor = connection.execute(
                "DELETE FROM connections WHERE id = ?", (connection_id,)
            )
    return cursor.rowcount > 0


NODE_CONNECTION_TYPES = {
    "postgres-source": "postgres",
    "postgres-storage": "postgres",
    "mysql-source": "mysql",
    "data-warehouse": "warehouse",
}


def migrate_connection_strings(dry_run: bool = False) -> WorkflowDict:
    with closing(get_connection()) as connection:
        rows = connection.execute("SELECT * FROM workflows").fetchall()

    workflows_nodes: dict[str, tuple[str, list[WorkflowDict]]] = {}
    for row in rows:
        workflows_nodes[row["id"]] = (
            row["name"],
            _parse_nodes_column(row["nodes"]),
        )

    candidates: list[
        tuple[str, str, WorkflowDict, WorkflowDict, str]
    ] = []
    for workflow_id, (workflow_name, nodes) in workflows_nodes.items():
        for node in nodes:
            data = node.get("data")
            if not isinstance(data, dict):
                continue
            config = data.get("config")
            if not isinstance(config, dict):
                continue
            secret = config.get("connection_string")
            if not isinstance(secret, str) or not secret.strip():
                continue
            candidates.append(
                (workflow_id, workflow_name, node, config, secret)
            )

    secret_to_connection: dict[str, tuple[str | None, str]] = {}
    details: list[WorkflowDict] = []
    touched_workflows: set[str] = set()

    for workflow_id, workflow_name, node, config, secret in candidates:
        node_data = node.get("data")
        node_name = (
            str(node_data.get("name"))
            if isinstance(node_data, dict) and node_data.get("name")
            else str(node.get("id") or "node")
        )
        node_type = str(node.get("type") or "unknown")

        existing = config.get("connection_id")
        if isinstance(existing, str) and existing:
            action = "cleaned"
            conn_id: str | None = existing
            conn_name = "(kept existing)"
        elif secret in secret_to_connection:
            action = "reused"
            conn_id, conn_name = secret_to_connection[secret]
        else:
            action = "created"
            conn_type = NODE_CONNECTION_TYPES.get(node_type, "other")
            conn_name = f"{workflow_name} / {node_name}"
            if dry_run:
                conn_id = None
            else:
                created = create_connection(conn_name, conn_type, secret)
                conn_id = created["id"]
            secret_to_connection[secret] = (conn_id, conn_name)

        details.append(
            {
                "workflow_id": workflow_id,
                "workflow_name": workflow_name,
                "node_id": str(node.get("id") or ""),
                "node_name": node_name,
                "node_type": node_type,
                "action": action,
                "connection_id": conn_id,
                "connection_name": conn_name,
            }
        )

        if not dry_run:
            touched_workflows.add(workflow_id)
            del config["connection_string"]
            if action != "cleaned" and conn_id is not None:
                config["connection_id"] = conn_id

    if not dry_run:
        for workflow_id in touched_workflows:
            _, nodes = workflows_nodes[workflow_id]
            with closing(get_connection()) as connection:
                with connection:
                    connection.execute(
                        "UPDATE workflows SET nodes = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(nodes), _now(), workflow_id),
                    )

    return {
        "migrated": not dry_run,
        "created_connections": len(
            [d for d in details if d["action"] == "created"]
        )
        if not dry_run
        else 0,
        "updated_workflows": len(touched_workflows) if not dry_run else 0,
        "cleaned_nodes": len(details) if not dry_run else 0,
        "details": details,
    }

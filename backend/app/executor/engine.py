from typing import Any

from .graph import CycleError, topological_order
from .handlers import NodeError, NodeFailedError, execute_node

Node = dict[str, Any]


def _columns(rows: list[dict[str, Any]]) -> list[str]:
    columns: list[str] = []
    for record in rows:
        for key in record.keys():
            if key not in columns:
                columns.append(key)
    return sorted(columns)


def run_workflow(nodes: list[Node], edges: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {node["id"]: node for node in nodes if node.get("id")}

    try:
        order = topological_order(
            list(by_id.keys()),
            [
                (edge["source"], edge["target"])
                for edge in edges
                if edge.get("source") and edge.get("target")
            ],
        )
    except CycleError as error:
        return {"status": "failed", "nodes": {}, "error": str(error)}

    edge_pairs = [
        (edge["source"], edge["target"])
        for edge in edges
        if edge.get("source") and edge.get("target")
    ]
    outputs: dict[str, list[dict[str, Any]]] = {}
    results: dict[str, dict[str, Any]] = {}

    for node_id in order:
        node = by_id[node_id]
        inputs = [
            outputs[source]
            for source, target in edge_pairs
            if target == node_id and source in outputs
        ]
        try:
            rows, log = execute_node(node, inputs)
            results[node_id] = {
                "status": "success",
                "rows": len(rows),
                "columns": _columns(rows),
                "log": log,
                "error": None,
            }
            outputs[node_id] = rows
        except NodeFailedError as error:
            results[node_id] = {
                "status": "failed",
                "rows": 0,
                "columns": [],
                "log": [],
                "error": str(error),
            }
            return {
                "status": "failed",
                "nodes": results,
                "error": f"node '{node.get('id')}' failed: {error}",
            }
        except NodeError as error:
            results[node_id] = {
                "status": "error",
                "rows": 0,
                "columns": [],
                "log": [],
                "error": str(error),
            }
            return {
                "status": "failed",
                "nodes": results,
                "error": f"node '{node.get('id')}' errored: {error}",
            }

    return {"status": "success", "nodes": results, "error": None}

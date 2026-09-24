from typing import Any

from .. import repository
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


def _edge_pairs(edges: list[dict[str, Any]]) -> list[tuple[str, str]]:
    return [
        (edge["source"], edge["target"])
        for edge in edges
        if edge.get("source") and edge.get("target")
    ]


def run_workflow(nodes: list[Node], edges: list[dict[str, Any]]) -> dict[str, Any]:
    result, _ = _execute(nodes, edges, ())
    return result


def run_subworkflow(
    workflow_id: str, stack: tuple[str, ...]
) -> tuple[list[dict[str, Any]], str]:
    if workflow_id in stack:
        chain = " → ".join([*stack, workflow_id])
        raise NodeError(f"circular workflow call detected: {chain}")

    target = repository.get_workflow(workflow_id)
    if target is None:
        raise NodeError(f"workflow '{workflow_id}' not found")

    sub_result, sub_outputs = _execute(
        target["nodes"], target["edges"], (*stack, workflow_id)
    )
    if sub_result["status"] != "success":
        raise NodeError(
            f"workflow '{target['name']}' failed: {sub_result.get('error')}"
        )

    produced = {source for source, _ in _edge_pairs(target["edges"])}
    merged: list[dict[str, Any]] = []
    for node_id, rows in sub_outputs.items():
        if node_id not in produced:
            merged.extend(rows)

    return merged, f"ran '{target['name']}': {len(merged)} rows"


def _execute(
    nodes: list[Node], edges: list[dict[str, Any]], stack: tuple[str, ...]
) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    by_id = {node["id"]: node for node in nodes if node.get("id")}

    try:
        order = topological_order(list(by_id.keys()), _edge_pairs(edges))
    except CycleError as error:
        return {"status": "failed", "nodes": {}, "error": str(error)}, {}

    edge_pairs = _edge_pairs(edges)
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
            rows, log = execute_node(
                node, inputs, lambda wid: run_subworkflow(wid, stack)
            )
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
            return (
                {
                    "status": "failed",
                    "nodes": results,
                    "error": f"node '{node.get('id')}' failed: {error}",
                },
                outputs,
            )
        except NodeError as error:
            results[node_id] = {
                "status": "error",
                "rows": 0,
                "columns": [],
                "log": [],
                "error": str(error),
            }
            return (
                {
                    "status": "failed",
                    "nodes": results,
                    "error": f"node '{node.get('id')}' errored: {error}",
                },
                outputs,
            )

    return {"status": "success", "nodes": results, "error": None}, outputs

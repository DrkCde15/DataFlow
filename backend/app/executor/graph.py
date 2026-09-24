class CycleError(Exception):
    pass


def topological_order(
    node_ids: list[str], edges: list[tuple[str, str]]
) -> list[str]:
    children: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    indegree: dict[str, int] = {node_id: 0 for node_id in node_ids}

    for source, target in edges:
        if source not in indegree or target not in indegree:
            continue
        if target not in children[source]:
            children[source].append(target)
            indegree[target] += 1

    queue = [node_id for node_id in node_ids if indegree[node_id] == 0]
    order: list[str] = []

    while queue:
        current = queue.pop(0)
        order.append(current)
        for child in children[current]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    if len(order) != len(node_ids):
        raise CycleError("workflow has a cycle")

    return order

from .conftest import sample_node, workflow_payload


def file_node(node_id, file_id, filename="in.csv"):
    return sample_node(
        node_id,
        "file",
        config={"file": {"id": file_id, "filename": filename}, "format": "csv"},
    )


def call_node(node_id, workflow_id):
    return sample_node(
        node_id, "workflow-call", config={"workflow_id": workflow_id}
    )


def upload(client, name, content):
    return client.post("/api/files", files={"file": (name, content)}).json()


def create_wf(client, name, nodes, edges=None):
    return client.post(
        "/api/workflows", json=workflow_payload(name, nodes, edges or [])
    ).json()


def edge(source, target):
    return {"id": f"{source}-{target}", "source": source, "target": target}


def test_subworkflow_run(client):
    attachment = upload(client, "a.csv", b"id,v\n1,x\n2,y\n")
    child = create_wf(
        client,
        "child",
        [
            file_node("f", attachment["id"]),
            sample_node("flt", "filter", config={"condition": "id > 1"}),
        ],
        [edge("f", "flt")],
    )
    parent = create_wf(client, "parent", [call_node("c", child["id"])])
    run = client.post(f"/api/workflows/{parent['id']}/run").json()
    assert run["status"] == "success"
    assert run["nodes"]["c"]["rows"] == 1
    assert "child" in (run["nodes"]["c"]["log"][0] or "")


def test_subworkflow_cycle(client):
    first = create_wf(client, "a", [call_node("c", "pending")])
    second = create_wf(client, "b", [call_node("c", first["id"])])
    client.put(
        f"/api/workflows/{first['id']}",
        json={"nodes": [call_node("c", second["id"])]},
    )
    run = client.post(f"/api/workflows/{first['id']}/run").json()
    assert run["status"] == "failed"
    assert "circular" in (run["nodes"]["c"]["error"] or "")


def test_subworkflow_missing(client):
    parent = create_wf(client, "parent", [call_node("c", "nope")])
    run = client.post(f"/api/workflows/{parent['id']}/run").json()
    assert run["status"] == "failed"
    assert "not found" in (run["nodes"]["c"]["error"] or "")


def test_subworkflow_child_failure_propagates(client):
    attachment = upload(client, "a.csv", b"id\n1\n")
    child = create_wf(
        client,
        "child",
        [
            file_node("f", attachment["id"]),
            sample_node("q", "null-check", config={"columns": "missing"}),
        ],
        [edge("f", "q")],
    )
    parent = create_wf(client, "parent", [call_node("c", child["id"])])
    run = client.post(f"/api/workflows/{parent['id']}/run").json()
    assert run["status"] == "failed"
    assert run["nodes"]["c"]["status"] == "error"


def test_subworkflow_merges_sinks(client):
    first = upload(client, "a.csv", b"id\n1\n2\n")
    second = upload(client, "b.csv", b"id\n3\n")
    child = create_wf(
        client,
        "child",
        [file_node("f1", first["id"]), file_node("f2", second["id"])],
    )
    parent = create_wf(client, "parent", [call_node("c", child["id"])])
    run = client.post(f"/api/workflows/{parent['id']}/run").json()
    assert run["status"] == "success"
    assert run["nodes"]["c"]["rows"] == 3


def test_workflow_call_without_selection_fails(client):
    parent = create_wf(client, "parent", [call_node("c", "")])
    run = client.post(f"/api/workflows/{parent['id']}/run").json()
    assert run["status"] == "failed"
    assert "no workflow selected" in (run["nodes"]["c"]["error"] or "")

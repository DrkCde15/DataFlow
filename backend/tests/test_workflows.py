from .conftest import legacy_node, sample_node, workflow_payload


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_get_workflow(client):
    created = client.post(
        "/api/workflows", json=workflow_payload("demo")
    ).json()
    assert created["name"] == "demo"
    assert created["id"]

    fetched = client.get(f"/api/workflows/{created['id']}").json()
    assert fetched == created


def test_list_orders_by_updated_desc(client):
    first = client.post("/api/workflows", json=workflow_payload("a")).json()
    second = client.post("/api/workflows", json=workflow_payload("b")).json()
    listed = client.get("/api/workflows").json()
    assert [w["id"] for w in listed] == [second["id"], first["id"]]
    assert listed[0]["node_count"] == 0


def test_update_merges_partial_payload(client):
    node = sample_node()
    created = client.post(
        "/api/workflows", json=workflow_payload("w", nodes=[node])
    ).json()

    updated = client.put(
        f"/api/workflows/{created['id']}", json={"name": "renamed"}
    ).json()
    assert updated["name"] == "renamed"
    assert updated["nodes"] == [node]
    assert updated["updated_at"] >= updated["created_at"]


def test_update_missing_returns_404(client):
    response = client.put("/api/workflows/nope", json={"name": "x"})
    assert response.status_code == 404


def test_create_rejects_blank_name(client):
    response = client.post("/api/workflows", json=workflow_payload(""))
    assert response.status_code == 422


def test_delete_workflow_and_missing(client):
    created = client.post("/api/workflows", json=workflow_payload()).json()
    assert client.delete(f"/api/workflows/{created['id']}").status_code == 204
    assert client.delete(f"/api/workflows/{created['id']}").status_code == 404
    assert client.get(f"/api/workflows/{created['id']}").status_code == 404


def test_delete_removes_unreferenced_upload(client, data_dir):
    uploaded = client.post(
        "/api/files", files={"file": ("a.csv", b"id,name\n1,x\n")}
    ).json()
    node = sample_node(
        "f1",
        "file",
        config={"file": {"id": uploaded["id"], "filename": "a.csv"}},
    )
    created = client.post(
        "/api/workflows", json=workflow_payload("w", nodes=[node])
    ).json()

    assert (data_dir / "uploads" / uploaded["id"]).exists()
    assert (
        client.delete(f"/api/workflows/{created['id']}").status_code == 204
    )
    assert not (data_dir / "uploads" / uploaded["id"]).exists()


def test_delete_keeps_file_used_by_other_workflow(client, data_dir):
    uploaded = client.post(
        "/api/files", files={"file": ("a.csv", b"id\n1\n")}
    ).json()
    config = {"file": {"id": uploaded["id"], "filename": "a.csv"}}
    first = client.post(
        "/api/workflows",
        json=workflow_payload("w1", nodes=[sample_node("f", "file", config=config)]),
    ).json()
    client.post(
        "/api/workflows",
        json=workflow_payload("w2", nodes=[sample_node("f", "file", config=config)]),
    )

    client.delete(f"/api/workflows/{first['id']}")
    assert (data_dir / "uploads" / uploaded["id"]).exists()

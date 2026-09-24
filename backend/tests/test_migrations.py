from .conftest import legacy_node, workflow_payload


def legacy_workflow(name, secrets):
    nodes = [
        legacy_node(f"n{i}", secret) for i, secret in enumerate(secrets)
    ]
    return workflow_payload(name, nodes=nodes)


def test_dry_run_reports_without_writing(client):
    client.post(
        "/api/workflows",
        json=legacy_workflow("legacy", ["postgres://u:P1@h/db"]),
    )
    report = client.post(
        "/api/migrations/connection-strings?dry_run=true"
    ).json()
    assert report["migrated"] is False
    assert report["created_connections"] == 0
    assert len(report["details"]) == 1
    assert report["details"][0]["action"] == "created"
    assert report["details"][0]["connection_id"] is None
    assert client.get("/api/connections").json() == []


def test_apply_dedupes_reuses_and_rewrites(client):
    secret = "postgres://u:P1@h/db"
    other = "mysql://u:P2@h/db"
    created = client.post(
        "/api/workflows", json=legacy_workflow("legacy", [secret, secret, other])
    ).json()

    report = client.post("/api/migrations/connection-strings").json()
    assert report["migrated"] is True
    assert report["created_connections"] == 2
    assert report["updated_workflows"] == 1
    actions = [d["action"] for d in report["details"]]
    assert actions == ["created", "reused", "created"]

    workflow = client.get(f"/api/workflows/{created['id']}").json()
    assert "P1" not in str(workflow) and "P2" not in str(workflow)
    configs = [n["data"]["config"] for n in workflow["nodes"]]
    assert configs[0]["connection_id"] == configs[1]["connection_id"]
    assert "connection_string" not in configs[0]

    connections = {c["name"]: c for c in client.get("/api/connections").json()}
    assert set(connections) == {"legacy / N", "legacy / N"}
    assert connections["legacy / N"]["type"] in ("postgres", "mysql")


def test_second_run_finds_nothing(client):
    client.post(
        "/api/workflows", json=legacy_workflow("legacy", ["postgres://u:P@h/db"])
    )
    client.post("/api/migrations/connection-strings")
    report = client.post("/api/migrations/connection-strings").json()
    assert report["details"] == []
    assert report["created_connections"] == 0

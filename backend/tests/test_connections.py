SECRET = "postgresql://admin:SUPERSECRET@prod:5432/vendas"


def create_connection(client, name="prod", type="postgres", secret=SECRET):
    return client.post(
        "/api/connections",
        json={"name": name, "type": type, "connection_string": secret},
    )


def test_create_hides_secret(client):
    response = create_connection(client)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "prod"
    assert "connection_string" not in body
    assert "SUPERSECRET" not in response.text


def test_get_and_list_hide_secret(client):
    created = create_connection(client).json()
    assert "SUPERSECRET" not in client.get("/api/connections").text
    fetched = client.get(f"/api/connections/{created['id']}").json()
    assert fetched["id"] == created["id"]
    assert "connection_string" not in fetched


def test_update_keeps_secret_when_blank(client):
    created = create_connection(client).json()
    updated = client.put(
        f"/api/connections/{created['id']}", json={"name": "renamed"}
    ).json()
    assert updated["name"] == "renamed"
    assert updated["type"] == "postgres"


def test_delete_unreferenced_returns_204(client):
    created = create_connection(client).json()
    assert (
        client.delete(f"/api/connections/{created['id']}").status_code == 204
    )
    assert client.delete(f"/api/connections/{created['id']}").status_code == 404


def test_delete_in_use_returns_409_with_names(client):
    from .conftest import sample_node, workflow_payload

    created = create_connection(client).json()
    node = sample_node(
        "p1",
        "postgres-source",
        config={"connection_id": created["id"], "query": "SELECT 1"},
    )
    client.post("/api/workflows", json=workflow_payload("w", nodes=[node]))

    response = client.delete(f"/api/connections/{created['id']}")
    assert response.status_code == 409
    assert "w" in response.json()["detail"]


def test_create_rejects_blank_secret(client):
    response = client.post(
        "/api/connections",
        json={"name": "x", "type": "postgres", "connection_string": ""},
    )
    assert response.status_code == 422

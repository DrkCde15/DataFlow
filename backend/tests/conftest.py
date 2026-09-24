import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATAFLOW_DATA_DIR", str(tmp_path))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("DATAFLOW_DATA_DIR", str(tmp_path))
    init_db()
    return tmp_path


@pytest.fixture()
def upload_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("DATAFLOW_DATA_DIR", str(tmp_path))
    init_db()
    target = tmp_path / "uploads"
    target.mkdir(parents=True, exist_ok=True)
    return target


def workflow_payload(name="wf", nodes=None, edges=None):
    return {
        "name": name,
        "nodes": nodes if nodes is not None else [],
        "edges": edges if edges is not None else [],
    }


def sample_node(node_id="n1", node_type="sql", **data_overrides):
    data = {
        "nodeType": node_type,
        "name": "N",
        "description": "",
        "status": "ready",
        "config": {},
    }
    data.update(data_overrides)
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 0, "y": 0},
        "data": data,
    }


def legacy_node(node_id, secret):
    return sample_node(
        node_id,
        "postgres-source",
        config={"connection_string": secret, "query": "SELECT 1"},
    )

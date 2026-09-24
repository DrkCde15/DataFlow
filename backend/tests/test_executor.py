import json as jsonlib
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from app.executor import engine
from app.executor.graph import CycleError, topological_order


def node(node_id, node_type, config=None):
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 0, "y": 0},
        "data": {
            "nodeType": node_type,
            "name": node_id,
            "description": "",
            "status": "ready",
            "config": config or {},
        },
    }


def edge(source, target):
    return {"id": f"{source}-{target}", "source": source, "target": target}


@pytest.fixture()
def upload_dir(tmp_path, monkeypatch):
    from app.database import init_db

    monkeypatch.setenv("DATAFLOW_DATA_DIR", str(tmp_path))
    init_db()
    target = tmp_path / "uploads"
    target.mkdir(parents=True, exist_ok=True)
    return target


def write_csv(upload_dir, name, text):
    file_id = f"file-{name}"
    (upload_dir / file_id).write_bytes(text.encode("utf-8"))
    return {"id": file_id, "filename": name, "size": len(text)}


class _JsonHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = jsonlib.dumps([{"id": 1, "v": "a"}, {"id": 2, "v": "b"}]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


@pytest.fixture()
def json_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _JsonHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}/data"
    server.shutdown()


def test_topological_order_respects_edges():
    order = topological_order(["a", "b", "c"], [("a", "b"), ("b", "c")])
    assert order == ["a", "b", "c"]


def test_topological_order_ignores_unknown_endpoints():
    order = topological_order(["a"], [("a", "ghost"), ("ghost", "a")])
    assert order == ["a"]


def test_topological_order_detects_cycle():
    with pytest.raises(CycleError):
        topological_order(["a", "b"], [("a", "b"), ("b", "a")])


def test_file_csv(upload_dir):
    attachment = write_csv(upload_dir, "a.csv", "id,name\n1,foo\n2,bar\n")
    nodes = [node("f", "file", {"file": attachment, "format": "auto"})]
    result = engine.run_workflow(nodes, [])
    assert result["status"] == "success"
    assert result["nodes"]["f"]["rows"] == 2
    assert result["nodes"]["f"]["columns"] == ["id", "name"]


def test_file_json(upload_dir):
    file_id = "file-j"
    (upload_dir / file_id).write_bytes(b'[{"a": 1}, {"a": 2}]')
    nodes = [
        node(
            "f",
            "file",
            {"file": {"id": file_id, "filename": "d.json"}, "format": "auto"},
        )
    ]
    result = engine.run_workflow(nodes, [])
    assert result["status"] == "success"
    assert result["nodes"]["f"]["rows"] == 2


def test_file_missing_attachment_fails():
    result = engine.run_workflow([node("f", "file", {})], [])
    assert result["status"] == "failed"
    assert result["nodes"]["f"]["status"] == "error"


def test_file_unsupported_format_fails(upload_dir):
    attachment = write_csv(upload_dir, "a.avro", "x")
    nodes = [node("f", "file", {"file": attachment, "format": "avro"})]
    result = engine.run_workflow(nodes, [])
    assert result["status"] == "failed"
    assert "not readable yet" in (result["nodes"]["f"]["error"] or "")


def test_file_broken_parquet_fails_clearly(upload_dir):
    attachment = write_csv(upload_dir, "a.parquet", "x")
    nodes = [node("f", "file", {"file": attachment, "format": "parquet"})]
    result = engine.run_workflow(nodes, [])
    assert result["status"] == "failed"
    assert "cannot read parquet" in (result["nodes"]["f"]["error"] or "")


def csv_pipeline(upload_dir, text="id,amount\n1,150\n2,40\n3,200\n"):
    attachment = write_csv(upload_dir, "in.csv", text)
    return [
        node("f", "file", {"file": attachment, "format": "csv"}),
        node("flt", "filter", {"condition": "amount > 100"}),
    ], [edge("f", "flt")]


def test_filter_keeps_matching_rows(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "success"
    assert result["nodes"]["flt"]["rows"] == 2


def test_filter_rejects_bad_condition(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes[1]["data"]["config"]["condition"] = "amount"
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "failed"
    assert result["nodes"]["flt"]["status"] == "error"


def test_filter_treats_blank_as_no_match(upload_dir):
    nodes, edges = csv_pipeline(upload_dir, "id,amount\n1,150\n2,\n")
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "success"
    assert result["nodes"]["flt"]["rows"] == 1


def test_filter_null_equality(upload_dir):
    nodes, edges = csv_pipeline(upload_dir, "id,amount\n1,150\n2,\n")
    nodes[1]["data"]["config"]["condition"] = "amount == null"
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "success"
    assert result["nodes"]["flt"]["rows"] == 1


def test_filter_rejects_unknown_column(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes[1]["data"]["config"]["condition"] = "nope > 1"
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "failed"


def test_join_inner_and_left(upload_dir):
    left = write_csv(upload_dir, "l.csv", "id,v\n1,a\n2,b\n")
    right = write_csv(upload_dir, "r.csv", "id,w\n2,B\n3,C\n")
    base = [
        node("l", "file", {"file": left, "format": "csv"}),
        node("r", "file", {"file": right, "format": "csv"}),
        node(
            "j",
            "join",
            {"left_key": "id", "right_key": "id", "join_type": "inner"},
        ),
    ]
    result = engine.run_workflow(base, [edge("l", "j"), edge("r", "j")])
    assert result["status"] == "success"
    assert result["nodes"]["j"]["rows"] == 1

    base[2]["data"]["config"]["join_type"] = "left"
    result = engine.run_workflow(base, [edge("l", "j"), edge("r", "j")])
    assert result["nodes"]["j"]["rows"] == 2


def test_join_needs_two_inputs(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes.append(node("j", "join", {"left_key": "id", "right_key": "id"}))
    edges.append(edge("flt", "j"))
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "failed"


def test_aggregate_sum_and_count(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes.append(
        node(
            "agg",
            "aggregate",
            {"group_by": "", "aggregations": "sum(amount), count(*)"},
        )
    )
    edges.append(edge("flt", "agg"))
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "success"
    assert result["nodes"]["agg"]["rows"] == 1


def test_null_check_pass_and_fail(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes.append(node("q", "null-check", {"columns": "id, amount"}))
    edges.append(edge("flt", "q"))
    assert engine.run_workflow(nodes, edges)["status"] == "success"

    bad_nodes, bad_edges = csv_pipeline(upload_dir, "id,amount\n1,\n2,5\n")
    bad_nodes[1]["data"]["config"] = {"condition": "id > 0"}
    bad_nodes.append(node("q", "null-check", {"columns": "amount"}))
    bad_edges.append(edge("flt", "q"))
    result = engine.run_workflow(bad_nodes, bad_edges)
    assert result["status"] == "failed"
    assert result["nodes"]["q"]["status"] == "failed"


def test_duplicate_check(upload_dir):
    nodes, edges = csv_pipeline(upload_dir, "id\n1\n1\n2\n")
    nodes.append(node("q", "duplicate-check", {"keys": "id"}))
    edges.append(edge("flt", "q"))
    nodes[1]["data"]["config"] = {"condition": "id > 0"}
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "failed"
    assert "duplicate" in (result["nodes"]["q"]["error"] or "")


def test_schema_validation(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    schema = {"id": "integer", "amount": "integer"}
    nodes.append(node("q", "schema-validation", {"schema": jsonlib.dumps(schema)}))
    edges.append(edge("flt", "q"))
    assert engine.run_workflow(nodes, edges)["status"] == "success"

    nodes[2]["data"]["config"]["schema"] = jsonlib.dumps({"id": "integer", "nope": "string"})
    result = engine.run_workflow(nodes, edges)
    assert result["nodes"]["q"]["status"] == "failed"


def test_data_freshness(upload_dir):
    fresh = "ts\n2100-01-01T00:00:00\n"
    nodes, edges = csv_pipeline(upload_dir, fresh)
    nodes[1]["data"]["config"] = {"condition": "ts != ''"}
    nodes.append(
        node("q", "data-freshness", {"column": "ts", "max_age_hours": 24})
    )
    edges.append(edge("flt", "q"))
    assert engine.run_workflow(nodes, edges)["status"] == "success"

    old = "ts\n2000-01-01T00:00:00\n"
    nodes2, edges2 = csv_pipeline(upload_dir, old)
    nodes2[1]["data"]["config"] = {"condition": "ts != ''"}
    nodes2.append(
        node("q", "data-freshness", {"column": "ts", "max_age_hours": 24})
    )
    edges2.append(edge("flt", "q"))
    assert engine.run_workflow(nodes2, edges2)["status"] == "failed"


def test_sql_select(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes.append(
        node("s", "sql", {"query": "SELECT id FROM input WHERE amount > 100"})
    )
    edges.append(edge("flt", "s"))
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "success"
    assert result["nodes"]["s"]["rows"] == 2

    nodes[2]["data"]["config"]["query"] = "SELECT FROM WHERE"
    assert engine.run_workflow(nodes, edges)["status"] == "failed"


def test_python_transform_and_error(upload_dir):
    nodes, edges = csv_pipeline(upload_dir)
    nodes.append(node("p", "python", {"code": "rows = [r for r in rows if int(r['amount']) > 100]"}))
    edges.append(edge("flt", "p"))
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "success"

    nodes[2]["data"]["config"]["code"] = "raise ValueError('boom')"
    assert engine.run_workflow(nodes, edges)["status"] == "failed"


def test_rest_api(json_server):
    nodes = [node("api", "rest-api", {"url": json_server, "method": "GET"})]
    result = engine.run_workflow(nodes, [])
    assert result["status"] == "success"
    assert result["nodes"]["api"]["rows"] == 2


def test_unsupported_node_type_fails():
    result = engine.run_workflow([node("c", "condition", {})], [])
    assert result["status"] == "failed"
    assert "not executable yet" in (result["nodes"]["c"]["error"] or "")


def test_cycle_fails():
    nodes = [node("a", "filter", {}), node("b", "filter", {})]
    result = engine.run_workflow(nodes, [edge("a", "b"), edge("b", "a")])
    assert result["status"] == "failed"
    assert "cycle" in (result["error"] or "")


def test_fail_fast_skips_downstream(upload_dir):
    nodes, edges = csv_pipeline(upload_dir, "id,amount\n1,\n2,5\n")
    nodes[1]["data"]["config"] = {"condition": "id > 0"}
    nodes.append(node("q", "null-check", {"columns": "amount"}))
    nodes.append(node("s", "sql", {"query": "SELECT * FROM input"}))
    edges += [edge("flt", "q"), edge("q", "s")]
    result = engine.run_workflow(nodes, edges)
    assert result["status"] == "failed"
    assert "s" not in result["nodes"]


def test_run_endpoint_and_history(client):
    from .conftest import workflow_payload

    created = client.post("/api/workflows", json=workflow_payload("w")).json()
    run = client.post(f"/api/workflows/{created['id']}/run").json()
    assert run["status"] in ("success", "failed")
    assert run["workflow_id"] == created["id"]

    history = client.get(f"/api/workflows/{created['id']}/runs").json()
    assert len(history) == 1
    assert history[0]["id"] == run["id"]

    fetched = client.get(f"/api/runs/{run['id']}").json()
    assert fetched["id"] == run["id"]


def test_run_endpoint_404s(client):
    assert client.post("/api/workflows/nope/run").status_code == 404
    assert client.get("/api/workflows/nope/runs").status_code == 404
    assert client.get("/api/runs/nope").status_code == 404


def test_run_real_pipeline_through_api(client):
    from .conftest import sample_node, workflow_payload

    uploaded = client.post(
        "/api/files", files={"file": ("in.csv", b"id,amount\n1,150\n2,40\n")}
    ).json()
    nodes = [
        sample_node(
            "f",
            "file",
            config={
                "file": {
                    "id": uploaded["id"],
                    "filename": "in.csv",
                    "size": 1,
                },
                "format": "csv",
            },
        ),
        sample_node("flt", "filter", config={"condition": "amount > 100"}),
    ]
    edges = [{"id": "e", "source": "f", "target": "flt"}]
    created = client.post(
        "/api/workflows", json=workflow_payload("pipe", nodes, edges)
    ).json()

    run = client.post(f"/api/workflows/{created['id']}/run").json()
    assert run["status"] == "success"
    assert run["nodes"]["f"]["rows"] == 2
    assert run["nodes"]["flt"]["rows"] == 1

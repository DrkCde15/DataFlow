import sys

import pytest

from app.executor import db as db_helpers
from app.executor import engine
from app.executor.handlers import NodeError


class _FakeCursor:
    def __init__(self):
        self.executed = []
        self.rows = []
        self.columns = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    @property
    def description(self):
        return [(column,) for column in self.columns]

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def executemany(self, query, seq):
        self.executed.append((query, list(seq)))

    def fetchall(self):
        return self.rows


class _FakeConnection:
    def __init__(self):
        self.cursor_obj = _FakeCursor()
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


@pytest.fixture()
def fake_pg(monkeypatch):
    state = {}

    class FakePsycopg:
        @staticmethod
        def connect(*args, **kwargs):
            connection = _FakeConnection()
            state["connection"] = connection
            return connection

    monkeypatch.setitem(sys.modules, "psycopg", FakePsycopg)
    return state


def pg_node(node_id, node_type, **config):
    from .conftest import sample_node

    return sample_node(node_id, node_type, config=config)


def test_validate_table_name():
    assert db_helpers.validate_table_name("events") == "events"
    assert db_helpers.validate_table_name(" public.events ") == "public.events"
    for bad in ["", "drop table x", "my-table", "1abc", "a b", "t;"]:
        with pytest.raises(ValueError):
            db_helpers.validate_table_name(bad)


def test_assert_select_only():
    db_helpers.assert_select_only("SELECT * FROM t")
    db_helpers.assert_select_only("  -- comment\nWITH x AS (SELECT 1) SELECT * FROM x")
    for bad in ["INSERT INTO t VALUES (1)", "DELETE FROM t", "DROP TABLE t", ""]:
        with pytest.raises(ValueError):
            db_helpers.assert_select_only(bad)


def test_pg_type_for():
    assert db_helpers.pg_type_for([1, 2, None]) == "BIGINT"
    assert db_helpers.pg_type_for([1.5, 2]) == "DOUBLE PRECISION"
    assert db_helpers.pg_type_for(["a", 1]) == "TEXT"
    assert db_helpers.pg_type_for([True, False]) == "BOOLEAN"
    assert db_helpers.pg_type_for([None, ""]) == "TEXT"


def test_pg_read_returns_dicts(fake_pg):
    rows = db_helpers.pg_read("postgres://x", "SELECT id FROM t")
    assert rows == []
    cursor = fake_pg["connection"].cursor_obj
    assert cursor.executed[0][0] == "SELECT id FROM t"


def test_pg_read_rejects_non_select(fake_pg):
    with pytest.raises(ValueError):
        db_helpers.pg_read("postgres://x", "DELETE FROM t")


def test_pg_write_creates_and_inserts(fake_pg):
    rows = [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]
    written = db_helpers.pg_write("postgres://x", "public.events", rows)
    assert written == 2
    connection = fake_pg["connection"]
    assert connection.committed is True
    create, insert = connection.cursor_obj.executed
    assert "CREATE TABLE IF NOT EXISTS public.events" in create[0]
    assert "BIGINT" in create[0]
    assert insert[1] == [[1, "a"], [2, "b"]]


def test_pg_write_empty_writes_nothing(fake_pg):
    assert db_helpers.pg_write("postgres://x", "t", []) == 0
    assert "connection" not in fake_pg


def test_pg_write_rejects_bad_table(fake_pg):
    with pytest.raises(ValueError):
        db_helpers.pg_write("postgres://x", "drop table t", [{"a": 1}])


def test_resolve_connection_string_missing(data_dir):
    with pytest.raises(LookupError):
        db_helpers.resolve_connection_string("nope")


def test_postgres_source_handler(fake_pg, data_dir):
    from app import repository

    created = repository.create_connection("pg", "postgres", "postgres://x")
    node = pg_node(
        "p",
        "postgres-source",
        connection_id=created["id"],
        query="SELECT 1",
    )
    fake_pg_conn = None

    from app.executor import handlers

    rows, log = handlers.execute_node(node, [])
    assert rows == []
    assert log == ["read 0 rows"]


def test_postgres_source_without_connection():
    from app.executor import handlers

    node = pg_node("p", "postgres-source", query="SELECT 1")
    with pytest.raises(NodeError):
        handlers.execute_node(node, [])


def test_mysql_source_is_unsupported():
    from app.executor import handlers

    node = pg_node("m", "mysql-source")
    with pytest.raises(NodeError, match="not installed yet"):
        handlers.execute_node(node, [])


def test_postgres_storage_passthrough(fake_pg, data_dir):
    from app import repository
    from app.executor import handlers

    created = repository.create_connection("pg", "postgres", "postgres://x")
    node = pg_node(
        "s", "postgres-storage", connection_id=created["id"], table="events"
    )
    rows = [{"id": 1}]
    output, log = handlers.execute_node(node, [rows])
    assert output == rows
    assert log == ["wrote 1 rows to events"]


def test_parquet_roundtrip(tmp_path, upload_dir):
    import json

    from app.executor import engine, handlers

    rows = [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}]
    target = tmp_path / "out.parquet"
    output, _ = handlers.execute_node(
        pg_node("w", "parquet", path=str(target)), [rows]
    )
    assert output == rows
    assert target.exists()

    file_id = "pq1"
    (upload_dir / file_id).write_bytes(target.read_bytes())
    result = engine.run_workflow(
        [
            pg_node(
                "r",
                "file",
                file={"id": file_id, "filename": "out.parquet"},
                format="auto",
            )
        ],
        [],
    )
    assert result["status"] == "success"
    read = result["nodes"]["r"]["preview"]
    assert read == rows
    assert [type(record["id"]) for record in read] == [int, int]
    json.dumps(read)


def test_parquet_write_needs_path():
    from app.executor import handlers

    with pytest.raises(NodeError):
        handlers.execute_node(pg_node("w", "parquet", path=""), [[{"a": 1}]])


def test_preview_is_capped():
    trigger = {
        "id": "t",
        "type": "trigger",
        "position": {"x": 0, "y": 0},
        "data": {
            "name": "t",
            "description": "",
            "status": "ready",
            "config": {},
        },
    }
    gen = {
        "id": "p",
        "type": "python",
        "position": {"x": 0, "y": 0},
        "data": {
            "name": "p",
            "description": "",
            "status": "ready",
            "config": {"code": "rows = [{'n': i} for i in range(150)]"},
        },
    }
    result = engine.run_workflow(
        [trigger, gen],
        [{"id": "e", "source": "t", "target": "p"}],
    )
    assert result["status"] == "success"
    assert result["nodes"]["p"]["rows"] == 150
    assert len(result["nodes"]["p"]["preview"]) == 100

import os
import stat

import pytest

from app.executor import engine

FAKE_SUBMIT = """#!/usr/bin/env python3
import os
import sys
import time

mode = os.environ.get("FAKE_SPARK_MODE", "ok")
input_path, output_path, code_path = sys.argv[-3], sys.argv[-2], sys.argv[-1]
with open(code_path, encoding="utf-8") as handle:
    handle.read()

if mode == "slow":
    time.sleep(30)
if mode == "fail":
    print("fake spark boom", file=sys.stderr)
    sys.exit(1)

import pandas

if input_path == "-":
    rows = [{"gen": 1}]
else:
    rows = pandas.read_parquet(input_path).to_dict(orient="records")
pandas.DataFrame(rows).to_parquet(output_path)
"""


@pytest.fixture()
def fake_submit(tmp_path, monkeypatch):
    bindir = tmp_path / "bin"
    bindir.mkdir()
    script = bindir / "spark-submit"
    script.write_text(FAKE_SUBMIT, encoding="utf-8")
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{bindir}{os.pathsep}{os.environ['PATH']}")
    return bindir


def spark_node(node_id, **config):
    return {
        "id": node_id,
        "type": "pyspark",
        "position": {"x": 0, "y": 0},
        "data": {
            "name": node_id,
            "description": "",
            "status": "ready",
            "config": config,
        },
    }


def test_pyspark_missing_binary(monkeypatch):
    monkeypatch.setattr("shutil.which", lambda *args, **kwargs: None)
    result = engine.run_workflow([spark_node("s", code="df = df")], [])
    assert result["status"] == "failed"
    assert "spark-submit not found" in (result["nodes"]["s"]["error"] or "")


def test_pyspark_empty_code(fake_submit):
    result = engine.run_workflow([spark_node("s", code="  ")], [])
    assert result["status"] == "failed"
    assert "code is empty" in (result["nodes"]["s"]["error"] or "")


def test_pyspark_passthrough(fake_submit):
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
        "id": "gen",
        "type": "python",
        "position": {"x": 0, "y": 0},
        "data": {
            "name": "gen",
            "description": "",
            "status": "ready",
            "config": {"code": "rows = [{'id': 1}, {'id': 2}]"},
        },
    }
    result = engine.run_workflow(
        [trigger, gen, spark_node("s", code="df = df")],
        [
            {"id": "e1", "source": "t", "target": "gen"},
            {"id": "e2", "source": "gen", "target": "s"},
        ],
    )
    assert result["status"] == "success"
    assert result["nodes"]["s"]["rows"] == 2
    assert "spark job finished" in (result["nodes"]["s"]["log"][0] or "")


def test_pyspark_failure_surfaces_stderr(fake_submit, monkeypatch):
    monkeypatch.setenv("FAKE_SPARK_MODE", "fail")
    result = engine.run_workflow([spark_node("s", code="df = df")], [])
    assert result["status"] == "failed"
    error = result["nodes"]["s"]["error"] or ""
    assert "exit 1" in error
    assert "fake spark boom" in error


def test_pyspark_timeout(fake_submit, monkeypatch):
    monkeypatch.setenv("FAKE_SPARK_MODE", "slow")
    result = engine.run_workflow(
        [spark_node("s", code="df = df", timeout_seconds=1)], []
    )
    assert result["status"] == "failed"
    assert "timed out" in (result["nodes"]["s"]["error"] or "")


def test_extract_spark_error_prefers_traceback():
    from app.executor.handlers import _extract_spark_error

    stderr = "\n".join(
        [
            "26/09/24 INFO Utils: startup noise",
            "Traceback (most recent call last):",
            '  File "<pyspark>", line 1, in <module>',
            "pyspark.errors.AnalysisException: cannot resolve 'nope'",
            "26/09/24 INFO Utils: shutdown noise",
        ]
    )
    extracted, found = _extract_spark_error(stderr)
    assert found is True
    assert "AnalysisException" in extracted
    assert "startup noise" not in extracted


def test_extract_spark_error_falls_back_to_error_lines():
    from app.executor.handlers import _extract_spark_error

    stderr = "\n".join(
        [
            "26/09/24 INFO Utils: startup noise",
            "26/09/24 ERROR Executor: boom",
        ]
    )
    extracted, found = _extract_spark_error(stderr)
    assert found is True
    assert "boom" in extracted
    assert "startup noise" not in extracted


def test_extract_spark_error_reports_noise_as_not_found():
    from app.executor.handlers import _extract_spark_error

    extracted, found = _extract_spark_error("26/09/24 INFO Utils: just noise")
    assert found is False
    assert "just noise" in extracted

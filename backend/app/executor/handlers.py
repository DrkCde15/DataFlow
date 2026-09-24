import csv
import datetime
import io
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import httpx

from ..database import get_upload_dir
from . import db as db_helpers

Row = dict[str, Any]
Dataset = list[Row]
Node = dict[str, Any]


class NodeError(Exception):
    pass


class NodeFailedError(NodeError):
    pass


class UnsupportedNodeError(NodeError):
    pass


def _node_name(node: Node) -> str:
    data = node.get("data")
    if isinstance(data, dict) and data.get("name"):
        return str(data["name"])
    return str(node.get("id") or "node")


def _config(node: Node, key: str, default: Any = None) -> Any:
    data = node.get("data")
    if not isinstance(data, dict):
        return default
    config = data.get("config")
    if not isinstance(config, dict):
        return default
    value = config.get(key, default)
    return default if value is None else value


def _require_input(inputs: list[Dataset], node: Node) -> Dataset:
    if not inputs:
        raise NodeError(f"'{_node_name(node)}' has no input connected")
    return inputs[0]


def _is_null(value: Any) -> bool:
    return value is None or value == ""


def _normalize_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return value
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _normalize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize_value(item) for item in value]
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return _normalize_value(item())
        except (ValueError, TypeError):
            pass
    return str(value)


def normalize_rows(rows: Dataset) -> Dataset:
    return [
        {key: _normalize_value(value) for key, value in record.items()}
        for record in rows
        if isinstance(record, dict)
    ]


def handle_file(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    file_ref = _config(node, "file")
    if not isinstance(file_ref, dict) or not file_ref.get("id"):
        raise NodeError("no file attached")
    path = get_upload_dir() / str(file_ref["id"])
    if not path.exists():
        raise NodeError(
            f"uploaded file '{file_ref.get('filename', '?')}' not found on server"
        )

    raw = path.read_bytes()
    filename = str(file_ref.get("filename") or "file")
    fmt = str(_config(node, "format") or "auto").lower()
    if fmt == "auto":
        suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        fmt = suffix if suffix in ("csv", "json", "parquet") else ""

    if fmt == "csv":
        delimiter = str(_config(node, "delimiter") or ",") or ","
        text = raw.decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text), delimiter=delimiter))
    elif fmt == "json":
        payload = json.loads(raw.decode("utf-8"))
        if isinstance(payload, list):
            rows = [item for item in payload if isinstance(item, dict)]
        elif isinstance(payload, dict):
            rows = [payload]
        else:
            raise NodeError("JSON root must be an object or an array of objects")
    elif fmt == "parquet":
        try:
            import pandas
        except ImportError:
            raise UnsupportedNodeError("parquet support needs pandas installed")
        try:
            frame = pandas.read_parquet(io.BytesIO(raw))
        except Exception as error:
            raise NodeError(f"cannot read parquet: {error}")
        rows = frame.to_dict(orient="records")
    else:
        raise UnsupportedNodeError(
            f"format '{fmt or '?'}' is not readable yet (csv/json/parquet supported)"
        )

    return rows, [f"read {len(rows)} rows from {filename}"]


_CONDITION_RE = re.compile(
    r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$"
)


def _parse_value(text: str) -> Any:
    if len(text) >= 2 and text[0] == text[-1] and text[0] in ("'", '"'):
        return text[1:-1]
    lowered = text.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if lowered in ("null", "none"):
        return None
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        pass
    return text


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _coerce_number(value: Any) -> Any:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            pass
        try:
            return float(value)
        except ValueError:
            pass
    return None


def _compare_ordered(left: Any, op: str, right: Any) -> bool:
    if op == "==":
        return left == right
    if op == "!=":
        return left != right
    if op == ">":
        return left > right
    if op == "<":
        return left < right
    if op == ">=":
        return left >= right
    return left <= right


def _compare(left: Any, op: str, right: Any) -> bool:
    if _is_null(left) or _is_null(right):
        both_null = _is_null(left) and _is_null(right)
        if op == "==":
            return both_null
        if op == "!=":
            return not both_null
        return False
    left_number = _coerce_number(left)
    right_number = _coerce_number(right)
    if left_number is not None and right_number is not None:
        return _compare_ordered(left_number, op, right_number)
    if isinstance(left, str) and isinstance(right, str):
        return _compare_ordered(left, op, right)
    if op == "==":
        return left == right
    if op == "!=":
        return left != right
    raise NodeError(f"cannot apply '{op}' to non-numeric values")


def handle_filter(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    condition = str(_config(node, "condition") or "").strip()
    if not condition:
        raise NodeError("filter condition is empty")

    match = _CONDITION_RE.match(condition)
    if not match:
        raise NodeError(
            f"cannot parse condition '{condition}' (expected: column operator value)"
        )
    column, op, raw_value = match.groups()
    if rows and column not in rows[0]:
        raise NodeError(f"column '{column}' not found")

    value = _parse_value(raw_value)
    kept = [row for row in rows if _compare(row.get(column), op, value)]
    return kept, [f"{len(rows)} → {len(kept)} rows"]


def handle_join(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    if len(inputs) < 2:
        raise NodeError(f"'{_node_name(node)}' needs two inputs")
    left, right = inputs[0], inputs[1]
    left_key = str(_config(node, "left_key") or "")
    right_key = str(_config(node, "right_key") or "")
    if not left_key or not right_key:
        raise NodeError("join keys are empty")

    join_type = str(_config(node, "join_type") or "inner").lower()
    if join_type not in ("inner", "left", "right"):
        raise UnsupportedNodeError(f"join type '{join_type}' is not supported yet")
    if join_type == "right":
        left, right, left_key, right_key = right, left, right_key, left_key

    index: dict[Any, list[Row]] = {}
    for record in right:
        try:
            index.setdefault(_hashable(record.get(right_key)), []).append(record)
        except TypeError:
            raise NodeError(f"unhashable join key value in '{right_key}'")

    output: Dataset = []
    for record in left:
        try:
            matches = index.get(_hashable(record.get(left_key)), [])
        except TypeError:
            raise NodeError(f"unhashable join key value in '{left_key}'")
        if matches:
            for match in matches:
                merged = {
                    key: value
                    for key, value in match.items()
                    if key != right_key
                }
                merged.update(record)
                output.append(merged)
        elif join_type == "left":
            output.append(dict(record))

    return output, [f"{len(left)} + {len(right)} → {len(output)} rows ({join_type})"]


def _hashable(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True)
    return value


_AGG_RE = re.compile(r"^\s*(sum|avg|min|max|count)\s*\(\s*([^)]*?)\s*\)\s*$", re.IGNORECASE)


def _split_top_level(spec: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in spec:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def _aggregate_values(func: str, column: str, members: Dataset) -> Any:
    if func == "count" and column in ("", "*"):
        return len(members)
    values = [
        record.get(column)
        for record in members
        if not _is_null(record.get(column))
    ]
    if func == "count":
        return len(values)
    if not values:
        return None
    if all(isinstance(value, int) and not isinstance(value, bool) for value in values):
        numbers: list[Any] = list(values)
    else:
        try:
            numbers = [float(value) for value in values]  # type: ignore[arg-type]
        except (TypeError, ValueError):
            raise NodeError(f"aggregation '{func}({column})' needs numeric values")
    if func == "sum":
        return sum(numbers)
    if func == "avg":
        return sum(numbers) / len(numbers)
    if func == "min":
        return min(numbers)
    return max(numbers)


def handle_aggregate(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    spec = str(_config(node, "aggregations") or "").strip()
    if not spec:
        raise NodeError("aggregations are empty")
    group_by = [
        column.strip()
        for column in str(_config(node, "group_by") or "").split(",")
        if column.strip()
    ]

    parsed: list[tuple[str, str, str]] = []
    for part in _split_top_level(spec):
        match = _AGG_RE.match(part)
        if not match:
            raise NodeError(
                f"cannot parse aggregation '{part}' (expected func(column))"
            )
        func, column = match.group(1).lower(), match.group(2)
        label = "count" if func == "count" and column in ("", "*") else f"{func}({column})"
        parsed.append((func, column, label))

    groups: dict[Any, Dataset] = {}
    for record in rows:
        try:
            key = tuple(_hashable(record.get(column)) for column in group_by)
        except TypeError:
            raise NodeError("unhashable group key value")
        groups.setdefault(key, []).append(record)

    output: Dataset = []
    for key, members in groups.items():
        record = {column: value for column, value in zip(group_by, key)}
        for func, column, label in parsed:
            record[label] = _aggregate_values(func, column, members)
        output.append(record)

    return output, [f"{len(rows)} → {len(output)} rows"]


def handle_null_check(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    columns = [
        column.strip()
        for column in str(_config(node, "columns") or "").split(",")
        if column.strip()
    ]
    if not columns:
        raise NodeError("columns are empty")
    bad = sum(1 for record in rows for column in columns if _is_null(record.get(column)))
    if bad:
        raise NodeFailedError(
            f"{bad} null value(s) in {len(rows)} rows (columns: {', '.join(columns)})"
        )
    return rows, [f"checked {len(rows)} rows, no nulls in {', '.join(columns)}"]


def handle_duplicate_check(
    node: Node, inputs: list[Dataset]
) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    keys = [
        column.strip()
        for column in str(_config(node, "keys") or "").split(",")
        if column.strip()
    ]
    if not keys and rows:
        keys = sorted(rows[0].keys())

    seen: set[Any] = set()
    duplicates = 0
    for record in rows:
        try:
            key = tuple(_hashable(record.get(column)) for column in keys)
        except TypeError:
            raise NodeError("unhashable key value")
        if key in seen:
            duplicates += 1
        else:
            seen.add(key)

    if duplicates:
        raise NodeFailedError(
            f"{duplicates} duplicate row(s) on keys: {', '.join(keys)}"
        )
    scope = ", ".join(keys) if keys else "all columns"
    return rows, [f"checked {len(rows)} rows, no duplicates on {scope}"]


def _matches_type(value: Any, type_name: str) -> bool:
    if type_name == "string":
        return isinstance(value, str)
    if type_name == "boolean":
        if isinstance(value, bool):
            return True
        return str(value).lower() in ("true", "false", "1", "0")
    if type_name == "integer":
        if isinstance(value, bool):
            return False
        if isinstance(value, int):
            return True
        try:
            int(str(value))
            return True
        except (TypeError, ValueError):
            return False
    if type_name in ("float", "number"):
        if isinstance(value, bool):
            return False
        if isinstance(value, (int, float)):
            return True
        try:
            float(str(value))
            return True
        except (TypeError, ValueError):
            return False
    return False


def handle_schema_validation(
    node: Node, inputs: list[Dataset]
) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    schema_raw = str(_config(node, "schema") or "").strip()
    if not schema_raw:
        return rows, ["no schema defined, skipped"]
    try:
        schema = json.loads(schema_raw)
    except json.JSONDecodeError:
        raise NodeError("schema is not valid JSON")
    if not isinstance(schema, dict):
        raise NodeError("schema must be a JSON object")

    for column, raw_type in schema.items():
        type_name = str(raw_type).lower()
        if type_name not in ("integer", "float", "number", "string", "boolean"):
            raise NodeError(f"unknown type '{raw_type}' for column '{column}'")
        for index, record in enumerate(rows):
            if column not in record:
                raise NodeFailedError(f"column '{column}' missing (row {index})")
            if not _matches_type(record.get(column), type_name):
                raise NodeFailedError(
                    f"column '{column}' is not {type_name} (row {index})"
                )

    return rows, [f"validated {len(rows)} rows against {len(schema)} columns"]


def handle_data_freshness(
    node: Node, inputs: list[Dataset]
) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    column = str(_config(node, "column") or "").strip()
    if not column:
        raise NodeError("timestamp column is empty")
    try:
        max_age = float(_config(node, "max_age_hours") or 24)
    except (TypeError, ValueError):
        raise NodeError("max age is not a number")
    if not rows:
        return rows, ["no rows, skipped"]

    latest = None
    for record in rows:
        raw = record.get(column)
        if _is_null(raw):
            continue
        try:
            parsed = datetime.datetime.fromisoformat(
                str(raw).replace("Z", "+00:00")
            )
        except ValueError:
            raise NodeError(f"cannot parse timestamp '{raw}'")
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=datetime.timezone.utc)
        if latest is None or parsed > latest:
            latest = parsed

    if latest is None:
        raise NodeFailedError(f"column '{column}' has no timestamps")
    age_hours = (
        datetime.datetime.now(datetime.timezone.utc) - latest
    ).total_seconds() / 3600
    if age_hours > max_age:
        raise NodeFailedError(
            f"data is {age_hours:.1f}h old, limit is {max_age:g}h"
        )
    return rows, [f"newest record is {age_hours:.1f}h old (limit {max_age:g}h)"]


def _parse_headers(raw: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" not in line:
            raise NodeError(f"invalid header line '{line}' (expected Name: value)")
        name, value = line.split(":", 1)
        headers[name.strip()] = value.strip()
    return headers


def handle_rest_api(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    url = str(_config(node, "url") or "").strip()
    if not url:
        raise NodeError("URL is empty")
    method = str(_config(node, "method") or "GET").upper()
    if method not in ("GET", "POST", "PUT", "DELETE"):
        raise NodeError(f"method '{method}' is not supported")
    headers = _parse_headers(str(_config(node, "headers") or ""))

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.request(method, url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise NodeError(f"request failed: {error}")

    try:
        payload = response.json()
    except ValueError:
        raise NodeError("response is not JSON")
    if isinstance(payload, list):
        rows = [item for item in payload if isinstance(item, dict)]
    elif isinstance(payload, dict):
        rows = [payload]
    else:
        raise NodeError("response JSON must be an object or an array of objects")

    return rows, [f"{method} {url} → {len(rows)} rows"]


def handle_python(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    code = str(_config(node, "code") or "")
    if not code.strip():
        raise NodeError("code is empty")

    namespace: dict[str, Any] = {
        "rows": [dict(record) for record in rows],
        "json": json,
        "math": math,
        "datetime": datetime,
    }
    try:
        exec(compile(code, "<node>", "exec"), namespace)  # noqa: S102
    except Exception as error:
        raise NodeError(f"python error: {error}")

    result = namespace.get("rows")
    if not isinstance(result, list) or any(
        not isinstance(record, dict) for record in result
    ):
        raise NodeError("code must leave 'rows' as a list of objects")
    return result, [f"{len(rows)} → {len(result)} rows"]


def handle_sql(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    query = str(_config(node, "query") or "").strip()
    if not query:
        raise NodeError("query is empty")

    columns: list[str] = []
    for record in rows:
        for key in record.keys():
            if key not in columns:
                columns.append(key)

    connection = sqlite3.connect(":memory:")
    try:
        if columns:
            placeholders = ", ".join("?" for _ in columns)
            quoted = ", ".join(f'"{column}"' for column in columns)
            connection.execute(f"CREATE TABLE input ({quoted})")
            connection.executemany(
                f"INSERT INTO input VALUES ({placeholders})",
                [[record.get(column) for column in columns] for record in rows],
            )
        else:
            connection.execute("CREATE TABLE input (_x)")
        connection.row_factory = sqlite3.Row
        try:
            fetched = connection.execute(query).fetchall()
        except sqlite3.Error as error:
            raise NodeError(f"sql error: {error}")
    finally:
        connection.close()

    return [dict(record) for record in fetched], [f"{len(rows)} → {len(fetched)} rows"]


def _spark_submit_bin() -> str | None:
    found = shutil.which("spark-submit")
    if found:
        return found
    spark_home = os.environ.get("SPARK_HOME", "").strip()
    if spark_home:
        candidate = os.path.join(spark_home, "bin", "spark-submit")
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def handle_entry(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    return [], [f"'{_node_name(node)}' is an entry point (no-op)"]


SPARK_TIMEOUT_DEFAULT = 300
SPARK_ERROR_TAIL = 3000


def _extract_spark_error(stderr: str) -> tuple[str, bool]:
    lines = stderr.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.startswith("Traceback (most recent call last):"):
            start = index
    if start is not None:
        return "\n".join(lines[start : start + 30]), True
    errors = [
        line
        for line in lines
        if " ERROR " in line or "Exception" in line or line.startswith("py4j.")
    ]
    if errors:
        return "\n".join(errors[-10:]), True
    return stderr.strip()[-SPARK_ERROR_TAIL:], False

SPARK_WRAPPER = """import sys

from pyspark.sql import DataFrame, SparkSession

_, input_path, output_path, code_path = sys.argv

spark = SparkSession.builder.appName("dataflow").getOrCreate()
spark.sparkContext.setLogLevel("ERROR")

if input_path == "-":
    df = None
else:
    df = spark.read.parquet(input_path)

with open(code_path, encoding="utf-8") as handle:
    code = handle.read()

namespace = {"spark": spark, "df": df}
exec(compile(code, "<pyspark>", "exec"), namespace)
df = namespace.get("df")

if not isinstance(df, DataFrame):
    print("ERROR: code must leave 'df' as a Spark DataFrame", file=sys.stderr)
    sys.exit(3)

df.write.mode("overwrite").parquet(output_path)
spark.stop()
"""


def handle_pyspark(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    import pandas

    submit_bin = _spark_submit_bin()
    if submit_bin is None:
        raise NodeError(
            "spark-submit not found — install Apache Spark and Java to run PySpark nodes"
        )
    code = str(_config(node, "code") or "")
    if not code.strip():
        raise NodeError("code is empty")
    master = str(_config(node, "master") or "local[*]").strip() or "local[*]"
    try:
        timeout = int(_config(node, "timeout_seconds") or SPARK_TIMEOUT_DEFAULT)
    except (TypeError, ValueError):
        raise NodeError("timeout_seconds is not a number")
    if timeout <= 0:
        raise NodeError("timeout_seconds must be positive")

    all_rows = [record for dataset in inputs for record in dataset]
    with tempfile.TemporaryDirectory(prefix="dataflow-spark-") as tmp:
        if all_rows:
            input_path = os.path.join(tmp, "input.parquet")
            pandas.DataFrame(all_rows).to_parquet(input_path)
            input_arg = input_path
        else:
            input_arg = "-"
        output_path = os.path.join(tmp, "output.parquet")
        code_path = os.path.join(tmp, "node.py")
        wrapper_path = os.path.join(tmp, "wrapper.py")
        Path(code_path).write_text(code, encoding="utf-8")
        Path(wrapper_path).write_text(SPARK_WRAPPER, encoding="utf-8")

        try:
            completed = subprocess.run(
                [
                    submit_bin,
                    "--master",
                    master,
                    wrapper_path,
                    input_arg,
                    output_path,
                    code_path,
                ],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            raise NodeError(f"spark job timed out after {timeout}s")
        if completed.returncode != 0:
            detail, found = _extract_spark_error(completed.stderr or "")
            if not found:
                stdout_tail = (completed.stdout or "").strip()[-1500:]
                if stdout_tail:
                    detail = f"{detail}\n--- stdout ---\n{stdout_tail}"
            raise NodeError(
                f"spark-submit failed (exit {completed.returncode}): {detail or 'no output'}"
            )
        try:
            frame = pandas.read_parquet(output_path)
        except Exception as error:
            raise NodeError(f"cannot read spark output: {error}")
        rows = frame.to_dict(orient="records")

    return rows, [f"spark job finished: {len(rows)} rows"]


def _connection_id(node: Node) -> str:
    connection_id = _config(node, "connection_id")
    if not isinstance(connection_id, str) or not connection_id.strip():
        raise NodeError("no connection selected")
    return connection_id.strip()


def handle_postgres_source(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    query = str(_config(node, "query") or "").strip()
    if not query:
        raise NodeError("query is empty")
    try:
        secret = db_helpers.resolve_connection_string(_connection_id(node))
    except LookupError as error:
        raise NodeError(str(error))
    try:
        rows = db_helpers.pg_read(secret, query)
    except ValueError as error:
        raise NodeError(str(error))
    except Exception as error:
        raise NodeError(f"postgres error: {error}")
    return rows, [f"read {len(rows)} rows"]


def handle_mysql_source(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    raise UnsupportedNodeError("MySQL sources need a driver (not installed yet)")


def handle_postgres_storage(
    node: Node, inputs: list[Dataset]
) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    table = str(_config(node, "table") or "").strip()
    if not table:
        raise NodeError("table is empty")
    try:
        secret = db_helpers.resolve_connection_string(_connection_id(node))
    except LookupError as error:
        raise NodeError(str(error))
    try:
        written = db_helpers.pg_write(secret, table, rows)
    except ValueError as error:
        raise NodeError(str(error))
    except Exception as error:
        raise NodeError(f"postgres error: {error}")
    return rows, [f"wrote {written} rows to {table.strip()}"]


def handle_parquet(node: Node, inputs: list[Dataset]) -> tuple[Dataset, list[str]]:
    rows = _require_input(inputs, node)
    path = str(_config(node, "path") or "").strip()
    if not path:
        raise NodeError("path is empty")
    try:
        import pandas
    except ImportError:
        raise UnsupportedNodeError("parquet support needs pandas installed")
    from pathlib import Path as _Path

    target = _Path(path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        pandas.DataFrame(rows).to_parquet(target)
    except Exception as error:
        raise NodeError(f"cannot write parquet: {error}")
    return rows, [f"wrote {len(rows)} rows to {path}"]


def handle_workflow_call(
    node: Node, _inputs: list[Dataset], run_subworkflow
) -> tuple[Dataset, list[str]]:
    workflow_id = str(_config(node, "workflow_id") or "").strip()
    if not workflow_id:
        raise NodeError("no workflow selected")
    if run_subworkflow is None:
        raise NodeError("sub-workflows are not supported here")
    rows, log = run_subworkflow(workflow_id)
    return rows, [log]


HANDLERS = {
    "file": handle_file,
    "filter": handle_filter,
    "join": handle_join,
    "aggregate": handle_aggregate,
    "null-check": handle_null_check,
    "duplicate-check": handle_duplicate_check,
    "schema-validation": handle_schema_validation,
    "data-freshness": handle_data_freshness,
    "rest-api": handle_rest_api,
    "python": handle_python,
    "sql": handle_sql,
    "pyspark": handle_pyspark,
    "schedule": handle_entry,
    "trigger": handle_entry,
    "postgres-source": handle_postgres_source,
    "mysql-source": handle_mysql_source,
    "postgres-storage": handle_postgres_storage,
    "parquet": handle_parquet,
}


def execute_node(
    node: Node, inputs: list[Dataset], run_subworkflow=None
) -> tuple[Dataset, list[str]]:
    node_type = str(node.get("type") or "")
    if node_type == "workflow-call":
        return handle_workflow_call(node, inputs, run_subworkflow)
    handler = HANDLERS.get(node_type)
    if handler is None:
        raise UnsupportedNodeError(f"node type '{node_type}' is not executable yet")
    return handler(node, inputs)

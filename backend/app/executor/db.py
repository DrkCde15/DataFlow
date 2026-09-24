import re
from contextlib import closing
from typing import Any

from ..database import get_connection

Row = dict[str, Any]

_TABLE_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")


def resolve_connection_string(connection_id: str) -> str:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT connection_string FROM connections WHERE id = ?",
            (connection_id,),
        ).fetchone()
    if row is None:
        raise LookupError(f"connection '{connection_id}' not found")
    return str(row["connection_string"])


def validate_table_name(table: str) -> str:
    name = table.strip()
    if not _TABLE_RE.match(name):
        raise ValueError(
            f"invalid table name '{table}' (use letters, numbers, _ and .)"
        )
    return name


def assert_select_only(query: str) -> None:
    first = ""
    for line in query.strip().splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            first = stripped.split()[0].upper() if stripped.split() else ""
            break
    if first not in ("SELECT", "WITH"):
        raise ValueError("only SELECT/WITH queries are allowed in sources")


def pg_type_for(values: list[Any]) -> str:
    seen = [value for value in values if not _is_null(value)]
    if not seen:
        return "TEXT"
    if all(isinstance(value, bool) for value in seen):
        return "BOOLEAN"
    if all(
        isinstance(value, int) and not isinstance(value, bool) for value in seen
    ):
        return "BIGINT"
    if all(_is_float_like(value) for value in seen):
        return "DOUBLE PRECISION"
    return "TEXT"


def _is_null(value: Any) -> bool:
    return value is None or value == ""


def _is_float_like(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except ValueError:
            return False
    return False


def pg_read(connection_string: str, query: str) -> list[Row]:
    import psycopg

    assert_select_only(query)
    with psycopg.connect(connection_string, connect_timeout=15) as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            columns = [desc[0] for desc in (cursor.description or [])]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


def pg_write(connection_string: str, table: str, rows: list[Row]) -> int:
    import psycopg

    name = validate_table_name(table)
    if not rows:
        return 0

    columns: list[str] = []
    for record in rows:
        for key in record.keys():
            if key not in columns:
                columns.append(key)

    quoted = ", ".join(f'"{column}"' for column in columns)
    types = ", ".join(
        f'"{column}" {pg_type_for([record.get(column) for record in rows])}'
        for column in columns
    )
    placeholders = ", ".join(["%s"] * len(columns))

    with psycopg.connect(connection_string, connect_timeout=15) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE TABLE IF NOT EXISTS {name} ({types})")
            cursor.executemany(
                f"INSERT INTO {name} ({quoted}) VALUES ({placeholders})",
                [[record.get(column) for column in columns] for record in rows],
            )
        connection.commit()
    return len(rows)

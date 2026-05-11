"""Read-only database queries for database-type knowledge documents."""
from __future__ import annotations

import re

from app.services.document_crypto import decrypt_secret
from app.services.document_db_validate import validate_table_name

_SAFE_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _quote_ident_pg(ident: str) -> str:
    if not _SAFE_IDENT.match(ident):
        raise ValueError("invalid identifier")
    return '"' + ident.replace('"', '""') + '"'


def fetch_table_preview(
    engine: str,
    config: dict,
    table: str,
    *,
    limit: int = 50,
) -> tuple[bool, str]:
    """SELECT-only preview from allowed_tables in config."""
    allowed = set(config.get("allowed_tables") or [])
    if table not in allowed or not validate_table_name(table):
        return False, "Table not in allowed list or invalid name"
    lim = max(1, min(int(limit), 200))
    eng = (engine or "").strip().lower()
    pwd = decrypt_secret(config.get("password_encrypted") or "")

    try:
        if eng == "postgresql":
            import psycopg2

            conn = psycopg2.connect(
                host=config.get("host") or "localhost",
                port=int(config.get("port") or 5432),
                dbname=config.get("database") or "",
                user=config.get("user") or "",
                password=pwd,
                connect_timeout=10,
            )
            conn.set_session(readonly=True, autocommit=True)
            q = f'SELECT * FROM {_quote_ident_pg(table)} LIMIT {lim}'
            cur = conn.cursor()
            cur.execute(q)
            rows = cur.fetchall()
            colnames = [d[0] for d in cur.description] if cur.description else []
            cur.close()
            conn.close()
            lines = [", ".join(colnames)] + [str(row) for row in rows]
            return True, "\n".join(lines[: lim + 5])
        if eng == "mysql":
            import pymysql

            conn = pymysql.connect(
                host=config.get("host") or "localhost",
                port=int(config.get("port") or 3306),
                database=config.get("database") or "",
                user=config.get("user") or "",
                password=pwd,
                connect_timeout=10,
                read_timeout=60,
            )
            cur = conn.cursor()
            cur.execute(f"SELECT * FROM `{table}` LIMIT {lim}")
            rows = cur.fetchall()
            colnames = [d[0] for d in cur.description] if cur.description else []
            cur.close()
            conn.close()
            lines = [", ".join(str(c) for c in colnames)] + [str(row) for row in rows]
            return True, "\n".join(lines[: lim + 5])
        if eng == "sqlite":
            import sqlite3

            path = config.get("sqlite_path") or ""
            conn = sqlite3.connect(path, timeout=10)
            cur = conn.execute(f'SELECT * FROM "{table}" LIMIT {lim}')
            rows = cur.fetchall()
            colnames = [d[0] for d in cur.description] if cur.description else []
            conn.close()
            lines = [", ".join(str(c) for c in colnames)] + [str(row) for row in rows]
            return True, "\n".join(lines[: lim + 5])
        return False, f"unsupported engine {engine}"
    except Exception as e:
        return False, str(e)[:4000]

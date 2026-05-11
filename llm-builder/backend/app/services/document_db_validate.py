"""Validate database document configs and discover allowed table names."""
from __future__ import annotations

import re
_TABLE_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def validate_table_name(name: str) -> bool:
    return bool(name and _TABLE_NAME_RE.match(name))


def list_tables_postgresql(host: str, port: int, database: str, user: str, password: str) -> tuple[bool, str, list[str]]:
    try:
        import psycopg2

        conn = psycopg2.connect(
            host=host,
            port=port or 5432,
            dbname=database,
            user=user,
            password=password,
            connect_timeout=10,
        )
        conn.set_session(readonly=True, autocommit=True)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
            LIMIT 500
            """
        )
        tables = [r[0] for r in cur.fetchall() if validate_table_name(r[0])]
        cur.close()
        conn.close()
        return True, "", tables
    except Exception as e:
        return False, str(e)[:2000], []


def list_tables_mysql(host: str, port: int, database: str, user: str, password: str) -> tuple[bool, str, list[str]]:
    try:
        import pymysql

        conn = pymysql.connect(
            host=host,
            port=port or 3306,
            database=database,
            user=user,
            password=password,
            connect_timeout=10,
            read_timeout=30,
        )
        cur = conn.cursor()
        cur.execute("SHOW TABLES")
        rows = cur.fetchall()
        tables = [r[0] for r in rows if r and validate_table_name(str(r[0]))][:500]
        cur.close()
        conn.close()
        return True, "", tables
    except Exception as e:
        return False, str(e)[:2000], []


def list_tables_sqlite(path: str) -> tuple[bool, str, list[str]]:
    try:
        import sqlite3

        conn = sqlite3.connect(path, timeout=10)
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 500"
        )
        tables = [r[0] for r in cur.fetchall() if validate_table_name(r[0])]
        conn.close()
        return True, "", tables
    except Exception as e:
        return False, str(e)[:2000], []


def validate_database_document(
    engine: str,
    *,
    host: str | None,
    port: int | None,
    database: str | None,
    user: str | None,
    password: str | None,
    sqlite_path: str | None,
) -> tuple[bool, str, list[str]]:
    eng = (engine or "").strip().lower()
    if eng == "postgresql":
        if not all([host, database, user]):
            return False, "postgresql requires host, database, user", []
        return list_tables_postgresql(host or "localhost", port or 5432, database or "", user or "", password or "")
    if eng == "mysql":
        if not all([host, database, user]):
            return False, "mysql requires host, database, user", []
        return list_tables_mysql(host or "localhost", port or 3306, database or "", user or "", password or "")
    if eng == "sqlite":
        if not sqlite_path:
            return False, "sqlite requires sqlite_path", []
        return list_tables_sqlite(sqlite_path)
    return False, f"unsupported engine: {engine}", []

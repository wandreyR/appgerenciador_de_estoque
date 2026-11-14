"""Registro local das licenças emitidas (SQLite, só no computador do administrador)."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from typing import Any, Iterator

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS licenses (
    id          TEXT PRIMARY KEY,
    customer    TEXT NOT NULL,
    hwid        TEXT NOT NULL,
    issued      TEXT NOT NULL,
    expires     TEXT,
    key         TEXT NOT NULL,
    notes       TEXT,
    status      TEXT NOT NULL DEFAULT 'ativa',
    created_at  TEXT NOT NULL,
    revoked_at  TEXT
);
CREATE INDEX IF NOT EXISTS ix_lic_hwid ON licenses(hwid);
"""


@contextmanager
def conn() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init() -> None:
    with conn() as c:
        c.executescript(SCHEMA)


def now() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def row_out(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    exp = d["expires"]
    days_left = (date.fromisoformat(exp) - date.today()).days if exp else None
    if d["status"] == "excluida":
        situation = "excluida"
    elif days_left is not None and days_left < 0:
        situation = "expirada"
    else:
        situation = "ativa"
    d.update(days_left=days_left, situation=situation)
    return d


def insert(lid: str, customer: str, hwid: str, issued: str, expires: str | None, key: str, notes: str | None) -> dict:
    with conn() as c:
        c.execute(
            "INSERT INTO licenses (id, customer, hwid, issued, expires, key, notes, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (lid, customer, hwid, issued, expires, key, notes, "ativa", now()),
        )
    return get(lid)


def get(lid: str) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM licenses WHERE id = ?", (lid,)).fetchone()
    return row_out(r) if r else None


def search(q: str | None = None) -> list[dict]:
    sql, args = "SELECT * FROM licenses", []
    if q:
        like = f"%{q.strip()}%"
        sql += " WHERE customer LIKE ? OR hwid LIKE ? OR id LIKE ? OR notes LIKE ?"
        args = [like, like, like, like]
    with conn() as c:
        rows = c.execute(sql + " ORDER BY created_at DESC", args).fetchall()
    return [row_out(r) for r in rows]


def set_status(lid: str, status: str) -> dict | None:
    with conn() as c:
        c.execute(
            "UPDATE licenses SET status = ?, revoked_at = ? WHERE id = ?",
            (status, now() if status == "excluida" else None, lid),
        )
    return get(lid)


def update_notes(lid: str, notes: str | None) -> dict | None:
    with conn() as c:
        c.execute("UPDATE licenses SET notes = ? WHERE id = ?", (notes, lid))
    return get(lid)


def revoked_ids() -> list[str]:
    with conn() as c:
        return [r[0] for r in c.execute("SELECT id FROM licenses WHERE status = 'excluida'")]


def counts() -> dict[str, int]:
    out = {"total": 0, "ativa": 0, "expirada": 0, "excluida": 0}
    for lic in search():
        out["total"] += 1
        out[lic["situation"]] += 1
    return out

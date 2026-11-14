from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DB_PATH


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)
_engine: Engine | None = None

DEFAULT_CATEGORIES = ["Blusa", "Calça", "Vestido", "Camiseta", "Jaqueta", "Shorts", "Saia", "Macacão"]


def _set_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.close()


def init_engine() -> Engine:
    global _engine
    from . import models  # noqa: F401  (registra as tabelas)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(
        f"sqlite:///{DB_PATH.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    event.listen(_engine, "connect", _set_pragmas)
    SessionLocal.configure(bind=_engine)
    Base.metadata.create_all(_engine)
    _seed()
    return _engine


def _seed() -> None:
    from .models import Category

    with SessionLocal() as db:
        if db.scalar(select(Category.id).limit(1)) is None:
            db.add_all(Category(name=n) for n in DEFAULT_CATEGORIES)
            db.commit()


def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

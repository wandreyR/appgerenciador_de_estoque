from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import MovementKind, Product, ProductColor, StockMovement, Variant
from ..schemas import StockMoveIn
from ..serializers import movement_out, variant_flat
from ..services import move_stock
from ..utils import size_key

router = APIRouter(prefix="/api", tags=["estoque"])


def _variant_query():
    return (
        select(Variant)
        .join(Product, Variant.product_id == Product.id)
        .join(ProductColor, Variant.color_id == ProductColor.id)
        .where(Product.active.is_(True))
        .options(joinedload(Variant.product).joinedload(Product.category), joinedload(Variant.color))
    )


@router.get("/variants")
def search_variants(
    q: str | None = None,
    category_id: int | None = None,
    color: str | None = None,
    size: str | None = None,
    available: bool = False,
    low: bool = False,
    limit: int = 400,
    db: Session = Depends(get_db),
):
    stmt = _variant_query()
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Product.name.ilike(like), Product.sku_base.ilike(like), Variant.sku.ilike(like), ProductColor.name.ilike(like))
        )
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if color:
        stmt = stmt.where(ProductColor.name.ilike(color))
    if size:
        stmt = stmt.where(Variant.size == size.upper())
    if available:
        stmt = stmt.where(Variant.quantity > 0)
    if low:
        stmt = stmt.where(Variant.min_stock > 0, Variant.quantity <= Variant.min_stock)
    stmt = stmt.order_by(Product.name, ProductColor.position).limit(min(max(limit, 1), 2000))
    rows = list(db.scalars(stmt).unique())
    rows.sort(key=lambda v: (v.product.name.lower(), v.product_id, v.color.position, size_key(v.size)))
    return [variant_flat(v) for v in rows]


@router.get("/variants/filters")
def variant_filters(db: Session = Depends(get_db)):
    base = select(ProductColor.name, ProductColor.hex).join(Product).where(Product.active.is_(True))
    colors: dict[str, str] = {}
    for name, hx in db.execute(base):
        colors.setdefault(name.strip().title(), hx)
    sizes = db.scalars(select(Variant.size).join(Product, Variant.product_id == Product.id).where(Product.active.is_(True)).distinct())
    return {
        "colors": [{"name": n, "hex": h} for n, h in sorted(colors.items())],
        "sizes": sorted(set(sizes), key=size_key),
    }


@router.post("/stock/movements", status_code=201)
def create_movement(data: StockMoveIn, db: Session = Depends(get_db)):
    v = db.get(Variant, data.variant_id)
    if not v or not v.product.active:
        raise HTTPException(404, "Variação não encontrada.")
    if data.kind == "entrada":
        delta, kind = data.quantity, MovementKind.ENTRADA
    elif data.kind == "saida":
        delta, kind = -data.quantity, MovementKind.SAIDA
    else:  # ajuste: define o saldo absoluto (inventário)
        delta, kind = data.quantity - v.quantity, MovementKind.AJUSTE
    if delta == 0:
        raise HTTPException(400, "A movimentação não altera o saldo.")
    m = move_stock(db, v, delta, kind, (data.reason or "").strip() or None)
    db.commit()
    return {"movement": movement_out(m), "variant": variant_flat(v)}


@router.get("/stock/movements")
def list_movements(variant_id: int | None = None, kind: str | None = None, limit: int = 300, db: Session = Depends(get_db)):
    stmt = select(StockMovement).order_by(StockMovement.id.desc()).limit(min(max(limit, 1), 2000))
    if variant_id:
        stmt = stmt.where(StockMovement.variant_id == variant_id)
    if kind:
        stmt = stmt.where(StockMovement.kind == kind)
    return [movement_out(m) for m in db.scalars(stmt)]

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import StockMovement, Variant


def variant_label(v: Variant) -> str:
    return f"{v.product.name} • {v.color.name} • {v.size}"


def move_stock(
    db: Session,
    v: Variant,
    delta: int,
    kind: str,
    reason: str | None = None,
    order_id: int | None = None,
) -> StockMovement | None:
    """Altera o saldo de uma variação e registra no histórico."""
    if delta == 0:
        return None
    new_qty = v.quantity + delta
    if new_qty < 0:
        raise HTTPException(
            409, f"Estoque insuficiente para {variant_label(v)}: disponível {v.quantity}, solicitado {-delta}."
        )
    v.quantity = new_qty
    m = StockMovement(
        variant_id=v.id,
        description=variant_label(v),
        kind=kind,
        delta=delta,
        balance_after=new_qty,
        reason=reason,
        order_id=order_id,
    )
    db.add(m)
    return m

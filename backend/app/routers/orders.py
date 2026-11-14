from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import get_db
from ..models import Customer, MovementKind, Order, OrderItem, OrderStatus, Product, Variant, now
from ..schemas import OrderIn, OrderStatusIn
from ..serializers import order_out
from ..services import move_stock, variant_label
from ..utils import clean_str

router = APIRouter(prefix="/api/orders", tags=["pedidos"])

TRANSITIONS = {
    OrderStatus.PENDENTE: {OrderStatus.SEPARADO, OrderStatus.CANCELADO},
    OrderStatus.SEPARADO: {OrderStatus.PENDENTE, OrderStatus.ENTREGUE, OrderStatus.CANCELADO},
    OrderStatus.ENTREGUE: {OrderStatus.CANCELADO},
    OrderStatus.CANCELADO: set(),
}


def _get(db: Session, oid: int) -> Order:
    o = db.scalar(
        select(Order).where(Order.id == oid).options(selectinload(Order.items), joinedload(Order.customer))
    )
    if not o:
        raise HTTPException(404, "Pedido não encontrado.")
    return o


@router.get("")
def list_orders(status: str | None = None, q: str | None = None, limit: int = 300, db: Session = Depends(get_db)):
    stmt = (
        select(Order)
        .options(selectinload(Order.items), joinedload(Order.customer))
        .order_by(Order.id.desc())
        .limit(min(max(limit, 1), 2000))
    )
    if status:
        stmt = stmt.where(Order.status == status)
    if q and q.strip():
        term = q.strip().lstrip("#")
        conds = [Order.customer_name.ilike(f"%{term}%")]
        if term.isdigit():
            conds.append(Order.id == int(term))
        stmt = stmt.where(or_(*conds))
    return [order_out(o, with_items=False) for o in db.scalars(stmt).unique()]


@router.get("/{oid}")
def get_order(oid: int, db: Session = Depends(get_db)):
    return order_out(_get(db, oid))


@router.post("", status_code=201)
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    customer = None
    if data.customer_id:
        customer = db.get(Customer, data.customer_id)
        if not customer:
            raise HTTPException(404, "Cliente não encontrado.")
    name = customer.name if customer else (data.customer_name or "").strip()
    if not name:
        raise HTTPException(400, "Informe o cliente do pedido.")

    # agrupa linhas repetidas da mesma variação
    qty: dict[int, int] = {}
    price: dict[int, float | None] = {}
    for it in data.items:
        qty[it.variant_id] = qty.get(it.variant_id, 0) + it.quantity
        if it.unit_price is not None:
            price[it.variant_id] = it.unit_price

    variants = {
        v.id: v
        for v in db.scalars(
            select(Variant)
            .where(Variant.id.in_(qty))
            .options(joinedload(Variant.product), joinedload(Variant.color))
        ).unique()
    }
    errors = []
    for vid, q in qty.items():
        v = variants.get(vid)
        if not v or not v.product.active:
            errors.append(f"Variação #{vid} não existe mais.")
        elif v.quantity < q:
            errors.append(f"{variant_label(v)}: disponível {v.quantity}, solicitado {q}.")
    if errors:
        raise HTTPException(409, "Estoque insuficiente:\n" + "\n".join(errors))

    order = Order(
        customer_id=customer.id if customer else None,
        customer_name=name,
        customer_phone=customer.phone if customer else None,
        status=OrderStatus.PENDENTE,
        notes=clean_str(data.notes),
    )
    db.add(order)
    db.flush()

    total, pieces = 0.0, 0
    for vid, q in qty.items():
        v = variants[vid]
        unit = price.get(vid)
        unit = v.product.sale_price if unit is None else unit
        order.items.append(
            OrderItem(
                variant_id=v.id,
                product_name=v.product.name,
                sku=v.sku,
                color_name=v.color.name,
                color_hex=v.color.hex,
                size=v.size,
                image_path=v.color.image_path or v.product.image_path,
                quantity=q,
                unit_price=round(unit, 2),
            )
        )
        move_stock(db, v, -q, MovementKind.PEDIDO, f"Pedido #{order.id:06d} - {name}", order.id)
        total += q * unit
        pieces += q
    order.total = round(total, 2)
    order.total_pieces = pieces
    db.commit()
    return order_out(_get(db, order.id))


@router.post("/{oid}/status")
def change_status(oid: int, data: OrderStatusIn, db: Session = Depends(get_db)):
    o = _get(db, oid)
    if data.status == o.status:
        return order_out(o)
    if data.status not in TRANSITIONS[o.status]:
        raise HTTPException(400, f"Não é possível mudar de '{o.status}' para '{data.status}'.")

    if data.status == OrderStatus.CANCELADO:
        for it in o.items:
            if it.variant_id:
                v = db.get(Variant, it.variant_id)
                if v and v.product:
                    move_stock(db, v, it.quantity, MovementKind.CANCELAMENTO, f"Cancelamento do pedido #{o.id:06d}", o.id)
        o.cancelled_at = now()
    elif data.status == OrderStatus.SEPARADO:
        o.separated_at = now()
        o.separated_by = clean_str(data.separated_by)
    elif data.status == OrderStatus.PENDENTE:
        o.separated_at = None
        o.separated_by = None
    o.status = data.status
    db.commit()
    return order_out(_get(db, oid))

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import get_db
from ..models import Order, OrderStatus, Product, Variant
from ..serializers import order_out, variant_flat

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    active = Product.active.is_(True)
    join = (Product, Variant.product_id == Product.id)

    pieces, cost_value, sale_value, variant_count = db.execute(
        select(
            func.coalesce(func.sum(Variant.quantity), 0),
            func.coalesce(func.sum(Variant.quantity * Product.cost_price), 0),
            func.coalesce(func.sum(Variant.quantity * Product.sale_price), 0),
            func.count(Variant.id),
        ).join(*join).where(active)
    ).one()

    low_cond = (Variant.min_stock > 0) & (Variant.quantity <= Variant.min_stock)
    low_count = db.scalar(select(func.count()).select_from(Variant).join(*join).where(active, low_cond))
    out_count = db.scalar(select(func.count()).select_from(Variant).join(*join).where(active, Variant.quantity == 0))
    low_list = db.scalars(
        select(Variant)
        .join(*join)
        .where(active, low_cond)
        .options(joinedload(Variant.product).joinedload(Product.category), joinedload(Variant.color))
        .order_by(Variant.quantity, Product.name)
        .limit(40)
    ).unique()

    def count_status(s: str) -> int:
        return db.scalar(select(func.count()).select_from(Order).where(Order.status == s))

    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_sales, month_orders = db.execute(
        select(func.coalesce(func.sum(Order.total), 0), func.count(Order.id)).where(
            Order.status != OrderStatus.CANCELADO, Order.created_at >= month_start
        )
    ).one()

    pending = db.scalars(
        select(Order)
        .where(Order.status == OrderStatus.PENDENTE)
        .options(selectinload(Order.items), joinedload(Order.customer))
        .order_by(Order.id)
        .limit(10)
    ).unique()

    return {
        "total_pieces": int(pieces),
        "stock_cost_value": round(float(cost_value), 2),
        "stock_sale_value": round(float(sale_value), 2),
        "variant_count": int(variant_count),
        "product_count": db.scalar(select(func.count()).select_from(Product).where(active)),
        "low_stock_count": low_count,
        "out_of_stock_count": out_count,
        "pending_orders": count_status(OrderStatus.PENDENTE),
        "separated_orders": count_status(OrderStatus.SEPARADO),
        "month_sales": round(float(month_sales), 2),
        "month_orders": month_orders,
        "low_stock": [variant_flat(v) for v in low_list],
        "pending_list": [order_out(o, with_items=False) for o in pending],
    }

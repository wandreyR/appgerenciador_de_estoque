from __future__ import annotations

from datetime import datetime

from .images import thumb_rel
from .models import Customer, Order, OrderItem, Product, ProductColor, StockMovement, Variant
from .utils import size_key


def dt(x: datetime | None) -> str | None:
    return x.isoformat() if x else None


def media_url(rel: str | None) -> str | None:
    return f"/media/{rel}" if rel else None


def thumb_url(rel: str | None) -> str | None:
    return f"/media/{thumb_rel(rel)}" if rel else None


def is_low(v: Variant) -> bool:
    return v.min_stock > 0 and v.quantity <= v.min_stock


def variant_out(v: Variant) -> dict:
    return {
        "id": v.id,
        "size": v.size,
        "sku": v.sku,
        "quantity": v.quantity,
        "min_stock": v.min_stock,
        "low": is_low(v),
    }


def color_out(c: ProductColor) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "hex": c.hex,
        "position": c.position,
        "image_url": media_url(c.image_path),
        "thumb_url": thumb_url(c.image_path),
        "variants": [variant_out(v) for v in sorted(c.variants, key=lambda v: size_key(v.size))],
    }


def product_out(p: Product) -> dict:
    variants = [v for c in p.colors for v in c.variants]
    return {
        "id": p.id,
        "name": p.name,
        "sku_base": p.sku_base,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else "",
        "cost_price": p.cost_price,
        "sale_price": p.sale_price,
        "notes": p.notes,
        "image_url": media_url(p.image_path),
        "thumb_url": thumb_url(p.image_path),
        "colors": [color_out(c) for c in p.colors],
        "sizes": sorted({v.size for v in variants}, key=size_key),
        "total_quantity": sum(v.quantity for v in variants),
        "low_stock_count": sum(1 for v in variants if is_low(v)),
        "created_at": dt(p.created_at),
        "updated_at": dt(p.updated_at),
    }


def variant_flat(v: Variant) -> dict:
    p, c = v.product, v.color
    img = c.image_path or p.image_path
    return {
        "id": v.id,
        "sku": v.sku,
        "size": v.size,
        "quantity": v.quantity,
        "min_stock": v.min_stock,
        "low": is_low(v),
        "product_id": p.id,
        "product_name": p.name,
        "sku_base": p.sku_base,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else "",
        "color_id": c.id,
        "color_name": c.name,
        "color_hex": c.hex,
        "sale_price": p.sale_price,
        "cost_price": p.cost_price,
        "image_url": media_url(img),
        "thumb_url": thumb_url(img),
    }


def customer_out(c: Customer) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "document": c.document,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "city": c.city,
        "notes": c.notes,
        "created_at": dt(c.created_at),
    }


def item_out(i: OrderItem) -> dict:
    return {
        "id": i.id,
        "variant_id": i.variant_id,
        "product_name": i.product_name,
        "sku": i.sku,
        "color_name": i.color_name,
        "color_hex": i.color_hex,
        "size": i.size,
        "quantity": i.quantity,
        "unit_price": i.unit_price,
        "subtotal": round(i.quantity * i.unit_price, 2),
        "image_url": media_url(i.image_path),
        "thumb_url": thumb_url(i.image_path),
    }


def order_out(o: Order, with_items: bool = True) -> dict:
    c = o.customer
    data = {
        "id": o.id,
        "number": f"{o.id:06d}",
        "customer_id": o.customer_id,
        "customer_name": o.customer_name,
        "customer_phone": o.customer_phone or (c.phone if c else None),
        "customer_document": c.document if c else None,
        "customer_address": c.address if c else None,
        "customer_city": c.city if c else None,
        "status": o.status,
        "notes": o.notes,
        "total": o.total,
        "total_pieces": o.total_pieces,
        "item_count": len(o.items),
        "created_at": dt(o.created_at),
        "separated_at": dt(o.separated_at),
        "separated_by": o.separated_by,
        "cancelled_at": dt(o.cancelled_at),
    }
    if with_items:
        data["items"] = [item_out(i) for i in o.items]
    return data


def movement_out(m: StockMovement) -> dict:
    return {
        "id": m.id,
        "variant_id": m.variant_id,
        "description": m.description,
        "kind": m.kind,
        "delta": m.delta,
        "balance_after": m.balance_after,
        "reason": m.reason,
        "order_id": m.order_id,
        "created_at": dt(m.created_at),
    }

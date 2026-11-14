from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..images import release_image, save_image
from ..models import Category, MovementKind, OrderItem, Product, ProductColor, Variant
from ..schemas import ProductIn
from ..serializers import product_out
from ..services import move_stock
from ..utils import clean_str, variant_sku

router = APIRouter(prefix="/api", tags=["produtos"])


def _query():
    return select(Product).options(
        selectinload(Product.category),
        selectinload(Product.colors).selectinload(ProductColor.variants),
    )


def _get(db: Session, pid: int) -> Product:
    p = db.scalar(_query().where(Product.id == pid, Product.active.is_(True)))
    if not p:
        raise HTTPException(404, "Produto não encontrado.")
    return p


@router.get("/products")
def list_products(q: str | None = None, category_id: int | None = None, db: Session = Depends(get_db)):
    stmt = _query().where(Product.active.is_(True))
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(like),
                Product.sku_base.ilike(like),
                Product.id.in_(select(ProductColor.product_id).where(ProductColor.name.ilike(like))),
            )
        )
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    return [product_out(p) for p in db.scalars(stmt.order_by(Product.name))]


@router.get("/products/{pid}")
def get_product(pid: int, db: Session = Depends(get_db)):
    return product_out(_get(db, pid))


def _apply(db: Session, p: Product, data: ProductIn) -> list[str]:
    """Sincroniza modelo + grade (cores x tamanhos). Retorna imagens órfãs."""
    if not db.get(Category, data.category_id):
        raise HTTPException(400, "Categoria inválida.")
    sku = data.sku_base.upper()
    dup = db.scalar(select(Product.id).where(func.upper(Product.sku_base) == sku, Product.id != (p.id or 0)))
    if dup:
        raise HTTPException(409, f"O SKU '{sku}' já está em uso por outro produto.")

    names = [c.name.lower() for c in data.colors]
    if len(names) != len(set(names)):
        raise HTTPException(400, "Existem cores com o mesmo nome neste produto.")
    for c in data.colors:
        sizes = [v.size.strip().upper() for v in c.variants]
        if len(sizes) != len(set(sizes)):
            raise HTTPException(400, f"Tamanho repetido na cor '{c.name}'.")

    p.category_id = data.category_id
    p.name = data.name
    p.sku_base = sku
    p.cost_price = round(data.cost_price, 2)
    p.sale_price = round(data.sale_price, 2)
    p.notes = clean_str(data.notes)

    existing = {c.id: c for c in p.colors}
    kept: list[ProductColor] = []
    pending: list[tuple[Variant, int, bool]] = []  # (variante, qtd desejada, nova?)

    for pos, cin in enumerate(data.colors):
        color = existing.get(cin.id) if cin.id else None
        if color is None:
            color = ProductColor()
            p.colors.append(color)
        color.name, color.hex, color.position = cin.name, cin.hex.upper(), pos
        kept.append(color)

        by_id = {v.id: v for v in color.variants}
        by_size = {v.size.upper(): v for v in color.variants}
        kept_v: list[Variant] = []
        for vin in cin.variants:
            size = vin.size.strip().upper()
            v = (by_id.get(vin.id) if vin.id else None) or by_size.get(size)
            is_new = v is None
            if v is None:
                v = Variant(product=p, size=size, quantity=0)
                color.variants.append(v)
            v.size = size
            v.min_stock = vin.min_stock
            v.sku = variant_sku(sku, color.name, size)
            kept_v.append(v)
            pending.append((v, vin.quantity, is_new))
        for v in list(color.variants):
            if v not in kept_v:
                color.variants.remove(v)

    orphans: list[str] = []
    for c in list(p.colors):
        if c not in kept:
            if c.image_path:
                orphans.append(c.image_path)
            p.colors.remove(c)

    db.flush()
    for v, target, is_new in pending:
        delta = target - v.quantity
        if delta:
            kind = MovementKind.CADASTRO if is_new else MovementKind.AJUSTE
            reason = "Estoque inicial (cadastro)" if is_new else "Ajuste pela tela de cadastro"
            move_stock(db, v, delta, kind, reason)
    return orphans


@router.post("/products", status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    p = Product()
    db.add(p)
    _apply(db, p, data)
    db.commit()
    return product_out(_get(db, p.id))


@router.put("/products/{pid}")
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db)):
    p = _get(db, pid)
    orphans = _apply(db, p, data)
    db.commit()
    for rel in orphans:
        release_image(db, rel)
    db.expire_all()
    return product_out(_get(db, pid))


@router.delete("/products/{pid}", status_code=204)
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = _get(db, pid)
    used = db.scalar(
        select(func.count()).select_from(OrderItem).join(Variant, OrderItem.variant_id == Variant.id).where(Variant.product_id == pid)
    )
    if used:
        # Mantém o histórico dos pedidos: apenas inativa e libera o SKU.
        p.active = False
        p.sku_base = f"{p.sku_base}#DEL{p.id}"
        db.commit()
        return
    images = [p.image_path] + [c.image_path for c in p.colors]
    db.delete(p)
    db.commit()
    for rel in images:
        release_image(db, rel)


# ---------------- imagens ----------------
@router.post("/products/{pid}/image")
def upload_product_image(pid: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    p = _get(db, pid)
    rel = save_image(file.file.read(), "produtos")
    old, p.image_path = p.image_path, rel
    db.commit()
    release_image(db, old)
    return product_out(_get(db, pid))


@router.delete("/products/{pid}/image")
def delete_product_image(pid: int, db: Session = Depends(get_db)):
    p = _get(db, pid)
    old, p.image_path = p.image_path, None
    db.commit()
    release_image(db, old)
    return product_out(_get(db, pid))


def _get_color(db: Session, cid: int) -> ProductColor:
    c = db.get(ProductColor, cid)
    if not c or not c.product.active:
        raise HTTPException(404, "Cor não encontrada.")
    return c


@router.post("/colors/{cid}/image")
def upload_color_image(cid: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    c = _get_color(db, cid)
    rel = save_image(file.file.read(), "cores")
    old, c.image_path = c.image_path, rel
    db.commit()
    release_image(db, old)
    return {"id": c.id, "image_url": f"/media/{rel}"}


@router.delete("/colors/{cid}/image", status_code=204)
def delete_color_image(cid: int, db: Session = Depends(get_db)):
    c = _get_color(db, cid)
    old, c.image_path = c.image_path, None
    db.commit()
    release_image(db, old)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Product
from ..schemas import CategoryIn

router = APIRouter(prefix="/api/categories", tags=["categorias"])


def _out(c: Category, count: int) -> dict:
    return {"id": c.id, "name": c.name, "product_count": count}


def _check_dup(db: Session, name: str, exclude_id: int = 0) -> None:
    if db.scalar(select(Category.id).where(func.lower(Category.name) == name.lower(), Category.id != exclude_id)):
        raise HTTPException(409, f"Já existe a categoria '{name}'.")


@router.get("")
def list_categories(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Product.category_id, func.count()).where(Product.active.is_(True)).group_by(Product.category_id)
        ).all()
    )
    return [_out(c, counts.get(c.id, 0)) for c in db.scalars(select(Category).order_by(Category.name))]


@router.post("", status_code=201)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    _check_dup(db, data.name)
    c = Category(name=data.name)
    db.add(c)
    db.commit()
    return _out(c, 0)


@router.put("/{cid}")
def update_category(cid: int, data: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Categoria não encontrada.")
    _check_dup(db, data.name, cid)
    c.name = data.name
    db.commit()
    return _out(c, 0)


@router.delete("/{cid}", status_code=204)
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Categoria não encontrada.")
    if db.scalar(select(func.count()).select_from(Product).where(Product.category_id == cid)):
        raise HTTPException(409, "Existem produtos nesta categoria. Mova-os para outra categoria antes de excluir.")
    db.delete(c)
    db.commit()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Customer, Order
from ..schemas import CustomerIn
from ..serializers import customer_out
from ..utils import clean_str

router = APIRouter(prefix="/api/customers", tags=["clientes"])


def _apply(c: Customer, data: CustomerIn) -> None:
    c.name = data.name
    for f in ("document", "phone", "email", "address", "city", "notes"):
        setattr(c, f, clean_str(getattr(data, f)))


@router.get("")
def list_customers(q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Customer).order_by(Customer.name)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.document.ilike(like)))
    counts = dict(db.execute(select(Order.customer_id, func.count()).group_by(Order.customer_id)).all())
    return [{**customer_out(c), "order_count": counts.get(c.id, 0)} for c in db.scalars(stmt)]


@router.get("/{cid}")
def get_customer(cid: int, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404, "Cliente não encontrado.")
    return customer_out(c)


@router.post("", status_code=201)
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    c = Customer()
    _apply(c, data)
    db.add(c)
    db.commit()
    return customer_out(c)


@router.put("/{cid}")
def update_customer(cid: int, data: CustomerIn, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404, "Cliente não encontrado.")
    _apply(c, data)
    db.commit()
    return customer_out(c)


@router.delete("/{cid}", status_code=204)
def delete_customer(cid: int, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404, "Cliente não encontrado.")
    db.delete(c)  # pedidos mantêm o nome do cliente (snapshot)
    db.commit()

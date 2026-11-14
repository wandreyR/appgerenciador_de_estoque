from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now() -> datetime:
    return datetime.now().replace(microsecond=0)


class OrderStatus:
    PENDENTE = "pendente"      # aguardando separação (estoque já baixado)
    SEPARADO = "separado"
    ENTREGUE = "entregue"
    CANCELADO = "cancelado"   # estoque devolvido
    ALL = (PENDENTE, SEPARADO, ENTREGUE, CANCELADO)


class MovementKind:
    ENTRADA = "entrada"
    SAIDA = "saida"
    AJUSTE = "ajuste"
    CADASTRO = "cadastro"
    PEDIDO = "pedido"
    CANCELAMENTO = "cancelamento"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    sku_base: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    cost_price: Mapped[float] = mapped_column(Float, default=0)
    sale_price: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    category: Mapped[Category] = relationship()
    colors: Mapped[list[ProductColor]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductColor.position"
    )
    variants: Mapped[list[Variant]] = relationship(viewonly=True)


class ProductColor(Base):
    __tablename__ = "product_colors"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    hex: Mapped[str] = mapped_column(String(7), default="#000000")
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="colors")
    variants: Mapped[list[Variant]] = relationship(
        back_populates="color", cascade="all, delete-orphan", order_by="Variant.id"
    )


class Variant(Base):
    """Uma célula da grade: modelo + cor + tamanho."""

    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("color_id", "size", name="uq_variant_color_size"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    color_id: Mapped[int] = mapped_column(ForeignKey("product_colors.id", ondelete="CASCADE"), index=True)
    size: Mapped[str] = mapped_column(String(12))
    sku: Mapped[str] = mapped_column(String(80), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship()
    color: Mapped[ProductColor] = relationship(back_populates="variants")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    document: Mapped[str | None] = mapped_column(String(30), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(160))
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=OrderStatus.PENDENTE, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total: Mapped[float] = mapped_column(Float, default=0)
    total_pieces: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    separated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    separated_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customer: Mapped[Customer | None] = relationship()
    items: Mapped[list[OrderItem]] = relationship(cascade="all, delete-orphan", order_by="OrderItem.id")


class OrderItem(Base):
    """Guarda um 'snapshot' do produto para que o pedido continue íntegro
    mesmo que o cadastro seja alterado ou excluído depois."""

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("variants.id", ondelete="SET NULL"), nullable=True)
    product_name: Mapped[str] = mapped_column(String(160))
    sku: Mapped[str] = mapped_column(String(80))
    color_name: Mapped[str] = mapped_column(String(60))
    color_hex: Mapped[str] = mapped_column(String(7))
    size: Mapped[str] = mapped_column(String(12))
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Float, default=0)

    variant: Mapped[Variant | None] = relationship()


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("variants.id", ondelete="SET NULL"), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(20), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")

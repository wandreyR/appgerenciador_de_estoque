from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

HEX_PATTERN = r"^#[0-9A-Fa-f]{6}$"


def _strip(v):
    return v.strip() if isinstance(v, str) else v


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    strip_fields = field_validator("name", mode="before")(_strip)


class VariantIn(BaseModel):
    id: int | None = None
    size: str = Field(min_length=1, max_length=12)
    quantity: int = Field(ge=0, default=0)
    min_stock: int = Field(ge=0, default=0)


class ColorIn(BaseModel):
    id: int | None = None
    name: str = Field(min_length=1, max_length=60)
    hex: str = Field(pattern=HEX_PATTERN)
    variants: list[VariantIn] = Field(default_factory=list)
    strip_fields = field_validator("name", mode="before")(_strip)


class ProductIn(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=160)
    sku_base: str = Field(min_length=1, max_length=60)
    cost_price: float = Field(ge=0, default=0)
    sale_price: float = Field(ge=0, default=0)
    notes: str | None = None
    colors: list[ColorIn] = Field(default_factory=list)
    strip_fields = field_validator("name", "sku_base", mode="before")(_strip)


class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    document: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=80)
    notes: str | None = None
    strip_fields = field_validator("name", "document", "phone", "email", "address", "city", mode="before")(_strip)


class OrderItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(ge=1)
    unit_price: float | None = Field(default=None, ge=0)


class OrderIn(BaseModel):
    customer_id: int | None = None
    customer_name: str | None = None
    notes: str | None = None
    items: list[OrderItemIn] = Field(min_length=1)


class OrderStatusIn(BaseModel):
    status: Literal["pendente", "separado", "entregue", "cancelado"]
    separated_by: str | None = Field(default=None, max_length=80)


class StockMoveIn(BaseModel):
    variant_id: int
    kind: Literal["entrada", "saida", "ajuste"]
    quantity: int = Field(ge=0)
    reason: str | None = Field(default=None, max_length=255)


class ActivateIn(BaseModel):
    key: str = Field(min_length=10, max_length=4000)

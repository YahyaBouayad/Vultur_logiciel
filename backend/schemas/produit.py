from pydantic import BaseModel
from decimal import Decimal
from typing import Optional


class ProduitCreate(BaseModel):
    nom: str
    reference: str
    stock: int = 0
    prix: Decimal


class ProduitUpdate(BaseModel):
    nom: Optional[str] = None
    reference: Optional[str] = None
    stock: Optional[int] = None
    prix: Optional[Decimal] = None


class ProduitOut(BaseModel):
    id: int
    nom: str
    reference: str
    stock: int
    prix: Decimal

    class Config:
        from_attributes = True

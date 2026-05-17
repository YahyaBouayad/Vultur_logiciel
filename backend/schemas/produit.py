from pydantic import BaseModel
from decimal import Decimal
from typing import Optional


class ProduitCreate(BaseModel):
    nom: str
    reference: str
    stock: float = 0
    prix: Decimal
    alerte_ignoree: bool = False
    unite: str = 'unité'


class ProduitUpdate(BaseModel):
    nom: Optional[str] = None
    reference: Optional[str] = None
    stock: Optional[float] = None
    prix: Optional[Decimal] = None
    alerte_ignoree: Optional[bool] = None
    unite: Optional[str] = None


class ProduitOut(BaseModel):
    id: int
    nom: str
    reference: str
    stock: float
    prix: Decimal
    alerte_ignoree: bool
    unite: str = 'unité'

    class Config:
        from_attributes = True

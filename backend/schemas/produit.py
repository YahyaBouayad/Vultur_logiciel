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
    type_produit: Optional[str] = None


class ProduitUpdate(BaseModel):
    nom: Optional[str] = None
    reference: Optional[str] = None
    stock: Optional[float] = None
    prix: Optional[Decimal] = None
    alerte_ignoree: Optional[bool] = None
    unite: Optional[str] = None
    type_produit: Optional[str] = None
    suivi_hulio: Optional[bool] = None
    pbr: Optional[Decimal] = None


class ProduitOut(BaseModel):
    id: int
    nom: str
    reference: str
    stock: float
    prix: Decimal
    alerte_ignoree: bool
    unite: str = 'unité'
    type_produit: Optional[str] = None
    suivi_hulio: bool = False
    pbr: Optional[Decimal] = None

    class Config:
        from_attributes = True

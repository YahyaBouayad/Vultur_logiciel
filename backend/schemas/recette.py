from pydantic import BaseModel
from decimal import Decimal
from typing import Optional, List


class LigneRecetteIn(BaseModel):
    produit_id: int
    quantite: float


class LigneRecetteOut(BaseModel):
    id: int
    produit_id: int
    produit_nom: str
    produit_unite: str
    produit_stock: float
    quantite: float

    class Config:
        from_attributes = True


class RecetteCreate(BaseModel):
    # Produit fini (créé simultanément)
    nom: str
    reference: str
    prix: Decimal
    unite: str = 'unité'
    # Recette
    quantite_produite: float
    notes: Optional[str] = None
    lignes: List[LigneRecetteIn]


class RecetteUpdate(BaseModel):
    quantite_produite: Optional[float] = None
    notes: Optional[str] = None
    lignes: Optional[List[LigneRecetteIn]] = None


class RecetteOut(BaseModel):
    id: int
    produit_id: int
    produit_nom: str
    produit_reference: str
    produit_unite: str
    produit_stock: float
    produit_prix: float
    quantite_produite: float
    notes: Optional[str] = None
    lignes: List[LigneRecetteOut] = []

from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date


class LigneCommandeCreate(BaseModel):
    produit_id: int
    quantite: int
    prix_unitaire: Decimal


class LigneCommandeOut(BaseModel):
    id: int
    produit_id: int
    quantite: int
    prix_unitaire: Decimal

    class Config:
        from_attributes = True


class BonCommandeCreate(BaseModel):
    fournisseur_id: int
    notes: Optional[str] = None
    lignes: List[LigneCommandeCreate]


class StatutCommandeUpdate(BaseModel):
    statut: str  # brouillon | envoyé | reçu


class BonCommandeOut(BaseModel):
    id: int
    fournisseur_id: int
    date: date
    statut: str
    notes: Optional[str]
    lignes: List[LigneCommandeOut]

    class Config:
        from_attributes = True

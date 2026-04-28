from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
import datetime


class LigneCommandeCreate(BaseModel):
    produit_id: int
    quantite: int
    prix_unitaire: Decimal
    remise: Decimal = Decimal('0')


class LigneCommandeOut(BaseModel):
    id: int
    produit_id: int
    quantite: int
    prix_unitaire: Decimal
    remise: Decimal = Decimal('0')

    class Config:
        from_attributes = True


class BonCommandeCreate(BaseModel):
    fournisseur_id: int
    date: Optional[datetime.date] = None
    notes: Optional[str] = None
    lignes: List[LigneCommandeCreate]
    pdf_base64: Optional[str] = None


class BonCommandeUpdate(BaseModel):
    fournisseur_id: Optional[int] = None
    date: Optional[datetime.date] = None
    notes: Optional[str] = None
    lignes: Optional[List[LigneCommandeCreate]] = None
    pdf_base64: Optional[str] = None


class StatutCommandeUpdate(BaseModel):
    statut: str  # brouillon | envoyé | reçu


class BonCommandeOut(BaseModel):
    id: int
    fournisseur_id: int
    date: datetime.date
    statut: str
    notes: Optional[str]
    lignes: List[LigneCommandeOut]
    pdf_base64: Optional[str] = None

    class Config:
        from_attributes = True

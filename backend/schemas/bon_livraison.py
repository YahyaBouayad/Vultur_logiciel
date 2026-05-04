from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date


class LigneCreate(BaseModel):
    produit_id: int
    quantite: int
    prix_unitaire: Decimal
    remise: Decimal = Decimal('0')


class LigneOut(BaseModel):
    id: int
    produit_id: int
    quantite: int
    prix_unitaire: Decimal
    remise: Decimal = Decimal('0')

    class Config:
        from_attributes = True


class BonLivraisonCreate(BaseModel):
    client_id: int
    notes: Optional[str] = None
    lignes: List[LigneCreate]


class BonLivraisonUpdate(BaseModel):
    client_id: Optional[int] = None
    notes: Optional[str] = None
    lignes: Optional[List[LigneCreate]] = None


class StatutUpdate(BaseModel):
    statut: str  # brouillon | validé | livré


class EncaisserUpdate(BaseModel):
    mode_encaissement: str
    date_encaissement: date


class BonLivraisonOut(BaseModel):
    id: int
    client_id: int
    date: date
    statut: str
    notes: Optional[str]
    lignes: List[LigneOut]
    facture_id: Optional[int] = None
    encaisse: bool = False
    mode_encaissement: Optional[str] = None
    date_encaissement: Optional[date] = None

    class Config:
        from_attributes = True


class BonLivraisonPage(BaseModel):
    items: List[BonLivraisonOut]
    total: int


class BLEncaisseOut(BaseModel):
    id: int
    client_id: int
    date: date
    date_encaissement: Optional[date]
    mode_encaissement: Optional[str]
    montant: float
    notes: Optional[str]

    class Config:
        from_attributes = True

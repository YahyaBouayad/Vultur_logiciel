from pydantic import BaseModel
from decimal import Decimal
from typing import Optional, List
from datetime import date


class PaiementCreate(BaseModel):
    date: date
    montant: Decimal
    mode: str
    notes: Optional[str] = None


class PaiementOut(BaseModel):
    id: int
    facture_id: int
    date: date
    montant: float
    mode: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class SuiviFactureOut(BaseModel):
    facture_id: int
    facture_numero: str
    client_id: int
    date_emission: date
    date_echeance: Optional[date]
    statut: str
    montant_ht: float
    montant_paye: float
    solde: float
    paiements: List[PaiementOut]

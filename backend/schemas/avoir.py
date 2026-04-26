from pydantic import BaseModel
from decimal import Decimal
from typing import Optional
from datetime import date


class AvoirCreate(BaseModel):
    date: date
    montant_ht: Decimal
    motif: str
    notes: Optional[str] = None


class AvoirOut(BaseModel):
    id: int
    facture_id: int
    numero: str
    date: date
    montant_ht: float
    motif: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class AvoirDetailOut(AvoirOut):
    facture_numero: str
    facture_date_emission: Optional[date]
    client_id: Optional[int]

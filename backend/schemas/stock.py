from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MouvementCreate(BaseModel):
    produit_id: int
    quantite: float
    bon_livraison_id: Optional[int] = None
    notes: Optional[str] = None


class MouvementOut(BaseModel):
    id: int
    produit_id: int
    type: str
    quantite: float
    date: datetime
    bon_livraison_id: Optional[int]
    ordre_fabrication_id: Optional[int] = None
    livraison_hulio_id: Optional[int] = None
    notes: Optional[str]

    class Config:
        from_attributes = True

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MouvementCreate(BaseModel):
    produit_id: int
    quantite: int
    bon_livraison_id: Optional[int] = None
    notes: Optional[str] = None


class MouvementOut(BaseModel):
    id: int
    produit_id: int
    type: str
    quantite: int
    date: datetime
    bon_livraison_id: Optional[int]
    notes: Optional[str]

    class Config:
        from_attributes = True

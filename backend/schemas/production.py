from pydantic import BaseModel
from typing import Optional
import datetime


class OrdreFabricationCreate(BaseModel):
    recette_id: int
    nombre_batches: float
    quantite_reelle: Optional[float] = None
    notes: Optional[str] = None
    date: Optional[datetime.date] = None


class OrdreFabricationOut(BaseModel):
    id: int
    recette_id: int
    produit_id: int
    produit_nom: str
    produit_unite: str
    nombre_batches: float
    quantite_produite: float
    quantite_reelle: float
    perte: float
    cout_production: float
    cout_unitaire: float
    date: datetime.date
    notes: Optional[str] = None

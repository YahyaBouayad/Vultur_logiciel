from pydantic import BaseModel
from typing import List, Optional
import datetime


class LigneDemandeAchatCreate(BaseModel):
    produit_id: int
    quantite_demandee: float
    prix_unitaire: float


class DemandeAchatCreate(BaseModel):
    fournisseur_id: int
    date: Optional[datetime.date] = None
    notes: Optional[str] = None
    lignes: List[LigneDemandeAchatCreate]


class LigneDemandeAchatUpdate(BaseModel):
    produit_id: int
    quantite_demandee: float
    prix_unitaire: float


class DemandeAchatUpdate(BaseModel):
    notes: Optional[str] = None
    lignes: Optional[List[LigneDemandeAchatUpdate]] = None


class LigneValider(BaseModel):
    produit_id: int
    quantite_confirmee: float
    prix_unitaire: float


class DemandeAchatValider(BaseModel):
    lignes: Optional[List[LigneValider]] = None
    date_bc: Optional[datetime.date] = None
    notes_bc: Optional[str] = None


class LigneDemandeAchatOut(BaseModel):
    id: int
    produit_id: int
    produit_nom: str
    produit_reference: str
    produit_unite: str
    quantite_demandee: float
    quantite_confirmee: Optional[float] = None
    prix_unitaire: float

    class Config:
        from_attributes = True


class DemandeAchatOut(BaseModel):
    id: int
    numero: str
    fournisseur_id: int
    fournisseur_nom: str
    fournisseur_email: Optional[str] = None
    fournisseur_adresse: Optional[str] = None
    fournisseur_ice: Optional[str] = None
    statut: str
    date: datetime.date
    notes: Optional[str] = None
    bon_commande_id: Optional[int] = None
    lignes: List[LigneDemandeAchatOut]

    class Config:
        from_attributes = True

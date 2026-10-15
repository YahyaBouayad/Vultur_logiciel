from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class FactureCreate(BaseModel):
    bon_livraison_id: int
    notes: Optional[str] = None
    date_echeance: Optional[date] = None  # défaut : émission + 30 jours
    tva_incluse: bool = False


class FactureUpdate(BaseModel):
    notes: Optional[str] = None
    date_echeance: Optional[date] = None
    date_emission: Optional[date] = None
    tva_incluse: Optional[bool] = None


class StatutFactureUpdate(BaseModel):
    statut: str  # émise | payée | annulée


class FactureHulioOut(BaseModel):
    traitement_id: int
    produit_id: int
    designation: str
    quantite: int
    ppm: float
    pbr: Optional[float] = None
    taux_prise_en_charge: Optional[float] = None
    taux_tva: float = 0.0
    numero_prise_en_charge: Optional[str] = None
    assure_nom: Optional[str] = None
    beneficiaire_nom: Optional[str] = None
    immatriculation: Optional[str] = None
    organisme: Optional[str] = None

    class Config:
        from_attributes = True


class FactureOut(BaseModel):
    id: int
    numero: str
    bon_livraison_id: Optional[int] = None
    client_id: int
    date_emission: date
    date_echeance: Optional[date]
    statut: str
    notes: Optional[str]
    montant_ht: float = 0.0
    tva_incluse: bool = False
    type_facture: str = "standard"
    taux_tva: Optional[float] = None  # renseigné pour les factures Hulio (sinon : TVA des paramètres)
    hulio: Optional[FactureHulioOut] = None

    class Config:
        from_attributes = True


class FacturePage(BaseModel):
    items: List[FactureOut]
    total: int


class ImpayeOut(BaseModel):
    id: int
    numero: str
    client_id: int
    date_emission: date
    date_echeance: Optional[date]
    jours_retard: int
    niveau: str  # normal | attention | retard | critique
    montant_ht: float = 0.0

    class Config:
        from_attributes = True

from pydantic import BaseModel
from typing import Optional, List
from schemas.facture import FactureHulioOut
import datetime


class LivraisonHulioCreate(BaseModel):
    date_prevue: datetime.date
    date_rappel: Optional[datetime.date] = None
    nombre_boites: int = 1
    notes: Optional[str] = None


class LivraisonHulioUpdate(BaseModel):
    date_prevue: Optional[datetime.date] = None
    date_rappel: Optional[datetime.date] = None
    nombre_boites: Optional[int] = None
    notes: Optional[str] = None


class LivrerHulio(BaseModel):
    date_livraison: Optional[datetime.date] = None


class LivraisonHulioOut(BaseModel):
    id: int
    traitement_id: int
    date_prevue: datetime.date
    date_rappel: Optional[datetime.date] = None
    nombre_boites: int
    statut: str
    date_livraison: Optional[datetime.date] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class TraitementHulioCreate(BaseModel):
    client_id: int
    produit_id: int
    pathologie: Optional[str] = None
    nature_remboursement: Optional[str] = None
    centre_mutuelle: Optional[str] = None
    date_debut: datetime.date
    duree_mois: Optional[int] = None
    date_fin: Optional[datetime.date] = None
    nombre_boites: int
    notes: Optional[str] = None
    livraisons: List[LivraisonHulioCreate] = []
    # Facture créée avec le traitement (quantité libre ; aucune facture si absente ou 0)
    facture_quantite: Optional[int] = None
    facture_taux_prise_en_charge: Optional[float] = None


class TraitementHulioUpdate(BaseModel):
    produit_id: Optional[int] = None
    pathologie: Optional[str] = None
    nature_remboursement: Optional[str] = None
    centre_mutuelle: Optional[str] = None
    date_debut: Optional[datetime.date] = None
    duree_mois: Optional[int] = None
    date_fin: Optional[datetime.date] = None
    nombre_boites: Optional[int] = None
    statut: Optional[str] = None
    notes: Optional[str] = None


class TraitementHulioOut(BaseModel):
    id: int
    client_id: int
    client_nom: str
    client_telephone: Optional[str] = None
    produit_id: int
    produit_nom: str
    pathologie: Optional[str] = None
    nature_remboursement: Optional[str] = None
    centre_mutuelle: Optional[str] = None
    date_debut: datetime.date
    duree_mois: Optional[int] = None
    date_fin: Optional[datetime.date] = None
    nombre_boites: int
    statut: str
    notes: Optional[str] = None
    boites_livrees: int
    boites_planifiees: int  # livraisons non annulées (livrées + prévues)
    livraisons: List[LivraisonHulioOut]
    boites_facturees: int = 0  # factures non annulées
    factures: List["FactureHulioResume"] = []


# ── Factures Hulio ───────────────────────────────────────────────────────────

class FactureHulioCreate(BaseModel):
    quantite: int
    date_emission: Optional[datetime.date] = None
    taux_prise_en_charge: Optional[float] = None
    notes: Optional[str] = None


class FactureHulioUpdate(BaseModel):
    """Compléter / corriger une facture Hulio avant impression. Un champ envoyé à null est vidé."""
    date_emission: Optional[datetime.date] = None
    designation: Optional[str] = None
    quantite: Optional[int] = None
    ppm: Optional[float] = None
    pbr: Optional[float] = None
    taux_prise_en_charge: Optional[float] = None
    numero_prise_en_charge: Optional[str] = None
    assure_nom: Optional[str] = None
    beneficiaire_nom: Optional[str] = None
    immatriculation: Optional[str] = None
    organisme: Optional[str] = None
    notes: Optional[str] = None


class FactureHulioResume(BaseModel):
    id: int  # id de la facture
    numero: str
    statut: str
    client_id: int
    date_emission: datetime.date
    date_echeance: Optional[datetime.date] = None
    notes: Optional[str] = None
    type_facture: str = "hulio"
    montant_ttc: float
    hulio: FactureHulioOut


# TraitementHulioOut référence FactureHulioResume, défini après
TraitementHulioOut.model_rebuild()

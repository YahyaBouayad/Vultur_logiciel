from pydantic import BaseModel, field_validator
from typing import Optional


class ParametreOut(BaseModel):
    id: int
    compteur_facture: int

    # Société
    nom: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    ice: Optional[str] = None
    rc: Optional[str] = None

    # Comptes bancaires
    rib_1: Optional[str] = None
    rib_1_label: Optional[str] = None
    rib_2: Optional[str] = None
    rib_2_label: Optional[str] = None
    rib_3: Optional[str] = None
    rib_3_label: Optional[str] = None
    rib_actif: int = 1

    # Facturation
    tva: float = 20.0
    delai_paiement: int = 30
    devise: str = 'MAD'
    prefixe_facture: str = 'FAC'

    # Personnalisation PDF
    logo: Optional[str] = None
    signature: Optional[str] = None
    cachet: Optional[str] = None
    couleur_primaire: str = '#0d2c6e'
    couleur_accent: str = '#f06020'
    conditions_paiement: Optional[str] = None
    mentions_legales: Optional[str] = None
    pied_de_page: Optional[str] = None
    afficher_remise: bool = True
    prod_afficher_cout: bool = True
    prod_afficher_batches: bool = True
    prod_afficher_stats: bool = True
    prefixe_demande: str = 'DA'
    compteur_demande: int = 1
    duree_archivage_demandes: int = 90

    class Config:
        from_attributes = True


class ParametreUpdate(BaseModel):
    compteur_facture: Optional[int] = None

    # Société
    nom: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    ice: Optional[str] = None
    rc: Optional[str] = None

    # Comptes bancaires
    rib_1: Optional[str] = None
    rib_1_label: Optional[str] = None
    rib_2: Optional[str] = None
    rib_2_label: Optional[str] = None
    rib_3: Optional[str] = None
    rib_3_label: Optional[str] = None
    rib_actif: Optional[int] = None

    # Facturation
    tva: Optional[float] = None
    delai_paiement: Optional[int] = None
    devise: Optional[str] = None
    prefixe_facture: Optional[str] = None

    # Personnalisation PDF
    logo: Optional[str] = None
    signature: Optional[str] = None
    cachet: Optional[str] = None
    couleur_primaire: Optional[str] = None
    couleur_accent: Optional[str] = None
    conditions_paiement: Optional[str] = None
    mentions_legales: Optional[str] = None
    pied_de_page: Optional[str] = None
    afficher_remise: Optional[bool] = None
    prod_afficher_cout: Optional[bool] = None
    prod_afficher_batches: Optional[bool] = None
    prod_afficher_stats: Optional[bool] = None
    prefixe_demande: Optional[str] = None
    compteur_demande: Optional[int] = None
    duree_archivage_demandes: Optional[int] = None

    @field_validator('compteur_facture')
    @classmethod
    def positif(cls, v):
        if v is not None and v < 1:
            raise ValueError('Le compteur doit être supérieur ou égal à 1')
        return v

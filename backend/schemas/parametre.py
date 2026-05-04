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

    # Facturation
    tva: float = 20.0
    delai_paiement: int = 30
    devise: str = 'MAD'
    prefixe_facture: str = 'FAC'

    # Personnalisation PDF
    logo: Optional[str] = None
    couleur_primaire: str = '#0d2c6e'
    couleur_accent: str = '#f06020'
    conditions_paiement: Optional[str] = None
    mentions_legales: Optional[str] = None
    pied_de_page: Optional[str] = None
    afficher_remise: bool = True

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

    # Facturation
    tva: Optional[float] = None
    delai_paiement: Optional[int] = None
    devise: Optional[str] = None
    prefixe_facture: Optional[str] = None

    # Personnalisation PDF
    logo: Optional[str] = None
    couleur_primaire: Optional[str] = None
    couleur_accent: Optional[str] = None
    conditions_paiement: Optional[str] = None
    mentions_legales: Optional[str] = None
    pied_de_page: Optional[str] = None
    afficher_remise: Optional[bool] = None

    @field_validator('compteur_facture')
    @classmethod
    def positif(cls, v):
        if v is not None and v < 1:
            raise ValueError('Le compteur doit être supérieur ou égal à 1')
        return v

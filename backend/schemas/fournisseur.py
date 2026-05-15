from pydantic import BaseModel
from typing import Optional


class FournisseurCreate(BaseModel):
    nom: str
    contact: Optional[str] = None
    particulier: bool = False
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    mail: Optional[str] = None
    ice: Optional[str] = None
    rib: Optional[str] = None


class FournisseurUpdate(BaseModel):
    nom: Optional[str] = None
    contact: Optional[str] = None
    particulier: Optional[bool] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    mail: Optional[str] = None
    ice: Optional[str] = None
    rib: Optional[str] = None


class FournisseurOut(BaseModel):
    id: int
    nom: str
    contact: Optional[str]
    particulier: bool
    telephone: Optional[str]
    adresse: Optional[str]
    mail: Optional[str]
    ice: Optional[str]
    rib: Optional[str]

    class Config:
        from_attributes = True

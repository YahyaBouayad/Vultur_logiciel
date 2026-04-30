from pydantic import BaseModel
from typing import Optional

TYPES_CLIENT = {"pharmacie", "clinique", "hopital", "particulier", "parapharmacie"}


class ClientCreate(BaseModel):
    nom: str
    type_client: str
    contact: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    mail: Optional[str] = None
    ice: Optional[str] = None


class ClientUpdate(BaseModel):
    nom: Optional[str] = None
    type_client: Optional[str] = None
    contact: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    mail: Optional[str] = None
    ice: Optional[str] = None


class ClientOut(BaseModel):
    id: int
    nom: str
    type_client: Optional[str]
    particulier: bool
    contact: Optional[str]
    telephone: Optional[str]
    adresse: Optional[str]
    mail: Optional[str]
    ice: Optional[str]

    class Config:
        from_attributes = True

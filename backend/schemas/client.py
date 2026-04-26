from pydantic import BaseModel
from typing import Optional


class ClientCreate(BaseModel):
    nom: str
    contact: Optional[str] = None
    particulier: bool = False
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    mail: Optional[str] = None
    ice: Optional[str] = None


class ClientUpdate(BaseModel):
    nom: Optional[str] = None
    contact: Optional[str] = None
    particulier: Optional[bool] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    mail: Optional[str] = None
    ice: Optional[str] = None


class ClientOut(BaseModel):
    id: int
    nom: str
    contact: Optional[str]
    particulier: bool
    telephone: Optional[str]
    adresse: Optional[str]
    mail: Optional[str]
    ice: Optional[str]

    class Config:
        from_attributes = True

from pydantic import BaseModel
from pydantic import field_validator


class ParametreOut(BaseModel):
    id: int
    compteur_facture: int

    class Config:
        from_attributes = True


class ParametreUpdate(BaseModel):
    compteur_facture: int

    @field_validator('compteur_facture')
    @classmethod
    def positif(cls, v):
        if v < 1:
            raise ValueError('Le compteur doit être supérieur ou égal à 1')
        return v

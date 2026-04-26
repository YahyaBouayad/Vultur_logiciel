from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    mot_de_passe: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UtilisateurOut(BaseModel):
    id: int
    nom: str
    email: str

    class Config:
        from_attributes = True


class UtilisateurCreate(BaseModel):
    nom: str
    email: str
    mot_de_passe: str

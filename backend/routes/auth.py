from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.utilisateur import Utilisateur
from schemas.auth import LoginRequest, TokenOut, UtilisateurOut, UtilisateurCreate
from security import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=UtilisateurOut, status_code=201)
def register(data: UtilisateurCreate, db: Session = Depends(get_db)):
    existant = db.query(Utilisateur).filter(Utilisateur.email == data.email).first()
    if existant:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = Utilisateur(
        nom=data.nom,
        email=data.email,
        mot_de_passe=hash_password(data.mot_de_passe),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Utilisateur).filter(Utilisateur.email == data.email).first()
    if not user or not verify_password(data.mot_de_passe, user.mot_de_passe):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    token = create_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UtilisateurOut)
def me(current_user: Utilisateur = Depends(get_current_user)):
    return current_user


class ChangePasswordRequest(BaseModel):
    ancien: str
    nouveau: str


@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if not verify_password(data.ancien, current_user.mot_de_passe):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if len(data.nouveau) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit faire au moins 6 caractères")
    current_user.mot_de_passe = hash_password(data.nouveau)
    db.commit()
    return {"detail": "Mot de passe modifié avec succès"}

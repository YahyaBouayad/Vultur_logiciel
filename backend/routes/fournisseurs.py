from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.fournisseur import Fournisseur
from models.utilisateur import Utilisateur
from schemas.fournisseur import FournisseurCreate, FournisseurUpdate, FournisseurOut
from security import get_current_user

router = APIRouter(prefix="/fournisseurs", tags=["Fournisseurs"])


@router.get("/", response_model=List[FournisseurOut])
def get_fournisseurs(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return db.query(Fournisseur).all()


@router.get("/{fournisseur_id}", response_model=FournisseurOut)
def get_fournisseur(fournisseur_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    fournisseur = db.query(Fournisseur).filter(Fournisseur.id == fournisseur_id).first()
    if not fournisseur:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return fournisseur


@router.post("/", response_model=FournisseurOut, status_code=201)
def create_fournisseur(data: FournisseurCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if data.particulier and data.ice:
        raise HTTPException(status_code=400, detail="Un particulier ne peut pas avoir d'ICE")
    fournisseur = Fournisseur(**data.model_dump())
    db.add(fournisseur)
    db.commit()
    db.refresh(fournisseur)
    return fournisseur


@router.put("/{fournisseur_id}", response_model=FournisseurOut)
def update_fournisseur(fournisseur_id: int, data: FournisseurUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    fournisseur = db.query(Fournisseur).filter(Fournisseur.id == fournisseur_id).first()
    if not fournisseur:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    for champ, valeur in data.model_dump(exclude_unset=True).items():
        setattr(fournisseur, champ, valeur)
    if fournisseur.particulier and fournisseur.ice:
        raise HTTPException(status_code=400, detail="Un particulier ne peut pas avoir d'ICE")
    db.commit()
    db.refresh(fournisseur)
    return fournisseur


@router.delete("/{fournisseur_id}", status_code=204)
def delete_fournisseur(fournisseur_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    fournisseur = db.query(Fournisseur).filter(Fournisseur.id == fournisseur_id).first()
    if not fournisseur:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    db.delete(fournisseur)
    db.commit()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.produit import Produit
from models.utilisateur import Utilisateur
from schemas.produit import ProduitCreate, ProduitUpdate, ProduitOut
from security import get_current_user

router = APIRouter(prefix="/produits", tags=["Produits"])


@router.get("/", response_model=List[ProduitOut])
def get_produits(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return db.query(Produit).all()


@router.get("/{produit_id}", response_model=ProduitOut)
def get_produit(produit_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    produit = db.query(Produit).filter(Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return produit


@router.post("/", response_model=ProduitOut, status_code=201)
def create_produit(data: ProduitCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    existant = db.query(Produit).filter(Produit.reference == data.reference).first()
    if existant:
        raise HTTPException(status_code=400, detail="Référence déjà utilisée")
    produit = Produit(**data.model_dump())
    db.add(produit)
    db.commit()
    db.refresh(produit)
    return produit


@router.put("/{produit_id}", response_model=ProduitOut)
def update_produit(produit_id: int, data: ProduitUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    produit = db.query(Produit).filter(Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for champ, valeur in data.model_dump(exclude_unset=True).items():
        setattr(produit, champ, valeur)
    db.commit()
    db.refresh(produit)
    return produit


@router.delete("/{produit_id}", status_code=204)
def delete_produit(produit_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    produit = db.query(Produit).filter(Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    db.delete(produit)
    db.commit()

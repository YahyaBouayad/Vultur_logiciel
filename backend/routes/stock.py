from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.produit import Produit
from models.stock_mouvement import StockMouvement
from models.utilisateur import Utilisateur
from schemas.stock import MouvementCreate, MouvementOut
from security import get_current_user

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.get("/mouvements", response_model=List[MouvementOut])
def get_mouvements(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return db.query(StockMouvement).order_by(StockMouvement.date.desc()).all()


@router.get("/mouvements/{produit_id}", response_model=List[MouvementOut])
def get_mouvements_produit(produit_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return (
        db.query(StockMouvement)
        .filter(StockMouvement.produit_id == produit_id)
        .order_by(StockMouvement.date.desc())
        .all()
    )


@router.post("/entree", response_model=MouvementOut, status_code=201)
def entree_stock(data: MouvementCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    produit = db.query(Produit).filter(Produit.id == data.produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    if data.quantite <= 0:
        raise HTTPException(status_code=400, detail="La quantité doit être positive")

    produit.stock += data.quantite

    mouvement = StockMouvement(
        produit_id=data.produit_id,
        type="entrée",
        quantite=data.quantite,
        bon_livraison_id=data.bon_livraison_id,
        notes=data.notes,
    )
    db.add(mouvement)
    db.commit()
    db.refresh(mouvement)
    return mouvement


@router.post("/sortie", response_model=MouvementOut, status_code=201)
def sortie_stock(data: MouvementCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    produit = db.query(Produit).filter(Produit.id == data.produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    if data.quantite <= 0:
        raise HTTPException(status_code=400, detail="La quantité doit être positive")
    if produit.stock < data.quantite:
        raise HTTPException(status_code=400, detail=f"Stock insuffisant (disponible : {produit.stock})")

    produit.stock -= data.quantite

    mouvement = StockMouvement(
        produit_id=data.produit_id,
        type="sortie",
        quantite=data.quantite,
        bon_livraison_id=data.bon_livraison_id,
        notes=data.notes,
    )
    db.add(mouvement)
    db.commit()
    db.refresh(mouvement)
    return mouvement

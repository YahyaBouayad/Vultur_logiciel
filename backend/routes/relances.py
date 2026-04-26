from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.facture import Facture
from models.relance import Relance
from models.utilisateur import Utilisateur
from schemas.relance import RelanceCreate, RelanceOut
from security import get_current_user

router = APIRouter(tags=["Relances"])


@router.get("/factures/{facture_id}/relances", response_model=List[RelanceOut])
def get_relances(facture_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if not db.query(Facture).filter(Facture.id == facture_id).first():
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return db.query(Relance).filter(Relance.facture_id == facture_id).order_by(Relance.date.asc()).all()


@router.post("/factures/{facture_id}/relances", response_model=RelanceOut, status_code=201)
def create_relance(facture_id: int, data: RelanceCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    facture = db.query(Facture).filter(Facture.id == facture_id).first()
    if not facture:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if facture.statut != "émise":
        raise HTTPException(status_code=400, detail="Seule une facture émise peut être relancée")
    relance = Relance(facture_id=facture_id, date=data.date, notes=data.notes)
    db.add(relance)
    db.commit()
    db.refresh(relance)
    return relance


@router.delete("/relances/{relance_id}", status_code=204)
def delete_relance(relance_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    relance = db.query(Relance).filter(Relance.id == relance_id).first()
    if not relance:
        raise HTTPException(status_code=404, detail="Relance introuvable")
    db.delete(relance)
    db.commit()

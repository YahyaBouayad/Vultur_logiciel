from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.facture import Facture
from models.avoir import Avoir
from models.utilisateur import Utilisateur
from models.parametre import Parametre
from schemas.avoir import AvoirCreate, AvoirOut, AvoirDetailOut
from security import get_current_user
import datetime

router = APIRouter(tags=["Avoirs"])


@router.get("/avoirs", response_model=list[AvoirDetailOut])
def get_all_avoirs(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    avoirs = (
        db.query(Avoir)
        .options(joinedload(Avoir.facture))
        .order_by(Avoir.date.desc(), Avoir.id.desc())
        .all()
    )
    return [
        AvoirDetailOut(
            id=a.id,
            facture_id=a.facture_id,
            facture_numero=a.facture.numero if a.facture else "—",
            facture_date_emission=a.facture.date_emission if a.facture else None,
            client_id=a.facture.client_id if a.facture else None,
            numero=a.numero,
            date=a.date,
            montant_ht=float(a.montant_ht),
            motif=a.motif,
            notes=a.notes,
        )
        for a in avoirs
    ]


def _generer_numero(db: Session) -> str:
    annee = datetime.date.today().year
    count = db.query(Avoir).filter(Avoir.numero.like(f"AV-{annee}-%")).count()
    return f"AV-{annee}-{str(count + 1).zfill(4)}"


def _taux_tva(db: Session) -> float:
    p = db.query(Parametre).filter(Parametre.id == 1).first()
    return float(p.tva or 0) if p else 0.0


from utils.calculs import montant_ht_facture as _montant_ht_facture


@router.get("/factures/{facture_id}/avoirs", response_model=List[AvoirOut])
def get_avoirs(facture_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if not db.query(Facture).filter(Facture.id == facture_id).first():
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return db.query(Avoir).filter(Avoir.facture_id == facture_id).order_by(Avoir.date.asc()).all()


@router.post("/factures/{facture_id}/avoirs", response_model=AvoirOut, status_code=201)
def create_avoir(facture_id: int, data: AvoirCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    from models.bon_livraison import BonLivraison
    from models.paiement import Paiement

    facture = (
        db.query(Facture)
        .options(
            joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes),
            joinedload(Facture.paiements),
        )
        .filter(Facture.id == facture_id)
        .first()
    )
    if not facture:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if facture.statut == "annulée":
        raise HTTPException(status_code=400, detail="Impossible d'émettre un avoir sur une facture annulée")

    tva = _taux_tva(db)
    montant_facture  = _montant_ht_facture(facture, tva)
    deja_avoirs      = db.query(Avoir).filter(Avoir.facture_id == facture_id).all()
    total_avoirs     = sum(float(a.montant_ht) for a in deja_avoirs)
    total_paiements  = sum(float(p.montant) for p in facture.paiements) if facture.paiements else 0.0
    # L'avoir ne peut pas réduire le montant en dessous de ce qui a déjà été encaissé
    restant = max(0.0, montant_facture - total_avoirs - total_paiements)

    if float(data.montant_ht) <= 0:
        raise HTTPException(status_code=400, detail="Le montant de l'avoir doit être positif")
    if float(data.montant_ht) > restant + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Le montant de l'avoir ({float(data.montant_ht):.2f}) dépasse le solde disponible ({restant:.2f})"
        )

    avoir = Avoir(
        facture_id=facture_id,
        numero=_generer_numero(db),
        date=data.date,
        montant_ht=data.montant_ht,
        motif=data.motif,
        notes=data.notes,
    )
    db.add(avoir)
    db.commit()
    db.refresh(avoir)
    return avoir


@router.delete("/avoirs/{avoir_id}", status_code=204)
def delete_avoir(avoir_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    avoir = db.query(Avoir).filter(Avoir.id == avoir_id).first()
    if not avoir:
        raise HTTPException(status_code=404, detail="Avoir introuvable")
    db.delete(avoir)
    db.commit()

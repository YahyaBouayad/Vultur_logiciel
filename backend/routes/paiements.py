from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models.facture import Facture
from models.bon_livraison import BonLivraison
from models.paiement import Paiement
from models.utilisateur import Utilisateur
from models.parametre import Parametre
from schemas.paiement import PaiementCreate, PaiementOut, SuiviFactureOut
from security import get_current_user

router = APIRouter(tags=["Paiements"])


def _taux_tva(db: Session) -> float:
    p = db.query(Parametre).filter(Parametre.id == 1).first()
    return float(p.tva or 0) if p else 0.0


def _montant_ht(facture, taux_tva: float = 0.0) -> float:
    if facture.bon_livraison:
        raw = sum(
            float(l.prix_unitaire) * l.quantite * (1 - float(l.remise or 0) / 100)
            for l in facture.bon_livraison.lignes
        )
        if facture.tva_incluse and taux_tva > 0:
            return raw / (1 + taux_tva / 100)
        return raw
    return 0.0


def _build_suivi(facture, paiements, taux_tva: float = 0.0) -> SuiviFactureOut:
    montant_brut = _montant_ht(facture, taux_tva)
    # Les avoirs réduisent le montant effectivement dû
    total_avoirs = sum(float(a.montant_ht) for a in facture.avoirs) if facture.avoirs else 0.0
    montant_ht   = max(0.0, round(montant_brut - total_avoirs, 2))

    if facture.statut == "payée":
        # Quelle que soit l'historique des paiements partiels,
        # une facture marquée payée est entièrement encaissée
        montant_paye = montant_ht
        solde        = 0.0
    else:
        montant_paye = round(sum(float(p.montant) for p in paiements), 2)
        solde        = max(0.0, round(montant_ht - montant_paye, 2))

    return SuiviFactureOut(
        facture_id=facture.id,
        facture_numero=facture.numero,
        client_id=facture.client_id,
        date_emission=facture.date_emission,
        date_echeance=facture.date_echeance,
        statut=facture.statut,
        montant_ht=montant_ht,
        montant_paye=montant_paye,
        solde=solde,
        paiements=[PaiementOut.model_validate(p) for p in paiements],
    )


@router.get("/suivi-paiements", response_model=List[SuiviFactureOut])
def get_suivi(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    factures = (
        db.query(Facture)
        .options(
            joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes),
            joinedload(Facture.paiements),
            joinedload(Facture.avoirs),
        )
        .filter(Facture.statut != "annulée")
        .order_by(Facture.date_emission.desc(), Facture.id.desc())
        .all()
    )
    tva = _taux_tva(db)
    return [_build_suivi(f, f.paiements, tva) for f in factures]


@router.get("/factures/{facture_id}/paiements", response_model=List[PaiementOut])
def get_paiements(facture_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if not db.query(Facture).filter(Facture.id == facture_id).first():
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return db.query(Paiement).filter(Paiement.facture_id == facture_id).order_by(Paiement.date.asc()).all()


@router.post("/factures/{facture_id}/paiements", response_model=PaiementOut, status_code=201)
def create_paiement(facture_id: int, data: PaiementCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    from models.avoir import Avoir
    facture = (
        db.query(Facture)
        .options(
            joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes),
            joinedload(Facture.avoirs),
        )
        .filter(Facture.id == facture_id)
        .first()
    )
    if not facture:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if facture.statut == "annulée":
        raise HTTPException(status_code=400, detail="Impossible d'enregistrer un paiement sur une facture annulée")

    tva           = _taux_tva(db)
    montant_brut  = _montant_ht(facture, tva)
    total_avoirs  = sum(float(a.montant_ht) for a in facture.avoirs) if facture.avoirs else 0.0
    montant_net   = max(0.0, montant_brut - total_avoirs)
    deja_paye     = sum(float(p.montant) for p in db.query(Paiement).filter(Paiement.facture_id == facture_id).all())
    solde         = max(0.0, montant_net - deja_paye)

    if float(data.montant) <= 0:
        raise HTTPException(status_code=400, detail="Le montant doit être positif")
    if float(data.montant) > solde + 0.01:
        raise HTTPException(status_code=400, detail=f"Montant ({float(data.montant):.2f}) supérieur au solde restant ({solde:.2f})")

    paiement = Paiement(
        facture_id=facture_id,
        date=data.date,
        montant=data.montant,
        mode=data.mode,
        notes=data.notes,
    )
    db.add(paiement)

    # Marquer payée si le solde net est soldé
    if abs(deja_paye + float(data.montant) - montant_net) < 0.01:
        facture.statut = "payée"

    db.commit()
    db.refresh(paiement)
    return paiement


@router.delete("/paiements/{paiement_id}", status_code=204)
def delete_paiement(paiement_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    from models.avoir import Avoir
    p = db.query(Paiement).filter(Paiement.id == paiement_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    facture = (
        db.query(Facture)
        .options(
            joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes),
            joinedload(Facture.avoirs),
        )
        .filter(Facture.id == p.facture_id)
        .first()
    )
    db.delete(p)
    db.flush()
    tva           = _taux_tva(db)
    remaining     = db.query(Paiement).filter(Paiement.facture_id == p.facture_id).all()
    montant_brut  = _montant_ht(facture, tva)
    total_avoirs  = sum(float(a.montant_ht) for a in facture.avoirs) if facture.avoirs else 0.0
    montant_net   = max(0.0, montant_brut - total_avoirs)
    total_reste   = sum(float(r.montant) for r in remaining)
    if facture.statut == "payée" and total_reste < montant_net - 0.01:
        facture.statut = "émise"
    db.commit()

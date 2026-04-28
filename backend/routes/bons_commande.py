from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from database import get_db
from models.bon_commande import BonCommande, LigneBonCommande
from models.produit import Produit
from models.stock_mouvement import StockMouvement
from models.utilisateur import Utilisateur
from schemas.bon_commande import BonCommandeCreate, BonCommandeUpdate, BonCommandeOut, StatutCommandeUpdate
from security import get_current_user

router = APIRouter(prefix="/bons-commande", tags=["Bons de commande"])

CYCLE = ["brouillon", "envoyé", "reçu"]


@router.get("", response_model=List[BonCommandeOut])
def get_bons(
    date_debut: Optional[datetime.date] = None,
    date_fin: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    q = db.query(BonCommande)
    if date_debut: q = q.filter(BonCommande.date >= date_debut)
    if date_fin:   q = q.filter(BonCommande.date <= date_fin)
    return q.order_by(BonCommande.date.desc()).all()


@router.get("/{bc_id}", response_model=BonCommandeOut)
def get_bon(bc_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bc = db.query(BonCommande).filter(BonCommande.id == bc_id).first()
    if not bc:
        raise HTTPException(status_code=404, detail="Bon de commande introuvable")
    return bc


@router.post("", response_model=BonCommandeOut, status_code=201)
def create_bon(data: BonCommandeCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if not data.lignes:
        raise HTTPException(status_code=400, detail="Le bon de commande doit contenir au moins une ligne")

    bc = BonCommande(
        fournisseur_id=data.fournisseur_id,
        date=data.date or datetime.date.today(),
        notes=data.notes,
        statut="brouillon",
        pdf_base64=data.pdf_base64,
    )
    db.add(bc)
    db.flush()

    for ligne_data in data.lignes:
        produit = db.query(Produit).filter(Produit.id == ligne_data.produit_id).first()
        if not produit:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Produit {ligne_data.produit_id} introuvable")
        db.add(LigneBonCommande(
            bon_commande_id=bc.id,
            produit_id=ligne_data.produit_id,
            quantite=ligne_data.quantite,
            prix_unitaire=ligne_data.prix_unitaire,
            remise=ligne_data.remise,
        ))

    db.commit()
    db.refresh(bc)
    return bc


@router.put("/{bc_id}", response_model=BonCommandeOut)
def update_bon(bc_id: int, data: BonCommandeUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bc = db.query(BonCommande).filter(BonCommande.id == bc_id).first()
    if not bc:
        raise HTTPException(status_code=404, detail="Bon de commande introuvable")
    if bc.statut != "brouillon":
        raise HTTPException(status_code=400, detail="Seul un bon en statut 'brouillon' peut être modifié")

    if data.fournisseur_id is not None: bc.fournisseur_id = data.fournisseur_id
    if data.date is not None:           bc.date           = data.date
    if data.notes is not None:          bc.notes          = data.notes or None
    if data.pdf_base64 is not None:     bc.pdf_base64     = data.pdf_base64

    if data.lignes is not None:
        if not data.lignes:
            raise HTTPException(status_code=400, detail="Le bon doit contenir au moins une ligne")
        db.query(LigneBonCommande).filter(LigneBonCommande.bon_commande_id == bc_id).delete()
        for ligne_data in data.lignes:
            produit = db.query(Produit).filter(Produit.id == ligne_data.produit_id).first()
            if not produit:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Produit {ligne_data.produit_id} introuvable")
            db.add(LigneBonCommande(
                bon_commande_id=bc_id,
                produit_id=ligne_data.produit_id,
                quantite=ligne_data.quantite,
                prix_unitaire=ligne_data.prix_unitaire,
                remise=ligne_data.remise,
            ))

    db.commit()
    db.refresh(bc)
    return bc


@router.put("/{bc_id}/statut", response_model=BonCommandeOut)
def update_statut(bc_id: int, data: StatutCommandeUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bc = db.query(BonCommande).filter(BonCommande.id == bc_id).first()
    if not bc:
        raise HTTPException(status_code=404, detail="Bon de commande introuvable")

    if data.statut not in CYCLE:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs acceptées : {CYCLE}")

    index_actuel = CYCLE.index(bc.statut)
    index_nouveau = CYCLE.index(data.statut)
    if index_nouveau != index_actuel + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Transition invalide : {bc.statut} → {data.statut}",
        )

    # Incrémenter le stock quand le BC passe à "reçu"
    if data.statut == "reçu":
        for ligne in bc.lignes:
            produit = db.query(Produit).filter(Produit.id == ligne.produit_id).first()
            produit.stock += ligne.quantite
            mouvement = StockMouvement(
                produit_id=ligne.produit_id,
                type="entrée",
                quantite=ligne.quantite,
            )
            db.add(mouvement)

    bc.statut = data.statut
    db.commit()
    db.refresh(bc)
    return bc


@router.delete("/{bc_id}", status_code=204)
def delete_bon(bc_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bc = db.query(BonCommande).filter(BonCommande.id == bc_id).first()
    if not bc:
        raise HTTPException(status_code=404, detail="Bon de commande introuvable")
    if bc.statut != "brouillon":
        raise HTTPException(status_code=400, detail="Seul un bon en statut 'brouillon' peut être supprimé")
    db.delete(bc)
    db.commit()

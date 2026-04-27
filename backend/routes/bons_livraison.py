from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from database import get_db
from models.bon_livraison import BonLivraison, LigneBonLivraison
from models.produit import Produit
from models.stock_mouvement import StockMouvement
from models.utilisateur import Utilisateur
from schemas.bon_livraison import (
    BonLivraisonCreate, BonLivraisonUpdate,
    BonLivraisonOut, BonLivraisonPage, StatutUpdate, EncaisserUpdate,
)
from security import get_current_user

router = APIRouter(prefix="/bons-livraison", tags=["Bons de livraison"])

CYCLE = ["brouillon", "validé", "livré"]


def _build_out(bl) -> BonLivraisonOut:
    out = BonLivraisonOut.model_validate(bl)
    out.facture_id = bl.facture.id if bl.facture else None
    return out


@router.get("", response_model=BonLivraisonPage)
def get_bons(
    skip: int = 0,
    limit: int = 50,
    statut: Optional[str] = None,
    client_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    filters = []
    if statut:    filters.append(BonLivraison.statut == statut)
    if client_id: filters.append(BonLivraison.client_id == client_id)
    if q:
        try:
            filters.append(BonLivraison.id == int(q))
        except ValueError:
            pass

    total = db.query(func.count(BonLivraison.id)).filter(*filters).scalar()

    items = (
        db.query(BonLivraison)
        .options(
            joinedload(BonLivraison.lignes),
            joinedload(BonLivraison.facture),
        )
        .filter(*filters)
        .order_by(BonLivraison.date.desc(), BonLivraison.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"items": [_build_out(bl) for bl in items], "total": total}


@router.get("/{bl_id}", response_model=BonLivraisonOut)
def get_bon(bl_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = (
        db.query(BonLivraison)
        .options(joinedload(BonLivraison.lignes), joinedload(BonLivraison.facture))
        .filter(BonLivraison.id == bl_id)
        .first()
    )
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    return _build_out(bl)


@router.post("", response_model=BonLivraisonOut, status_code=201)
def create_bon(data: BonLivraisonCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if not data.lignes:
        raise HTTPException(status_code=400, detail="Le bon de livraison doit contenir au moins une ligne")

    bl = BonLivraison(client_id=data.client_id, notes=data.notes, statut="brouillon")
    db.add(bl)
    db.flush()

    for ligne_data in data.lignes:
        produit = db.query(Produit).filter(Produit.id == ligne_data.produit_id).first()
        if not produit:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Produit {ligne_data.produit_id} introuvable")
        db.add(LigneBonLivraison(
            bon_livraison_id=bl.id,
            produit_id=ligne_data.produit_id,
            quantite=ligne_data.quantite,
            prix_unitaire=ligne_data.prix_unitaire,
            remise=ligne_data.remise,
        ))

    db.commit()
    db.refresh(bl)
    return _build_out(bl)


@router.put("/{bl_id}", response_model=BonLivraisonOut)
def update_bon(bl_id: int, data: BonLivraisonUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = db.query(BonLivraison).options(joinedload(BonLivraison.lignes), joinedload(BonLivraison.facture)).filter(BonLivraison.id == bl_id).first()
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    if bl.statut == "livré":
        raise HTTPException(status_code=400, detail="Un bon livré ne peut plus être modifié")

    if data.client_id is not None:
        bl.client_id = data.client_id
    if data.notes is not None:
        bl.notes = data.notes or None

    if data.lignes is not None:
        if not data.lignes:
            raise HTTPException(status_code=400, detail="Le bon doit contenir au moins une ligne")
        db.query(LigneBonLivraison).filter(LigneBonLivraison.bon_livraison_id == bl_id).delete()
        for ligne_data in data.lignes:
            produit = db.query(Produit).filter(Produit.id == ligne_data.produit_id).first()
            if not produit:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Produit {ligne_data.produit_id} introuvable")
            db.add(LigneBonLivraison(
                bon_livraison_id=bl_id,
                produit_id=ligne_data.produit_id,
                quantite=ligne_data.quantite,
                prix_unitaire=ligne_data.prix_unitaire,
                remise=ligne_data.remise,
            ))

    db.commit()
    db.refresh(bl)
    return _build_out(bl)


@router.put("/{bl_id}/statut", response_model=BonLivraisonOut)
def update_statut(bl_id: int, data: StatutUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = db.query(BonLivraison).options(joinedload(BonLivraison.lignes), joinedload(BonLivraison.facture)).filter(BonLivraison.id == bl_id).first()
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")

    if data.statut not in CYCLE:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs acceptées : {CYCLE}")

    index_actuel = CYCLE.index(bl.statut)
    index_nouveau = CYCLE.index(data.statut)
    if index_nouveau != index_actuel + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Transition invalide : {bl.statut} → {data.statut}",
        )

    if data.statut == "livré":
        for ligne in bl.lignes:
            produit = db.query(Produit).filter(Produit.id == ligne.produit_id).first()
            if produit.stock < ligne.quantite:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuffisant pour '{produit.nom}' (disponible : {produit.stock}, requis : {ligne.quantite})",
                )
        for ligne in bl.lignes:
            produit = db.query(Produit).filter(Produit.id == ligne.produit_id).first()
            produit.stock -= ligne.quantite
            db.add(StockMouvement(
                produit_id=ligne.produit_id,
                type="sortie",
                quantite=ligne.quantite,
                bon_livraison_id=bl.id,
            ))

    bl.statut = data.statut
    db.commit()
    db.refresh(bl)
    return _build_out(bl)


@router.put("/{bl_id}/encaisser", response_model=BonLivraisonOut)
def encaisser_bl(bl_id: int, data: EncaisserUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = db.query(BonLivraison).options(joinedload(BonLivraison.lignes), joinedload(BonLivraison.facture)).filter(BonLivraison.id == bl_id).first()
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    if bl.statut != "livré":
        raise HTTPException(status_code=400, detail="Seul un bon livré peut être encaissé directement")
    if bl.facture:
        raise HTTPException(status_code=400, detail="Ce bon a déjà une facture associée")
    if bl.encaisse:
        raise HTTPException(status_code=400, detail="Ce bon est déjà encaissé")
    bl.encaisse          = True
    bl.mode_encaissement = data.mode_encaissement
    bl.date_encaissement = data.date_encaissement
    db.commit()
    db.refresh(bl)
    return _build_out(bl)


@router.delete("/{bl_id}/encaisser", response_model=BonLivraisonOut)
def annuler_encaissement(bl_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = db.query(BonLivraison).options(joinedload(BonLivraison.lignes), joinedload(BonLivraison.facture)).filter(BonLivraison.id == bl_id).first()
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    if not bl.encaisse:
        raise HTTPException(status_code=400, detail="Ce bon n'est pas marqué comme encaissé")
    bl.encaisse          = False
    bl.mode_encaissement = None
    bl.date_encaissement = None
    db.commit()
    db.refresh(bl)
    return _build_out(bl)


@router.delete("/{bl_id}", status_code=204)
def delete_bon(bl_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = db.query(BonLivraison).filter(BonLivraison.id == bl_id).first()
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    if bl.statut == "livré":
        raise HTTPException(status_code=400, detail="Un bon livré ne peut pas être supprimé")
    db.delete(bl)
    db.commit()

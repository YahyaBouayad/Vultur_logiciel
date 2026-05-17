from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models.produit import Produit
from models.recette import Recette, LigneRecette
from models.ordre_fabrication import OrdreFabrication
from models.utilisateur import Utilisateur
from schemas.recette import RecetteCreate, RecetteUpdate, RecetteOut, LigneRecetteOut
from security import get_current_user

router = APIRouter(prefix="/recettes", tags=["Recettes"])


def _build_recette_out(r: Recette) -> RecetteOut:
    return RecetteOut(
        id=r.id,
        produit_id=r.produit_id,
        produit_nom=r.produit.nom,
        produit_reference=r.produit.reference,
        produit_unite=r.produit.unite,
        produit_stock=float(r.produit.stock),
        produit_prix=float(r.produit.prix),
        quantite_produite=float(r.quantite_produite),
        notes=r.notes,
        lignes=[
            LigneRecetteOut(
                id=l.id,
                produit_id=l.produit_id,
                produit_nom=l.produit.nom,
                produit_unite=l.produit.unite,
                produit_stock=float(l.produit.stock),
                quantite=float(l.quantite),
            )
            for l in r.lignes
        ],
    )


def _load(recette_id: int, db: Session) -> Recette:
    r = (
        db.query(Recette)
        .options(joinedload(Recette.produit), joinedload(Recette.lignes).joinedload(LigneRecette.produit))
        .filter(Recette.id == recette_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return r


@router.get("", response_model=List[RecetteOut])
def get_recettes(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    recettes = (
        db.query(Recette)
        .options(joinedload(Recette.produit), joinedload(Recette.lignes).joinedload(LigneRecette.produit))
        .all()
    )
    return [_build_recette_out(r) for r in recettes]


@router.get("/{recette_id}", response_model=RecetteOut)
def get_recette(recette_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return _build_recette_out(_load(recette_id, db))


@router.post("", response_model=RecetteOut, status_code=201)
def create_recette(data: RecetteCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if db.query(Produit).filter(Produit.reference == data.reference).first():
        raise HTTPException(status_code=400, detail="Cette référence produit est déjà utilisée")
    if not data.lignes:
        raise HTTPException(status_code=400, detail="La recette doit avoir au moins un ingrédient")

    # Créer le produit fini
    produit = Produit(
        nom=data.nom,
        reference=data.reference,
        prix=data.prix,
        stock=0,
        unite=data.unite,
        alerte_ignoree=False,
    )
    db.add(produit)
    db.flush()

    # Créer la recette
    recette = Recette(
        produit_id=produit.id,
        quantite_produite=data.quantite_produite,
        notes=data.notes,
    )
    db.add(recette)
    db.flush()

    # Créer les lignes
    for ligne in data.lignes:
        ingredient = db.query(Produit).filter(Produit.id == ligne.produit_id).first()
        if not ingredient:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Ingrédient {ligne.produit_id} introuvable")
        if ligne.quantite <= 0:
            db.rollback()
            raise HTTPException(status_code=400, detail="La quantité d'un ingrédient doit être positive")
        db.add(LigneRecette(
            recette_id=recette.id,
            produit_id=ligne.produit_id,
            quantite=ligne.quantite,
        ))

    db.commit()
    return _build_recette_out(_load(recette.id, db))


@router.put("/{recette_id}", response_model=RecetteOut)
def update_recette(recette_id: int, data: RecetteUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    recette = _load(recette_id, db)

    if data.quantite_produite is not None:
        recette.quantite_produite = data.quantite_produite
    if data.notes is not None:
        recette.notes = data.notes or None

    if data.lignes is not None:
        if not data.lignes:
            raise HTTPException(status_code=400, detail="La recette doit avoir au moins un ingrédient")
        db.query(LigneRecette).filter(LigneRecette.recette_id == recette_id).delete()
        for ligne in data.lignes:
            ingredient = db.query(Produit).filter(Produit.id == ligne.produit_id).first()
            if not ingredient:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Ingrédient {ligne.produit_id} introuvable")
            db.add(LigneRecette(
                recette_id=recette_id,
                produit_id=ligne.produit_id,
                quantite=ligne.quantite,
            ))

    db.commit()
    return _build_recette_out(_load(recette_id, db))


@router.delete("/{recette_id}", status_code=204)
def delete_recette(recette_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    recette = _load(recette_id, db)
    if db.query(OrdreFabrication).filter(OrdreFabrication.recette_id == recette_id).first():
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer : cette recette a un historique de fabrication. Annulez d'abord les ordres de fabrication associés.",
        )
    db.delete(recette)
    db.commit()

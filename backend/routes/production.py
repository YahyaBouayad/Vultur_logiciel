from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models.produit import Produit
from models.recette import Recette, LigneRecette
from models.ordre_fabrication import OrdreFabrication
from models.stock_mouvement import StockMouvement
from models.utilisateur import Utilisateur
from schemas.production import OrdreFabricationCreate, OrdreFabricationOut
from security import get_current_user
import datetime

router = APIRouter(prefix="/production", tags=["Production"])


def _build_out(o: OrdreFabrication) -> OrdreFabricationOut:
    return OrdreFabricationOut(
        id=o.id,
        recette_id=o.recette_id,
        produit_id=o.produit_id,
        produit_nom=o.produit.nom,
        produit_unite=o.produit.unite,
        nombre_batches=float(o.nombre_batches),
        quantite_produite=float(o.quantite_produite),
        quantite_reelle=float(o.quantite_reelle),
        perte=float(o.perte),
        cout_production=float(o.cout_production),
        cout_unitaire=float(o.cout_unitaire),
        date=o.date,
        notes=o.notes,
    )


@router.get("", response_model=List[OrdreFabricationOut])
def get_ordres(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    ordres = (
        db.query(OrdreFabrication)
        .options(joinedload(OrdreFabrication.produit))
        .order_by(OrdreFabrication.date.desc(), OrdreFabrication.id.desc())
        .all()
    )
    return [_build_out(o) for o in ordres]


@router.post("", response_model=OrdreFabricationOut, status_code=201)
def lancer_fabrication(
    data: OrdreFabricationCreate,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    recette = (
        db.query(Recette)
        .options(joinedload(Recette.lignes), joinedload(Recette.produit))
        .filter(Recette.id == data.recette_id)
        .first()
    )
    if not recette:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    if data.nombre_batches <= 0:
        raise HTTPException(status_code=400, detail="Le nombre de batches doit être positif")

    # Phase 1 : vérifier et verrouiller les stocks ingrédients
    ingredients_map: dict[int, tuple[Produit, float]] = {}
    for ligne in recette.lignes:
        ingredient = (
            db.query(Produit)
            .filter(Produit.id == ligne.produit_id)
            .with_for_update()
            .first()
        )
        if not ingredient:
            raise HTTPException(status_code=404, detail=f"Ingrédient introuvable (id={ligne.produit_id})")
        needed = float(ligne.quantite) * data.nombre_batches
        if float(ingredient.stock) < needed - 0.001:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stock insuffisant pour '{ingredient.nom}' "
                    f"(disponible : {float(ingredient.stock):.3g} {ingredient.unite}, "
                    f"requis : {needed:.3g} {ingredient.unite})"
                ),
            )
        ingredients_map[ligne.produit_id] = (ingredient, needed)

    quantite_theorique = float(recette.quantite_produite) * data.nombre_batches
    quantite_reelle = round(
        data.quantite_reelle if data.quantite_reelle is not None else quantite_theorique,
        3,
    )

    if quantite_reelle < 0:
        raise HTTPException(status_code=400, detail="La quantité réelle ne peut pas être négative")
    if quantite_reelle > quantite_theorique + 0.001:
        raise HTTPException(status_code=400, detail="La quantité réelle ne peut pas dépasser la quantité théorique")

    perte = round(quantite_theorique - quantite_reelle, 3)

    # Coût de revient basé sur les prix d'achat des ingrédients
    cout_production = round(sum(
        float(ingredient.prix) * needed
        for _, (ingredient, needed) in ingredients_map.items()
    ), 2)
    cout_unitaire = round(cout_production / quantite_reelle, 4) if quantite_reelle > 0 else 0.0

    # Créer l'ordre
    ordre = OrdreFabrication(
        recette_id=recette.id,
        produit_id=recette.produit_id,
        nombre_batches=data.nombre_batches,
        quantite_produite=quantite_theorique,
        quantite_reelle=quantite_reelle,
        perte=perte,
        cout_production=cout_production,
        cout_unitaire=cout_unitaire,
        date=data.date or datetime.date.today(),
        notes=data.notes,
    )
    db.add(ordre)
    db.flush()

    # Phase 2 : consommer les ingrédients
    for produit_id, (ingredient, needed) in ingredients_map.items():
        ingredient.stock = float(ingredient.stock) - needed
        db.add(StockMouvement(
            produit_id=ingredient.id,
            type="sortie",
            quantite=needed,
            ordre_fabrication_id=ordre.id,
            notes=f"Fabrication — {recette.produit.nom}",
        ))

    # Phase 3 : incrémenter le produit fini (quantité réelle uniquement)
    produit_fini = (
        db.query(Produit)
        .filter(Produit.id == recette.produit_id)
        .with_for_update()
        .first()
    )
    produit_fini.stock = float(produit_fini.stock) + quantite_reelle
    db.add(StockMouvement(
        produit_id=produit_fini.id,
        type="entrée",
        quantite=quantite_reelle,
        ordre_fabrication_id=ordre.id,
        notes=f"Production — {data.nombre_batches:g} batch(es)",
    ))

    db.commit()
    db.refresh(ordre)
    # Re-charger avec joinedload pour _build_out
    ordre = db.query(OrdreFabrication).options(joinedload(OrdreFabrication.produit)).filter(OrdreFabrication.id == ordre.id).first()
    return _build_out(ordre)


@router.delete("/{ordre_id}", status_code=204)
def annuler_fabrication(
    ordre_id: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    ordre = (
        db.query(OrdreFabrication)
        .filter(OrdreFabrication.id == ordre_id)
        .first()
    )
    if not ordre:
        raise HTTPException(status_code=404, detail="Ordre de fabrication introuvable")

    mouvements = (
        db.query(StockMouvement)
        .filter(StockMouvement.ordre_fabrication_id == ordre_id)
        .all()
    )

    # Verrou + vérification + inversion en une seule passe (évite le TOCTOU)
    for m in mouvements:
        produit = (
            db.query(Produit)
            .filter(Produit.id == m.produit_id)
            .with_for_update()
            .first()
        )
        if not produit:
            continue
        if m.type == "entrée":
            if float(produit.stock) < float(m.quantite) - 0.001:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Impossible d'annuler : le stock de '{produit.nom}' "
                        f"({float(produit.stock):.3g} {produit.unite}) est insuffisant "
                        f"pour rembourser les {float(m.quantite):.3g} {produit.unite} produits."
                    ),
                )
            produit.stock = float(produit.stock) - float(m.quantite)
            db.add(StockMouvement(
                produit_id=produit.id,
                type="sortie",
                quantite=float(m.quantite),
                notes=f"Annulation fabrication #{ordre_id}",
            ))
        elif m.type == "sortie":
            produit.stock = float(produit.stock) + float(m.quantite)
            db.add(StockMouvement(
                produit_id=produit.id,
                type="entrée",
                quantite=float(m.quantite),
                notes=f"Annulation fabrication #{ordre_id}",
            ))

    # Supprimer les mouvements liés puis l'ordre
    db.query(StockMouvement).filter(StockMouvement.ordre_fabrication_id == ordre_id).delete()
    db.delete(ordre)
    db.commit()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
import datetime
from database import get_db
from models.demande_achat import DemandeAchat, LigneDemandeAchat
from models.bon_commande import BonCommande, LigneBonCommande
from models.produit import Produit
from models.fournisseur import Fournisseur
from models.parametre import Parametre
from models.utilisateur import Utilisateur
from schemas.demande_achat import (
    DemandeAchatCreate, DemandeAchatUpdate, DemandeAchatValider, DemandeAchatOut
)
from security import get_current_user

router = APIRouter(prefix="/demandes-achat", tags=["Demandes d'achat"])

STATUTS_EDITABLES = {"brouillon", "envoyée"}


def _generer_numero(db: Session) -> str:
    annee_2 = str(datetime.date.today().year)[-2:]
    p = db.query(Parametre).filter(Parametre.id == 1).with_for_update().first()
    if not p:
        p = Parametre(id=1)
        db.add(p)
        db.flush()
    prefixe = (p.prefixe_demande or 'DA').strip()
    numero = p.compteur_demande or 1
    p.compteur_demande = numero + 1
    db.flush()
    return f"{prefixe}-{numero:03d}/{annee_2}"


def _load(demande_id: int, db: Session) -> DemandeAchat:
    d = (
        db.query(DemandeAchat)
        .options(
            joinedload(DemandeAchat.fournisseur),
            joinedload(DemandeAchat.lignes).joinedload(LigneDemandeAchat.produit),
        )
        .filter(DemandeAchat.id == demande_id)
        .first()
    )
    if not d:
        raise HTTPException(status_code=404, detail="Demande d'achat introuvable")
    return d


def _build_out(d: DemandeAchat) -> DemandeAchatOut:
    return DemandeAchatOut(
        id=d.id,
        numero=d.numero,
        fournisseur_id=d.fournisseur_id,
        fournisseur_nom=d.fournisseur.nom,
        fournisseur_email=d.fournisseur.mail,
        fournisseur_adresse=d.fournisseur.adresse,
        fournisseur_ice=d.fournisseur.ice,
        statut=d.statut,
        date=d.date,
        notes=d.notes,
        tva_estimee=d.tva_estimee,
        bon_commande_id=d.bon_commande_id,
        lignes=[
            {
                "id": l.id,
                "produit_id": l.produit_id,
                "produit_nom": l.produit.nom,
                "produit_reference": l.produit.reference,
                "produit_unite": l.produit.unite,
                "quantite_demandee": float(l.quantite_demandee),
                "quantite_confirmee": float(l.quantite_confirmee) if l.quantite_confirmee is not None else None,
                "prix_unitaire": float(l.prix_unitaire),
            }
            for l in d.lignes
        ],
    )


def _get_duree(db: Session) -> int:
    p = db.query(Parametre).filter(Parametre.id == 1).first()
    return int(p.duree_archivage_demandes) if p and p.duree_archivage_demandes else 90


@router.get("", response_model=List[DemandeAchatOut])
def get_demandes(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    duree = _get_duree(db)
    cutoff = datetime.date.today() - datetime.timedelta(days=duree)
    demandes = (
        db.query(DemandeAchat)
        .options(
            joinedload(DemandeAchat.fournisseur),
            joinedload(DemandeAchat.lignes).joinedload(LigneDemandeAchat.produit),
        )
        .filter(
            # Toujours afficher les validées
            # Pour les non-validées : seulement dans la fenêtre d'archivage
            (DemandeAchat.statut == "validée") |
            (DemandeAchat.date >= cutoff)
        )
        .order_by(DemandeAchat.date.desc(), DemandeAchat.id.desc())
        .all()
    )
    return [_build_out(d) for d in demandes]


@router.post("", response_model=DemandeAchatOut, status_code=201)
def create_demande(
    data: DemandeAchatCreate,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    if not data.lignes:
        raise HTTPException(status_code=400, detail="La demande doit contenir au moins un article")
    fourn = db.query(Fournisseur).filter(Fournisseur.id == data.fournisseur_id).first()
    if not fourn:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")

    for ligne in data.lignes:
        if ligne.quantite_demandee <= 0:
            raise HTTPException(status_code=400, detail="La quantité doit être positive")
        if ligne.prix_unitaire < 0:
            raise HTTPException(status_code=400, detail="Le prix unitaire ne peut pas être négatif")
        if not db.query(Produit).filter(Produit.id == ligne.produit_id).first():
            raise HTTPException(status_code=404, detail=f"Produit {ligne.produit_id} introuvable")

    numero = _generer_numero(db)
    demande = DemandeAchat(
        numero=numero,
        fournisseur_id=data.fournisseur_id,
        statut="brouillon",
        date=data.date or datetime.date.today(),
        notes=data.notes,
        tva_estimee=data.tva_estimee,
    )
    db.add(demande)
    db.flush()

    for ligne in data.lignes:
        db.add(LigneDemandeAchat(
            demande_id=demande.id,
            produit_id=ligne.produit_id,
            quantite_demandee=ligne.quantite_demandee,
            prix_unitaire=ligne.prix_unitaire,
        ))

    db.commit()
    return _build_out(_load(demande.id, db))


@router.put("/{demande_id}", response_model=DemandeAchatOut)
def update_demande(
    demande_id: int,
    data: DemandeAchatUpdate,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    demande = _load(demande_id, db)
    if demande.statut not in STATUTS_EDITABLES:
        raise HTTPException(status_code=400, detail="Seules les demandes brouillon ou envoyées peuvent être modifiées")

    if data.notes is not None:
        demande.notes = data.notes or None
    if data.tva_estimee is not None:
        demande.tva_estimee = data.tva_estimee

    if data.lignes is not None:
        if not data.lignes:
            raise HTTPException(status_code=400, detail="La demande doit contenir au moins un article")
        db.query(LigneDemandeAchat).filter(LigneDemandeAchat.demande_id == demande_id).delete()
        for ligne in data.lignes:
            if not db.query(Produit).filter(Produit.id == ligne.produit_id).first():
                raise HTTPException(status_code=404, detail=f"Produit {ligne.produit_id} introuvable")
            db.add(LigneDemandeAchat(
                demande_id=demande_id,
                produit_id=ligne.produit_id,
                quantite_demandee=ligne.quantite_demandee,
                prix_unitaire=ligne.prix_unitaire,
            ))

    db.commit()
    return _build_out(_load(demande_id, db))


@router.post("/{demande_id}/envoyer", response_model=DemandeAchatOut)
def envoyer_demande(
    demande_id: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    demande = _load(demande_id, db)
    if demande.statut != "brouillon":
        raise HTTPException(status_code=400, detail="Seules les demandes brouillon peuvent être marquées envoyées")
    demande.statut = "envoyée"
    db.commit()
    return _build_out(_load(demande_id, db))


@router.post("/{demande_id}/valider", response_model=DemandeAchatOut)
def valider_demande(
    demande_id: int,
    data: DemandeAchatValider,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    demande = _load(demande_id, db)
    if demande.statut not in {"brouillon", "envoyée"}:
        raise HTTPException(status_code=400, detail="Cette demande ne peut plus être validée")

    # Construire les lignes BC : utilise les lignes de validation si fournies, sinon les lignes de la demande
    if data.lignes:
        lignes_bc = data.lignes
        # Vérifier que tous les produit_id correspondent à des lignes de la demande
        produit_ids_demande = {l.produit_id for l in demande.lignes}
        for l in lignes_bc:
            if l.produit_id not in produit_ids_demande:
                raise HTTPException(status_code=400, detail=f"Produit {l.produit_id} absent de la demande")
            if l.quantite_confirmee <= 0:
                raise HTTPException(status_code=400, detail="La quantité confirmée doit être positive")
    else:
        lignes_bc = [
            type('L', (), {
                'produit_id': l.produit_id,
                'quantite_confirmee': float(l.quantite_demandee),
                'prix_unitaire': float(l.prix_unitaire),
            })()
            for l in demande.lignes
        ]

    # Créer le Bon de Commande
    bc = BonCommande(
        fournisseur_id=demande.fournisseur_id,
        date=data.date_bc or datetime.date.today(),
        statut="brouillon",
        notes=data.notes_bc or demande.notes,
        tva_incluse=data.tva_incluse,
    )
    db.add(bc)
    db.flush()

    for l in lignes_bc:
        db.add(LigneBonCommande(
            bon_commande_id=bc.id,
            produit_id=l.produit_id,
            quantite=round(l.quantite_confirmee),
            prix_unitaire=l.prix_unitaire,
            remise=0,
        ))

    # Mettre à jour les quantités confirmées dans les lignes de la demande
    if data.lignes:
        qte_map = {l.produit_id: l.quantite_confirmee for l in data.lignes}
        for ligne in demande.lignes:
            if ligne.produit_id in qte_map:
                ligne.quantite_confirmee = qte_map[ligne.produit_id]

    demande.statut = "validée"
    demande.bon_commande_id = bc.id
    db.commit()
    return _build_out(_load(demande_id, db))


@router.post("/{demande_id}/annuler", response_model=DemandeAchatOut)
def annuler_demande(
    demande_id: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    demande = _load(demande_id, db)
    if demande.statut == "validée":
        raise HTTPException(status_code=400, detail="Une demande validée ne peut pas être annulée. Le bon de commande a déjà été créé.")
    if demande.statut == "annulée":
        raise HTTPException(status_code=400, detail="Cette demande est déjà annulée")
    demande.statut = "annulée"
    db.commit()
    return _build_out(_load(demande_id, db))


@router.delete("/{demande_id}", status_code=204)
def delete_demande(
    demande_id: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    demande = _load(demande_id, db)
    if demande.statut == "validée":
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer une demande validée. Un bon de commande y est rattaché.",
        )
    db.delete(demande)
    db.commit()

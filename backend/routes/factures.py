from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import datetime
from database import get_db
from models.facture import Facture
from models.bon_livraison import BonLivraison
from models.paiement import Paiement
from models.produit import Produit
from models.stock_mouvement import StockMouvement
from models.utilisateur import Utilisateur
from models.parametre import Parametre
from schemas.facture import FactureOut, FactureCreate, FactureUpdate, FacturePage, StatutFactureUpdate, ImpayeOut
from security import get_current_user

router = APIRouter(prefix="/factures", tags=["Factures"])

STATUTS = ["émise", "payée", "annulée"]
DELAI_DEFAUT = 30  # jours


def _get_parametre(db: Session) -> Parametre:
    p = db.query(Parametre).filter(Parametre.id == 1).first()
    return p or Parametre(id=1, compteur_facture=1)


def _taux_tva(db: Session) -> float:
    p = db.query(Parametre).filter(Parametre.id == 1).first()
    return float(p.tva or 0) if p else 0.0


def generer_numero(db: Session) -> str:
    annee_2 = str(datetime.date.today().year)[-2:]
    p = db.query(Parametre).filter(Parametre.id == 1).with_for_update().first()
    if not p:
        p = Parametre(id=1, compteur_facture=1)
        db.add(p)
        db.flush()
    prefixe = (p.prefixe_facture or 'FAC').strip()
    numero = p.compteur_facture
    p.compteur_facture = numero + 1
    db.flush()
    return f"{prefixe}-{numero}/{annee_2}"


def calcul_niveau(jours: int) -> str:
    if jours <= 0:   return "normal"
    if jours <= 15:  return "attention"
    if jours <= 30:  return "retard"
    return "critique"


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


def _build_out(f, taux_tva: float = 0.0) -> FactureOut:
    out = FactureOut.model_validate(f)
    out.montant_ht = _montant_ht(f, taux_tva)
    return out


@router.get("/impayes", response_model=List[ImpayeOut])
def get_impayes(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    aujourd_hui = datetime.date.today()
    param = _get_parametre(db)
    delai = int(param.delai_paiement or DELAI_DEFAUT)
    tva   = float(param.tva or 0)
    factures = (
        db.query(Facture)
        .options(joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes))
        .filter(Facture.statut == "émise")
        .all()
    )
    result = []
    for f in factures:
        echeance = f.date_echeance or (f.date_emission + datetime.timedelta(days=delai))
        jours = (aujourd_hui - echeance).days
        result.append(ImpayeOut(
            id=f.id,
            numero=f.numero,
            client_id=f.client_id,
            date_emission=f.date_emission,
            date_echeance=echeance,
            jours_retard=jours,
            niveau=calcul_niveau(jours),
            montant_ht=_montant_ht(f, tva),
        ))
    return sorted(result, key=lambda x: x.jours_retard, reverse=True)


@router.get("", response_model=FacturePage)
def get_factures(
    skip: int = 0,
    limit: int = 50,
    statut: Optional[str] = None,
    client_id: Optional[int] = None,
    q: Optional[str] = None,
    date_debut: Optional[datetime.date] = None,
    date_fin: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
):
    filters = []
    if statut:      filters.append(Facture.statut == statut)
    if client_id:   filters.append(Facture.client_id == client_id)
    if q:           filters.append(Facture.numero.ilike(f"%{q}%"))
    if date_debut:  filters.append(Facture.date_emission >= date_debut)
    if date_fin:    filters.append(Facture.date_emission <= date_fin)

    total = db.query(func.count(Facture.id)).filter(*filters).scalar()

    items = (
        db.query(Facture)
        .options(joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes))
        .filter(*filters)
        .order_by(Facture.date_emission.desc(), Facture.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    tva = _taux_tva(db)
    return {"items": [_build_out(f, tva) for f in items], "total": total}


@router.get("/{facture_id}", response_model=FactureOut)
def get_facture(facture_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    f = (
        db.query(Facture)
        .options(joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes))
        .filter(Facture.id == facture_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return _build_out(f, _taux_tva(db))


@router.post("", response_model=FactureOut, status_code=201)
def create_facture(data: FactureCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    bl = db.query(BonLivraison).filter(BonLivraison.id == data.bon_livraison_id).first()
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    if bl.statut != "livré":
        raise HTTPException(status_code=400, detail="Seul un bon de livraison 'livré' peut être facturé")

    existante = db.query(Facture).filter(
        Facture.bon_livraison_id == data.bon_livraison_id,
        Facture.statut != "annulée",
    ).first()
    if existante:
        raise HTTPException(status_code=400, detail=f"Ce BL est déjà facturé ({existante.numero})")

    param = _get_parametre(db)
    delai = int(param.delai_paiement or DELAI_DEFAUT)
    echeance = data.date_echeance or (datetime.date.today() + datetime.timedelta(days=delai))

    facture = Facture(
        numero=generer_numero(db),
        bon_livraison_id=bl.id,
        client_id=bl.client_id,
        date_echeance=echeance,
        notes=data.notes,
        tva_incluse=data.tva_incluse,
    )
    db.add(facture)
    db.flush()

    if bl.encaisse:
        montant = sum(
            float(l.prix_unitaire) * l.quantite * (1 - float(l.remise or 0) / 100)
            for l in bl.lignes
        )
        db.add(Paiement(
            facture_id=facture.id,
            date=bl.date_encaissement,
            montant=montant,
            mode=bl.mode_encaissement,
            notes="Converti depuis règlement par arrangement",
        ))
        facture.statut = "payée"
        bl.encaisse = False
        bl.mode_encaissement = None
        bl.date_encaissement = None

    db.commit()
    db.refresh(facture)
    return _build_out(facture, _taux_tva(db))


@router.put("/{facture_id}", response_model=FactureOut)
def update_facture(facture_id: int, data: FactureUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    f = (
        db.query(Facture)
        .options(joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes))
        .filter(Facture.id == facture_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if f.statut in ("annulée", "payée"):
        raise HTTPException(status_code=400, detail=f"Une facture '{f.statut}' ne peut pas être modifiée")
    if data.date_emission is not None:
        f.date_emission = data.date_emission
    if data.date_echeance is not None:
        f.date_echeance = data.date_echeance
    if data.notes is not None:
        f.notes = data.notes or None
    if data.tva_incluse is not None:
        f.tva_incluse = data.tva_incluse
    db.commit()
    db.refresh(f)
    return _build_out(f, _taux_tva(db))


@router.put("/{facture_id}/statut", response_model=FactureOut)
def update_statut(facture_id: int, data: StatutFactureUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    f = (
        db.query(Facture)
        .options(joinedload(Facture.bon_livraison).joinedload(BonLivraison.lignes))
        .filter(Facture.id == facture_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if data.statut not in STATUTS:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs : {STATUTS}")
    if f.statut == "annulée":
        raise HTTPException(status_code=400, detail="Une facture annulée ne peut pas être modifiée")

    # Retour payée → émise : autorisé seulement si aucun paiement enregistré
    if f.statut == "payée" and data.statut == "émise":
        total_paye = sum(float(p.montant) for p in f.paiements)
        if total_paye > 0:
            raise HTTPException(
                status_code=400,
                detail="Des paiements sont enregistrés sur cette facture. Supprimez-les d'abord pour la remettre en émise.",
            )

    if data.statut == "annulée":
        total_paye = sum(float(p.montant) for p in f.paiements)
        if total_paye > 0:
            raise HTTPException(
                status_code=400,
                detail="Impossible d'annuler une facture avec des paiements enregistrés. Supprimez les paiements d'abord.",
            )
        bl = f.bon_livraison
        if bl and bl.statut == "livré":
            for ligne in bl.lignes:
                produit = db.query(Produit).filter(Produit.id == ligne.produit_id).first()
                if produit:
                    produit.stock += ligne.quantite
                    db.add(StockMouvement(
                        produit_id=ligne.produit_id,
                        type="entrée",
                        quantite=ligne.quantite,
                        bon_livraison_id=bl.id,
                    ))
            bl.statut = "validé"

    f.statut = data.statut
    db.commit()
    db.refresh(f)
    return _build_out(f, _taux_tva(db))


@router.delete("/{facture_id}", status_code=204)
def delete_facture(facture_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if f.statut != "annulée":
        raise HTTPException(status_code=400, detail="Seule une facture annulée peut être supprimée")
    db.delete(f)
    db.commit()

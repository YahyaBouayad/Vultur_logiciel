from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
import datetime
from database import get_db
from models.client import Client
from models.produit import Produit
from models.hulio import TraitementHulio, LivraisonHulio, FactureHulio
from models.facture import Facture
from models.parametre import Parametre
from models.stock_mouvement import StockMouvement
from models.utilisateur import Utilisateur
from schemas.facture import FactureHulioOut
from schemas.hulio import (
    TraitementHulioCreate, TraitementHulioUpdate, TraitementHulioOut,
    LivraisonHulioCreate, LivraisonHulioUpdate, LivraisonHulioOut, LivrerHulio,
    FactureHulioCreate, FactureHulioUpdate, FactureHulioResume,
)
from security import get_current_user
from utils.calculs import montant_ttc_hulio

router = APIRouter(prefix="/hulio", tags=["Suivi Hulio"])

STATUTS_TRAITEMENT = {"en_cours", "termine", "arrete"}
DELAI_DEFAUT = 30  # jours


def _facture_resume(h: FactureHulio) -> FactureHulioResume:
    f = h.facture
    return FactureHulioResume(
        id=f.id,
        numero=f.numero,
        statut=f.statut,
        client_id=f.client_id,
        date_emission=f.date_emission,
        date_echeance=f.date_echeance,
        notes=f.notes,
        montant_ttc=round(montant_ttc_hulio(h), 2),
        hulio=FactureHulioOut.model_validate(h),
    )


def _build_out(t: TraitementHulio) -> TraitementHulioOut:
    actives = [l for l in t.livraisons if l.statut != "annulée"]
    return TraitementHulioOut(
        id=t.id,
        client_id=t.client_id,
        client_nom=t.client.nom,
        client_telephone=t.client.telephone,
        produit_id=t.produit_id,
        produit_nom=t.produit.nom,
        pathologie=t.pathologie,
        nature_remboursement=t.nature_remboursement,
        centre_mutuelle=t.centre_mutuelle,
        date_debut=t.date_debut,
        duree_mois=t.duree_mois,
        date_fin=t.date_fin,
        nombre_boites=t.nombre_boites,
        statut=t.statut,
        notes=t.notes,
        boites_livrees=sum(l.nombre_boites for l in actives if l.statut == "livrée"),
        boites_planifiees=sum(l.nombre_boites for l in actives),
        livraisons=[LivraisonHulioOut.model_validate(l) for l in t.livraisons],
        boites_facturees=sum(h.quantite for h in t.factures if h.facture.statut != "annulée"),
        factures=[_facture_resume(h) for h in t.factures],
    )


def _query(db: Session):
    return db.query(TraitementHulio).options(
        joinedload(TraitementHulio.client),
        joinedload(TraitementHulio.produit),
        joinedload(TraitementHulio.livraisons),
        joinedload(TraitementHulio.factures).joinedload(FactureHulio.facture),
    )


def _organisme(nature_remboursement):
    """Case à cocher du formulaire ANAM déduite de la nature de remboursement du traitement."""
    n = (nature_remboursement or "").upper()
    if "CNOPS" in n: return "CNOPS"
    if "CNSS" in n:  return "CNSS"
    return nature_remboursement or None


def _generer_numero_hulio(db: Session) -> str:
    annee_2 = str(datetime.date.today().year)[-2:]
    p = db.query(Parametre).filter(Parametre.id == 1).with_for_update().first()
    if not p:
        p = Parametre(id=1, compteur_facture=1)
        db.add(p)
        db.flush()
    prefixe = (p.prefixe_facture_hulio or "HUL").strip()
    numero = p.compteur_facture_hulio or 1
    p.compteur_facture_hulio = numero + 1
    db.flush()
    return f"{prefixe}-{numero:03d}/{annee_2}"


def _creer_facture(db: Session, t: TraitementHulio, quantite: int, date_emission=None,
                   taux_prise_en_charge=None, notes=None) -> Facture:
    """Crée une facture Hulio (circuit facture normal : paiements, avoirs, relances, comptabilité)
    avec un instantané des infos patient / produit, à compléter avant impression."""
    if quantite <= 0:
        raise HTTPException(status_code=400, detail="La quantité facturée doit être positive")
    if taux_prise_en_charge is not None and not 0 <= taux_prise_en_charge <= 100:
        raise HTTPException(status_code=400, detail="Le taux de prise en charge doit être entre 0 et 100 %")
    param = db.query(Parametre).filter(Parametre.id == 1).first()
    delai = int(param.delai_paiement or DELAI_DEFAUT) if param else DELAI_DEFAUT
    emission = date_emission or datetime.date.today()
    client, produit = t.client, t.produit

    facture = Facture(
        numero=_generer_numero_hulio(db),
        bon_livraison_id=None,
        type_facture="hulio",
        client_id=t.client_id,
        date_emission=emission,
        date_echeance=emission + datetime.timedelta(days=delai),
        notes=notes,
        tva_incluse=False,
    )
    db.add(facture)
    db.flush()
    db.add(FactureHulio(
        facture_id=facture.id,
        traitement_id=t.id,
        produit_id=produit.id,
        designation=produit.nom,
        quantite=quantite,
        ppm=produit.prix,
        pbr=produit.pbr,
        taux_prise_en_charge=taux_prise_en_charge,
        taux_tva=float(param.tva_hulio or 0) if param else 0,
        numero_prise_en_charge=client.numero_prise_en_charge,
        assure_nom=client.nom_assure or client.nom,
        beneficiaire_nom=client.nom,
        immatriculation=client.immatriculation,
        organisme=_organisme(t.nature_remboursement),
    ))
    return facture


def _load(traitement_id: int, db: Session) -> TraitementHulio:
    t = _query(db).filter(TraitementHulio.id == traitement_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Traitement introuvable")
    return t


def _load_livraison(livraison_id: int, db: Session) -> LivraisonHulio:
    l = db.query(LivraisonHulio).filter(LivraisonHulio.id == livraison_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Livraison introuvable")
    return l


def _check_produit_hulio(produit_id: int, db: Session):
    produit = db.query(Produit).filter(Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    if not produit.suivi_hulio:
        raise HTTPException(status_code=400, detail=f"'{produit.nom}' n'est pas dans la liste des produits suivis Hulio")


def _check_livraison(data):
    if data.nombre_boites is not None and data.nombre_boites <= 0:
        raise HTTPException(status_code=400, detail="Le nombre de boîtes doit être positif")


# ── Traitements ──────────────────────────────────────────────────────────────

@router.get("/traitements", response_model=List[TraitementHulioOut])
def get_traitements(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    traitements = _query(db).order_by(TraitementHulio.date_debut.desc(), TraitementHulio.id.desc()).all()
    return [_build_out(t) for t in traitements]


@router.get("/traitements/{traitement_id}", response_model=TraitementHulioOut)
def get_traitement(traitement_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return _build_out(_load(traitement_id, db))


@router.post("/traitements", response_model=TraitementHulioOut, status_code=201)
def create_traitement(data: TraitementHulioCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    if client.type_client != "hulio":
        raise HTTPException(status_code=400, detail="Le client doit être de type Hulio")
    _check_produit_hulio(data.produit_id, db)
    if data.nombre_boites <= 0:
        raise HTTPException(status_code=400, detail="Le nombre de boîtes doit être positif")
    if data.date_fin and data.date_fin < data.date_debut:
        raise HTTPException(status_code=400, detail="La date de fin doit être après la date de début")
    for l in data.livraisons:
        _check_livraison(l)

    traitement = TraitementHulio(
        **data.model_dump(exclude={"livraisons", "facture_quantite", "facture_taux_prise_en_charge"}),
        statut="en_cours",
    )
    db.add(traitement)
    db.flush()
    for l in data.livraisons:
        db.add(LivraisonHulio(traitement_id=traitement.id, statut="prévue", **l.model_dump()))
    if data.facture_quantite:
        _creer_facture(db, traitement, data.facture_quantite,
                       taux_prise_en_charge=data.facture_taux_prise_en_charge)

    db.commit()
    return _build_out(_load(traitement.id, db))


@router.put("/traitements/{traitement_id}", response_model=TraitementHulioOut)
def update_traitement(traitement_id: int, data: TraitementHulioUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    t = _load(traitement_id, db)
    if data.statut is not None and data.statut not in STATUTS_TRAITEMENT:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs : {sorted(STATUTS_TRAITEMENT)}")
    if data.nombre_boites is not None and data.nombre_boites <= 0:
        raise HTTPException(status_code=400, detail="Le nombre de boîtes doit être positif")
    if data.produit_id is not None and data.produit_id != t.produit_id:
        if any(l.statut == "livrée" for l in t.livraisons):
            raise HTTPException(status_code=400, detail="Impossible de changer le produit : des livraisons ont déjà été effectuées")
        _check_produit_hulio(data.produit_id, db)

    # Les champs envoyés à null sont vidés (ex : date de fin retirée)
    for champ, valeur in data.model_dump(exclude_unset=True).items():
        if champ in {"produit_id", "date_debut", "nombre_boites", "statut"} and valeur is None:
            continue
        setattr(t, champ, valeur)
    if t.date_fin and t.date_fin < t.date_debut:
        raise HTTPException(status_code=400, detail="La date de fin doit être après la date de début")

    db.commit()
    return _build_out(_load(traitement_id, db))


@router.delete("/traitements/{traitement_id}", status_code=204)
def delete_traitement(traitement_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    t = _load(traitement_id, db)
    if any(l.statut == "livrée" for l in t.livraisons):
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer : des livraisons ont déjà été effectuées. Annulez-les d'abord ou marquez le traitement comme arrêté.",
        )
    if t.factures:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer : ce traitement a des factures. Annulez-les puis supprimez-les depuis la page Factures, ou marquez le traitement comme arrêté.",
        )
    db.delete(t)
    db.commit()


# ── Livraisons ───────────────────────────────────────────────────────────────

@router.post("/traitements/{traitement_id}/livraisons", response_model=TraitementHulioOut, status_code=201)
def add_livraisons(traitement_id: int, data: List[LivraisonHulioCreate], db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    t = _load(traitement_id, db)
    if not data:
        raise HTTPException(status_code=400, detail="Aucune livraison à ajouter")
    for l in data:
        _check_livraison(l)
        db.add(LivraisonHulio(traitement_id=t.id, statut="prévue", **l.model_dump()))
    db.commit()
    db.expire_all()
    return _build_out(_load(traitement_id, db))


@router.put("/livraisons/{livraison_id}", response_model=LivraisonHulioOut)
def update_livraison(livraison_id: int, data: LivraisonHulioUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    l = _load_livraison(livraison_id, db)
    if l.statut == "livrée" and data.nombre_boites is not None and data.nombre_boites != l.nombre_boites:
        raise HTTPException(status_code=400, detail="Annulez d'abord la livraison pour modifier le nombre de boîtes")
    _check_livraison(data)
    for champ, valeur in data.model_dump(exclude_unset=True).items():
        if champ in {"date_prevue", "nombre_boites"} and valeur is None:
            continue
        setattr(l, champ, valeur)
    db.commit()
    db.refresh(l)
    return l


@router.delete("/livraisons/{livraison_id}", status_code=204)
def delete_livraison(livraison_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    l = _load_livraison(livraison_id, db)
    if l.statut == "livrée":
        raise HTTPException(status_code=400, detail="Une livraison effectuée ne peut pas être supprimée. Annulez-la d'abord.")
    db.delete(l)
    db.commit()


@router.post("/livraisons/{livraison_id}/livrer", response_model=LivraisonHulioOut)
def livrer(livraison_id: int, data: LivrerHulio, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    l = _load_livraison(livraison_id, db)
    if l.statut != "prévue":
        raise HTTPException(status_code=400, detail="Seule une livraison prévue peut être marquée livrée")
    t = l.traitement

    produit = db.query(Produit).filter(Produit.id == t.produit_id).with_for_update().first()
    if float(produit.stock) < l.nombre_boites:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuffisant pour '{produit.nom}' (disponible : {float(produit.stock):g}, requis : {l.nombre_boites})",
        )
    produit.stock = float(produit.stock) - l.nombre_boites
    db.add(StockMouvement(
        produit_id=produit.id,
        type="sortie",
        quantite=l.nombre_boites,
        livraison_hulio_id=l.id,
        notes=f"Livraison Hulio — {t.client.nom}",
    ))

    l.statut = "livrée"
    l.date_livraison = data.date_livraison or datetime.date.today()
    db.commit()
    db.refresh(l)
    return l


@router.post("/livraisons/{livraison_id}/annuler-livraison", response_model=LivraisonHulioOut)
def annuler_livraison(livraison_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    """Revient sur une livraison marquée livrée par erreur : remet le stock et repasse en prévue."""
    l = _load_livraison(livraison_id, db)
    if l.statut != "livrée":
        raise HTTPException(status_code=400, detail="Cette livraison n'est pas marquée livrée")
    t = l.traitement

    produit = db.query(Produit).filter(Produit.id == t.produit_id).with_for_update().first()
    produit.stock = float(produit.stock) + l.nombre_boites
    db.add(StockMouvement(
        produit_id=produit.id,
        type="entrée",
        quantite=l.nombre_boites,
        livraison_hulio_id=l.id,
        notes=f"Annulation livraison Hulio — {t.client.nom}",
    ))

    l.statut = "prévue"
    l.date_livraison = None
    db.commit()
    db.refresh(l)
    return l


@router.post("/livraisons/{livraison_id}/annuler", response_model=LivraisonHulioOut)
def annuler(livraison_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    """Livraison prévue qui n'aura pas lieu (conservée dans l'historique)."""
    l = _load_livraison(livraison_id, db)
    if l.statut != "prévue":
        raise HTTPException(status_code=400, detail="Seule une livraison prévue peut être annulée")
    l.statut = "annulée"
    db.commit()
    db.refresh(l)
    return l


@router.post("/livraisons/{livraison_id}/retablir", response_model=LivraisonHulioOut)
def retablir(livraison_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    l = _load_livraison(livraison_id, db)
    if l.statut != "annulée":
        raise HTTPException(status_code=400, detail="Cette livraison n'est pas annulée")
    l.statut = "prévue"
    db.commit()
    db.refresh(l)
    return l


# ── Factures ─────────────────────────────────────────────────────────────────

@router.post("/traitements/{traitement_id}/factures", response_model=TraitementHulioOut, status_code=201)
def create_facture(traitement_id: int, data: FactureHulioCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    """Facture complémentaire (ex : complication nécessitant des boîtes supplémentaires)."""
    t = _load(traitement_id, db)
    _creer_facture(db, t, data.quantite, data.date_emission, data.taux_prise_en_charge, data.notes)
    db.commit()
    db.expire_all()
    return _build_out(_load(traitement_id, db))


@router.put("/factures/{facture_id}", response_model=FactureHulioResume)
def update_facture(facture_id: int, data: FactureHulioUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    h = db.query(FactureHulio).options(joinedload(FactureHulio.facture)).filter(FactureHulio.facture_id == facture_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Facture Hulio introuvable")
    f = h.facture
    champs = data.model_dump(exclude_unset=True)

    # Les montants ne bougent plus une fois la facture payée ou annulée ; les infos administratives restent modifiables
    def _change(champ):
        avant, apres = getattr(h, champ), champs[champ]
        if avant is None or apres is None:
            return avant is not apres
        return abs(float(avant) - float(apres)) > 0.001

    montants = {"quantite", "ppm", "pbr", "taux_prise_en_charge"}
    if f.statut != "émise" and any(_change(k) for k in montants & champs.keys()):
        raise HTTPException(status_code=400, detail=f"Les montants d'une facture {f.statut} ne peuvent plus être modifiés")
    if champs.get("quantite") is not None and champs["quantite"] <= 0:
        raise HTTPException(status_code=400, detail="La quantité doit être positive")
    if champs.get("ppm") is not None and champs["ppm"] < 0:
        raise HTTPException(status_code=400, detail="Le PPM ne peut pas être négatif")
    taux = champs.get("taux_prise_en_charge")
    if taux is not None and not 0 <= taux <= 100:
        raise HTTPException(status_code=400, detail="Le taux de prise en charge doit être entre 0 et 100 %")

    for champ, valeur in champs.items():
        if champ in {"date_emission", "notes"}:
            continue
        if champ in {"designation", "quantite", "ppm"} and valeur is None:
            continue
        setattr(h, champ, valeur)
    if champs.get("date_emission"):
        f.date_emission = champs["date_emission"]
    if "notes" in champs:
        f.notes = champs["notes"] or None

    # Le total ne peut pas descendre sous ce qui est déjà encaissé ou crédité
    if f.statut == "émise":
        deja = sum(float(p.montant) for p in f.paiements) + sum(float(a.montant_ht) for a in f.avoirs)
        if montant_ttc_hulio(h) / (1 + float(h.taux_tva or 0) / 100) < deja - 0.01:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Le nouveau total est inférieur aux paiements et avoirs déjà enregistrés ({deja:.2f})")

    db.commit()
    db.refresh(h)
    return _facture_resume(h)


@router.get("/alertes")
def get_alertes(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    """Compteurs pour le badge du menu : rappels échus et livraisons en retard (traitements en cours)."""
    today = datetime.date.today()
    base = (
        db.query(LivraisonHulio)
        .join(TraitementHulio)
        .filter(LivraisonHulio.statut == "prévue", TraitementHulio.statut == "en_cours")
    )
    retards = base.filter(LivraisonHulio.date_prevue < today).count()
    rappels = base.filter(
        LivraisonHulio.date_prevue >= today,
        LivraisonHulio.date_rappel.isnot(None),
        LivraisonHulio.date_rappel <= today,
    ).count()
    return {"retards": retards, "rappels": rappels, "total": retards + rappels}

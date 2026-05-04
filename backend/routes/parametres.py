from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.parametre import Parametre
from models.utilisateur import Utilisateur
from schemas.parametre import ParametreOut, ParametreUpdate
from security import get_current_user

router = APIRouter(prefix="/parametres", tags=["Paramètres"])


def _get_or_create(db: Session) -> Parametre:
    p = db.query(Parametre).filter(Parametre.id == 1).first()
    if not p:
        p = Parametre(id=1, compteur_facture=1)
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


@router.get("", response_model=ParametreOut)
def get_parametre(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return _get_or_create(db)


@router.put("", response_model=ParametreOut)
def update_parametre(data: ParametreUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    p = _get_or_create(db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p

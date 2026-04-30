from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.client import Client
from models.utilisateur import Utilisateur
from schemas.client import ClientCreate, ClientUpdate, ClientOut, TYPES_CLIENT
from security import get_current_user

router = APIRouter(prefix="/clients", tags=["Clients"])


def _sync_particulier(client: Client):
    client.particulier = (client.type_client == "particulier")


@router.get("", response_model=List[ClientOut])
def get_clients(db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    return db.query(Client).all()


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return client


@router.post("", response_model=ClientOut, status_code=201)
def create_client(data: ClientCreate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    if data.type_client not in TYPES_CLIENT:
        raise HTTPException(status_code=400, detail=f"Type client invalide. Valeurs : {sorted(TYPES_CLIENT)}")
    is_particulier = data.type_client == "particulier"
    if is_particulier and data.ice:
        raise HTTPException(status_code=400, detail="Un particulier ne peut pas avoir d'ICE")
    payload = data.model_dump()
    payload["particulier"] = is_particulier
    client = Client(**payload)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    if data.type_client is not None and data.type_client not in TYPES_CLIENT:
        raise HTTPException(status_code=400, detail=f"Type client invalide. Valeurs : {sorted(TYPES_CLIENT)}")
    for champ, valeur in data.model_dump(exclude_unset=True).items():
        setattr(client, champ, valeur)
    _sync_particulier(client)
    if client.particulier and client.ice:
        raise HTTPException(status_code=400, detail="Un particulier ne peut pas avoir d'ICE")
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db), _: Utilisateur = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    db.delete(client)
    db.commit()

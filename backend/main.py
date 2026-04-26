from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
import models  # noqa: enregistre tous les modèles sur Base
from routes import produits, stock, clients, fournisseurs, bons_livraison, bons_commande, factures, relances, avoirs, paiements, auth
import os

Base.metadata.create_all(bind=engine)

# Migrations inline — ajoute les colonnes manquantes sur les tables existantes
with engine.connect() as _conn:
    _conn.execute(text("ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS encaisse BOOLEAN NOT NULL DEFAULT FALSE"))
    _conn.execute(text("ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS mode_encaissement VARCHAR"))
    _conn.execute(text("ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS date_encaissement DATE"))
    _conn.commit()

app = FastAPI(title="Vultur - Gestion d'entreprise")

_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(produits.router)
app.include_router(stock.router)
app.include_router(clients.router)
app.include_router(fournisseurs.router)
app.include_router(bons_livraison.router)
app.include_router(bons_commande.router)
app.include_router(factures.router)
app.include_router(relances.router)
app.include_router(avoirs.router)
app.include_router(paiements.router)


@app.get("/")
def root():
    return {"message": "API Vultur opérationnelle"}

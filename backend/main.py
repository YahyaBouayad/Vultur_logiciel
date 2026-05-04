from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
import models  # noqa: enregistre tous les modèles sur Base
from routes import produits, stock, clients, fournisseurs, bons_livraison, bons_commande, factures, relances, avoirs, paiements, auth, parametres

Base.metadata.create_all(bind=engine)

# Migrations inline — ajoute les colonnes manquantes sur les tables existantes
with engine.connect() as _conn:
    _conn.execute(text("""
        CREATE TABLE IF NOT EXISTS parametres (
            id INTEGER PRIMARY KEY,
            compteur_facture INTEGER NOT NULL DEFAULT 1
        )
    """))
    _conn.execute(text("INSERT INTO parametres (id, compteur_facture) VALUES (1, 1) ON CONFLICT (id) DO NOTHING"))
    _conn.execute(text("ALTER TABLE produits ADD COLUMN IF NOT EXISTS alerte_ignoree BOOLEAN NOT NULL DEFAULT FALSE"))
    _conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS type_client VARCHAR"))
    _conn.execute(text("UPDATE clients SET type_client = 'particulier' WHERE particulier = TRUE  AND type_client IS NULL"))
    _conn.execute(text("UPDATE clients SET type_client = 'pharmacie'   WHERE particulier = FALSE AND type_client IS NULL"))
    _conn.execute(text("ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS encaisse BOOLEAN NOT NULL DEFAULT FALSE"))
    _conn.execute(text("ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS mode_encaissement VARCHAR"))
    _conn.execute(text("ALTER TABLE bons_livraison ADD COLUMN IF NOT EXISTS date_encaissement DATE"))
    _conn.execute(text("ALTER TABLE lignes_bon_commande ADD COLUMN IF NOT EXISTS remise NUMERIC(5,2) NOT NULL DEFAULT 0"))
    _conn.execute(text("ALTER TABLE bons_commande ADD COLUMN IF NOT EXISTS pdf_base64 TEXT"))
    _conn.execute(text("ALTER TABLE factures ADD COLUMN IF NOT EXISTS tva_incluse BOOLEAN NOT NULL DEFAULT FALSE"))
    # Paramètres société — migration vers stockage BDD
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS nom VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS adresse VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS ville VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS telephone VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS email VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS ice VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rc VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS tva NUMERIC(5,2) NOT NULL DEFAULT 20"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS delai_paiement INTEGER NOT NULL DEFAULT 30"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS devise VARCHAR NOT NULL DEFAULT 'MAD'"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS prefixe_facture VARCHAR NOT NULL DEFAULT 'FAC'"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS logo TEXT"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS couleur_primaire VARCHAR NOT NULL DEFAULT '#0d2c6e'"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS couleur_accent VARCHAR NOT NULL DEFAULT '#f06020'"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS conditions_paiement TEXT"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS mentions_legales TEXT"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS pied_de_page TEXT"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS afficher_remise BOOLEAN NOT NULL DEFAULT TRUE"))
    _conn.execute(text("ALTER TABLE stock_mouvements ADD COLUMN IF NOT EXISTS notes VARCHAR"))
    _conn.commit()

app = FastAPI(title="Vultur - Gestion d'entreprise", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
app.include_router(parametres.router)


@app.get("/")
def root():
    return {"message": "API Vultur opérationnelle"}

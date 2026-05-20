from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
import models  # noqa: enregistre tous les modèles sur Base
from routes import produits, stock, clients, fournisseurs, bons_livraison, bons_commande, factures, relances, avoirs, paiements, auth, parametres, recettes, production, demandes_achat

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
    _conn.execute(text("ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS rib VARCHAR"))
    # Comptes bancaires — remplacement de rib unique par rib_1/2/3
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_1 VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_1_label VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_2 VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_2_label VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_3 VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_3_label VARCHAR"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS rib_actif INTEGER NOT NULL DEFAULT 1"))
    # Migrer l'ancien champ rib vers rib_1 seulement si la colonne rib existe
    _conn.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'parametres' AND column_name = 'rib'
            ) THEN
                UPDATE parametres SET rib_1 = rib WHERE rib IS NOT NULL AND rib_1 IS NULL;
            END IF;
        END $$;
    """))
    # Production module — nouvelles colonnes et tables
    _conn.execute(text("ALTER TABLE produits ADD COLUMN IF NOT EXISTS unite VARCHAR NOT NULL DEFAULT 'unité'"))
    _conn.execute(text("ALTER TABLE produits ALTER COLUMN stock TYPE NUMERIC(12,3) USING stock::numeric"))
    _conn.execute(text("ALTER TABLE stock_mouvements ALTER COLUMN quantite TYPE NUMERIC(12,3) USING quantite::numeric"))
    _conn.execute(text("""
        CREATE TABLE IF NOT EXISTS recettes (
            id SERIAL PRIMARY KEY,
            produit_id INTEGER NOT NULL UNIQUE REFERENCES produits(id),
            quantite_produite NUMERIC(12,3) NOT NULL,
            notes TEXT
        )
    """))
    _conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ordres_fabrication (
            id SERIAL PRIMARY KEY,
            recette_id INTEGER NOT NULL REFERENCES recettes(id),
            produit_id INTEGER NOT NULL REFERENCES produits(id),
            nombre_batches NUMERIC(12,3) NOT NULL,
            quantite_produite NUMERIC(12,3) NOT NULL,
            date DATE NOT NULL,
            notes TEXT
        )
    """))
    _conn.execute(text("""
        CREATE TABLE IF NOT EXISTS lignes_recette (
            id SERIAL PRIMARY KEY,
            recette_id INTEGER NOT NULL REFERENCES recettes(id) ON DELETE CASCADE,
            produit_id INTEGER NOT NULL REFERENCES produits(id),
            quantite NUMERIC(12,3) NOT NULL
        )
    """))
    _conn.execute(text("ALTER TABLE stock_mouvements ADD COLUMN IF NOT EXISTS ordre_fabrication_id INTEGER REFERENCES ordres_fabrication(id)"))
    _conn.execute(text("ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS quantite_reelle NUMERIC(12,3)"))
    _conn.execute(text("ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS perte NUMERIC(12,3) NOT NULL DEFAULT 0"))
    _conn.execute(text("ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS cout_production NUMERIC(12,2) NOT NULL DEFAULT 0"))
    _conn.execute(text("ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS cout_unitaire NUMERIC(12,4) NOT NULL DEFAULT 0"))
    # Remplir quantite_reelle pour les ordres existants (= quantite_produite, perte = 0)
    _conn.execute(text("UPDATE ordres_fabrication SET quantite_reelle = quantite_produite WHERE quantite_reelle IS NULL"))
    _conn.execute(text("ALTER TABLE ordres_fabrication ALTER COLUMN quantite_reelle SET NOT NULL"))
    # Paramètres d'affichage production
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS prod_afficher_cout BOOLEAN NOT NULL DEFAULT TRUE"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS prod_afficher_batches BOOLEAN NOT NULL DEFAULT TRUE"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS prod_afficher_stats BOOLEAN NOT NULL DEFAULT TRUE"))
    # Demandes d'achat — paramètres
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS prefixe_demande VARCHAR NOT NULL DEFAULT 'DA'"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS compteur_demande INTEGER NOT NULL DEFAULT 1"))
    _conn.execute(text("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS duree_archivage_demandes INTEGER NOT NULL DEFAULT 90"))
    # Demandes d'achat — tables
    _conn.execute(text("""
        CREATE TABLE IF NOT EXISTS demandes_achat (
            id SERIAL PRIMARY KEY,
            numero VARCHAR NOT NULL UNIQUE,
            fournisseur_id INTEGER NOT NULL REFERENCES fournisseurs(id),
            statut VARCHAR NOT NULL DEFAULT 'brouillon',
            date DATE NOT NULL,
            notes TEXT,
            bon_commande_id INTEGER REFERENCES bons_commande(id)
        )
    """))
    _conn.execute(text("""
        CREATE TABLE IF NOT EXISTS lignes_demande_achat (
            id SERIAL PRIMARY KEY,
            demande_id INTEGER NOT NULL REFERENCES demandes_achat(id) ON DELETE CASCADE,
            produit_id INTEGER NOT NULL REFERENCES produits(id),
            quantite_demandee NUMERIC(12,3) NOT NULL,
            quantite_confirmee NUMERIC(12,3),
            prix_unitaire NUMERIC(10,2) NOT NULL
        )
    """))
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
app.include_router(recettes.router)
app.include_router(production.router)
app.include_router(demandes_achat.router)


@app.get("/")
def root():
    return {"message": "API Vultur opérationnelle"}

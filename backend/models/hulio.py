from sqlalchemy import Column, Integer, String, Date, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class TraitementHulio(Base):
    __tablename__ = "traitements_hulio"

    id                   = Column(Integer, primary_key=True, index=True)
    client_id            = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    produit_id           = Column(Integer, ForeignKey("produits.id"), nullable=False)
    pathologie           = Column(String, nullable=True)
    nature_remboursement = Column(String, nullable=True)
    centre_mutuelle      = Column(String, nullable=True)
    date_debut           = Column(Date, default=datetime.date.today, nullable=False)
    duree_mois           = Column(Integer, nullable=True)
    date_fin             = Column(Date, nullable=True)
    nombre_boites        = Column(Integer, nullable=False)
    statut               = Column(String, default="en_cours", nullable=False)  # en_cours | termine | arrete
    notes                = Column(Text, nullable=True)

    client     = relationship("Client")
    produit    = relationship("Produit")
    livraisons = relationship(
        "LivraisonHulio", back_populates="traitement",
        cascade="all, delete-orphan", order_by="LivraisonHulio.date_prevue",
    )
    factures   = relationship("FactureHulio", back_populates="traitement", order_by="FactureHulio.id")


class LivraisonHulio(Base):
    __tablename__ = "livraisons_hulio"

    id             = Column(Integer, primary_key=True, index=True)
    traitement_id  = Column(Integer, ForeignKey("traitements_hulio.id", ondelete="CASCADE"), nullable=False, index=True)
    date_prevue    = Column(Date, nullable=False)
    date_rappel    = Column(Date, nullable=True)
    nombre_boites  = Column(Integer, nullable=False, default=1)
    statut         = Column(String, default="prévue", nullable=False)  # prévue | livrée | annulée
    date_livraison = Column(Date, nullable=True)
    notes          = Column(Text, nullable=True)

    traitement = relationship("TraitementHulio", back_populates="livraisons")


class FactureHulio(Base):
    """Détail d'une facture Hulio (format ANAM). Les montants et informations du patient
    sont figés à la création puis complétés à la main : le PDF reste identique dans le temps."""
    __tablename__ = "factures_hulio"

    id                     = Column(Integer, primary_key=True, index=True)
    facture_id             = Column(Integer, ForeignKey("factures.id", ondelete="CASCADE"), nullable=False, unique=True)
    traitement_id          = Column(Integer, ForeignKey("traitements_hulio.id"), nullable=False, index=True)
    produit_id             = Column(Integer, ForeignKey("produits.id"), nullable=False)
    designation            = Column(String, nullable=False)
    quantite               = Column(Integer, nullable=False)
    ppm                    = Column(Numeric(10, 2), nullable=False)  # prix public Maroc (TTC)
    pbr                    = Column(Numeric(10, 2), nullable=True)   # prix base de remboursement
    taux_prise_en_charge   = Column(Numeric(5, 2), nullable=True)    # saisi à la main
    taux_tva               = Column(Numeric(5, 2), nullable=False, default=0)
    numero_prise_en_charge = Column(String, nullable=True)
    assure_nom             = Column(String, nullable=True)
    beneficiaire_nom       = Column(String, nullable=True)
    immatriculation        = Column(String, nullable=True)
    organisme              = Column(String, nullable=True)  # CNOPS | CNSS | autre

    facture    = relationship("Facture", back_populates="hulio")
    traitement = relationship("TraitementHulio", back_populates="factures")

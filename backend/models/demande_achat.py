from sqlalchemy import Column, Integer, String, Numeric, Date, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class DemandeAchat(Base):
    __tablename__ = "demandes_achat"

    id             = Column(Integer, primary_key=True, index=True)
    numero         = Column(String, nullable=False, unique=True)
    fournisseur_id = Column(Integer, ForeignKey("fournisseurs.id"), nullable=False)
    statut         = Column(String, default="brouillon", nullable=False)  # brouillon | envoyée | validée | annulée
    date           = Column(Date, default=datetime.date.today, nullable=False)
    notes          = Column(Text, nullable=True)
    tva_estimee    = Column(Boolean, nullable=False, default=False, server_default='false')
    bon_commande_id = Column(Integer, ForeignKey("bons_commande.id"), nullable=True)

    fournisseur  = relationship("Fournisseur")
    lignes       = relationship("LigneDemandeAchat", back_populates="demande", cascade="all, delete-orphan")
    bon_commande = relationship("BonCommande")


class LigneDemandeAchat(Base):
    __tablename__ = "lignes_demande_achat"

    id                 = Column(Integer, primary_key=True, index=True)
    demande_id         = Column(Integer, ForeignKey("demandes_achat.id"), nullable=False)
    produit_id         = Column(Integer, ForeignKey("produits.id"), nullable=False)
    quantite_demandee  = Column(Numeric(12, 3), nullable=False)
    quantite_confirmee = Column(Numeric(12, 3), nullable=True)
    prix_unitaire      = Column(Numeric(10, 2), nullable=False)

    demande = relationship("DemandeAchat", back_populates="lignes")
    produit = relationship("Produit")

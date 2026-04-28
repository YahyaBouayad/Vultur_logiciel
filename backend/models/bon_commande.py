from sqlalchemy import Column, Integer, String, Numeric, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class BonCommande(Base):
    __tablename__ = "bons_commande"

    id             = Column(Integer, primary_key=True, index=True)
    fournisseur_id = Column(Integer, ForeignKey("fournisseurs.id"), nullable=False)
    date           = Column(Date, default=datetime.date.today, nullable=False)
    statut         = Column(String, default="brouillon", nullable=False)  # brouillon | envoyé | reçu
    notes          = Column(Text, nullable=True)
    pdf_base64     = Column(Text, nullable=True)

    fournisseur = relationship("Fournisseur")
    lignes      = relationship("LigneBonCommande", back_populates="bon_commande", cascade="all, delete-orphan")


class LigneBonCommande(Base):
    __tablename__ = "lignes_bon_commande"

    id              = Column(Integer, primary_key=True, index=True)
    bon_commande_id = Column(Integer, ForeignKey("bons_commande.id"), nullable=False)
    produit_id      = Column(Integer, ForeignKey("produits.id"), nullable=False)
    quantite        = Column(Integer, nullable=False)
    prix_unitaire   = Column(Numeric(10, 2), nullable=False)
    remise          = Column(Numeric(5, 2), nullable=False, default=0, server_default='0')

    bon_commande = relationship("BonCommande", back_populates="lignes")
    produit      = relationship("Produit")

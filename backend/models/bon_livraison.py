from sqlalchemy import Column, Integer, String, Numeric, Date, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime


class BonLivraison(Base):
    __tablename__ = "bons_livraison"

    id        = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    date      = Column(Date, default=datetime.date.today, nullable=False)
    statut    = Column(String, default="brouillon", nullable=False)  # brouillon | validé | livré
    notes     = Column(Text, nullable=True)

    # Règlement direct sans facture (arrangement)
    encaisse          = Column(Boolean, default=False, nullable=False, server_default='false')
    mode_encaissement = Column(String, nullable=True)
    date_encaissement = Column(Date, nullable=True)

    client  = relationship("Client")
    lignes  = relationship("LigneBonLivraison", back_populates="bon_livraison", cascade="all, delete-orphan", order_by="LigneBonLivraison.id")
    facture = relationship("Facture", back_populates="bon_livraison", uselist=False)


class LigneBonLivraison(Base):
    __tablename__ = "lignes_bon_livraison"

    id               = Column(Integer, primary_key=True, index=True)
    bon_livraison_id = Column(Integer, ForeignKey("bons_livraison.id"), nullable=False)
    produit_id       = Column(Integer, ForeignKey("produits.id"), nullable=False)
    quantite         = Column(Integer, nullable=False)
    prix_unitaire    = Column(Numeric(10, 2), nullable=False)
    remise           = Column(Numeric(5, 2), default=0, server_default='0', nullable=False)

    bon_livraison = relationship("BonLivraison", back_populates="lignes")
    produit       = relationship("Produit")

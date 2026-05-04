from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Facture(Base):
    __tablename__ = "factures"

    id               = Column(Integer, primary_key=True, index=True)
    numero           = Column(String, unique=True, nullable=False, index=True)
    bon_livraison_id = Column(Integer, ForeignKey("bons_livraison.id"), nullable=False)
    client_id        = Column(Integer, ForeignKey("clients.id"), nullable=False)
    date_emission    = Column(Date, default=datetime.date.today, nullable=False)
    date_echeance    = Column(Date, nullable=True)
    statut           = Column(String, default="émise", nullable=False)  # émise | payée | annulée
    notes            = Column(Text, nullable=True)
    tva_incluse      = Column(Boolean, default=False, nullable=False, server_default='false')

    bon_livraison = relationship("BonLivraison", back_populates="facture")
    client        = relationship("Client")
    relances      = relationship("Relance", back_populates="facture", cascade="all, delete-orphan", order_by="Relance.date")
    avoirs        = relationship("Avoir",    back_populates="facture", cascade="all, delete-orphan", order_by="Avoir.date")
    paiements     = relationship("Paiement", back_populates="facture", cascade="all, delete-orphan", order_by="Paiement.date")

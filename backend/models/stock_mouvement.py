from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class StockMouvement(Base):
    __tablename__ = "stock_mouvements"

    id               = Column(Integer, primary_key=True, index=True)
    produit_id       = Column(Integer, ForeignKey("produits.id"), nullable=False)
    type             = Column(String, nullable=False)  # 'entrée' | 'sortie'
    quantite         = Column(Integer, nullable=False)
    date             = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    bon_livraison_id = Column(Integer, ForeignKey("bons_livraison.id"), nullable=True)

    produit       = relationship("Produit")
    bon_livraison = relationship("BonLivraison")

from sqlalchemy import Column, Integer, Numeric, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class OrdreFabrication(Base):
    __tablename__ = "ordres_fabrication"

    id                = Column(Integer, primary_key=True, index=True)
    recette_id        = Column(Integer, ForeignKey("recettes.id"), nullable=False)
    produit_id        = Column(Integer, ForeignKey("produits.id"), nullable=False)
    nombre_batches    = Column(Numeric(12, 3), nullable=False)
    quantite_produite = Column(Numeric(12, 3), nullable=False)
    quantite_reelle   = Column(Numeric(12, 3), nullable=False)
    perte             = Column(Numeric(12, 3), nullable=False, default=0)
    cout_production   = Column(Numeric(12, 2), nullable=False, default=0)
    cout_unitaire     = Column(Numeric(12, 4), nullable=False, default=0)
    date              = Column(Date, default=datetime.date.today, nullable=False)
    notes             = Column(String, nullable=True)

    recette = relationship("Recette")
    produit = relationship("Produit")

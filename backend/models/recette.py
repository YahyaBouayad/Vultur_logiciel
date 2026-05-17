from sqlalchemy import Column, Integer, Numeric, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Recette(Base):
    __tablename__ = "recettes"

    id                = Column(Integer, primary_key=True, index=True)
    produit_id        = Column(Integer, ForeignKey("produits.id"), nullable=False, unique=True)
    quantite_produite = Column(Numeric(12, 3), nullable=False)
    notes             = Column(String, nullable=True)

    produit = relationship("Produit")
    lignes  = relationship("LigneRecette", back_populates="recette", cascade="all, delete-orphan")


class LigneRecette(Base):
    __tablename__ = "lignes_recette"

    id         = Column(Integer, primary_key=True, index=True)
    recette_id = Column(Integer, ForeignKey("recettes.id"), nullable=False)
    produit_id = Column(Integer, ForeignKey("produits.id"), nullable=False)
    quantite   = Column(Numeric(12, 3), nullable=False)

    recette = relationship("Recette", back_populates="lignes")
    produit = relationship("Produit")

from sqlalchemy import Column, Integer, String, Numeric
from database import Base


class Produit(Base):
    __tablename__ = "produits"

    id        = Column(Integer, primary_key=True, index=True)
    nom       = Column(String, nullable=False)
    reference = Column(String, unique=True, nullable=False, index=True)
    stock     = Column(Integer, default=0, nullable=False)
    prix      = Column(Numeric(10, 2), nullable=False)

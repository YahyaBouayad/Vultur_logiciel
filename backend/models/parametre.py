from sqlalchemy import Column, Integer
from database import Base


class Parametre(Base):
    __tablename__ = "parametres"

    id               = Column(Integer, primary_key=True, default=1)
    compteur_facture = Column(Integer, nullable=False, default=1)

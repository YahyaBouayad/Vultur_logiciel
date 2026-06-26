from sqlalchemy import Column, Integer, String, Numeric, Boolean
from database import Base

UNITES = ['unité', 'kg', 'g', 'L', 'mL']

TYPES_PRODUIT = [
    'Dispositif médical classé 1',
    'Dispositif médical classé 2',
    'Dispositif médical classé 3',
    'Cosmétique',
]


class Produit(Base):
    __tablename__ = "produits"

    id              = Column(Integer, primary_key=True, index=True)
    nom             = Column(String, nullable=False)
    reference       = Column(String, unique=True, nullable=False, index=True)
    stock           = Column(Numeric(12, 3), default=0, nullable=False)
    prix            = Column(Numeric(10, 2), nullable=False)
    alerte_ignoree  = Column(Boolean, default=False, nullable=False)
    unite           = Column(String, nullable=False, default='unité')
    type_produit    = Column(String, nullable=True)

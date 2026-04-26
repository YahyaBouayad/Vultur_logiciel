from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Avoir(Base):
    __tablename__ = "avoirs"

    id         = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id", ondelete="CASCADE"), nullable=False)
    numero     = Column(String, unique=True, nullable=False, index=True)
    date       = Column(Date, default=datetime.date.today, nullable=False)
    montant_ht = Column(Numeric(12, 2), nullable=False)
    motif      = Column(String, nullable=False)  # annulation | retour | commercial
    notes      = Column(Text, nullable=True)

    facture = relationship("Facture", back_populates="avoirs")

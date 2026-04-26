from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Paiement(Base):
    __tablename__ = "paiements"

    id         = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id", ondelete="CASCADE"), nullable=False)
    date       = Column(Date, default=datetime.date.today, nullable=False)
    montant    = Column(Numeric(12, 2), nullable=False)
    mode       = Column(String, nullable=False)  # espèces | virement | chèque | carte
    notes      = Column(Text, nullable=True)

    facture = relationship("Facture", back_populates="paiements")

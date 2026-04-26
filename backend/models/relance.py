from sqlalchemy import Column, Integer, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Relance(Base):
    __tablename__ = "relances"

    id         = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id", ondelete="CASCADE"), nullable=False)
    date       = Column(Date, default=datetime.date.today, nullable=False)
    notes      = Column(Text, nullable=True)

    facture = relationship("Facture", back_populates="relances")

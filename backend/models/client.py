from sqlalchemy import Column, Integer, String, Boolean
from database import Base


class Client(Base):
    __tablename__ = "clients"

    id          = Column(Integer, primary_key=True, index=True)
    nom         = Column(String, nullable=False)
    contact     = Column(String, nullable=True)
    type_client = Column(String, nullable=True)   # pharmacie | clinique | hopital | particulier
    particulier = Column(Boolean, nullable=False, default=False)
    telephone   = Column(String, nullable=True)
    adresse     = Column(String, nullable=True)
    mail        = Column(String, nullable=True)
    ice         = Column(String, nullable=True)  # NULL si particulier = True

    # Patients Hulio (facture ANAM) — l'assuré peut être différent du bénéficiaire (patient)
    nom_assure             = Column(String, nullable=True)
    immatriculation        = Column(String, nullable=True)
    numero_prise_en_charge = Column(String, nullable=True)

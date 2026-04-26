from sqlalchemy import Column, Integer, String
from database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id           = Column(Integer, primary_key=True, index=True)
    nom          = Column(String, nullable=False)
    email        = Column(String, unique=True, nullable=False, index=True)
    mot_de_passe = Column(String, nullable=False)  # hashé bcrypt

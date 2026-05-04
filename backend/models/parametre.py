from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric
from database import Base


class Parametre(Base):
    __tablename__ = "parametres"

    id               = Column(Integer, primary_key=True, default=1)
    compteur_facture = Column(Integer, nullable=False, default=1)

    # Société
    nom       = Column(String, nullable=True)
    adresse   = Column(String, nullable=True)
    ville     = Column(String, nullable=True)
    telephone = Column(String, nullable=True)
    email     = Column(String, nullable=True)
    ice       = Column(String, nullable=True)
    rc        = Column(String, nullable=True)

    # Facturation
    tva             = Column(Numeric(5, 2), nullable=False, default=20,    server_default='20')
    delai_paiement  = Column(Integer,       nullable=False, default=30,    server_default='30')
    devise          = Column(String,        nullable=False, default='MAD', server_default="'MAD'")
    prefixe_facture = Column(String,        nullable=False, default='FAC', server_default="'FAC'")

    # Personnalisation PDF
    logo                = Column(Text,    nullable=True)
    couleur_primaire    = Column(String,  nullable=False, default='#0d2c6e', server_default="'#0d2c6e'")
    couleur_accent      = Column(String,  nullable=False, default='#f06020', server_default="'#f06020'")
    conditions_paiement = Column(Text,    nullable=True)
    mentions_legales    = Column(Text,    nullable=True)
    pied_de_page        = Column(Text,    nullable=True)
    afficher_remise     = Column(Boolean, nullable=False, default=True, server_default='true')

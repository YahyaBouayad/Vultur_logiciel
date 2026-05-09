def montant_ht_facture(facture, taux_tva: float = 0.0) -> float:
    """Calcule le montant HT d'une facture à partir des lignes du BL associé."""
    if facture.bon_livraison:
        raw = sum(
            float(l.prix_unitaire) * l.quantite * (1 - float(l.remise or 0) / 100)
            for l in facture.bon_livraison.lignes
        )
        if facture.tva_incluse and taux_tva > 0:
            return raw / (1 + taux_tva / 100)
        return raw
    return 0.0

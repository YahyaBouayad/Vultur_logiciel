def montant_ttc_hulio(h) -> float:
    """Total d'une facture Hulio : quantité × PPM (prix public, TTC)."""
    return float(h.ppm) * h.quantite


def montant_ht_facture(facture, taux_tva: float = 0.0) -> float:
    """Calcule le montant HT d'une facture à partir des lignes du BL associé,
    ou du détail Hulio (PPM TTC ramené en HT avec la TVA propre à la facture)."""
    if facture.bon_livraison:
        raw = sum(
            float(l.prix_unitaire) * l.quantite * (1 - float(l.remise or 0) / 100)
            for l in facture.bon_livraison.lignes
        )
        if facture.tva_incluse and taux_tva > 0:
            return raw / (1 + taux_tva / 100)
        return raw
    if facture.hulio:
        return montant_ttc_hulio(facture.hulio) / (1 + float(facture.hulio.taux_tva or 0) / 100)
    return 0.0

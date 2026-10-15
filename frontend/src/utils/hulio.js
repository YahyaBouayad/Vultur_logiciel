// Calculs et contrôles des factures Hulio (format ANAM), partagés entre les pages et le PDF

// Montants d'une facture Hulio : part organisme = Qté × PBR × taux ; reste = total PPM − part organisme
export function calculHulio(h) {
  const qte = Number(h?.quantite || 0)
  const total = qte * Number(h?.ppm || 0)
  const ok = h?.pbr !== null && h?.pbr !== undefined && h?.taux_prise_en_charge !== null && h?.taux_prise_en_charge !== undefined
  const og = ok ? qte * Number(h.pbr) * Number(h.taux_prise_en_charge) / 100 : null
  return { qte, total, og, reste: og === null ? null : total - og }
}

// Champs à vérifier avant impression
export function champsManquantsHulio(h) {
  const manquants = []
  if (!h?.numero_prise_en_charge) manquants.push('N° de prise en charge')
  if (!h?.immatriculation) manquants.push("N° d'immatriculation")
  if (!h?.organisme) manquants.push('Organisme gestionnaire')
  if (h?.pbr === null || h?.pbr === undefined) manquants.push('PBR')
  if (h?.taux_prise_en_charge === null || h?.taux_prise_en_charge === undefined) manquants.push('Taux de prise en charge')
  return manquants
}


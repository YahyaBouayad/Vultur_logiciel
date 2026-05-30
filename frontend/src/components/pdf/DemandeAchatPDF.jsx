import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1a2332', backgroundColor: '#ffffff' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '12 28 10' },
  logoBox: { flex: 1 },
  logo: { height: 46, objectFit: 'contain', objectPositionX: 0 },
  logoPlaceholder: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  companyBlock: { alignItems: 'flex-end', paddingLeft: 16 },
  companyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  companyLine: { fontSize: 7.5, color: '#475569', marginBottom: 1.5, textAlign: 'right' },
  iceText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginTop: 3, textAlign: 'right' },

  separator: { height: 2, marginHorizontal: 28 },

  infoRow: { flexDirection: 'row', padding: '10 28 10', gap: 16 },
  docLeft: { flex: 1 },
  docType: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a2332', marginBottom: 2 },
  docNum: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  dateRow: { flexDirection: 'row', marginBottom: 2 },
  dateLabel: { fontSize: 8.5, color: '#64748b', width: 75 },
  dateValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  statutBadge: { borderRadius: 3, padding: '2 7', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  fournisseurBox: { width: 210, borderRadius: 4, padding: '9 12', borderWidth: 0.5, borderColor: '#cbd5e1' },
  fournisseurBoxTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  fournisseurName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  fournisseurLine: { fontSize: 7.5, color: '#475569', marginBottom: 1.5 },

  tableOuter: { marginHorizontal: 28, marginTop: 6, borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  tableHead: { flexDirection: 'row', padding: '6 8' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: '7 8', borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tdRef: { fontSize: 8.5, color: '#1a2332', fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 8.5, color: '#1a2332' },
  tdNum: { fontSize: 8.5, color: '#1a2332', textAlign: 'right' },
  tdNumBold: { fontSize: 8.5, color: '#1a2332', fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  colRef:  { width: 72 },
  colDesc: { flex: 1 },
  colQty:  { width: 52, textAlign: 'right' },
  colPU:   { width: 90, textAlign: 'right' },
  colTot:  { width: 90, textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: '10 28 0' },
  totalBox: { borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '6 14', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minWidth: 200 },
  totRowTva: { flexDirection: 'row', justifyContent: 'space-between', padding: '6 14', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minWidth: 200, backgroundColor: '#fffbeb' },
  totRowFinal: { flexDirection: 'row', justifyContent: 'space-between', padding: '8 14', minWidth: 200 },
  totLabel: { fontSize: 8.5, color: '#475569' },
  totLabelTva: { fontSize: 8.5, color: '#92400e', fontFamily: 'Helvetica-Bold' },
  totValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  totValueTva: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#92400e' },
  totLabelFinal: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  tvaBadge: { marginHorizontal: 28, marginTop: 6, padding: '4 10', backgroundColor: '#fffbeb', borderWidth: 0.5, borderColor: '#fde68a', borderRadius: 3, flexDirection: 'row', alignItems: 'center' },
  tvaBadgeText: { fontSize: 7.5, color: '#92400e', fontFamily: 'Helvetica-Bold' },
  tvaBadgeNote: { fontSize: 7, color: '#b45309', marginLeft: 6 },

  notesBox: { margin: '10 28 0', borderWidth: 0.5, borderColor: '#cbd5e1', borderRadius: 4, padding: '8 12' },
  notesLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  notesText: { fontSize: 8.5, color: '#1a2332' },

  sigRow: { flexDirection: 'row', padding: '16 28 0', gap: 14 },
  sigBox: { flex: 1, borderWidth: 0.5, borderColor: '#cbd5e1', borderRadius: 4, padding: '10 12', height: 60 },
  sigLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  footer: {
    position: 'absolute', bottom: 16, left: 28, right: 28,
    borderTopWidth: 0.5, borderTopColor: '#cbd5e1',
    paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

const fmt = (n) => {
  const p = Number(n).toFixed(2).split('.')
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return p.join(',')
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtQte = (n) => {
  const v = Number(n)
  return v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}

const STATUT_LABEL = { brouillon: 'Brouillon', envoyée: 'Envoyée', validée: 'Validée', annulée: 'Annulée' }
const STATUT_COLOR = { brouillon: '#64748b', envoyée: '#3b82f6', validée: '#16a34a', annulée: '#ef4444' }

export default function DemandeAchatPDF({ demande, entreprise = {} }) {
  const E = entreprise
  const primary = E.couleurPrimaire || '#0d2c6e'
  const accent  = E.couleurAccent  || '#f06020'
  const devise  = E.devise || 'MAD'

  const lignes      = demande?.lignes || []
  const totalHT     = lignes.reduce((s, l) => s + Number(l.quantite_demandee) * Number(l.prix_unitaire), 0)
  const tvaEstimee  = demande?.tva_estimee === true
  const montantTVA  = tvaEstimee ? totalHT * 0.2 : 0
  const totalTTC    = tvaEstimee ? totalHT * 1.2 : totalHT

  const footerTxt = E.piedDePage
    || [E.nom, E.adresse, E.ville].filter(Boolean).join('  —  ')

  return (
    <Document title={demande.numero} author={E.nom || 'Demande d\'achat'}>
      <Page size="A4" style={s.page}>

        {/* ── EN-TÊTE ──────────────────────────────────── */}
        <View style={s.headerRow}>
          <View style={s.logoBox}>
            {E.logo
              ? <Image src={E.logo} style={s.logo} />
              : <Text style={[s.logoPlaceholder, { color: primary }]}>{E.nom || 'Votre société'}</Text>
            }
          </View>
          <View style={s.companyBlock}>
            {E.nom       && <Text style={[s.companyName, { color: primary }]}>{E.nom}</Text>}
            {E.adresse   && <Text style={s.companyLine}>{E.adresse}</Text>}
            {E.ville     && <Text style={s.companyLine}>{E.ville}</Text>}
            {E.telephone && <Text style={s.companyLine}>{E.telephone}</Text>}
            {E.ice       && <Text style={[s.iceText, { color: primary }]}>ICE : {E.ice}</Text>}
            {E.rc        && <Text style={[s.companyLine, { fontFamily: 'Helvetica-Bold' }]}>RC : {E.rc}</Text>}
          </View>
        </View>

        <View style={[s.separator, { backgroundColor: primary }]} />

        {/* ── TYPE DOC + FOURNISSEUR ───────────────────── */}
        <View style={s.infoRow}>
          <View style={s.docLeft}>
            <Text style={s.docType}>DEMANDE D'ACHAT</Text>
            <Text style={[s.docNum, { color: accent }]}>N° : {demande.numero}</Text>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>Date :</Text>
              <Text style={s.dateValue}>{fmtDate(demande.date)}</Text>
            </View>
            <View style={[s.dateRow, { alignItems: 'center' }]}>
              <Text style={s.dateLabel}>Statut :</Text>
              <Text style={[s.statutBadge, { backgroundColor: STATUT_COLOR[demande.statut] || '#64748b' }]}>
                {STATUT_LABEL[demande.statut] || demande.statut}
              </Text>
            </View>
            <View style={[s.dateRow, { marginTop: 6 }]}>
              <Text style={s.dateLabel}>Articles :</Text>
              <Text style={s.dateValue}>{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</Text>
            </View>
          </View>

          <View style={s.fournisseurBox}>
            <Text style={s.fournisseurBoxTitle}>Fournisseur</Text>
            <Text style={s.fournisseurName}>{demande.fournisseur_nom || '—'}</Text>
            {demande.fournisseur_adresse && <Text style={s.fournisseurLine}>{demande.fournisseur_adresse}</Text>}
            {demande.fournisseur_email   && <Text style={s.fournisseurLine}>{demande.fournisseur_email}</Text>}
            {demande.fournisseur_ice     && (
              <Text style={[s.fournisseurLine, { fontFamily: 'Helvetica-Bold', marginTop: 4 }]}>
                ICE : {demande.fournisseur_ice}
              </Text>
            )}
          </View>
        </View>

        {/* ── TABLEAU ──────────────────────────────────── */}
        <View style={s.tableOuter}>
          <View style={[s.tableHead, { backgroundColor: primary }]}>
            <Text style={[s.th, s.colRef]}>Référence</Text>
            <Text style={[s.th, s.colDesc]}>Désignation</Text>
            <Text style={[s.th, s.colQty]}>Qté dem.</Text>
            <Text style={[s.th, s.colPU]}>P.U.</Text>
            <Text style={[s.th, s.colTot]}>Total</Text>
          </View>
          {lignes.map((l, i) => {
            const sousTotal = Number(l.quantite_demandee) * Number(l.prix_unitaire)
            return (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.tdRef, s.colRef]}>{l.produit_reference || `#${l.produit_id}`}</Text>
                <Text style={[s.td,    s.colDesc]}>{l.produit_nom || '—'}</Text>
                <Text style={[s.tdNum, s.colQty]}>{fmtQte(l.quantite_demandee)} {l.produit_unite || ''}</Text>
                <Text style={[s.tdNum, s.colPU]}>{fmt(l.prix_unitaire)} {devise}</Text>
                <Text style={[s.tdNumBold, s.colTot]}>{fmt(sousTotal)} {devise}</Text>
              </View>
            )
          })}
        </View>

        {/* ── TOTAL ────────────────────────────────────── */}
        <View style={s.totalRow}>
          <View style={s.totalBox}>
            {tvaEstimee ? (
              <>
                <View style={s.totRow}>
                  <Text style={s.totLabel}>Total HT :</Text>
                  <Text style={s.totValue}>{fmt(totalHT)} {devise}</Text>
                </View>
                <View style={s.totRowTva}>
                  <Text style={s.totLabelTva}>TVA 20% :</Text>
                  <Text style={s.totValueTva}>{fmt(montantTVA)} {devise}</Text>
                </View>
                <View style={[s.totRowFinal, { backgroundColor: primary }]}>
                  <Text style={s.totLabelFinal}>Total TTC estimé :</Text>
                  <Text style={[s.totLabelFinal, { color: accent }]}>{fmt(totalTTC)} {devise}</Text>
                </View>
              </>
            ) : (
              <View style={[s.totRowFinal, { backgroundColor: primary }]}>
                <Text style={s.totLabelFinal}>Total estimé :</Text>
                <Text style={[s.totLabelFinal, { color: accent }]}>{fmt(totalHT)} {devise}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── BANDEAU TVA ESTIMATION ───────────────────── */}
        {tvaEstimee && (
          <View style={s.tvaBadge}>
            <Text style={s.tvaBadgeText}>TVA 20% — Estimation</Text>
            <Text style={s.tvaBadgeNote}>Les prix unitaires sont HT. La TVA est calculée à titre indicatif.</Text>
          </View>
        )}

        {/* ── NOTES ────────────────────────────────────── */}
        {demande.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{demande.notes}</Text>
          </View>
        )}

        {/* ── SIGNATURES ───────────────────────────────── */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Demandé par</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Approuvé par</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Signature fournisseur</Text>
          </View>
        </View>

        {/* ── MENTIONS ─────────────────────────────────── */}
        {E.mentionsLegales && (
          <Text style={s.mentionsText}>{E.mentionsLegales}</Text>
        )}

        {/* ── PIED DE PAGE ─────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>{footerTxt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  )
}

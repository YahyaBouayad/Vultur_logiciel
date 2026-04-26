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

  clientBox: { width: 210, borderRadius: 4, padding: '9 12', borderWidth: 0.5, borderColor: '#cbd5e1' },
  clientBoxTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  clientName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  clientLine: { fontSize: 7.5, color: '#475569', marginBottom: 1.5 },

  tableOuter: { marginHorizontal: 28, marginTop: 6, borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  tableHead: { flexDirection: 'row', padding: '6 8' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: '7 8', borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tdRef: { fontSize: 8.5, color: '#1a2332', fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 8.5, color: '#1a2332' },
  tdNum: { fontSize: 8.5, color: '#1a2332', textAlign: 'right' },
  tdNumBold: { fontSize: 8.5, color: '#1a2332', fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  colRef:     { width: 72 },
  colDesc:    { flex: 1 },
  colQty:     { width: 40, textAlign: 'right' },
  colPU:      { width: 80, textAlign: 'right' },
  colRemise:  { width: 48, textAlign: 'right' },
  colTot:     { width: 80, textAlign: 'right' },
  colPUWide:  { width: 90, textAlign: 'right' },
  colTotWide: { width: 90, textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: '10 28 0' },
  totalBox: { borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '6 14', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minWidth: 200 },
  totRowFinal: { flexDirection: 'row', justifyContent: 'space-between', padding: '8 14', minWidth: 200 },
  totLabel: { fontSize: 8.5, color: '#475569' },
  totValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  totLabelFinal: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  notesBox: { margin: '10 28 0', borderWidth: 0.5, borderColor: '#cbd5e1', borderRadius: 4, padding: '8 12' },
  notesLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  notesText: { fontSize: 8.5, color: '#1a2332' },

  sigRow: { flexDirection: 'row', padding: '16 28 0', gap: 14 },
  sigBox: { flex: 1, borderWidth: 0.5, borderColor: '#cbd5e1', borderRadius: 4, padding: '10 12', height: 60 },
  sigLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  mentionsText: { padding: '8 28 0', fontSize: 7, color: '#94a3b8', lineHeight: 1.5 },

  footer: {
    position: 'absolute', bottom: 16, left: 28, right: 28,
    borderTopWidth: 0.5, borderTopColor: '#cbd5e1',
    paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

const fmt = (n) => { const p = Number(n).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join(',') }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

const STATUT_LABEL = { brouillon: 'Brouillon', validé: 'Validé', livré: 'Livré' }
const STATUT_COLOR = { brouillon: '#64748b', validé: '#3b82f6', livré: '#16a34a' }

export default function BLPDF({ bl, client, produits, entreprise = {} }) {
  const E = entreprise
  const primary      = E.couleurPrimaire || '#0d2c6e'
  const accent       = E.couleurAccent  || '#f06020'
  const devise       = E.devise || 'MAD'
  const showRemise   = E.afficherRemise !== false

  const lignes = bl?.lignes || []
  const total  = lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)
  const blNum  = `BL-${String(bl.id).padStart(4, '0')}`

  const footerTxt = E.piedDePage
    || [E.nom, E.adresse, E.ville].filter(Boolean).join('  —  ')

  return (
    <Document title={blNum} author={E.nom || 'Bon de livraison'}>
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
            {E.nom && <Text style={[s.companyName, { color: primary }]}>{E.nom}</Text>}
            {E.adresse   && <Text style={s.companyLine}>{E.adresse}</Text>}
            {E.ville     && <Text style={s.companyLine}>{E.ville}</Text>}
            {E.telephone && <Text style={s.companyLine}>{E.telephone}</Text>}
            {E.ice       && <Text style={[s.iceText, { color: primary }]}>ICE : {E.ice}</Text>}
            {E.rc        && <Text style={[s.companyLine, { fontFamily: 'Helvetica-Bold' }]}>RC : {E.rc}</Text>}
          </View>
        </View>

        <View style={[s.separator, { backgroundColor: primary }]} />

        {/* ── TYPE DOC + CLIENT ────────────────────────── */}
        <View style={s.infoRow}>
          <View style={s.docLeft}>
            <Text style={s.docType}>BON DE LIVRAISON</Text>
            <Text style={[s.docNum, { color: accent }]}>N° : {blNum}</Text>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>Date :</Text>
              <Text style={s.dateValue}>{fmtDate(bl.date)}</Text>
            </View>
            <View style={[s.dateRow, { alignItems: 'center' }]}>
              <Text style={s.dateLabel}>Statut :</Text>
              <Text style={[s.statutBadge, { backgroundColor: STATUT_COLOR[bl.statut] || '#64748b' }]}>
                {STATUT_LABEL[bl.statut] || bl.statut}
              </Text>
            </View>
            <View style={[s.dateRow, { marginTop: 6 }]}>
              <Text style={s.dateLabel}>Articles :</Text>
              <Text style={s.dateValue}>{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</Text>
            </View>
          </View>

          <View style={s.clientBox}>
            <Text style={s.clientBoxTitle}>Livré à</Text>
            <Text style={s.clientName}>{client?.nom || '—'}</Text>
            {client?.adresse   && <Text style={s.clientLine}>{client.adresse}</Text>}
            {client?.telephone && <Text style={s.clientLine}>{client.telephone}</Text>}
            {client?.email     && <Text style={s.clientLine}>{client.email}</Text>}
            {client?.ice       && <Text style={[s.clientLine, { fontFamily: 'Helvetica-Bold', marginTop: 4 }]}>ICE : {client.ice}</Text>}
          </View>
        </View>

        {/* ── TABLEAU ──────────────────────────────────── */}
        <View style={s.tableOuter}>
          <View style={[s.tableHead, { backgroundColor: primary }]}>
            <Text style={[s.th, s.colRef]}>Référence</Text>
            <Text style={[s.th, s.colDesc]}>Désignation</Text>
            <Text style={[s.th, s.colQty]}>Qté</Text>
            <Text style={[s.th, showRemise ? s.colPU : s.colPUWide]}>P.U. TTC</Text>
            {showRemise && <Text style={[s.th, s.colRemise]}>Remise</Text>}
            <Text style={[s.th, showRemise ? s.colTot : s.colTotWide]}>Sous-total</Text>
          </View>
          {lignes.map((l, i) => {
            const p = produits.find(x => x.id === l.produit_id)
            const remisePct = Number(l.remise || 0)
            const sousTotal = l.quantite * Number(l.prix_unitaire) * (1 - remisePct / 100)
            return (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.tdRef, s.colRef]}>{p?.reference || `#${l.produit_id}`}</Text>
                <Text style={[s.td, s.colDesc]}>{p?.nom || '—'}</Text>
                <Text style={[s.tdNum, s.colQty]}>{l.quantite}</Text>
                <Text style={[s.tdNum, showRemise ? s.colPU : s.colPUWide]}>{fmt(l.prix_unitaire)} {devise}</Text>
                {showRemise && (
                  <Text style={[s.tdNum, s.colRemise]}>{remisePct > 0 ? `${remisePct}%` : '—'}</Text>
                )}
                <Text style={[s.tdNumBold, showRemise ? s.colTot : s.colTotWide]}>{fmt(sousTotal)} {devise}</Text>
              </View>
            )
          })}
        </View>

        {/* ── TOTAL ────────────────────────────────────── */}
        <View style={s.totalRow}>
          <View style={s.totalBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>Total HT :</Text>
              <Text style={s.totValue}>{fmt(total)} {devise}</Text>
            </View>
            <View style={[s.totRowFinal, { backgroundColor: primary }]}>
              <Text style={s.totLabelFinal}>Total TTC :</Text>
              <Text style={[s.totLabelFinal, { color: accent }]}>{fmt(total)} {devise}</Text>
            </View>
          </View>
        </View>

        {/* ── NOTES BL ─────────────────────────────────── */}
        {bl.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{bl.notes}</Text>
          </View>
        )}

        {/* ── MENTIONS LÉGALES ─────────────────────────── */}
        {E.mentionsLegales
          ? <Text style={s.mentionsText}>{E.mentionsLegales}</Text>
          : null
        }

        {/* ── SIGNATURES ───────────────────────────────── */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Livré par</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Reçu par (signature & cachet client)</Text>
          </View>
        </View>

        {/* ── FOOTER ───────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerTxt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

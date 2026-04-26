import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { montantEnLettres } from '../../utils/montantEnLettres'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1a2332', backgroundColor: '#ffffff' },

  // ─── EN-TÊTE ─────────────────────────────────────────────
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '12 28 10' },
  logoBox: { flex: 1 },
  logo: { height: 46, objectFit: 'contain', objectPositionX: 0 },
  logoPlaceholder: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1a2332' },
  companyBlock: { alignItems: 'flex-end', paddingLeft: 16 },
  companyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  companyLine: { fontSize: 7.5, color: '#475569', marginBottom: 1.5, textAlign: 'right' },
  iceText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#1a2332', marginTop: 3, textAlign: 'right' },

  separator: { height: 2, marginHorizontal: 28 },

  // ─── INFO DOC + CLIENT ───────────────────────────────────
  infoRow: { flexDirection: 'row', padding: '10 28 10', gap: 16 },
  docLeft: { flex: 1 },
  docType: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#1a2332', marginBottom: 2 },
  docNum: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  dateRow: { flexDirection: 'row', marginBottom: 2 },
  dateLabel: { fontSize: 8.5, color: '#64748b', width: 75 },
  dateValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  clientBox: { width: 210, borderRadius: 4, padding: '9 12', borderWidth: 0.5, borderColor: '#cbd5e1' },
  clientBoxTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  clientName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  clientLine: { fontSize: 7.5, color: '#475569', marginBottom: 1.5 },

  // ─── TABLEAU ─────────────────────────────────────────────
  tableOuter: { marginHorizontal: 28, marginTop: 6, borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  tableHead: { flexDirection: 'row', padding: '6 8' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: '7 8', borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tdRef: { fontSize: 8.5, color: '#1a2332', fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 8.5, color: '#1a2332' },
  tdNum: { fontSize: 8.5, color: '#1a2332', textAlign: 'right' },
  tdNumBold: { fontSize: 8.5, color: '#1a2332', fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  colRef:    { width: 72 },
  colDesc:   { flex: 1 },
  colQty:    { width: 40, textAlign: 'right' },
  colPU:     { width: 74, textAlign: 'right' },
  colRemise: { width: 44, textAlign: 'right' },
  colTVA:    { width: 44, textAlign: 'right' },
  colTot:    { width: 82, textAlign: 'right' },

  // ─── BAS DE PAGE : TVA + TOTAUX ──────────────────────────
  bottomRow: { flexDirection: 'row', padding: '12 28 0', gap: 10 },

  tvaTable: { width: 190, borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  tvaHead: { flexDirection: 'row', padding: '6 8' },
  tvaRow: { flexDirection: 'row', padding: '6 8', borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
  tvaTh: { flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  tvaTd: { flex: 1, fontSize: 8.5 },
  tvaTdRight: { flex: 1, fontSize: 8.5, textAlign: 'right' },

  totalsBox: { flex: 1, borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 2 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '6 12', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  totRowFinal: { flexDirection: 'row', justifyContent: 'space-between', padding: '8 12' },
  totLabel: { fontSize: 8.5, color: '#475569' },
  totValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  totLabelFinal: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  totValueFinal: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  // ─── CONDITIONS ──────────────────────────────────────────
  condRow: { flexDirection: 'row', padding: '10 28 0', gap: 12 },
  condLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#475569' },

  // ─── MONTANT EN LETTRES ───────────────────────────────────
  wordsRow: { padding: '10 28 0' },
  wordsLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#475569', marginBottom: 2 },
  wordsText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1a2332' },

  // ─── MENTIONS + FOOTER ───────────────────────────────────
  mentionsText: { padding: '8 28 0', fontSize: 7, color: '#94a3b8', lineHeight: 1.5 },
  footer: {
    position: 'absolute', bottom: 16, left: 28, right: 28,
    borderTopWidth: 0.5, borderTopColor: '#cbd5e1',
    paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

const fmt   = (n) => { const p = Number(n).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join(',') }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export function FacturePage({ facture, client, bl, produits, entreprise = {} }) {
  const E = entreprise
  const primary = E.couleurPrimaire || '#0d2c6e'
  const accent  = E.couleurAccent  || '#f06020'
  const devise  = E.devise || 'MAD'
  const tauxTVA = Number(E.tva) || 0

  const showRemise = E.afficherRemise !== false
  const lignes  = bl?.lignes || []
  const totalHT = lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)
  const montantTVA = totalHT * (tauxTVA / 100)
  const totalTTC   = totalHT + montantTVA

  const footerTxt = E.piedDePage
    || [E.nom, E.adresse, E.ville].filter(Boolean).join('  —  ')

  return (
    <Page size="A4" style={s.page}>

        {/* ── EN-TÊTE : logo à gauche, société à droite ─── */}
        <View style={s.headerRow}>
          <View style={s.logoBox}>
            {E.logo
              ? <Image src={E.logo} style={s.logo} />
              : <Text style={[s.logoPlaceholder, { color: primary }]}>{E.nom || 'Votre société'}</Text>
            }
          </View>
          <View style={s.companyBlock}>
            {!E.logo && E.nom && <Text style={[s.companyName, { color: primary }]}>{E.nom}</Text>}
            {E.logo && E.nom  && <Text style={[s.companyName, { color: primary }]}>{E.nom}</Text>}
            {E.adresse   && <Text style={s.companyLine}>{E.adresse}</Text>}
            {E.ville     && <Text style={s.companyLine}>{E.ville}</Text>}
            {E.telephone && <Text style={s.companyLine}>{E.telephone}</Text>}
            {E.ice       && <Text style={s.iceText}>ICE : {E.ice}</Text>}
            {E.rc        && <Text style={[s.companyLine, { fontFamily: 'Helvetica-Bold' }]}>RC : {E.rc}</Text>}
          </View>
        </View>

        <View style={[s.separator, { backgroundColor: primary }]} />

        {/* ── TYPE DOC + CLIENT ────────────────────────── */}
        <View style={s.infoRow}>
          <View style={s.docLeft}>
            <Text style={s.docType}>FACTURE</Text>
            <Text style={[s.docNum, { color: accent }]}>N° : {facture.numero}</Text>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>Date :</Text>
              <Text style={s.dateValue}>{fmtDate(facture.date_emission)}</Text>
            </View>
            {facture.date_echeance && (
              <View style={s.dateRow}>
                <Text style={s.dateLabel}>Échéance :</Text>
                <Text style={s.dateValue}>{fmtDate(facture.date_echeance)}</Text>
              </View>
            )}
            <View style={[s.dateRow, { marginTop: 6 }]}>
              <Text style={s.dateLabel}>Réf. BL :</Text>
              <Text style={s.dateValue}>#{facture.bon_livraison_id}</Text>
            </View>
          </View>

          <View style={s.clientBox}>
            <Text style={s.clientBoxTitle}>Facturé à</Text>
            <Text style={s.clientName}>{client?.nom || '—'}</Text>
            {client?.adresse   && <Text style={s.clientLine}>{client.adresse}</Text>}
            {client?.telephone && <Text style={s.clientLine}>{client.telephone}</Text>}
            {client?.email     && <Text style={s.clientLine}>{client.email}</Text>}
            {client?.ice       && <Text style={[s.clientLine, { fontFamily: 'Helvetica-Bold', marginTop: 4 }]}>ICE : {client.ice}</Text>}
          </View>
        </View>

        {/* ── TABLEAU ──────────────────────────────────── */}
        <View style={s.tableOuter}>
          {/* Entête */}
          <View style={[s.tableHead, { backgroundColor: primary }]}>
            <Text style={[s.th, s.colRef]}>Référence</Text>
            <Text style={[s.th, s.colDesc]}>Désignation</Text>
            <Text style={[s.th, s.colQty]}>Qté</Text>
            <Text style={[s.th, s.colPU]}>P.U. HT</Text>
            {showRemise && <Text style={[s.th, s.colRemise]}>Remise</Text>}
            <Text style={[s.th, s.colTVA]}>TVA %</Text>
            <Text style={[s.th, s.colTot]}>Montant TTC</Text>
          </View>

          {lignes.map((l, i) => {
            const p = produits.find(x => x.id === l.produit_id)
            const remisePct = Number(l.remise || 0)
            const ttc = l.quantite * Number(l.prix_unitaire) * (1 - remisePct / 100) * (1 + tauxTVA / 100)
            return (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.tdRef, s.colRef]}>{p?.reference || `#${l.produit_id}`}</Text>
                <Text style={[s.td, s.colDesc]}>{p?.nom || '—'}</Text>
                <Text style={[s.tdNum, s.colQty]}>{l.quantite}</Text>
                <Text style={[s.tdNum, s.colPU]}>{fmt(l.prix_unitaire)}</Text>
                {showRemise && (
                  <Text style={[s.tdNum, s.colRemise]}>{remisePct > 0 ? `${remisePct}%` : '—'}</Text>
                )}
                <Text style={[s.tdNum, s.colTVA]}>{tauxTVA}%</Text>
                <Text style={[s.tdNumBold, s.colTot]}>{fmt(ttc)}</Text>
              </View>
            )
          })}
        </View>

        {/* ── TVA + TOTAUX ─────────────────────────────── */}
        <View style={s.bottomRow}>
          {/* Tableau TVA */}
          <View style={s.tvaTable}>
            <View style={[s.tvaHead, { backgroundColor: primary }]}>
              <Text style={s.tvaTh}>Base HT</Text>
              <Text style={s.tvaTh}>Taux</Text>
              <Text style={[s.tvaTh, { textAlign: 'right' }]}>Montant TVA</Text>
            </View>
            <View style={s.tvaRow}>
              <Text style={s.tvaTd}>{fmt(totalHT)}</Text>
              <Text style={s.tvaTd}>{tauxTVA}%</Text>
              <Text style={s.tvaTdRight}>{fmt(montantTVA)}</Text>
            </View>
          </View>

          {/* Conditions (texte label centré à gauche) */}
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 2 }}>
            {E.conditionsPaiement
              ? <Text style={[s.condLabel, { fontSize: 8, color: '#475569' }]}>
                  Conditions de règlement :{'\n'}
                  <Text style={{ fontFamily: 'Helvetica', fontWeight: 'normal' }}>{E.conditionsPaiement}</Text>
                </Text>
              : <Text style={s.condLabel}>Conditions de règlement :</Text>
            }
          </View>

          {/* Totaux */}
          <View style={s.totalsBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>Total HT :</Text>
              <Text style={s.totValue}>{fmt(totalHT)} {devise}</Text>
            </View>
            <View style={s.totRow}>
              <Text style={s.totLabel}>Montant TVA :</Text>
              <Text style={s.totValue}>{fmt(montantTVA)} {devise}</Text>
            </View>
            <View style={[s.totRowFinal, { backgroundColor: primary }]}>
              <Text style={s.totLabelFinal}>Total TTC :</Text>
              <Text style={[s.totValueFinal, { color: accent }]}>{fmt(totalTTC)} {devise}</Text>
            </View>
          </View>
        </View>

        {/* ── MONTANT EN LETTRES ───────────────────────── */}
        <View style={s.wordsRow}>
          <Text style={s.wordsLabel}>Arrêté la présente facture à la somme de :</Text>
          <Text style={s.wordsText}>{montantEnLettres(totalTTC)}</Text>
        </View>

        {/* ── MENTIONS LÉGALES ─────────────────────────── */}
        {E.mentionsLegales
          ? <Text style={s.mentionsText}>{E.mentionsLegales}</Text>
          : null
        }

        {/* ── FOOTER ───────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerTxt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
  )
}

export default function FacturePDF({ facture, client, bl, produits, entreprise = {} }) {
  return (
    <Document title={facture.numero} author={entreprise.nom || 'Facture'}>
      <FacturePage facture={facture} client={client} bl={bl} produits={produits} entreprise={entreprise} />
    </Document>
  )
}

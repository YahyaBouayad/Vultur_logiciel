import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1a2332', backgroundColor: '#ffffff', padding: '28 40' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  logoBox: { flex: 1 },
  logo: { height: 40, objectFit: 'contain', objectPositionX: 0 },
  logoPlaceholder: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  companyBlock: { alignItems: 'flex-end' },
  companyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  companyLine: { fontSize: 7.5, color: '#475569', marginBottom: 1.5, textAlign: 'right' },

  separator: { height: 2, marginBottom: 20 },

  dateBlock: { alignItems: 'flex-end', marginBottom: 20 },
  dateText: { fontSize: 9 },

  recipientBox: { marginBottom: 24, width: 220 },
  recipientLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  recipientName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  recipientLine: { fontSize: 8, color: '#475569', marginBottom: 1.5 },

  subjectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, padding: '8 12', borderRadius: 3 },
  subjectLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#475569', marginRight: 6 },
  subjectText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  badge: { borderRadius: 3, padding: '2 8', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff', alignSelf: 'flex-start', marginBottom: 20 },

  bodyText: { fontSize: 9, lineHeight: 1.7, color: '#1a2332', marginBottom: 14 },

  detailBox: { borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 3, marginBottom: 20 },
  detailHead: { flexDirection: 'row', padding: '6 12' },
  detailRow: { flexDirection: 'row', padding: '6 12', borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
  detailLabel: { width: 130, fontSize: 8.5, color: '#64748b' },
  detailValue: { flex: 1, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  detailValueAlert: { flex: 1, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#dc2626' },

  closing: { fontSize: 9, lineHeight: 1.7, color: '#1a2332', marginTop: 10, marginBottom: 28 },

  sigBlock: { borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 12 },
  sigName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  sigLine: { fontSize: 8, color: '#475569' },

  footer: {
    position: 'absolute', bottom: 16, left: 40, right: 40,
    borderTopWidth: 0.5, borderTopColor: '#e2e8f0',
    paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmt = (n) => { const p = Number(n).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join(',') }

const niveauLabel = { '1': '1ère relance', '2': '2ème relance', '3': '3ème relance et dernière' }
const niveauColor = { '1': '#3b82f6', '2': '#f59e0b', '3': '#dc2626' }

export default function RelancePDF({ facture, client, relance, numRelance, entreprise = {} }) {
  const E = entreprise
  const primary   = E.couleurPrimaire || '#0d2c6e'
  const devise    = E.devise || 'MAD'
  const tauxTVA   = Number(E.tva) || 0
  const montantHT = facture.montant_ht || 0
  const montantTTC = montantHT * (1 + tauxTVA / 100)

  const echeance = facture.date_echeance
  const joursRetard = echeance
    ? Math.max(0, Math.floor((new Date(relance.date) - new Date(echeance)) / 86400000))
    : 0

  const nNum = String(Math.min(numRelance, 3))
  const badgeColor = niveauColor[nNum] || '#dc2626'
  const badgeLabel = niveauLabel[nNum] || `${numRelance}ème relance`

  const footerTxt = E.piedDePage || [E.nom, E.adresse, E.ville].filter(Boolean).join('  —  ')

  return (
    <Document title={`Relance ${facture.numero}`} author={E.nom || 'Relance'}>
      <Page size="A4" style={s.page}>

        {/* ── EN-TÊTE ── */}
        <View style={s.headerRow}>
          <View style={s.logoBox}>
            {E.logo
              ? <Image src={E.logo} style={s.logo} />
              : <Text style={[s.logoPlaceholder, { color: primary }]}>{E.nom || 'Votre société'}</Text>
            }
          </View>
          <View style={s.companyBlock}>
            {E.nom      && <Text style={[s.companyName, { color: primary }]}>{E.nom}</Text>}
            {E.adresse  && <Text style={s.companyLine}>{E.adresse}</Text>}
            {E.ville    && <Text style={s.companyLine}>{E.ville}</Text>}
            {E.telephone && <Text style={s.companyLine}>{E.telephone}</Text>}
            {E.email    && <Text style={s.companyLine}>{E.email}</Text>}
            {E.ice      && <Text style={[s.companyLine, { fontFamily: 'Helvetica-Bold' }]}>ICE : {E.ice}</Text>}
          </View>
        </View>

        <View style={[s.separator, { backgroundColor: primary }]} />

        {/* ── DATE + DESTINATAIRE ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={s.recipientBox}>
            <Text style={s.recipientLabel}>Destinataire</Text>
            <Text style={s.recipientName}>{client?.nom || '—'}</Text>
            {client?.adresse  && <Text style={s.recipientLine}>{client.adresse}</Text>}
            {client?.ville    && <Text style={s.recipientLine}>{client.ville}</Text>}
            {client?.telephone && <Text style={s.recipientLine}>{client.telephone}</Text>}
            {client?.mail     && <Text style={s.recipientLine}>{client.mail}</Text>}
          </View>
          <View style={s.dateBlock}>
            <Text style={s.dateText}>
              {E.ville ? `${E.ville}, ` : ''}{fmtDate(relance.date)}
            </Text>
          </View>
        </View>

        {/* ── BADGE NIVEAU + OBJET ── */}
        <Text style={[s.badge, { backgroundColor: badgeColor }]}>{badgeLabel.toUpperCase()}</Text>

        <View style={[s.subjectRow, { backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#e2e8f0' }]}>
          <Text style={s.subjectLabel}>Objet :</Text>
          <Text style={s.subjectText}>Relance — Facture N° {facture.numero} du {fmtDate(facture.date_emission)}</Text>
        </View>

        {/* ── CORPS ── */}
        <Text style={s.bodyText}>Madame, Monsieur,</Text>
        <Text style={s.bodyText}>
          {numRelance === 1
            ? "Sauf erreur ou omission de notre part, nous vous rappelons que la facture mentionnée ci-dessous reste impayée à ce jour. Nous vous serions reconnaissants de bien vouloir procéder au règlement dans les meilleurs délais."
            : numRelance === 2
            ? "Malgré notre précédente relance, nous constatons que la facture mentionnée ci-dessous n'a toujours pas été réglée. Nous vous invitons à régulariser cette situation dans les plus brefs délais afin d'éviter tout désagrément."
            : "En dépit de nos relances précédentes restées sans suite, la facture ci-dessous demeure impayée. Sauf règlement sous 8 jours, nous nous verrons dans l'obligation de recourir à d'autres moyens de recouvrement."
          }
        </Text>

        {/* ── DÉTAIL FACTURE ── */}
        <View style={s.detailBox}>
          <View style={[s.detailHead, { backgroundColor: primary }]}>
            <Text style={[s.detailLabel, { color: '#fff', fontFamily: 'Helvetica-Bold' }]}>Détail de la facture</Text>
            <Text style={[s.detailValue, { color: '#fff', fontFamily: 'Helvetica-Bold' }]}> </Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Numéro de facture</Text>
            <Text style={s.detailValue}>{facture.numero}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Date d'émission</Text>
            <Text style={s.detailValue}>{fmtDate(facture.date_emission)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Date d'échéance</Text>
            <Text style={[s.detailValue, joursRetard > 0 ? { color: '#dc2626' } : {}]}>
              {fmtDate(facture.date_echeance)}{joursRetard > 0 ? ` (${joursRetard} jour${joursRetard > 1 ? 's' : ''} de retard)` : ''}
            </Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Montant HT</Text>
            <Text style={s.detailValue}>{fmt(montantHT)} {devise}</Text>
          </View>
          {tauxTVA > 0 && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>TVA ({tauxTVA}%)</Text>
              <Text style={s.detailValue}>{fmt(montantHT * tauxTVA / 100)} {devise}</Text>
            </View>
          )}
          <View style={[s.detailRow, { backgroundColor: '#fef2f2' }]}>
            <Text style={[s.detailLabel, { fontFamily: 'Helvetica-Bold' }]}>Montant TTC DÛ</Text>
            <Text style={s.detailValueAlert}>{fmt(montantTTC)} {devise}</Text>
          </View>
        </View>

        {/* ── NOTES RELANCE ── */}
        {relance.notes && (
          <Text style={[s.bodyText, { fontStyle: 'italic', color: '#475569' }]}>
            Note : {relance.notes}
          </Text>
        )}

        {/* ── CLÔTURE ── */}
        <Text style={s.closing}>
          Dans l'attente de votre règlement, nous restons à votre disposition pour tout renseignement complémentaire.{'\n\n'}
          Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.
        </Text>

        {/* ── SIGNATURE ── */}
        <View style={s.sigBlock}>
          <Text style={[s.sigName, { color: primary }]}>{E.nom || ''}</Text>
          {E.telephone && <Text style={s.sigLine}>{E.telephone}</Text>}
          {E.email     && <Text style={s.sigLine}>{E.email}</Text>}
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerTxt}</Text>
          <Text style={s.footerText}>Lettre de relance — {fmtDate(relance.date)}</Text>
        </View>

      </Page>
    </Document>
  )
}

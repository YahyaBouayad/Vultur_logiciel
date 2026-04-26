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

  recipientBox: { marginBottom: 24, width: 220 },
  recipientLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  recipientName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  recipientLine: { fontSize: 8, color: '#475569', marginBottom: 1.5 },

  dateBlock: { alignItems: 'flex-end' },
  dateText: { fontSize: 9 },

  titleBadge: { borderRadius: 3, padding: '4 12', alignSelf: 'flex-start', marginBottom: 20 },
  titleText: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  subjectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, padding: '8 12', borderRadius: 3, backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#e2e8f0' },
  subjectLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#475569', marginRight: 6 },
  subjectText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  bodyText: { fontSize: 9, lineHeight: 1.7, color: '#1a2332', marginBottom: 14 },

  detailBox: { borderWidth: 0.5, borderColor: '#94a3b8', borderRadius: 3, marginBottom: 20 },
  detailHead: { flexDirection: 'row', padding: '6 12' },
  detailRow: { flexDirection: 'row', padding: '6 12', borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
  detailLabel: { width: 160, fontSize: 8.5, color: '#64748b' },
  detailValue: { flex: 1, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  detailValueCredit: { flex: 1, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#059669' },

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

const MOTIF_LABEL = {
  annulation: 'Annulation de facture',
  retour:     'Retour marchandise',
  commercial: 'Geste commercial',
}

export default function AvoirPDF({ avoir, facture, client, entreprise = {} }) {
  const E = entreprise
  const primary  = E.couleurPrimaire || '#0d2c6e'
  const devise   = E.devise || 'MAD'
  const tauxTVA  = Number(E.tva) || 0
  const montantHT  = Number(avoir.montant_ht) || 0
  const montantTTC = montantHT * (1 + tauxTVA / 100)

  const footerTxt = E.piedDePage || [E.nom, E.adresse, E.ville].filter(Boolean).join('  —  ')

  return (
    <Document title={`Avoir ${avoir.numero}`} author={E.nom || 'Avoir'}>
      <Page size="A4" style={s.page}>

        {/* EN-TÊTE */}
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

        <View style={[s.separator, { backgroundColor: '#059669' }]} />

        {/* DATE + DESTINATAIRE */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={s.recipientBox}>
            <Text style={s.recipientLabel}>Destinataire</Text>
            <Text style={s.recipientName}>{client?.nom || '—'}</Text>
            {client?.adresse   && <Text style={s.recipientLine}>{client.adresse}</Text>}
            {client?.ville     && <Text style={s.recipientLine}>{client.ville}</Text>}
            {client?.telephone && <Text style={s.recipientLine}>{client.telephone}</Text>}
            {client?.mail      && <Text style={s.recipientLine}>{client.mail}</Text>}
          </View>
          <View style={s.dateBlock}>
            <Text style={s.dateText}>{E.ville ? `${E.ville}, ` : ''}{fmtDate(avoir.date)}</Text>
          </View>
        </View>

        {/* BADGE TITRE */}
        <View style={[s.titleBadge, { backgroundColor: '#059669' }]}>
          <Text style={s.titleText}>NOTE DE CRÉDIT / AVOIR</Text>
        </View>

        {/* OBJET */}
        <View style={s.subjectRow}>
          <Text style={s.subjectLabel}>Objet :</Text>
          <Text style={s.subjectText}>
            Avoir N° {avoir.numero} — en référence à la facture N° {facture?.numero}
          </Text>
        </View>

        {/* CORPS */}
        <Text style={s.bodyText}>Madame, Monsieur,</Text>
        <Text style={s.bodyText}>
          Nous vous adressons la présente note de crédit en lien avec la facture N° {facture?.numero}{' '}
          du {fmtDate(facture?.date_emission)}. Veuillez trouver ci-dessous le détail de cet avoir.
        </Text>

        {/* DÉTAIL */}
        <View style={s.detailBox}>
          <View style={[s.detailHead, { backgroundColor: '#059669' }]}>
            <Text style={[s.detailLabel, { color: '#fff', fontFamily: 'Helvetica-Bold' }]}>Détail de l'avoir</Text>
            <Text style={[s.detailValue, { color: '#fff' }]}> </Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Numéro de l'avoir</Text>
            <Text style={s.detailValue}>{avoir.numero}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Date d'émission</Text>
            <Text style={s.detailValue}>{fmtDate(avoir.date)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Facture d'origine</Text>
            <Text style={s.detailValue}>{facture?.numero} du {fmtDate(facture?.date_emission)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Motif</Text>
            <Text style={s.detailValue}>{MOTIF_LABEL[avoir.motif] || avoir.motif}</Text>
          </View>
          {avoir.notes && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Note</Text>
              <Text style={s.detailValue}>{avoir.notes}</Text>
            </View>
          )}
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
          <View style={[s.detailRow, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[s.detailLabel, { fontFamily: 'Helvetica-Bold' }]}>TOTAL AVOIR TTC</Text>
            <Text style={s.detailValueCredit}>{fmt(montantTTC)} {devise}</Text>
          </View>
        </View>

        {/* CLÔTURE */}
        <Text style={s.closing}>
          Cet avoir pourra être déduit de votre prochaine facture ou faire l'objet d'un remboursement selon nos modalités convenues.{'\n\n'}
          Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.
        </Text>

        {/* SIGNATURE */}
        <View style={s.sigBlock}>
          <Text style={[s.sigName, { color: primary }]}>{E.nom || ''}</Text>
          {E.telephone && <Text style={s.sigLine}>{E.telephone}</Text>}
          {E.email     && <Text style={s.sigLine}>{E.email}</Text>}
        </View>

        {/* FOOTER */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerTxt}</Text>
          <Text style={s.footerText}>Note de crédit — {fmtDate(avoir.date)}</Text>
        </View>

      </Page>
    </Document>
  )
}

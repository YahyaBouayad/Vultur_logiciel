import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { montantEnLettres } from '../../utils/montantEnLettres'

// Facture simplifiée de l'officine (modèle carnet de la pharmacie) pour les traitements Hulio

const B = '0.8 solid #000'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: '#000', padding: '36 40 30' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  officine: { width: '52%' },
  officineNom: { fontFamily: 'Times-Bold', fontSize: 11, textTransform: 'uppercase' },
  officineLine: { fontFamily: 'Times-Bold', fontSize: 9.5, marginTop: 2 },
  logo: { height: 70, maxWidth: 230, objectFit: 'contain', objectPositionX: 0, marginBottom: 6 },
  droite: { width: '40%', alignItems: 'flex-end' },
  date: { fontFamily: 'Times-Bold', fontSize: 10, marginBottom: 18 },
  dateValeur: { fontFamily: 'Helvetica', fontSize: 11 },
  // Largeur relative : une largeur fixe débordait sur le logo
  clientBox: { width: '100%', minHeight: 60, border: B, padding: '10 12', justifyContent: 'center' },
  clientNom: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', lineHeight: 1.5 },

  numero: { marginTop: 10, marginLeft: 70, fontSize: 12 },
  numeroValeur: { fontFamily: 'Helvetica-Bold' },

  table: { marginTop: 18, borderTop: B, borderLeft: B },
  row: { flexDirection: 'row' },
  th: { borderRight: B, borderBottom: B, padding: '4 5', fontSize: 10.5 },
  td: { borderRight: B, borderBottom: B, padding: '8 5', height: 190, fontSize: 11 },
  num: { textAlign: 'right' },

  bas: { flexDirection: 'row' },
  cachetZone: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  cachet: { maxHeight: 62, maxWidth: 120, objectFit: 'contain' },
  totaux: { width: '54%', borderLeft: B },  // aligné sur Quantité + P.U. | Total
  totalRow: { flexDirection: 'row', borderBottom: B },
  totalLabel: { width: '63%', borderRight: B, padding: '6 5', fontSize: 11 },
  totalVal: { width: '37%', borderRight: B, padding: '6 5', fontSize: 11, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  arrete: { border: B, padding: '7 6', marginTop: 4, minHeight: 46 },
  arreteLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },

  signature: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  signImg: { maxHeight: 70, maxWidth: 140, objectFit: 'contain' },

  footer: { position: 'absolute', left: 40, right: 40, bottom: 34, borderTop: '1.2 solid #000', paddingTop: 6 },
  footerLine: { textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 3 },
})

// Désignation / Quantité / P.U. / Total
const COLS = ['46%', '16%', '18%', '20%']

const fmt = (n) => Number(n || 0).toFixed(2).replace('.', ',')

const fmtDateCourte = (d) => {
  if (!d) return ''
  const [y, m, j] = String(d).slice(0, 10).split('-')
  return `${j}/${m}/${y.slice(-2)}`
}

// Assemble « Libellé valeur » en ignorant les valeurs vides
const join = (parts) => parts.filter(([, v]) => v).map(([l, v]) => `${l} ${v}`).join(' / ')

export function FactureHulioSimplePage({ facture, entreprise = {} }) {
  const E = entreprise
  const h = facture.hulio || {}
  const qte = Number(h.quantite || 0)
  const pu = Number(h.ppm || 0)
  const total = qte * pu

  const nom = E.officineNom || E.nom
  const adresse = E.officineAdresse || E.adresse
  const ville = E.officineVille || E.ville
  const tels = (E.officineTelephone || E.telephone || '').split(/\s*[/,;]\s*/).filter(Boolean)

  const ligne1 = join([['Patente N°', E.officinePatente], ['R.C.', E.officineRc || E.rc], ['I.F.', E.officineIf]])
  const ligne2 = join([['C.N.S.S.', E.officineCnss], ['I.C.E.', E.officineIce], ['RIB:', E.officineRib]])

  return (
    <Page size="A4" style={s.page}>
      {/* ── En-tête : officine / logo / date + client ── */}
      <View style={s.header}>
        <View style={s.officine}>
          {/* Logo en haut à gauche ; il porte déjà le nom de la pharmacie : nom affiché seulement sans logo */}
          {E.officineLogo
            ? <Image src={E.officineLogo} style={s.logo} />
            : nom && <Text style={s.officineNom}>{nom}</Text>}
          {E.officinePharmacien && <Text style={s.officineLine}>{E.officinePharmacien}</Text>}
          {adresse && <Text style={s.officineLine}>{adresse}{ville && !adresse.includes(ville) ? ` ${ville}` : ''}</Text>}
          {tels.map((t, i) => (
            <Text key={i} style={s.officineLine}>{i === 0 ? 'Tél: ' : '        '}{t}</Text>
          ))}
        </View>

        <View style={s.droite}>
          <Text style={s.date}>
            {ville ? `${ville} le : ` : 'Le : '}<Text style={s.dateValeur}>{fmtDateCourte(facture.date_emission)}</Text>
          </Text>
          <View style={s.clientBox}>
            <Text style={s.clientNom}>{h.beneficiaire_nom || ''}</Text>
          </View>
        </View>
      </View>

      <Text style={s.numero}>FACTURE N° : <Text style={s.numeroValeur}>{facture.numero}</Text></Text>

      {/* ── Tableau ── */}
      <View style={s.table}>
        <View style={s.row}>
          {['Désignation', 'Quantité', 'P.U.', 'Total'].map((t, i) => (
            <View key={t} style={[s.th, { width: COLS[i] }]}><Text>{t}</Text></View>
          ))}
        </View>
        <View style={s.row}>
          <View style={[s.td, { width: COLS[0] }]}><Text>{h.designation}</Text></View>
          <View style={[s.td, { width: COLS[1] }]}><Text style={{ textAlign: 'center' }}>{qte}</Text></View>
          <View style={[s.td, { width: COLS[2] }]}><Text style={s.num}>{fmt(pu)}</Text></View>
          <View style={[s.td, { width: COLS[3] }]}><Text style={s.num}>{fmt(total)}</Text></View>
        </View>
      </View>

      {/* ── Cachet + totaux ── */}
      <View style={s.bas}>
        <View style={s.cachetZone}>
          {E.cachet && <Image src={E.cachet} style={s.cachet} />}
        </View>
        <View style={s.totaux}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TOTAL</Text>
            <Text style={s.totalVal}>{fmt(total)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Montant net à payer</Text>
            <Text style={s.totalVal}>{fmt(total)}</Text>
          </View>
        </View>
      </View>

      <View style={s.arrete}>
        <Text>
          <Text style={s.arreteLabel}>Arrêtée la présente facture à la somme de : </Text>
          {montantEnLettres(total)}
        </Text>
      </View>

      <View style={s.signature}>
        {E.signature && <Image src={E.signature} style={s.signImg} />}
      </View>

      {/* ── Pied de page : identifiants de l'officine ── */}
      <View style={s.footer} fixed>
        {ligne1 && <Text style={s.footerLine}>{ligne1}</Text>}
        {ligne2 && <Text style={s.footerLine}>{ligne2}</Text>}
      </View>
    </Page>
  )
}

export default function FactureHulioSimplePDF({ facture, entreprise = {} }) {
  return (
    <Document title={facture.numero} author={entreprise.officineNom || entreprise.nom || 'Facture'}>
      <FactureHulioSimplePage facture={facture} entreprise={entreprise} />
    </Document>
  )
}

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { montantEnLettres } from '../../utils/montantEnLettres'
import { calculHulio } from '../../utils/hulio'

// Reproduction du formulaire ANAM « Convention tiers payant médicaments » (Réf ANAM : 1.3.72.01)

const B = '0.8 solid #000'

const s = StyleSheet.create({
  page: { fontFamily: 'Times-Roman', fontSize: 9, color: '#000', padding: '28 36 24' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 8 },
  center: { textAlign: 'center' },
  convention: { textAlign: 'center', fontSize: 10, marginTop: 6 },
  titre: { textAlign: 'center', fontSize: 14, fontFamily: 'Times-Bold', marginTop: 4, marginBottom: 8 },

  box: { borderTop: B, borderLeft: B },
  row: { flexDirection: 'row' },
  cell: { borderRight: B, borderBottom: B, padding: '3 4' },
  label: { width: '45%' },
  value: { width: '55%', fontFamily: 'Times-Bold' },

  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 8, height: 8, border: B, marginRight: 3, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginTop: -1 },

  th: { fontSize: 8.5, padding: '3 3', justifyContent: 'center' },
  td: { fontSize: 9, padding: '3 3', textAlign: 'right', justifyContent: 'center', height: 26 },
  tdLeft: { textAlign: 'left' },

  sign: { height: 70, padding: 4, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  signImg: { maxHeight: 62, maxWidth: 110, objectFit: 'contain' },

  notice: { fontSize: 7.5, marginTop: 12, lineHeight: 1.35 },
  footer: { fontSize: 7.5, marginTop: 4 },
})

// Largeurs du tableau médicaments (identiques au modèle : 7 colonnes égales)
const COLS = ['16%', '12%', '12%', '12%', '14%', '17%', '17%']

const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)
  ? ''
  : Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' '))

const fmtDate = (d) => {
  if (!d) return ['____', '____', '______']
  const [y, m, j] = String(d).slice(0, 10).split('-')
  return [j, m, y]
}

const fill = (v) => v || ''

function Check({ checked, label }) {
  return (
    <View style={s.checkRow}>
      <View style={s.checkbox}>{checked && <Text style={s.checkMark}>X</Text>}</View>
      <Text>{label}</Text>
    </View>
  )
}

function InfoRow({ label, children }) {
  return (
    <View style={s.row}>
      <View style={[s.cell, s.label]}>{typeof label === 'string' ? <Text>{label}</Text> : label}</View>
      <View style={[s.cell, s.value]}>{typeof children === 'string' ? <Text>{children}</Text> : children}</View>
    </View>
  )
}

export function FactureHulioPage({ facture, entreprise = {} }) {
  const E = entreprise
  const h = facture.hulio || {}
  const { qte, total, og, reste } = calculHulio(h)
  const org = (h.organisme || '').toUpperCase()
  const [jj, mm, aaaa] = fmtDate(facture.date_emission)

  const officine = {
    nom: E.officineNom || E.nom,
    adresse: E.officineAdresse || E.adresse,
    ville: E.officineVille || E.ville,
    tel: E.officineTelephone || E.telephone,
    rc: E.officineRc || E.rc,
  }

  const ligne = [
    h.designation,
    String(qte),
    fmt(Number(h.ppm)),
    h.pbr !== null && h.pbr !== undefined ? fmt(Number(h.pbr)) : '',
    h.taux_prise_en_charge !== null && h.taux_prise_en_charge !== undefined ? `${Number(h.taux_prise_en_charge)} %` : '',
    fmt(og),
    fmt(reste),
  ]

  return (
    <Page size="A4" style={s.page}>
      <View style={s.topRow}>
        <View>
          <Text>Assurance Maladie Obligatoire</Text>
          <Text style={{ marginTop: 2 }}>Officine conventionnée</Text>
        </View>
        <Text>Réf ANAM : 1.3.72.01</Text>
      </View>

      <Text style={s.convention}>Convention tiers payant médicaments</Text>
      <Text style={s.titre}>FACTURE MEDICAMENTS</Text>

      {/* ── Identification ── */}
      <View style={s.box}>
        <InfoRow label="Nom de l'officine :">{fill(officine.nom)}</InfoRow>
        <InfoRow label="N° de la facture :">{facture.numero}</InfoRow>
        <InfoRow label="N° de prise en charge :">{fill(h.numero_prise_en_charge)}</InfoRow>
        <InfoRow label="Nom et prénom de l'assuré :">{fill(h.assure_nom)}</InfoRow>
        <InfoRow label="Nom et prénom du bénéficiaire :">{fill(h.beneficiaire_nom)}</InfoRow>
        <InfoRow label={
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Text>Organisme Gestionnaire :</Text>
            <Check checked={org === 'CNOPS'} label="CNOPS" />
            <Check checked={org === 'CNSS'} label="CNSS" />
          </View>
        }>
          {org && org !== 'CNOPS' && org !== 'CNSS' ? h.organisme : ''}
        </InfoRow>
        <InfoRow label="N° d'immatriculation de l'assuré :">{fill(h.immatriculation)}</InfoRow>
        <InfoRow label="INPE du pharmacien :">{fill(E.officineInpe)}</InfoRow>
      </View>

      {/* ── Médicaments ── */}
      <View style={[s.box, { marginTop: 14 }]}>
        <View style={s.row}>
          {['Médicament\n(Nom commercial)', 'Quantité', 'PPM', 'PBR', 'Taux de prise en charge',
            "Montant pris en charge par l'O.G (en DH)", "Montant restant à la charge de l'assuré (en DH)"]
            .map((t, i) => (
              <View key={i} style={[s.cell, s.th, { width: COLS[i] }]}><Text>{t}</Text></View>
            ))}
        </View>
        {[ligne, null, null, null].map((l, r) => (
          <View key={r} style={s.row}>
            {COLS.map((w, i) => (
              <View key={i} style={[s.cell, s.td, { width: w }, i === 0 ? s.tdLeft : {}]}>
                <Text>{l ? l[i] : ''}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={s.row}>
          <View style={[s.cell, s.td, s.tdLeft, { width: COLS[0], height: 18 }]}><Text>Total :</Text></View>
          <View style={[s.cell, s.td, { width: COLS[1], height: 18 }]}><Text>{qte}</Text></View>
          <View style={[s.cell, s.td, { width: COLS[2], height: 18 }]}><Text>{fmt(total)}</Text></View>
          <View style={[s.cell, s.td, { width: COLS[3], height: 18 }]} />
          <View style={[s.cell, s.td, { width: COLS[4], height: 18 }]} />
          <View style={[s.cell, s.td, { width: COLS[5], height: 18 }]}><Text>{fmt(og)}</Text></View>
          <View style={[s.cell, s.td, { width: COLS[6], height: 18 }]}><Text>{fmt(reste)}</Text></View>
        </View>
      </View>

      {/* ── Montants ── */}
      <View style={[s.box, { marginTop: 14 }]}>
        <View style={s.row}>
          <View style={[s.cell, { width: '100%' }]}>
            <Text>
              Arrêté la présente facture à la somme de (en DH et en toutes lettres) :{' '}
              <Text style={{ fontFamily: 'Times-Bold' }}>{montantEnLettres(total)}</Text>
            </Text>
          </View>
        </View>
        <View style={s.row}>
          <View style={[s.cell, { width: '100%' }]}>
            <Text>Montant pris en charge par l'Organisme Gestionnaire : <Text style={{ fontFamily: 'Times-Bold' }}>{og === null ? '' : `${fmt(og)} DH`}</Text></Text>
          </View>
        </View>
        <View style={s.row}>
          <View style={[s.cell, { width: '100%' }]}>
            <Text>Montant restant à la charge de l'assuré : <Text style={{ fontFamily: 'Times-Bold' }}>{reste === null ? '' : `${fmt(reste)} DH`}</Text></Text>
          </View>
        </View>
      </View>

      {/* ── Lieu, date, signatures ── */}
      <View style={[s.box, { marginTop: 14 }]}>
        <View style={s.row}>
          <View style={[s.cell, { width: '50%' }]}><Text>Fait à :</Text></View>
          <View style={[s.cell, { width: '50%' }]}><Text style={{ fontFamily: 'Times-Bold' }}>{fill(officine.ville)}</Text></View>
        </View>
        <View style={s.row}>
          <View style={[s.cell, { width: '50%' }]}>
            <Text>Date d'établissement de la facture correspondant à la délivrance des médicaments :  {jj} / {mm} / {aaaa}</Text>
          </View>
          <View style={[s.cell, { width: '50%' }]} />
        </View>
        <View style={s.row}>
          <View style={[s.cell, { width: '50%' }]}><Text>Signature de l'assuré ou du bénéficiaire :</Text></View>
          <View style={[s.cell, { width: '50%' }]}><Text>Signature du pharmacien et cachet de l'officine :</Text></View>
        </View>
        <View style={s.row}>
          <View style={[s.cell, s.sign, { width: '50%' }]} />
          <View style={[s.cell, s.sign, { width: '50%' }]}>
            {E.signature && <Image src={E.signature} style={s.signImg} />}
            {E.cachet && <Image src={E.cachet} style={s.signImg} />}
          </View>
        </View>
      </View>

      {/* ── Mentions ── */}
      <View style={s.notice}>
        <Text>
          Pour le déboursement des frais, veuillez joindre à cette facture les pièces suivantes et les déposer au niveau de la représentation de l'Organisme Gestionnaire concerné dans un délai ne dépassant pas 3 mois à compter de la date de délivrance des médicaments :
        </Text>
        <Text>- L'original de l'attestation de prise en charge des médicaments</Text>
        <Text>- L'original de l'ordonnance (sous réserve des dispositions de l'article 4 de la convention)</Text>
        <Text>- Les Prix Public Maroc et les codes des médicaments (à détacher et coller sur la présente facture)</Text>
      </View>
      <Text style={s.footer}>
        Patente : {fill(E.officinePatente) || '__________'}     RC : {fill(officine.rc) || '__________'}     IF : {fill(E.officineIf) || '__________'}     CNSS : {fill(E.officineCnss) || '__________'}
      </Text>
      <Text style={s.footer}>
        Adresse : {fill(officine.adresse) || '______________________________'}     Tél. : {fill(officine.tel) || '__________'}     Fax : {fill(E.officineFax) || '__________'}
      </Text>
    </Page>
  )
}

export default function FactureHulioPDF({ facture, entreprise = {} }) {
  return (
    <Document title={facture.numero} author={entreprise.officineNom || entreprise.nom || 'Facture'}>
      <FactureHulioPage facture={facture} entreprise={entreprise} />
    </Document>
  )
}

import { useState, useEffect, useMemo } from 'react'
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, AutoComplete,
  DatePicker, Space, Typography, message, Popconfirm, Tag, Tooltip, Drawer,
  Progress, Row, Col, Card, Statistic, Empty, Divider, Segmented,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, PhoneOutlined,
  CalendarOutlined, BellOutlined, WarningOutlined, UserOutlined, RollbackOutlined,
  StopOutlined, MinusCircleOutlined, ThunderboltOutlined, EyeOutlined, UndoOutlined,
  HistoryOutlined, InboxOutlined, FilePdfOutlined, ExportOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import dayjs from 'dayjs'
import api from '../api/axios'
import { useSettings } from '../context/SettingsContext'
import FactureHulioPDF from '../components/pdf/FactureHulioPDF'
import { calculHulio, champsManquantsHulio } from '../utils/hulio'

const { Title, Text } = Typography

const RAPPEL_JOURS = 3 // décalage par défaut du rappel avant la livraison (répartition auto)

const PATHOLOGIES = [
  'Polyarthrite rhumatoïde', 'Spondylarthrite ankylosante', 'Rhumatisme psoriasique',
  'Psoriasis en plaques', 'Maladie de Crohn', 'Rectocolite hémorragique',
  'Uvéite', 'Hidradénite suppurée', 'Arthrite juvénile idiopathique',
]
const REMBOURSEMENTS = ['AMO-CNSS', 'CNOPS', 'AMO Tadamon', 'Assurance privée', 'Sans couverture']

const STATUT_TRAITEMENT = {
  en_cours: { label: 'En cours', color: 'processing' },
  termine:  { label: 'Terminé',  color: 'success' },
  arrete:   { label: 'Arrêté',   color: 'default' },
}

const fmt = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—')
const iso = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null)
const toOptions = (arr) => arr.map(v => ({ value: v }))

// État d'une livraison prévue par rapport à aujourd'hui
function etatLivraison(l) {
  if (l.statut === 'livrée')  return { label: `Livrée le ${fmt(l.date_livraison)}`, color: 'success' }
  if (l.statut === 'annulée') return { label: 'Annulée', color: 'default' }
  const today = dayjs().startOf('day')
  const d = dayjs(l.date_prevue)
  if (d.isBefore(today)) return { label: `En retard (${today.diff(d, 'day')} j)`, color: 'error' }
  if (l.date_rappel && !dayjs(l.date_rappel).isAfter(today)) return { label: 'Rappel', color: 'warning' }
  if (d.isSame(today)) return { label: "Aujourd'hui", color: 'warning' }
  return { label: `Dans ${d.diff(today, 'day')} j`, color: 'blue' }
}

// Répartit `total` boîtes entre `debut` et `fin` (ou une livraison par mois sans date de fin)
function repartir(debut, fin, total, parLivraison = 1) {
  const n = Math.max(1, Math.ceil(total / Math.max(1, parLivraison)))
  const start = dayjs(debut)
  const pas = fin ? Math.max(1, dayjs(fin).diff(start, 'day')) / n : 30
  return Array.from({ length: n }, (_, i) => {
    const date = start.add(Math.round(i * pas), 'day')
    const boites = i === n - 1 ? total - parLivraison * (n - 1) : parLivraison
    return { date_prevue: date, date_rappel: date.subtract(RAPPEL_JOURS, 'day'), nombre_boites: boites }
  })
}

const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }

// Aperçu en direct des montants de la facture ANAM pendant la saisie
function ApercuMontants({ form }) {
  const h = {
    quantite: Form.useWatch('quantite', form),
    ppm: Form.useWatch('ppm', form),
    pbr: Form.useWatch('pbr', form),
    taux_prise_en_charge: Form.useWatch('taux_prise_en_charge', form),
  }
  const { total, og, reste } = calculHulio(h)
  return (
    <div style={{ display: 'flex', gap: 24, background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
      <span><Text type="secondary">Total : </Text><Text strong>{total.toFixed(2)} DH</Text></span>
      <span><Text type="secondary">Organisme : </Text><Text strong>{og === null ? '—' : `${og.toFixed(2)} DH`}</Text></span>
      <span><Text type="secondary">Assuré : </Text><Text strong>{reste === null ? '—' : `${reste.toFixed(2)} DH`}</Text></span>
    </div>
  )
}

export default function SuiviHulio() {
  const [traitements, setTraitements] = useState([])
  const [clients, setClients]         = useState([])
  const [produits, setProduits]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [activeTab, setActiveTab]     = useState('livraisons')
  const [periode, setPeriode]         = useState('30')
  const [filtreStatut, setFiltreStatut] = useState('en_cours')
  const [search, setSearch]           = useState('')

  // Modale traitement (création / modification)
  const [tModal, setTModal]           = useState(false)
  const [editing, setEditing]         = useState(null)
  const [tSaving, setTSaving]         = useState(false)
  const [lignes, setLignes]           = useState([])
  const [parLivraison, setParLivraison] = useState(1)
  const [tForm] = Form.useForm()

  // Modale nouveau patient
  const [pModal, setPModal]   = useState(false)
  const [pSaving, setPSaving] = useState(false)
  const [pForm] = Form.useForm()

  // Modale livraison (livrer / modifier / ajouter)
  const [lModal, setLModal]   = useState(null) // { mode: 'livrer'|'edit'|'add', livraison?, traitementId? }
  const [lSaving, setLSaving] = useState(false)
  const [lForm] = Form.useForm()

  // Stock Hulio : ajout d'un produit suivi, entrée de stock, historique
  const [ajoutProduitId, setAjoutProduitId] = useState(null)
  const [ajoutModal, setAjoutModal]         = useState(false)
  const [entreeProduit, setEntreeProduit]   = useState(null)
  const [entreeSaving, setEntreeSaving]     = useState(false)
  const [entreeForm] = Form.useForm()
  const [mvtProduit, setMvtProduit]         = useState(null)
  const [mouvements, setMouvements]         = useState([])
  const [mvtLoading, setMvtLoading]         = useState(false)

  // Prix PPM / PBR d'un produit Hulio
  const [prixProduit, setPrixProduit] = useState(null)
  const [prixSaving, setPrixSaving]   = useState(false)
  const [prixForm] = Form.useForm()

  // Factures : création complémentaire / complétion avant PDF
  const [fModal, setFModal]     = useState(null) // { mode: 'new', traitement } | { mode: 'edit', facture }
  const [fSaving, setFSaving]   = useState(false)
  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [fForm] = Form.useForm()

  const navigate = useNavigate()
  const { settings } = useSettings()

  // Détail traitement
  const [detailId, setDetailId] = useState(null)
  const detail = traitements.find(t => t.id === detailId) || null

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [t, c, p] = await Promise.all([
        api.get('/hulio/traitements'),
        api.get('/clients'),
        api.get('/produits'),
      ])
      setTraitements(t.data)
      setClients(c.data.filter(x => x.type_client === 'hulio'))
      setProduits(p.data)
    } catch {
      message.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  // Recharge aussi les produits : une livraison modifie le stock affiché dans « Stock Hulio »
  const reloadTraitements = async () => {
    const [t, p] = await Promise.all([api.get('/hulio/traitements'), api.get('/produits')])
    setTraitements(t.data)
    setProduits(p.data)
  }

  useEffect(() => { fetchAll() }, [])

  // Produits configurés dans l'onglet « Stock Hulio » : seuls proposés dans les traitements
  const produitsHulio = useMemo(() => produits.filter(p => p.suivi_hulio), [produits])

  // Suivi de stock par produit Hulio : réservé par les livraisons prévues, date de rupture prévisionnelle
  const stockHulio = useMemo(() => {
    const today = dayjs().startOf('day')
    return produitsHulio.map(p => {
      const enCours = traitements.filter(t => t.produit_id === p.id && t.statut === 'en_cours')
      const prevues = enCours
        .flatMap(t => t.livraisons.filter(l => l.statut === 'prévue'))
        .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue))
      const stock = parseFloat(p.stock)
      const reserve = prevues.reduce((s, l) => s + l.nombre_boites, 0)
      const besoin30 = prevues
        .filter(l => dayjs(l.date_prevue).diff(today, 'day') <= 30)
        .reduce((s, l) => s + l.nombre_boites, 0)
      let cumul = 0
      const rupture = prevues.find(l => (cumul += l.nombre_boites) > stock)
      return {
        ...p,
        stockNum: stock,
        reserve,
        besoin30,
        apres: stock - reserve,
        dateRupture: rupture?.date_prevue || null,
        patients: new Set(enCours.map(t => t.client_id)).size,
      }
    })
  }, [produitsHulio, traitements])

  // Suggestions issues des saisies précédentes + listes par défaut
  const suggestions = useMemo(() => {
    const uniq = (key, base = []) => [...new Set([...base, ...traitements.map(t => t[key]).filter(Boolean)])]
    return {
      pathologie: toOptions(uniq('pathologie', PATHOLOGIES)),
      remboursement: toOptions(uniq('nature_remboursement', REMBOURSEMENTS)),
      centre: toOptions(uniq('centre_mutuelle')),
    }
  }, [traitements])

  // ── Données dérivées ──────────────────────────────────────────────────────

  const livraisonsAVenir = useMemo(() => {
    const today = dayjs().startOf('day')
    const limite = periode === 'tout' ? null : today.add(Number(periode), 'day')
    return traitements
      .filter(t => t.statut === 'en_cours')
      .flatMap(t => t.livraisons
        .filter(l => l.statut === 'prévue')
        .map(l => ({ ...l, traitement: t })))
      .filter(l => {
        const d = dayjs(l.date_prevue)
        // Toujours afficher les retards et les rappels échus
        if (d.isBefore(today)) return true
        if (l.date_rappel && !dayjs(l.date_rappel).isAfter(today)) return true
        return !limite || !d.isAfter(limite)
      })
      .filter(l => !search || l.traitement.client_nom.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue))
  }, [traitements, periode, search])

  const kpis = useMemo(() => {
    const today = dayjs().startOf('day')
    const enCours = traitements.filter(t => t.statut === 'en_cours')
    const prevues = enCours.flatMap(t => t.livraisons.filter(l => l.statut === 'prévue'))
    return {
      patients: new Set(enCours.map(t => t.client_id)).size,
      semaine: prevues.filter(l => { const d = dayjs(l.date_prevue); return !d.isBefore(today) && d.diff(today, 'day') <= 7 }).length,
      retards: prevues.filter(l => dayjs(l.date_prevue).isBefore(today)).length,
      rappels: prevues.filter(l => !dayjs(l.date_prevue).isBefore(today) && l.date_rappel && !dayjs(l.date_rappel).isAfter(today)).length,
      finProche: enCours.filter(t => t.date_fin && dayjs(t.date_fin).diff(today, 'day') <= 30).length,
    }
  }, [traitements])

  const traitementsFiltres = useMemo(() => traitements
    .filter(t => !filtreStatut || t.statut === filtreStatut)
    .filter(t => !search || t.client_nom.toLowerCase().includes(search.toLowerCase())
      || (t.pathologie || '').toLowerCase().includes(search.toLowerCase())),
  [traitements, filtreStatut, search])

  // ── Patient ───────────────────────────────────────────────────────────────

  const savePatient = async (values) => {
    setPSaving(true)
    try {
      const r = await api.post('/clients', { ...values, type_client: 'hulio', ice: null })
      setClients(prev => [...prev, r.data])
      tForm.setFieldValue('client_id', r.data.id)
      message.success('Patient ajouté')
      setPModal(false)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setPSaving(false)
    }
  }

  // ── Traitement ────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null)
    tForm.resetFields()
    tForm.setFieldsValue({ date_debut: dayjs(), produit_id: produitsHulio[0]?.id })
    setLignes([])
    setParLivraison(1)
    setTModal(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    tForm.resetFields()
    tForm.setFieldsValue({
      ...t,
      date_debut: dayjs(t.date_debut),
      date_fin: t.date_fin ? dayjs(t.date_fin) : null,
    })
    setTModal(true)
  }

  // Durée (mois) → date de fin calculée, modifiable ensuite
  const onDureeChange = (duree) => {
    const debut = tForm.getFieldValue('date_debut')
    if (debut && duree) tForm.setFieldValue('date_fin', dayjs(debut).add(duree, 'month'))
  }
  const onDebutChange = (debut) => {
    const duree = tForm.getFieldValue('duree_mois')
    if (debut && duree) tForm.setFieldValue('date_fin', dayjs(debut).add(duree, 'month'))
  }

  const repartirAuto = () => {
    const { date_debut, date_fin, nombre_boites } = tForm.getFieldsValue()
    if (!date_debut || !nombre_boites) {
      message.warning('Renseignez la date de début et le nombre de boîtes')
      return
    }
    setLignes(repartir(date_debut, date_fin, nombre_boites, parLivraison))
  }

  const updateLigne = (idx, field, value) => {
    setLignes(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const next = { ...l, [field]: value }
      // Décaler le rappel avec la date prévue s'il suivait l'écart par défaut
      if (field === 'date_prevue' && value && l.date_prevue && l.date_rappel) {
        const ecart = dayjs(l.date_prevue).diff(dayjs(l.date_rappel), 'day')
        next.date_rappel = dayjs(value).subtract(ecart, 'day')
      }
      return next
    }))
  }

  const saveTraitement = async (values) => {
    if (!editing && lignes.some(l => !l.date_prevue || !l.nombre_boites)) {
      message.error('Chaque livraison doit avoir une date et un nombre de boîtes')
      return
    }
    setTSaving(true)
    const payload = {
      ...values,
      date_debut: iso(values.date_debut),
      date_fin: iso(values.date_fin),
      duree_mois: values.duree_mois ?? null,
      pathologie: values.pathologie || null,
      nature_remboursement: values.nature_remboursement || null,
      centre_mutuelle: values.centre_mutuelle || null,
      notes: values.notes || null,
    }
    try {
      if (editing) {
        await api.put(`/hulio/traitements/${editing.id}`, payload)
        message.success('Traitement modifié')
      } else {
        payload.livraisons = lignes.map(l => ({
          date_prevue: iso(l.date_prevue),
          date_rappel: iso(l.date_rappel),
          nombre_boites: l.nombre_boites,
        }))
        payload.facture_quantite = values.facture_quantite || null
        payload.facture_taux_prise_en_charge = values.facture_taux_prise_en_charge ?? null
        await api.post('/hulio/traitements', payload)
        message.success(payload.facture_quantite ? 'Traitement et facture créés' : 'Traitement créé')
      }
      setTModal(false)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setTSaving(false)
    }
  }

  // ── Factures ──────────────────────────────────────────────────────────────

  const openNouvelleFacture = (t) => {
    fForm.resetFields()
    fForm.setFieldsValue({ quantite: 1, date_emission: dayjs() })
    setFModal({ mode: 'new', traitement: t })
  }

  const openCompleterFacture = (f) => {
    fForm.resetFields()
    fForm.setFieldsValue({
      ...f.hulio,
      date_emission: dayjs(f.date_emission),
      notes: f.notes,
    })
    setFModal({ mode: 'edit', facture: f })
  }

  const telechargerFacture = async (f) => {
    setPdfLoadingId(f.id)
    try {
      const blob = await pdf(<FactureHulioPDF facture={f} entreprise={settings} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${f.numero.replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Erreur lors de la génération du PDF')
    } finally {
      setPdfLoadingId(null)
    }
  }

  // Avant le PDF : proposer de compléter les champs manquants
  const imprimerFacture = (f) => {
    const manquants = champsManquantsHulio(f.hulio)
    if (manquants.length === 0) return telechargerFacture(f)
    Modal.confirm({
      title: 'Informations manquantes',
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>Ces champs seront vides sur la facture :</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>{manquants.map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      ),
      okText: 'Compléter',
      cancelText: 'Générer quand même',
      onOk: () => openCompleterFacture(f),
      onCancel: () => telechargerFacture(f),
      keyboard: false,
    })
  }

  const saveFacture = async (values, imprimer = false) => {
    setFSaving(true)
    try {
      if (fModal.mode === 'new') {
        await api.post(`/hulio/traitements/${fModal.traitement.id}/factures`, {
          quantite: values.quantite,
          date_emission: iso(values.date_emission),
          taux_prise_en_charge: values.taux_prise_en_charge ?? null,
          notes: values.notes || null,
        })
        message.success('Facture complémentaire créée')
      } else {
        const r = await api.put(`/hulio/factures/${fModal.facture.id}`, {
          date_emission: iso(values.date_emission),
          designation: values.designation,
          quantite: values.quantite,
          ppm: values.ppm,
          pbr: values.pbr ?? null,
          taux_prise_en_charge: values.taux_prise_en_charge ?? null,
          numero_prise_en_charge: values.numero_prise_en_charge || null,
          assure_nom: values.assure_nom || null,
          beneficiaire_nom: values.beneficiaire_nom || null,
          immatriculation: values.immatriculation || null,
          organisme: values.organisme || null,
          notes: values.notes || null,
        })
        message.success('Facture mise à jour')
        if (imprimer) telechargerFacture(r.data)
      }
      setFModal(null)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFSaving(false)
    }
  }

  const changerStatut = async (t, statut) => {
    try {
      await api.put(`/hulio/traitements/${t.id}`, { statut })
      message.success(`Traitement ${STATUT_TRAITEMENT[statut].label.toLowerCase()}`)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const supprimerTraitement = async (t) => {
    try {
      await api.delete(`/hulio/traitements/${t.id}`)
      message.success('Traitement supprimé')
      if (detailId === t.id) setDetailId(null)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const repartirRestantes = async (t) => {
    const restantes = t.nombre_boites - t.boites_planifiees
    if (restantes <= 0) return
    const dernieres = t.livraisons.filter(l => l.statut !== 'annulée').map(l => l.date_prevue).sort()
    const derniere = dernieres.length ? dayjs(dernieres[dernieres.length - 1]).add(1, 'day') : dayjs(t.date_debut)
    const debut = derniere.isBefore(dayjs(), 'day') ? dayjs() : derniere
    const fin = t.date_fin && dayjs(t.date_fin).isAfter(debut) ? t.date_fin : null
    const nouvelles = repartir(debut, fin, restantes, 1).map(l => ({
      date_prevue: iso(l.date_prevue), date_rappel: iso(l.date_rappel), nombre_boites: l.nombre_boites,
    }))
    try {
      await api.post(`/hulio/traitements/${t.id}/livraisons`, nouvelles)
      message.success(`${nouvelles.length} livraison(s) planifiée(s)`)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  // ── Livraisons ────────────────────────────────────────────────────────────

  const openLivrer = (l) => {
    lForm.resetFields()
    lForm.setFieldsValue({ date_livraison: dayjs() })
    setLModal({ mode: 'livrer', livraison: l })
  }
  const openEditLivraison = (l) => {
    lForm.resetFields()
    lForm.setFieldsValue({
      date_prevue: dayjs(l.date_prevue),
      date_rappel: l.date_rappel ? dayjs(l.date_rappel) : null,
      nombre_boites: l.nombre_boites,
      notes: l.notes,
    })
    setLModal({ mode: 'edit', livraison: l })
  }
  const openAddLivraison = (t) => {
    lForm.resetFields()
    lForm.setFieldsValue({ date_prevue: dayjs(), date_rappel: null, nombre_boites: 1 })
    setLModal({ mode: 'add', traitementId: t.id })
  }

  const saveLivraison = async (values) => {
    setLSaving(true)
    try {
      if (lModal.mode === 'livrer') {
        await api.post(`/hulio/livraisons/${lModal.livraison.id}/livrer`, { date_livraison: iso(values.date_livraison) })
        message.success('Livraison enregistrée — stock mis à jour')
      } else {
        const payload = {
          date_prevue: iso(values.date_prevue),
          date_rappel: iso(values.date_rappel),
          nombre_boites: values.nombre_boites,
          notes: values.notes || null,
        }
        if (lModal.mode === 'edit') {
          await api.put(`/hulio/livraisons/${lModal.livraison.id}`, payload)
          message.success('Livraison modifiée')
        } else {
          await api.post(`/hulio/traitements/${lModal.traitementId}/livraisons`, [payload])
          message.success('Livraison ajoutée')
        }
      }
      setLModal(null)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setLSaving(false)
    }
  }

  const actionLivraison = async (l, action, succes) => {
    try {
      if (action === 'delete') await api.delete(`/hulio/livraisons/${l.id}`)
      else await api.post(`/hulio/livraisons/${l.id}/${action}`)
      message.success(succes)
      reloadTraitements()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  // ── Stock Hulio ───────────────────────────────────────────────────────────

  const reloadProduits = async () => {
    const r = await api.get('/produits')
    setProduits(r.data)
  }

  const setSuiviHulio = async (produitId, actif) => {
    try {
      await api.put(`/produits/${produitId}`, { suivi_hulio: actif })
      message.success(actif ? 'Produit ajouté au suivi Hulio' : 'Produit retiré du suivi Hulio')
      setAjoutModal(false)
      setAjoutProduitId(null)
      reloadProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const openPrix = (p) => {
    prixForm.setFieldsValue({ prix: parseFloat(p.prix), pbr: p.pbr !== null && p.pbr !== undefined ? parseFloat(p.pbr) : null })
    setPrixProduit(p)
  }

  const savePrix = async (values) => {
    setPrixSaving(true)
    try {
      await api.put(`/produits/${prixProduit.id}`, { prix: values.prix, pbr: values.pbr ?? null })
      message.success('Prix mis à jour (nouvelles factures)')
      setPrixProduit(null)
      reloadProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setPrixSaving(false)
    }
  }

  const openEntree = (p) => {
    entreeForm.resetFields()
    entreeForm.setFieldsValue({ notes: 'Réception fournisseur' })
    setEntreeProduit(p)
  }

  const saveEntree = async (values) => {
    setEntreeSaving(true)
    try {
      await api.post('/stock/entree', { produit_id: entreeProduit.id, quantite: values.quantite, notes: values.notes || null })
      message.success(`${values.quantite} boîte(s) ajoutée(s) au stock`)
      setEntreeProduit(null)
      reloadProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setEntreeSaving(false)
    }
  }

  const openMouvements = async (p) => {
    setMvtProduit(p)
    setMvtLoading(true)
    try {
      const r = await api.get(`/stock/mouvements/${p.id}`)
      setMouvements(r.data)
    } catch {
      message.error('Erreur lors du chargement des mouvements')
    } finally {
      setMvtLoading(false)
    }
  }

  // Boutons d'action d'une livraison selon son statut
  const actionsLivraison = (l) => (
    <Space size={4}>
      {l.statut === 'prévue' && (
        <>
          <Tooltip title="Marquer livrée">
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openLivrer(l)}
              style={{ background: '#16a34a', borderColor: '#16a34a' }} />
          </Tooltip>
          <Tooltip title="Modifier / reporter">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditLivraison(l)} />
          </Tooltip>
          <Popconfirm title="Annuler cette livraison ?" description="Elle restera visible dans l'historique."
            onConfirm={() => actionLivraison(l, 'annuler', 'Livraison annulée')} okText="Oui" cancelText="Non">
            <Tooltip title="Annuler"><Button size="small" icon={<StopOutlined />} /></Tooltip>
          </Popconfirm>
        </>
      )}
      {l.statut === 'livrée' && (
        <Popconfirm title="Revenir sur cette livraison ?" description="Les boîtes seront remises en stock."
          onConfirm={() => actionLivraison(l, 'annuler-livraison', 'Livraison annulée — stock restauré')}
          okText="Oui" cancelText="Non">
          <Tooltip title="Annuler la livraison (remet le stock)"><Button size="small" icon={<RollbackOutlined />} /></Tooltip>
        </Popconfirm>
      )}
      {l.statut === 'annulée' && (
        <Tooltip title="Rétablir">
          <Button size="small" icon={<UndoOutlined />} onClick={() => actionLivraison(l, 'retablir', 'Livraison rétablie')} />
        </Tooltip>
      )}
      {l.statut !== 'livrée' && (
        <Popconfirm title="Supprimer cette livraison ?" onConfirm={() => actionLivraison(l, 'delete', 'Livraison supprimée')}
          okText="Oui" cancelText="Non" okButtonProps={{ danger: true }}>
          <Tooltip title="Supprimer"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      )}
    </Space>
  )

  // ── Colonnes ──────────────────────────────────────────────────────────────

  const livraisonColumns = [
    {
      title: 'Date prévue', key: 'date', width: 120,
      render: (_, l) => <Text strong>{fmt(l.date_prevue)}</Text>,
    },
    {
      title: 'État', key: 'etat', width: 150,
      render: (_, l) => { const e = etatLivraison(l); return <Tag color={e.color}>{e.label}</Tag> },
    },
    {
      title: 'Patient', key: 'patient',
      render: (_, l) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setDetailId(l.traitement.id)}>
          {l.traitement.client_nom}
        </Button>
      ),
    },
    {
      title: 'Téléphone', key: 'tel', width: 150,
      render: (_, l) => l.traitement.client_telephone
        ? <a href={`tel:${l.traitement.client_telephone}`}><PhoneOutlined /> {l.traitement.client_telephone}</a>
        : <Text type="secondary">—</Text>,
    },
    { title: 'Boîtes', dataIndex: 'nombre_boites', key: 'boites', width: 80, align: 'center' },
    { title: 'Rappel', key: 'rappel', width: 110, render: (_, l) => fmt(l.date_rappel) },
    {
      title: 'Progression', key: 'prog', width: 140,
      render: (_, l) => <Text type="secondary">{l.traitement.boites_livrees} / {l.traitement.nombre_boites} boîtes</Text>,
    },
    { title: 'Actions', key: 'actions', width: 150, render: (_, l) => actionsLivraison(l) },
  ]

  const prochaine = (t) => t.livraisons.find(l => l.statut === 'prévue')

  const traitementColumns = [
    {
      title: 'Patient', key: 'patient',
      render: (_, t) => (
        <div>
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setDetailId(t.id)}>{t.client_nom}</Button>
          {t.client_telephone && <div><Text type="secondary" style={{ fontSize: 12 }}>{t.client_telephone}</Text></div>}
        </div>
      ),
    },
    { title: 'Pathologie', dataIndex: 'pathologie', key: 'patho', render: v => v || '—' },
    {
      title: 'Remboursement', key: 'remb',
      render: (_, t) => (
        <div>
          <div>{t.nature_remboursement || '—'}</div>
          {t.centre_mutuelle && <Text type="secondary" style={{ fontSize: 12 }}>{t.centre_mutuelle}</Text>}
        </div>
      ),
    },
    {
      title: 'Période', key: 'periode', width: 190,
      render: (_, t) => `${fmt(t.date_debut)} → ${fmt(t.date_fin)}`,
    },
    {
      title: 'Boîtes livrées', key: 'prog', width: 160,
      render: (_, t) => (
        <Tooltip title={`${t.boites_livrees} livrée(s), ${t.boites_planifiees} planifiée(s) sur ${t.nombre_boites}`}>
          <Progress percent={Math.round((t.boites_livrees / t.nombre_boites) * 100)} size="small"
            format={() => `${t.boites_livrees}/${t.nombre_boites}`} />
        </Tooltip>
      ),
    },
    {
      title: 'Prochaine livraison', key: 'next', width: 160,
      render: (_, t) => {
        const l = prochaine(t)
        if (!l) return <Text type="secondary">—</Text>
        const e = etatLivraison(l)
        return <Space direction="vertical" size={0}><Text>{fmt(l.date_prevue)}</Text><Tag color={e.color} style={{ margin: 0 }}>{e.label}</Tag></Space>
      },
    },
    {
      title: 'Statut', dataIndex: 'statut', key: 'statut', width: 100,
      render: s => <Tag color={STATUT_TRAITEMENT[s]?.color}>{STATUT_TRAITEMENT[s]?.label || s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (_, t) => (
        <Space size={4}>
          <Tooltip title="Détail"><Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(t.id)} /></Tooltip>
          <Tooltip title="Modifier"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} /></Tooltip>
          <Popconfirm title="Supprimer ce traitement ?" description="Ses livraisons prévues seront supprimées."
            onConfirm={() => supprimerTraitement(t)} okText="Oui" cancelText="Non" okButtonProps={{ danger: true }}>
            <Tooltip title="Supprimer"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const stockColumns = [
    {
      title: 'Produit', key: 'nom',
      render: (_, p) => <div><Text strong>{p.nom}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{p.reference}</Text></div></div>,
    },
    {
      title: <Tooltip title="Prix public Maroc / Prix base de remboursement, repris sur les nouvelles factures">PPM / PBR</Tooltip>,
      key: 'prix',
      render: (_, p) => (
        <Space size={4}>
          <Text>{parseFloat(p.prix).toFixed(2)}</Text>
          <Text type="secondary">/</Text>
          {p.pbr !== null && p.pbr !== undefined
            ? <Text>{parseFloat(p.pbr).toFixed(2)}</Text>
            : <Tag color="warning" style={{ margin: 0 }}>PBR ?</Tag>}
          <Tooltip title="Modifier les prix">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openPrix(p)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Stock actuel', key: 'stock', align: 'center',
      render: (_, p) => <Text strong style={{ fontSize: 16, color: p.stockNum <= 0 ? '#dc2626' : '#1e293b' }}>{p.stockNum}</Text>,
    },
    { title: 'Patients en cours', dataIndex: 'patients', key: 'patients', align: 'center' },
    {
      title: 'Besoin 30 j', key: 'b30', align: 'center',
      render: (_, p) => <Text style={{ color: p.besoin30 > p.stockNum ? '#dc2626' : undefined }}>{p.besoin30}</Text>,
    },
    {
      title: <Tooltip title="Boîtes de toutes les livraisons prévues des traitements en cours">Réservé total</Tooltip>,
      dataIndex: 'reserve', key: 'reserve', align: 'center',
    },
    {
      title: 'Après livraisons prévues', key: 'apres', align: 'center',
      render: (_, p) => p.apres < 0
        ? <Tag color="error">Manque {-p.apres}</Tag>
        : <Tag color="success">{p.apres} disponible(s)</Tag>,
    },
    {
      title: 'Rupture prévue', key: 'rupture',
      render: (_, p) => p.dateRupture
        ? <Tag color={dayjs(p.dateRupture).diff(dayjs(), 'day') <= 30 ? 'error' : 'warning'}>le {fmt(p.dateRupture)}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions', key: 'actions', width: 150,
      render: (_, p) => (
        <Space size={4}>
          <Tooltip title="Entrée de stock">
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openEntree(p)}
              style={{ background: '#1e293b', borderColor: '#1e293b' }} />
          </Tooltip>
          <Tooltip title="Mouvements de stock">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => openMouvements(p)} />
          </Tooltip>
          <Popconfirm
            title="Retirer ce produit du suivi Hulio ?"
            description={p.patients ? 'Les traitements existants le conservent, mais il ne sera plus proposé.' : 'Il ne sera plus proposé pour les nouveaux traitements.'}
            onConfirm={() => setSuiviHulio(p.id, false)} okText="Retirer" cancelText="Annuler">
            <Tooltip title="Retirer du suivi"><Button size="small" icon={<MinusCircleOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const detailLivraisonColumns = [
    { title: 'Date prévue', key: 'date', render: (_, l) => fmt(l.date_prevue) },
    { title: 'Rappel', key: 'rappel', render: (_, l) => fmt(l.date_rappel) },
    { title: 'Boîtes', dataIndex: 'nombre_boites', key: 'boites', align: 'center' },
    { title: 'État', key: 'etat', render: (_, l) => { const e = etatLivraison(l); return <Tag color={e.color}>{e.label}</Tag> } },
    { title: '', key: 'actions', render: (_, l) => actionsLivraison(l) },
  ]

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const boitesPlanifiees = lignes.reduce((s, l) => s + (l.nombre_boites || 0), 0)
  const boitesTotal = Form.useWatch('nombre_boites', tForm) || 0

  const kpiCard = (title, value, icon, color) => (
    <Col flex="1 1 180px">
      <Card size="small" style={{ borderRadius: 10 }}>
        <Statistic title={title} value={value} prefix={icon} valueStyle={{ color, fontSize: 24 }} />
      </Card>
    </Col>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Suivi Hulio</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Nouveau traitement
        </Button>
      </div>

      <Row gutter={12} style={{ marginBottom: 20 }} wrap>
        {kpiCard('Patients en traitement', kpis.patients, <UserOutlined />, '#1e293b')}
        {kpiCard('Livraisons sous 7 jours', kpis.semaine, <CalendarOutlined />, '#2563eb')}
        {kpiCard('Livraisons en retard', kpis.retards, <WarningOutlined />, kpis.retards ? '#dc2626' : '#94a3b8')}
        {kpiCard('Rappels à traiter', kpis.rappels, <BellOutlined />, kpis.rappels ? '#ea580c' : '#94a3b8')}
        {kpiCard('Fin de traitement < 30 j', kpis.finProche, <CalendarOutlined />, kpis.finProche ? '#ca8a04' : '#94a3b8')}
        {kpiCard('Produits en manque', stockHulio.filter(p => p.apres < 0).length, <InboxOutlined />,
          stockHulio.some(p => p.apres < 0) ? '#dc2626' : '#94a3b8')}
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Input.Search placeholder="Rechercher un patient…" allowClear style={{ width: 240 }}
            onChange={e => setSearch(e.target.value)} />
        }
        items={[
          {
            key: 'livraisons',
            label: <span><CalendarOutlined /> Livraisons à venir ({livraisonsAVenir.length})</span>,
            children: (
              <div style={card}>
                <div style={{ marginBottom: 12 }}>
                  <Segmented value={periode} onChange={setPeriode} options={[
                    { label: '7 jours', value: '7' },
                    { label: '30 jours', value: '30' },
                    { label: '90 jours', value: '90' },
                    { label: 'Tout', value: 'tout' },
                  ]} />
                  <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                    Les retards et les rappels échus sont toujours affichés.
                  </Text>
                </div>
                <Table
                  columns={livraisonColumns}
                  dataSource={livraisonsAVenir}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20, hideOnSinglePage: true }}
                  onRow={l => ({ style: dayjs(l.date_prevue).isBefore(dayjs(), 'day') ? { background: '#fef2f2' } : {} })}
                  locale={{ emptyText: <Empty description="Aucune livraison sur la période" /> }}
                />
              </div>
            ),
          },
          {
            key: 'traitements',
            label: <span><UserOutlined /> Traitements ({traitementsFiltres.length})</span>,
            children: (
              <div style={card}>
                <div style={{ marginBottom: 12 }}>
                  <Segmented value={filtreStatut ?? 'tous'} onChange={v => setFiltreStatut(v === 'tous' ? null : v)} options={[
                    { label: 'En cours', value: 'en_cours' },
                    { label: 'Terminés', value: 'termine' },
                    { label: 'Arrêtés', value: 'arrete' },
                    { label: 'Tous', value: 'tous' },
                  ]} />
                </div>
                <Table
                  columns={traitementColumns}
                  dataSource={traitementsFiltres}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15, hideOnSinglePage: true }}
                  locale={{ emptyText: <Empty description="Aucun traitement" /> }}
                />
              </div>
            ),
          },
          {
            key: 'stock',
            label: <span><InboxOutlined /> Stock Hulio ({produitsHulio.length})</span>,
            children: (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text type="secondary">
                    Produits proposés dans les traitements Hulio, avec les besoins calculés à partir des livraisons prévues.
                  </Text>
                  <Button icon={<PlusOutlined />} onClick={() => { setAjoutProduitId(null); setAjoutModal(true) }}>
                    Ajouter un produit
                  </Button>
                </div>
                <Table
                  columns={stockColumns}
                  dataSource={stockHulio}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  locale={{ emptyText: <Empty description="Aucun produit suivi. Ajoutez le produit Hulio depuis votre stock." /> }}
                />
              </div>
            ),
          },
        ]}
      />

      {/* ── Modale ajout produit suivi ────────────────────────────────────── */}
      <Modal
        title="Ajouter un produit au suivi Hulio"
        open={ajoutModal}
        onCancel={() => setAjoutModal(false)}
        onOk={() => ajoutProduitId && setSuiviHulio(ajoutProduitId, true)}
        okText="Ajouter"
        okButtonProps={{ disabled: !ajoutProduitId }}
        cancelText="Annuler"
        width={480}
      >
        <Text type="secondary" style={{ display: 'block', margin: '12px 0' }}>
          Choisissez un produit existant de votre stock.
        </Text>
        <Select
          showSearch optionFilterProp="label" placeholder="Rechercher un produit" style={{ width: '100%' }}
          value={ajoutProduitId} onChange={setAjoutProduitId}
          options={produits.filter(p => !p.suivi_hulio).map(p => ({
            value: p.id, label: `${p.nom} — ${p.reference} (stock ${parseFloat(p.stock)})`,
          }))}
        />
      </Modal>

      {/* ── Modale entrée de stock ────────────────────────────────────────── */}
      <Modal
        title={`Entrée de stock — ${entreeProduit?.nom || ''}`}
        open={!!entreeProduit}
        onCancel={() => setEntreeProduit(null)}
        onOk={() => entreeForm.submit()}
        okText="Ajouter au stock"
        cancelText="Annuler"
        confirmLoading={entreeSaving}
        width={400}
      >
        <Form form={entreeForm} layout="vertical" onFinish={saveEntree} style={{ marginTop: 16 }}>
          <Form.Item name="quantite" label="Nombre de boîtes reçues" rules={[{ required: true, message: 'Requis' }]}>
            <InputNumber min={1} style={{ width: '100%' }} autoFocus />
          </Form.Item>
          <Form.Item name="notes" label="Provenance / note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Mouvements de stock d'un produit ──────────────────────────────── */}
      <Drawer
        title={`Mouvements — ${mvtProduit?.nom || ''}`}
        open={!!mvtProduit}
        onClose={() => setMvtProduit(null)}
        width={560}
      >
        <Table
          size="small"
          loading={mvtLoading}
          dataSource={mouvements}
          rowKey="id"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          columns={[
            { title: 'Date', key: 'date', width: 110, render: (_, m) => fmt(m.date) },
            {
              title: 'Mouvement', key: 'type', width: 100,
              render: (_, m) => m.type === 'entrée'
                ? <Tag color="success">+{parseFloat(m.quantite)}</Tag>
                : <Tag color="error">−{parseFloat(m.quantite)}</Tag>,
            },
            {
              title: 'Origine', key: 'notes',
              render: (_, m) => m.notes || (m.bon_livraison_id ? `BL #${m.bon_livraison_id}` : '—'),
            },
          ]}
        />
      </Drawer>

      {/* ── Modale traitement ─────────────────────────────────────────────── */}
      <Modal
        title={editing ? `Modifier le traitement — ${editing.client_nom}` : 'Nouveau traitement Hulio'}
        open={tModal}
        onCancel={() => setTModal(false)}
        onOk={() => tForm.submit()}
        okText={editing ? 'Enregistrer' : 'Créer'}
        cancelText="Annuler"
        confirmLoading={tSaving}
        width={editing ? 640 : 820}
      >
        <Form form={tForm} layout="vertical" onFinish={saveTraitement} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={editing ? 24 : 16}>
              <Form.Item label="Patient" required style={{ marginBottom: 0 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="client_id" noStyle rules={[{ required: true, message: 'Patient requis' }]}>
                    <Select
                      showSearch optionFilterProp="label" placeholder="Choisir un patient" disabled={!!editing}
                      options={clients.map(c => ({ value: c.id, label: c.telephone ? `${c.nom} — ${c.telephone}` : c.nom }))}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  {!editing && (
                    <Button icon={<PlusOutlined />} onClick={() => { pForm.resetFields(); setPModal(true) }}>
                      Nouveau patient
                    </Button>
                  )}
                </Space.Compact>
              </Form.Item>
            </Col>
            {!editing && (
              <Col span={8}>
                <Form.Item name="produit_id" label="Produit" rules={[{ required: true, message: 'Produit requis' }]}
                  extra={produitsHulio.length === 0 && (
                    <Button type="link" size="small" style={{ padding: 0 }}
                      onClick={() => { setTModal(false); setActiveTab('stock') }}>
                      Aucun produit Hulio configuré — en ajouter
                    </Button>
                  )}>
                  <Select
                    placeholder="Aucun produit configuré"
                    disabled={produitsHulio.length <= 1}
                    options={produitsHulio.map(p => ({ value: p.id, label: `${p.nom} (stock ${parseFloat(p.stock)})` }))} />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Row gutter={12} style={{ marginTop: editing ? 16 : 0 }}>
            <Col span={8}>
              <Form.Item name="pathologie" label="Pathologie">
                <AutoComplete options={suggestions.pathologie} placeholder="Choisir ou saisir" allowClear
                  filterOption={(input, o) => o.value.toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nature_remboursement" label="Nature de remboursement">
                <AutoComplete options={suggestions.remboursement} placeholder="Choisir ou saisir" allowClear
                  filterOption={(input, o) => o.value.toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="centre_mutuelle" label="Centre de mutuelle">
                <AutoComplete options={suggestions.centre} placeholder="Ex : CNSS Fès" allowClear
                  filterOption={(input, o) => o.value.toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="date_debut" label="Début du traitement" rules={[{ required: true, message: 'Requis' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={onDebutChange} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="duree_mois" label="Durée (mois)">
                <InputNumber min={1} max={120} style={{ width: '100%' }} onChange={onDureeChange} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="date_fin" label="Fin du traitement">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="nombre_boites" label="Boîtes à livrer" rules={[{ required: true, message: 'Requis' }]}>
                {/* La quantité facturée suit le nombre de boîtes tant qu'elle n'a pas été modifiée à la main */}
                <InputNumber min={1} style={{ width: '100%' }} onChange={(v) => {
                  if (!editing && !tForm.isFieldTouched('facture_quantite')) tForm.setFieldValue('facture_quantite', v)
                }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Médecin prescripteur, remarques…" />
          </Form.Item>

          {!editing && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, margin: '8px 0 12px' }}>
                Facture
              </Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="facture_quantite" label="Boîtes facturées"
                    extra="Laisser vide pour ne pas créer de facture maintenant">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="facture_taux_prise_en_charge" label="Taux de prise en charge"
                    extra="Modifiable ensuite sur la facture">
                    <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ fontSize: 13, margin: '8px 0 12px' }}>
                Livraisons prévues
              </Divider>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <Button icon={<ThunderboltOutlined />} onClick={repartirAuto}>Répartir automatiquement</Button>
                <Text type="secondary">par</Text>
                <InputNumber min={1} value={parLivraison} onChange={v => setParLivraison(v || 1)} style={{ width: 64 }} />
                <Text type="secondary">boîte(s) par livraison</Text>
                <div style={{ flex: 1 }} />
                <Tag color={boitesPlanifiees === boitesTotal ? 'success' : boitesPlanifiees > boitesTotal ? 'error' : 'warning'}>
                  {boitesPlanifiees} / {boitesTotal} boîtes planifiées
                </Tag>
              </div>

              {lignes.length > 0 && (
                <Row gutter={8} style={{ marginBottom: 4 }}>
                  <Col span={9}><Text type="secondary" style={{ fontSize: 12 }}>Date de livraison</Text></Col>
                  <Col span={9}><Text type="secondary" style={{ fontSize: 12 }}>Date de rappel</Text></Col>
                  <Col span={4}><Text type="secondary" style={{ fontSize: 12 }}>Boîtes</Text></Col>
                </Row>
              )}
              {lignes.map((l, idx) => (
                <Row gutter={8} key={idx} style={{ marginBottom: 8 }} align="middle">
                  <Col span={9}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} value={l.date_prevue}
                      onChange={v => updateLigne(idx, 'date_prevue', v)} />
                  </Col>
                  <Col span={9}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} value={l.date_rappel}
                      onChange={v => updateLigne(idx, 'date_rappel', v)} placeholder="Aucun rappel" />
                  </Col>
                  <Col span={4}>
                    <InputNumber min={1} style={{ width: '100%' }} value={l.nombre_boites}
                      onChange={v => updateLigne(idx, 'nombre_boites', v)} />
                  </Col>
                  <Col span={2}>
                    <Button type="text" danger icon={<MinusCircleOutlined />}
                      onClick={() => setLignes(prev => prev.filter((_, i) => i !== idx))} />
                  </Col>
                </Row>
              ))}
              <Button type="dashed" block icon={<PlusOutlined />}
                onClick={() => setLignes(prev => [...prev, { date_prevue: null, date_rappel: null, nombre_boites: 1 }])}>
                Ajouter une livraison
              </Button>
            </>
          )}
        </Form>
      </Modal>

      {/* ── Modale nouveau patient ────────────────────────────────────────── */}
      <Modal
        title="Nouveau patient Hulio"
        open={pModal}
        onCancel={() => setPModal(false)}
        onOk={() => pForm.submit()}
        okText="Ajouter"
        cancelText="Annuler"
        confirmLoading={pSaving}
        width={480}
      >
        <Form form={pForm} layout="vertical" onFinish={savePatient} style={{ marginTop: 16 }}>
          <Form.Item name="nom" label="Nom du patient" rules={[{ required: true, message: 'Nom requis' }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="telephone" label="Téléphone">
            <Input placeholder="Ex : +212 6 00 00 00 00" />
          </Form.Item>
          <Form.Item name="contact" label="Personne à contacter">
            <Input placeholder="Optionnel" />
          </Form.Item>
          <Form.Item name="mail" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="adresse" label="Adresse de livraison">
            <Input />
          </Form.Item>
          <Divider orientation="left" style={{ fontSize: 13 }}>Assurance (facture ANAM)</Divider>
          <Form.Item name="nom_assure" label="Nom et prénom de l'assuré" extra="Laisser vide si le patient est lui-même l'assuré">
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="immatriculation" label="N° d'immatriculation">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="numero_prise_en_charge" label="N° de prise en charge">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Modale livraison ──────────────────────────────────────────────── */}
      <Modal
        title={lModal?.mode === 'livrer' ? 'Marquer comme livrée' : lModal?.mode === 'edit' ? 'Modifier la livraison' : 'Ajouter une livraison'}
        open={!!lModal}
        onCancel={() => setLModal(null)}
        onOk={() => lForm.submit()}
        okText={lModal?.mode === 'livrer' ? 'Confirmer la livraison' : 'Enregistrer'}
        cancelText="Annuler"
        confirmLoading={lSaving}
        width={420}
      >
        <Form form={lForm} layout="vertical" onFinish={saveLivraison} style={{ marginTop: 16 }}>
          {lModal?.mode === 'livrer' ? (
            <>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                {lModal.livraison.nombre_boites} boîte(s) seront retirées du stock.
              </Text>
              <Form.Item name="date_livraison" label="Date de livraison" rules={[{ required: true, message: 'Requis' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="date_prevue" label="Date de livraison prévue" rules={[{ required: true, message: 'Requis' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="date_rappel" label="Date de rappel">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Aucun rappel" />
              </Form.Item>
              <Form.Item name="nombre_boites" label="Nombre de boîtes" rules={[{ required: true, message: 'Requis' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* ── Modale facture (complémentaire / compléter) ───────────────────── */}
      <Modal
        title={fModal?.mode === 'new'
          ? `Facture complémentaire — ${fModal.traitement.client_nom}`
          : `Compléter la facture ${fModal?.facture?.numero || ''}`}
        open={!!fModal}
        onCancel={() => setFModal(null)}
        width={fModal?.mode === 'new' ? 460 : 720}
        footer={[
          <Button key="c" onClick={() => setFModal(null)}>Annuler</Button>,
          fModal?.mode === 'edit' && (
            <Button key="p" icon={<FilePdfOutlined />} loading={fSaving}
              onClick={() => fForm.validateFields().then(v => saveFacture(v, true)).catch(() => {})}>
              Enregistrer et PDF
            </Button>
          ),
          <Button key="o" type="primary" loading={fSaving} onClick={() => fForm.submit()}
            style={{ background: '#1e293b', borderColor: '#1e293b' }}>
            {fModal?.mode === 'new' ? 'Créer la facture' : 'Enregistrer'}
          </Button>,
        ]}
      >
        <Form form={fForm} layout="vertical" onFinish={(v) => saveFacture(v)} style={{ marginTop: 16 }}>
          {fModal?.mode === 'new' ? (
            <>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                Les informations du patient et les prix du produit sont repris automatiquement ; vous pourrez les compléter ensuite.
              </Text>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="quantite" label="Boîtes facturées" rules={[{ required: true, message: 'Requis' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} autoFocus />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="date_emission" label="Date de la facture" rules={[{ required: true, message: 'Requis' }]}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="taux_prise_en_charge" label="Taux de prise en charge">
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
              <Form.Item name="notes" label="Motif / notes">
                <Input placeholder="Ex : complication, boîtes supplémentaires" />
              </Form.Item>
            </>
          ) : (
            <>
              {fModal?.facture?.statut !== 'émise' && (
                <Tag color="warning" style={{ marginBottom: 12 }}>
                  Facture {fModal?.facture?.statut} : seules les informations administratives sont modifiables
                </Tag>
              )}
              <Divider orientation="left" style={{ fontSize: 13, margin: '0 0 12px' }}>Assuré / bénéficiaire</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="assure_nom" label="Nom et prénom de l'assuré"><Input /></Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="beneficiaire_nom" label="Nom et prénom du bénéficiaire"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="numero_prise_en_charge" label="N° de prise en charge"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="immatriculation" label="N° d'immatriculation"><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="organisme" label="Organisme gestionnaire">
                    <AutoComplete options={toOptions(['CNSS', 'CNOPS'])} placeholder="CNSS / CNOPS" allowClear />
                  </Form.Item>
                </Col>
              </Row>
              <Divider orientation="left" style={{ fontSize: 13, margin: '0 0 12px' }}>Médicament</Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="designation" label="Nom commercial" rules={[{ required: true, message: 'Requis' }]}><Input /></Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="quantite" label="Quantité" rules={[{ required: true, message: 'Requis' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="ppm" label="PPM" rules={[{ required: true, message: 'Requis' }]}>
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="pbr" label="PBR"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="taux_prise_en_charge" label="Taux">
                    <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
              </Row>
              <ApercuMontants form={fForm} />
              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={8}>
                  <Form.Item name="date_emission" label="Date de délivrance / facture" rules={[{ required: true, message: 'Requis' }]}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item name="notes" label="Notes (internes)"><Input /></Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>

      {/* ── Modale prix PPM / PBR ─────────────────────────────────────────── */}
      <Modal
        title={`Prix — ${prixProduit?.nom || ''}`}
        open={!!prixProduit}
        onCancel={() => setPrixProduit(null)}
        onOk={() => prixForm.submit()}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={prixSaving}
        width={400}
      >
        <Form form={prixForm} layout="vertical" onFinish={savePrix} style={{ marginTop: 16 }}>
          <Form.Item name="prix" label="PPM — prix public Maroc (TTC)" rules={[{ required: true, message: 'Requis' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pbr" label="PBR — prix base de remboursement">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Les factures déjà émises gardent leurs prix ; modifiez-les si besoin via « Compléter ».
          </Text>
        </Form>
      </Modal>

      {/* ── Détail traitement ─────────────────────────────────────────────── */}
      <Drawer
        title={detail ? `${detail.client_nom} — Traitement Hulio` : ''}
        open={!!detail}
        onClose={() => setDetailId(null)}
        width={760}
        extra={detail && (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(detail)}>Modifier</Button>
            {detail.statut === 'en_cours' ? (
              <>
                <Popconfirm title="Marquer le traitement comme terminé ?" onConfirm={() => changerStatut(detail, 'termine')} okText="Oui" cancelText="Non">
                  <Button>Terminer</Button>
                </Popconfirm>
                <Popconfirm title="Arrêter le traitement ?" onConfirm={() => changerStatut(detail, 'arrete')} okText="Oui" cancelText="Non">
                  <Button danger>Arrêter</Button>
                </Popconfirm>
              </>
            ) : (
              <Button onClick={() => changerStatut(detail, 'en_cours')}>Reprendre</Button>
            )}
          </Space>
        )}
      >
        {detail && (
          <>
            <Row gutter={[16, 12]} style={{ marginBottom: 20 }}>
              <Col span={8}><Text type="secondary">Téléphone</Text><div>{detail.client_telephone
                ? <a href={`tel:${detail.client_telephone}`}>{detail.client_telephone}</a> : '—'}</div></Col>
              <Col span={8}><Text type="secondary">Pathologie</Text><div>{detail.pathologie || '—'}</div></Col>
              <Col span={8}><Text type="secondary">Statut</Text><div>
                <Tag color={STATUT_TRAITEMENT[detail.statut]?.color}>{STATUT_TRAITEMENT[detail.statut]?.label}</Tag></div></Col>
              <Col span={8}><Text type="secondary">Remboursement</Text><div>{detail.nature_remboursement || '—'}</div></Col>
              <Col span={8}><Text type="secondary">Centre de mutuelle</Text><div>{detail.centre_mutuelle || '—'}</div></Col>
              <Col span={8}><Text type="secondary">Produit</Text><div>{detail.produit_nom}</div></Col>
              <Col span={8}><Text type="secondary">Début</Text><div>{fmt(detail.date_debut)}</div></Col>
              <Col span={8}><Text type="secondary">Fin</Text><div>{fmt(detail.date_fin)}
                {detail.duree_mois ? <Text type="secondary"> ({detail.duree_mois} mois)</Text> : null}</div></Col>
              <Col span={8}><Text type="secondary">Boîtes prévues</Text><div>{detail.nombre_boites}</div></Col>
              {detail.notes && <Col span={24}><Text type="secondary">Notes</Text><div>{detail.notes}</div></Col>}
            </Row>

            <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
              <Text strong>Progression</Text>
              <Progress percent={Math.round((detail.boites_livrees / detail.nombre_boites) * 100)}
                format={() => `${detail.boites_livrees}/${detail.nombre_boites}`} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {detail.boites_livrees} boîte(s) livrée(s) · {detail.boites_planifiees - detail.boites_livrees} prévue(s) ·{' '}
                {Math.max(0, detail.nombre_boites - detail.boites_planifiees)} restant à planifier
              </Text>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Livraisons</Text>
              <Space>
                {detail.nombre_boites - detail.boites_planifiees > 0 && (
                  <Popconfirm
                    title={`Planifier les ${detail.nombre_boites - detail.boites_planifiees} boîte(s) restante(s) ?`}
                    description="Une livraison par boîte, réparties jusqu'à la fin du traitement (ou une par mois)."
                    onConfirm={() => repartirRestantes(detail)} okText="Répartir" cancelText="Annuler">
                    <Button size="small" icon={<ThunderboltOutlined />}>Répartir les restantes</Button>
                  </Popconfirm>
                )}
                <Button size="small" icon={<PlusOutlined />} onClick={() => openAddLivraison(detail)}>Ajouter</Button>
              </Space>
            </div>
            <Table
              columns={detailLivraisonColumns}
              dataSource={detail.livraisons}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: 'Aucune livraison planifiée' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 8px' }}>
              <Text strong>
                Factures <Text type="secondary" style={{ fontWeight: 400 }}>
                  ({detail.boites_facturees} boîte(s) facturée(s) sur {detail.nombre_boites})
                </Text>
              </Text>
              <Button size="small" icon={<PlusOutlined />} onClick={() => openNouvelleFacture(detail)}>
                {detail.factures.length ? 'Facture complémentaire' : 'Créer la facture'}
              </Button>
            </div>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.factures}
              locale={{ emptyText: 'Aucune facture' }}
              columns={[
                { title: 'N°', dataIndex: 'numero', key: 'numero', render: v => <Text code>{v}</Text> },
                { title: 'Date', key: 'date', render: (_, f) => fmt(f.date_emission) },
                { title: 'Boîtes', key: 'qte', align: 'center', render: (_, f) => f.hulio.quantite },
                {
                  title: 'Montant', key: 'montant', align: 'right',
                  render: (_, f) => {
                    const { og } = calculHulio(f.hulio)
                    return (
                      <Tooltip title={og === null ? 'Part organisme non calculée (PBR ou taux manquant)' : `Organisme : ${og.toFixed(2)} — Assuré : ${(f.montant_ttc - og).toFixed(2)}`}>
                        <Text strong>{f.montant_ttc.toFixed(2)}</Text>
                      </Tooltip>
                    )
                  },
                },
                {
                  title: 'Statut', key: 'statut',
                  render: (_, f) => {
                    const manquants = champsManquantsHulio(f.hulio)
                    return (
                      <Space size={4}>
                        <Tag color={{ émise: 'processing', payée: 'success', annulée: 'error' }[f.statut]}>{f.statut}</Tag>
                        {manquants.length > 0 && f.statut !== 'annulée' && (
                          <Tooltip title={`À compléter : ${manquants.join(', ')}`}><Tag color="warning">incomplète</Tag></Tooltip>
                        )}
                      </Space>
                    )
                  },
                },
                {
                  title: '', key: 'actions',
                  render: (_, f) => (
                    <Space size={4}>
                      <Tooltip title="PDF">
                        <Button size="small" icon={<FilePdfOutlined />} loading={pdfLoadingId === f.id}
                          onClick={() => imprimerFacture(f)} style={{ color: '#dc2626', borderColor: '#dc2626' }} />
                      </Tooltip>
                      {f.statut !== 'annulée' && (
                        <Tooltip title="Compléter / modifier">
                          <Button size="small" icon={<EditOutlined />} onClick={() => openCompleterFacture(f)} />
                        </Tooltip>
                      )}
                      <Tooltip title="Paiements, avoirs, relances (page Factures)">
                        <Button size="small" icon={<ExportOutlined />} onClick={() => navigate('/factures', { state: { openFactureId: f.id } })} />
                      </Tooltip>
                    </Space>
                  ),
                },
              ]}
            />

            <Divider />
            <Popconfirm title="Supprimer ce traitement ?" description="Ses livraisons prévues seront supprimées."
              onConfirm={() => supprimerTraitement(detail)} okText="Oui" cancelText="Non" okButtonProps={{ danger: true }}>
              <Button danger icon={<DeleteOutlined />}>Supprimer le traitement</Button>
            </Popconfirm>
          </>
        )}
      </Drawer>
    </div>
  )
}

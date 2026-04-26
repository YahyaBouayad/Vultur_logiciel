import {
  Table, Button, Typography, Space, Tooltip, Popconfirm,
  message, Drawer, Divider, Badge, Empty, Input, Tabs, Tag, Alert,
  Form, Modal, DatePicker, Select, List, Popconfirm as Pop, InputNumber
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, SearchOutlined, FileTextOutlined,
  WarningOutlined, ClockCircleOutlined, FilePdfOutlined, EditOutlined,
  BellOutlined, DeleteOutlined, PlusOutlined, FileProtectOutlined, EuroOutlined,
  CreditCardOutlined,
} from '@ant-design/icons'
import RelancePDF from '../components/pdf/RelancePDF'
import AvoirPDF from '../components/pdf/AvoirPDF'
import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { PDFDownloadLink, pdf } from '@react-pdf/renderer'
import api from '../api/axios'
import { useImpayes } from '../context/ImpayesContext'
import { useSettings } from '../context/SettingsContext'
import FacturePDF from '../components/pdf/FacturePDF'

const { Title, Text } = Typography

const PAGE_SIZE   = 50
const statutColor = { émise: 'processing', payée: 'success', annulée: 'error' }
const statutLabel = { émise: 'Émise', payée: 'Payée', annulée: 'Annulée' }

const niveauConfig = {
  normal:    { color: '#e2e8f0', text: '#64748b' },
  attention: { color: '#fef9c3', text: '#b45309' },
  retard:    { color: '#fed7aa', text: '#c2410c' },
  critique:  { color: '#fee2e2', text: '#dc2626' },
}

function RetardTag({ jours, niveau }) {
  if (jours <= 0) return <Text type="secondary" style={{ fontSize: 12 }}>{Math.abs(jours)}j restants</Text>
  const cfg = niveauConfig[niveau] || niveauConfig.normal
  return (
    <Tag style={{ background: cfg.color, color: cfg.text, border: 'none', fontWeight: 600 }}>
      {jours}j de retard
    </Tag>
  )
}

export default function Factures() {
  const [factures, setFactures] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)

  const [search, setSearch]             = useState('')
  const [onglet, setOnglet]             = useState('toutes')
  const [filterStatut, setFilterStatut] = useState(null)
  const [filterClient, setFilterClient] = useState(null)

  const [clients, setClients]   = useState([])
  const [produits, setProduits] = useState([])
  const [impayes, setImpayes]   = useState([])

  const { refresh: refreshImpayes } = useImpayes()
  const { settings } = useSettings()

  const [drawer, setDrawer]         = useState(false)
  const [selected, setSelected]     = useState(null)
  const [selectedBL, setSelectedBL] = useState(null)
  const [blLoading, setBlLoading]   = useState(false)

  const [editModal, setEditModal]     = useState(false)
  const [editingFact, setEditingFact] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm] = Form.useForm()

  const [relances, setRelances]           = useState([])
  const [relLoading, setRelLoading]       = useState(false)
  const [relModal, setRelModal]           = useState(false)
  const [relModalFact, setRelModalFact]   = useState(null)
  const [relSubmitting, setRelSubmitting] = useState(false)
  const [relForm] = Form.useForm()

  const [avoirs, setAvoirs]               = useState([])
  const [avoirLoading, setAvoirLoading]   = useState(false)
  const [paiements, setPaiements]         = useState([])
  const [paiLoading, setPaiLoading]       = useState(false)
  const [paiModal, setPaiModal]           = useState(false)
  const [paiSubmitting, setPaiSubmitting] = useState(false)
  const [paiForm] = Form.useForm()
  const [avoirModal, setAvoirModal]       = useState(false)
  const [avoirSubmitting, setAvoirSubmitting] = useState(false)
  const [avoirForm] = Form.useForm()

  const [pdfLoadingIds, setPdfLoadingIds] = useState(new Set())
  const searchTimer = useRef(null)

  // Sync selected facture when list refreshes (e.g. after payment auto-marks it payée)
  useEffect(() => {
    if (!selected || factures.length === 0) return
    const updated = factures.find(f => f.id === selected.id)
    if (updated && updated.statut !== selected.statut) setSelected(updated)
  }, [factures])

  // Clients, produits et impayés chargés une seule fois
  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
    api.get('/produits').then(r => setProduits(r.data)).catch(() => {})
    loadImpayes()
  }, [])

  const loadImpayes = async () => {
    try {
      const r = await api.get('/factures/impayes')
      setImpayes(r.data)
    } catch {
      setImpayes([])
    }
  }

  const loadFactures = async (pg, statut, clientId, q, tab) => {
    setLoading(true)
    try {
      const params = { skip: (pg - 1) * PAGE_SIZE, limit: PAGE_SIZE }
      // Le filtre onglet se traduit en filtre statut si pas de filtre manuel
      const effectifStatut = statut ?? (tab === 'impayes' ? 'émise' : null)
      if (effectifStatut) params.statut    = effectifStatut
      if (clientId)       params.client_id = clientId
      if (q)              params.q         = q
      const r = await api.get('/factures', { params })
      setFactures(r.data.items)
      setTotal(r.data.total)
    } catch {
      setFactures([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Chargement initial
  useEffect(() => { loadFactures(1, null, null, '', 'toutes') }, [])

  const handleOngletChange = (tab) => {
    setOnglet(tab)
    setPage(1)
    // Pour l'onglet "retard", on filtre côté client sur les impayés (déjà chargés)
    // Pour "impayes", on passe statut=émise au backend
    // Pour "toutes", pas de filtre statut lié à l'onglet
    loadFactures(1, filterStatut, filterClient, search, tab)
  }

  const handleStatutChange = (val) => {
    setFilterStatut(val)
    setPage(1)
    loadFactures(1, val, filterClient, search, onglet)
  }

  const handleClientChange = (val) => {
    setFilterClient(val)
    setPage(1)
    loadFactures(1, filterStatut, val, search, onglet)
  }

  const handleSearchChange = (val) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      loadFactures(1, filterStatut, filterClient, val, onglet)
    }, 400)
  }

  const handlePageChange = (pg) => {
    setPage(pg)
    loadFactures(pg, filterStatut, filterClient, search, onglet)
  }

  // Pour l'onglet "retard", filtre côté client sur les impayés (volume borné : que les "émise")
  const displayedFactures = onglet === 'retard'
    ? factures.filter(f => {
        const imp = impayes.find(i => i.id === f.id)
        return imp && (imp.niveau === 'retard' || imp.niveau === 'critique')
      })
    : factures

  const openDrawer = async (facture) => {
    setSelected(facture)
    setSelectedBL(null)
    setRelances([])
    setAvoirs([])
    setPaiements([])
    setDrawer(true)
    setBlLoading(true)
    setRelLoading(true)
    setAvoirLoading(true)
    setPaiLoading(true)
    try {
      const [blRes, relRes, avoirRes, paiRes] = await Promise.all([
        api.get(`/bons-livraison/${facture.bon_livraison_id}`),
        api.get(`/factures/${facture.id}/relances`),
        api.get(`/factures/${facture.id}/avoirs`),
        api.get(`/factures/${facture.id}/paiements`),
      ])
      setSelectedBL(blRes.data)
      setRelances(relRes.data)
      setAvoirs(avoirRes.data)
      setPaiements(paiRes.data)
    } catch {
      setSelectedBL(null)
    } finally {
      setBlLoading(false)
      setRelLoading(false)
      setAvoirLoading(false)
      setPaiLoading(false)
    }
  }

  const openRelanceModal = (facture) => {
    setRelModalFact(facture)
    relForm.setFieldsValue({ date: dayjs(), notes: '' })
    setRelModal(true)
  }

  const submitRelance = async (values) => {
    const factId = relModalFact?.id
    if (!factId) return
    setRelSubmitting(true)
    try {
      await api.post(`/factures/${factId}/relances`, {
        date:  values.date.format('YYYY-MM-DD'),
        notes: values.notes || null,
      })
      message.success('Relance enregistrée')
      setRelModal(false)
      relForm.resetFields()
      if (drawer && selected?.id === factId) {
        const r = await api.get(`/factures/${factId}/relances`)
        setRelances(r.data)
      }
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setRelSubmitting(false)
    }
  }

  const deleteRelance = async (relanceId) => {
    try {
      await api.delete(`/relances/${relanceId}`)
      setRelances(prev => prev.filter(r => r.id !== relanceId))
      message.success('Relance supprimée')
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const downloadRelancePDF = async (relance, numRelance) => {
    try {
      const blob = await pdf(
        <RelancePDF
          facture={selected}
          client={clients.find(c => c.id === selected.client_id)}
          relance={relance}
          numRelance={numRelance}
          entreprise={settings}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Relance-${selected.numero}-${relance.date}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Erreur lors de la génération de la lettre')
    }
  }

  const openAvoirModal = () => {
    const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant_ht), 0)
    const totalPaye   = paiements.reduce((s, p) => s + Number(p.montant), 0)
    const solde = Math.max(0, (selected?.montant_ht || 0) - totalAvoirs - totalPaye)
    avoirForm.setFieldsValue({ date: dayjs(), montant_ht: +solde.toFixed(2), motif: 'annulation', notes: '' })
    setAvoirModal(true)
  }

  const submitAvoir = async (values) => {
    if (!selected) return
    setAvoirSubmitting(true)
    try {
      await api.post(`/factures/${selected.id}/avoirs`, {
        date:       values.date.format('YYYY-MM-DD'),
        montant_ht: values.montant_ht,
        motif:      values.motif,
        notes:      values.notes || null,
      })
      message.success('Avoir émis')
      setAvoirModal(false)
      avoirForm.resetFields()
      const r = await api.get(`/factures/${selected.id}/avoirs`)
      setAvoirs(r.data)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setAvoirSubmitting(false)
    }
  }

  const deleteAvoir = async (avoirId) => {
    try {
      await api.delete(`/avoirs/${avoirId}`)
      setAvoirs(prev => prev.filter(a => a.id !== avoirId))
      message.success('Avoir supprimé')
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const openPaiModal = () => {
    const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant_ht), 0)
    const totalPaye   = paiements.reduce((s, p) => s + Number(p.montant), 0)
    const solde = Math.max(0, (selected?.montant_ht || 0) - totalAvoirs - totalPaye)
    paiForm.setFieldsValue({ date: dayjs(), mode: 'virement', montant: +solde.toFixed(2), notes: '' })
    setPaiModal(true)
  }

  const submitPaiement = async (values) => {
    if (!selected) return
    setPaiSubmitting(true)
    try {
      await api.post(`/factures/${selected.id}/paiements`, {
        date:    values.date.format('YYYY-MM-DD'),
        montant: values.montant,
        mode:    values.mode,
        notes:   values.notes || null,
      })
      message.success('Paiement enregistré')
      setPaiModal(false)
      paiForm.resetFields()
      const r = await api.get(`/factures/${selected.id}/paiements`)
      setPaiements(r.data)
      loadFactures(page, filterStatut, filterClient, search, onglet)
      loadImpayes()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setPaiSubmitting(false)
    }
  }

  const deletePaiement = async (paiementId) => {
    try {
      await api.delete(`/paiements/${paiementId}`)
      setPaiements(prev => prev.filter(p => p.id !== paiementId))
      message.success('Paiement supprimé')
      loadFactures(page, filterStatut, filterClient, search, onglet)
      loadImpayes()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const downloadAvoirPDF = async (avoir) => {
    try {
      const blob = await pdf(
        <AvoirPDF
          avoir={avoir}
          facture={selected}
          client={clients.find(c => c.id === selected.client_id)}
          entreprise={settings}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${avoir.numero}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Erreur lors de la génération du PDF')
    }
  }

  const openEdit = (facture) => {
    setEditingFact(facture)
    editForm.setFieldsValue({
      date_emission: facture.date_emission ? dayjs(facture.date_emission) : null,
      date_echeance: facture.date_echeance ? dayjs(facture.date_echeance) : null,
      notes: facture.notes || '',
    })
    setEditModal(true)
  }

  const handleEdit = async (values) => {
    setEditLoading(true)
    try {
      await api.put(`/factures/${editingFact.id}`, {
        date_emission: values.date_emission ? values.date_emission.format('YYYY-MM-DD') : null,
        date_echeance: values.date_echeance ? values.date_echeance.format('YYYY-MM-DD') : null,
        notes: values.notes || null,
      })
      message.success('Facture modifiée')
      setEditModal(false)
      loadFactures(page, filterStatut, filterClient, search, onglet)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setEditLoading(false)
    }
  }

  const marquerPayee = async (id) => {
    try {
      await api.put(`/factures/${id}/statut`, { statut: 'payée' })
      message.success('Facture marquée comme payée')
      loadFactures(page, filterStatut, filterClient, search, onglet)
      loadImpayes()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const annuler = async (id) => {
    try {
      await api.put(`/factures/${id}/statut`, { statut: 'annulée' })
      message.success('Facture annulée — stock restauré')
      loadFactures(page, filterStatut, filterClient, search, onglet)
      loadImpayes()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const deleteFacture = async (id) => {
    try {
      await api.delete(`/factures/${id}`)
      message.success('Facture supprimée')
      setDrawer(false)
      loadFactures(page, filterStatut, filterClient, search, onglet)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const downloadFacturePDF = async (record) => {
    setPdfLoadingIds(prev => new Set([...prev, record.id]))
    try {
      const r = await api.get(`/bons-livraison/${record.bon_livraison_id}`)
      const blob = await pdf(
        <FacturePDF
          facture={record}
          client={clients.find(c => c.id === record.client_id)}
          bl={r.data}
          produits={produits}
          entreprise={settings}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${record.numero}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Erreur lors de la génération du PDF')
    } finally {
      setPdfLoadingIds(prev => { const s = new Set(prev); s.delete(record.id); return s })
    }
  }

  const totalBL = (bl) =>
    bl?.lignes?.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0) || 0

  const nbRetard    = impayes.filter(i => i.niveau === 'retard' || i.niveau === 'critique').length
  const nbImpayes   = impayes.length
  const totalImpaye = impayes.reduce((s, i) => s + (i.montant_ht || 0), 0)

  const rowClassName = (record) => {
    const imp = impayes.find(i => i.id === record.id)
    if (!imp) return ''
    if (imp.niveau === 'critique')  return 'row-critique'
    if (imp.niveau === 'retard')    return 'row-retard'
    if (imp.niveau === 'attention') return 'row-attention'
    return ''
  }

  const columns = [
    {
      title: 'Numéro',
      dataIndex: 'numero',
      key: 'numero',
      width: 150,
      render: (v) => <Text code style={{ fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      key: 'client',
      render: (id) => {
        const c = clients.find(c => c.id === id)
        return <Text strong>{c?.nom || '—'}</Text>
      },
    },
    {
      title: 'Date émission',
      dataIndex: 'date_emission',
      key: 'date',
      width: 130,
      render: (v) => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Échéance',
      dataIndex: 'date_echeance',
      key: 'echeance',
      width: 120,
      render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : <Text type="secondary">—</Text>,
    },
    {
      title: 'Retard',
      key: 'retard',
      width: 140,
      render: (_, record) => {
        if (record.statut !== 'émise') return <Text type="secondary">—</Text>
        const imp = impayes.find(i => i.id === record.id)
        if (!imp) return null
        return <RetardTag jours={imp.jours_retard} niveau={imp.niveau} />
      },
    },
    {
      title: 'Montant HT',
      key: 'montant',
      width: 130,
      render: (_, r) => <Text strong>{(r.montant_ht || 0).toFixed(2)} MAD</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      width: 100,
      render: (v) => <Badge status={statutColor[v]} text={statutLabel[v]} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Voir le détail">
            <Button size="small" icon={<FileTextOutlined />} onClick={() => openDrawer(record)} />
          </Tooltip>
          <Tooltip title="Télécharger PDF">
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              loading={pdfLoadingIds.has(record.id)}
              onClick={() => downloadFacturePDF(record)}
              style={{ color: '#dc2626', borderColor: '#dc2626' }}
            />
          </Tooltip>
          {record.statut === 'émise' && (
            <>
              <Tooltip title="Enregistrer une relance">
                <Button size="small" icon={<BellOutlined />}
                  style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                  onClick={() => openRelanceModal(record)} />
              </Tooltip>
              <Tooltip title="Modifier échéance / notes">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
              </Tooltip>
              <Tooltip title="Marquer payée">
                <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />}
                  onClick={() => marquerPayee(record.id)} />
              </Tooltip>
              <Tooltip title="Annuler la facture">
                <Popconfirm title="Annuler cette facture ? Le stock sera restauré." onConfirm={() => annuler(record.id)}
                  okText="Oui" cancelText="Non">
                  <Button size="small" danger icon={<CloseCircleOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {record.statut === 'annulée' && (
            <Tooltip title="Supprimer définitivement">
              <Popconfirm title="Supprimer cette facture définitivement ?" onConfirm={() => deleteFacture(record.id)}
                okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Non">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const tabItems = [
    { key: 'toutes',  label: `Toutes` },
    { key: 'impayes', label: <span><ClockCircleOutlined style={{ marginRight: 4 }} />Impayées ({nbImpayes})</span> },
    {
      key: 'retard',
      label: (
        <span style={{ color: nbRetard > 0 ? '#dc2626' : undefined }}>
          <WarningOutlined style={{ marginRight: 4 }} />En retard ({nbRetard})
        </span>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Factures</Title>
      </div>

      {nbRetard > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message={
            <span>
              <strong>{nbRetard} facture{nbRetard > 1 ? 's' : ''} en retard</strong>
              {' — '}montant total impayé en retard :{' '}
              <strong>{totalImpaye.toFixed(2)} MAD</strong>
            </span>
          }
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <style>{`
        .row-critique td { background: #fff1f2 !important; }
        .row-retard   td { background: #fff7ed !important; }
        .row-attention td { background: #fefce8 !important; }
      `}</style>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Tabs items={tabItems} activeKey={onglet} onChange={handleOngletChange} style={{ marginBottom: 12 }} />
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Rechercher par numéro..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ width: 240 }}
            allowClear
            onClear={() => handleSearchChange('')}
          />
          <Select
            placeholder="Tous les statuts"
            allowClear
            style={{ width: 150 }}
            value={filterStatut}
            onChange={handleStatutChange}
            options={[
              { value: 'émise',   label: 'Émise' },
              { value: 'payée',   label: 'Payée' },
              { value: 'annulée', label: 'Annulée' },
            ]}
          />
          <Select
            placeholder="Tous les clients"
            allowClear
            style={{ width: 220 }}
            showSearch
            value={filterClient}
            onChange={handleClientChange}
            filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            options={clients.map(c => ({ value: c.id, label: c.nom }))}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={displayedFactures}
          rowKey="id"
          loading={loading}
          rowClassName={rowClassName}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: onglet === 'retard' ? displayedFactures.length : total,
            showTotal: (t) => `${t} facture(s)`,
            onChange: handlePageChange,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Aucune facture' }}
        />
      </div>

      {/* Drawer détail */}
      <Drawer
        title={
          <Space>
            <Text strong>{selected?.numero}</Text>
            {selected && <Badge status={statutColor[selected.statut]} text={statutLabel[selected.statut]} />}
          </Space>
        }
        open={drawer}
        onClose={() => setDrawer(false)}
        width={520}
        extra={
          <Space>
            {selected && selectedBL && (
              <PDFDownloadLink
                document={
                  <FacturePDF
                    facture={selected}
                    client={clients.find(c => c.id === selected.client_id)}
                    bl={selectedBL}
                    produits={produits}
                    entreprise={settings}
                  />
                }
                fileName={`${selected.numero}.pdf`}
                style={{ textDecoration: 'none' }}
              >
                {({ loading }) => (
                  <Button icon={<FilePdfOutlined />} loading={loading}
                    style={{ color: '#dc2626', borderColor: '#dc2626' }}>
                    PDF
                  </Button>
                )}
              </PDFDownloadLink>
            )}
            {selected?.statut === 'émise' && (
              <>
                <Button icon={<EditOutlined />}
                  onClick={() => { openEdit(selected); setDrawer(false) }}>
                  Modifier
                </Button>
                <Button type="primary" icon={<CheckCircleOutlined />}
                  onClick={() => { marquerPayee(selected.id); setDrawer(false) }}
                  style={{ background: '#10b981', borderColor: '#10b981' }}>
                  Marquer payée
                </Button>
              </>
            )}
            {selected?.statut === 'annulée' && (
              <Popconfirm title="Supprimer cette facture définitivement ?"
                onConfirm={() => deleteFacture(selected.id)}
                okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Non">
                <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        {selected && (
          <>
            {(() => {
              const imp = impayes.find(i => i.id === selected.id)
              if (imp && imp.jours_retard > 0) {
                return (
                  <Alert
                    type={imp.niveau === 'critique' ? 'error' : 'warning'}
                    message={`${imp.jours_retard} jour(s) de retard de paiement`}
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                  />
                )
              }
              return null
            })()}

            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={6}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Numéro</Text>
                <Text code strong>{selected.numero}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Client</Text>
                <Text strong>{clients.find(c => c.id === selected.client_id)?.nom}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Date d'émission</Text>
                <Text>{new Date(selected.date_emission).toLocaleDateString('fr-FR')}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Date d'échéance</Text>
                <Text>{selected.date_echeance ? new Date(selected.date_echeance).toLocaleDateString('fr-FR') : '—'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Montant HT</Text>
                <Text strong>{(selected.montant_ht || 0).toFixed(2)} MAD</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">BL associé</Text>
                <Text code>#{selected.bon_livraison_id}</Text>
              </div>
            </Space>

            {/* ── RELANCES ── */}
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                Relances {relances.length > 0 && <Tag color="orange">{relances.length}</Tag>}
              </Title>
              {selected?.statut === 'émise' && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => openRelanceModal(selected)}
                  style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>
                  Nouvelle relance
                </Button>
              )}
            </div>

            {relLoading ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Chargement…</div>
            ) : relances.length === 0 ? (
              <Empty description="Aucune relance enregistrée" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={relances}
                renderItem={(rel, idx) => (
                  <List.Item
                    style={{ padding: '8px 0' }}
                    actions={[
                      <Tooltip title="Télécharger la lettre PDF">
                        <Button size="small" icon={<FilePdfOutlined />}
                          style={{ color: '#dc2626', borderColor: '#dc2626' }}
                          onClick={() => downloadRelancePDF(rel, idx + 1)} />
                      </Tooltip>,
                      <Popconfirm title="Supprimer cette relance ?"
                        onConfirm={() => deleteRelance(rel.id)} okText="Oui" cancelText="Non">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 12,
                          fontWeight: 700, color: '#fff', flexShrink: 0,
                          background: idx === 0 ? '#3b82f6' : idx === 1 ? '#f59e0b' : '#dc2626',
                        }}>
                          {idx + 1}
                        </div>
                      }
                      title={
                        <Text strong style={{ fontSize: 13 }}>
                          {idx === 0 ? '1ère' : idx === 1 ? '2ème' : `${idx + 1}ème`} relance —{' '}
                          {new Date(rel.date).toLocaleDateString('fr-FR')}
                        </Text>
                      }
                      description={rel.notes
                        ? <Text type="secondary" style={{ fontSize: 12 }}>{rel.notes}</Text>
                        : <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Sans note</Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}

            {/* ── AVOIRS ── */}
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                <FileProtectOutlined style={{ color: '#059669', marginRight: 6 }} />
                Avoirs {avoirs.length > 0 && <Tag color="green">{avoirs.length}</Tag>}
              </Title>
              {selected?.statut !== 'annulée' && (() => {
                const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant_ht), 0)
                const totalPaye   = paiements.reduce((s, p) => s + Number(p.montant), 0)
                const solde = Math.max(0, (selected?.montant_ht || 0) - totalAvoirs - totalPaye)
                return solde > 0.01 ? (
                  <Button size="small" icon={<PlusOutlined />} onClick={openAvoirModal}
                    style={{ color: '#059669', borderColor: '#059669' }}>
                    Émettre un avoir
                  </Button>
                ) : null
              })()}
            </div>

            {(() => {
              const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant_ht), 0)
              const solde = (selected?.montant_ht || 0) - totalAvoirs
              return avoirs.length > 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#059669' }}>Total avoirs émis : <strong>{totalAvoirs.toFixed(2)} MAD</strong></Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Solde restant : <strong>{solde.toFixed(2)} MAD</strong></Text>
                </div>
              )
            })()}

            {avoirLoading ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Chargement…</div>
            ) : avoirs.length === 0 ? (
              <Empty description="Aucun avoir émis" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={avoirs}
                renderItem={(av) => (
                  <List.Item
                    style={{ padding: '8px 0' }}
                    actions={[
                      <Tooltip title="Télécharger le PDF">
                        <Button size="small" icon={<FilePdfOutlined />}
                          style={{ color: '#059669', borderColor: '#059669' }}
                          onClick={() => downloadAvoirPDF(av)} />
                      </Tooltip>,
                      <Popconfirm title="Supprimer cet avoir ?"
                        onConfirm={() => deleteAvoir(av.id)} okText="Oui" cancelText="Non">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EuroOutlined style={{ color: '#fff', fontSize: 13 }} />
                        </div>
                      }
                      title={
                        <Text strong style={{ fontSize: 13 }}>
                          {av.numero} — {Number(av.montant_ht).toFixed(2)} MAD
                        </Text>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(av.date).toLocaleDateString('fr-FR')} ·{' '}
                          {{ annulation: 'Annulation', retour: 'Retour marchandise', commercial: 'Geste commercial' }[av.motif] || av.motif}
                          {av.notes ? ` · ${av.notes}` : ''}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}

            {/* ── PAIEMENTS ── */}
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                <CreditCardOutlined style={{ color: '#3b82f6', marginRight: 6 }} />
                Paiements {paiements.length > 0 && <Tag color="blue">{paiements.length}</Tag>}
              </Title>
              {selected?.statut === 'émise' && (() => {
                const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant_ht), 0)
                const totalPaye   = paiements.reduce((s, p) => s + Number(p.montant), 0)
                const solde = (selected?.montant_ht || 0) - totalAvoirs - totalPaye
                return solde > 0.01 ? (
                  <Button size="small" icon={<PlusOutlined />} onClick={openPaiModal}
                    style={{ color: '#3b82f6', borderColor: '#3b82f6' }}>
                    Enregistrer un paiement
                  </Button>
                ) : null
              })()}
            </div>

            {(() => {
              const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant_ht), 0)
              const montantNet  = Math.max(0, (selected?.montant_ht || 0) - totalAvoirs)
              const totalPaye   = paiements.reduce((s, p) => s + Number(p.montant), 0)
              const solde       = selected?.statut === 'payée' ? 0 : Math.max(0, montantNet - totalPaye)
              const totalPayeAff = selected?.statut === 'payée' ? montantNet : totalPaye
              return (paiements.length > 0 || selected?.statut === 'payée') && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#3b82f6' }}>Total encaissé : <strong>{totalPayeAff.toFixed(2)} MAD</strong></Text>
                  <Text style={{ fontSize: 12, color: solde < 0.01 ? '#10b981' : '#dc2626' }}>
                    Solde restant : <strong>{solde.toFixed(2)} MAD</strong>
                  </Text>
                </div>
              )
            })()}

            {paiLoading ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Chargement…</div>
            ) : paiements.length === 0 ? (
              <Empty description="Aucun paiement enregistré" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={paiements}
                renderItem={(p) => (
                  <List.Item
                    style={{ padding: '8px 0' }}
                    actions={[
                      <Popconfirm title="Supprimer ce paiement ?"
                        onConfirm={() => deletePaiement(p.id)} okText="Oui" cancelText="Non">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCardOutlined style={{ color: '#fff', fontSize: 13 }} />
                        </div>
                      }
                      title={
                        <Text strong style={{ fontSize: 13 }}>
                          {Number(p.montant).toFixed(2)} MAD
                        </Text>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(p.date).toLocaleDateString('fr-FR')} ·{' '}
                          {{ espèces: 'Espèces', virement: 'Virement', chèque: 'Chèque', carte: 'Carte bancaire' }[p.mode] || p.mode}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}

            <Divider />
            <Title level={5} style={{ marginBottom: 12 }}>Articles</Title>

            {blLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Chargement…</div>
            ) : !selectedBL ? (
              <Empty description="BL introuvable" />
            ) : (
              <Table
                size="small"
                dataSource={selectedBL.lignes}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'Produit',
                    dataIndex: 'produit_id',
                    render: (id) => {
                      const p = produits.find(p => p.id === id)
                      return p ? `${p.reference} — ${p.nom}` : `#${id}`
                    },
                  },
                  { title: 'Qté', dataIndex: 'quantite', width: 60 },
                  { title: 'Prix', dataIndex: 'prix_unitaire', width: 100, render: (v) => `${Number(v).toFixed(2)} MAD` },
                  { title: 'Remise', dataIndex: 'remise', width: 70, render: (v) => Number(v || 0) > 0 ? `${Number(v).toFixed(1)}%` : '—' },
                  {
                    title: 'S-total', width: 110,
                    render: (_, l) => <Text strong>{(l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100)).toFixed(2)} MAD</Text>,
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3} align="right"><Text strong>Total</Text></Table.Summary.Cell>
                    <Table.Summary.Cell>
                      <Text strong style={{ color: '#10b981' }}>{totalBL(selectedBL).toFixed(2)} MAD</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            )}
          </>
        )}
      </Drawer>

      {/* Modal relance */}
      <Modal
        title={
          <Space>
            <BellOutlined style={{ color: '#f59e0b' }} />
            Enregistrer une relance — {relModalFact?.numero}
          </Space>
        }
        open={relModal}
        onCancel={() => setRelModal(false)}
        onOk={() => relForm.submit()}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={relSubmitting}
        width={420}
      >
        <Form form={relForm} layout="vertical" onFinish={submitRelance} style={{ marginTop: 16 }}>
          <Form.Item name="date" label="Date de la relance" rules={[{ required: true, message: 'Date requise' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Note interne (optionnelle)">
            <Input.TextArea rows={3} placeholder="Ex : Appel téléphonique, promesse de paiement sous 15 jours…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal avoir */}
      <Modal
        title={
          <Space>
            <FileProtectOutlined style={{ color: '#059669' }} />
            Émettre un avoir — {selected?.numero}
          </Space>
        }
        open={avoirModal}
        onCancel={() => setAvoirModal(false)}
        onOk={() => avoirForm.submit()}
        okText="Émettre l'avoir"
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
        cancelText="Annuler"
        confirmLoading={avoirSubmitting}
        width={440}
      >
        <Form form={avoirForm} layout="vertical" onFinish={submitAvoir} style={{ marginTop: 16 }}>
          <Form.Item name="date" label="Date de l'avoir" rules={[{ required: true, message: 'Date requise' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="motif" label="Motif" rules={[{ required: true, message: 'Motif requis' }]}>
            <Select options={[
              { value: 'annulation', label: 'Annulation de facture' },
              { value: 'retour',     label: 'Retour marchandise' },
              { value: 'commercial', label: 'Geste commercial' },
            ]} />
          </Form.Item>
          <Form.Item name="montant_ht" label="Montant HT" rules={[{ required: true, message: 'Montant requis' }, { type: 'number', min: 0.01, message: 'Montant invalide' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              step={0.01}
              precision={2}
              addonAfter="MAD"
            />
          </Form.Item>
          <Form.Item name="notes" label="Note interne (optionnelle)">
            <Input.TextArea rows={2} placeholder="Ex : Accord du client le …" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal paiement */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined style={{ color: '#3b82f6' }} />
            Enregistrer un paiement — {selected?.numero}
          </Space>
        }
        open={paiModal}
        onCancel={() => setPaiModal(false)}
        onOk={() => paiForm.submit()}
        okText="Enregistrer"
        okButtonProps={{ style: { background: '#3b82f6', borderColor: '#3b82f6' } }}
        cancelText="Annuler"
        confirmLoading={paiSubmitting}
        width={440}
      >
        <Form form={paiForm} layout="vertical" onFinish={submitPaiement} style={{ marginTop: 16 }}>
          <Form.Item name="date" label="Date du paiement" rules={[{ required: true, message: 'Date requise' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="mode" label="Mode de paiement" rules={[{ required: true, message: 'Mode requis' }]}>
            <Select options={[
              { value: 'virement', label: 'Virement bancaire' },
              { value: 'chèque',   label: 'Chèque' },
              { value: 'espèces',  label: 'Espèces' },
              { value: 'carte',    label: 'Carte bancaire' },
            ]} />
          </Form.Item>
          <Form.Item name="montant" label="Montant (MAD)" rules={[{ required: true, message: 'Montant requis' }, { type: 'number', min: 0.01, message: 'Montant invalide' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} precision={2} addonAfter="MAD" />
          </Form.Item>
          <Form.Item name="notes" label="Note interne (optionnelle)">
            <Input.TextArea rows={2} placeholder="Ex : Virement reçu le …" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal modification facture */}
      <Modal
        title={`Modifier — ${editingFact?.numero}`}
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={() => editForm.submit()}
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={editLoading}
        width={440}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item name="date_emission" label="Date d'émission" rules={[{ required: true, message: 'Date requise' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="date_echeance" label="Date d'échéance">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Sélectionner une date" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Remarques optionnelles..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

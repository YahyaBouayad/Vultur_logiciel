import {
  Table, Button, Input, Space, Typography, Modal, Form,
  Select, InputNumber, Popconfirm, message, Tooltip, Drawer,
  Divider, Badge, Empty, Tag, DatePicker, Card,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, DeleteOutlined,
  CheckCircleOutlined, SendOutlined, MinusCircleOutlined,
  FileDoneOutlined, FilePdfOutlined, EditOutlined, CreditCardOutlined,
} from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PDFDownloadLink } from '@react-pdf/renderer'
import dayjs from 'dayjs'
import api from '../api/axios'
import { useSettings } from '../context/SettingsContext'
import BLPDF from '../components/pdf/BLPDF'

const { Title, Text } = Typography

const PAGE_SIZE   = 50
const CYCLE       = ['brouillon', 'validé', 'livré']
const statutColor = { brouillon: 'default', validé: 'processing', livré: 'success' }
const statutLabel = { brouillon: 'Brouillon', validé: 'Validé', livré: 'Livré' }

const nextAction = {
  brouillon: { label: 'Marquer validé', icon: <SendOutlined /> },
  validé:    { label: 'Marquer livré',  icon: <CheckCircleOutlined /> },
}

export default function BonsLivraison() {
  const [bons, setBons]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)

  const [search, setSearch]             = useState('')
  const [filterStatut, setFilterStatut] = useState(null)
  const [filterClient, setFilterClient] = useState(null)

  const [clients, setClients]   = useState([])
  const [produits, setProduits] = useState([])

  const [modalOpen, setModalOpen]     = useState(false)
  const [modalMode, setModalMode]     = useState('create')
  const [editingId, setEditingId]     = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [lignes, setLignes]           = useState([{ produit_id: null, quantite: 1, prix_unitaire: 0, remise: 0 }])

  const [drawer, setDrawer]       = useState(false)
  const [selected, setSelected]   = useState(null)
  const [encModal, setEncModal]   = useState(false)
  const [encSubmitting, setEncSubmitting] = useState(false)
  const [encForm] = Form.useForm()

  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useSettings()
  const [form] = Form.useForm()
  const searchTimer = useRef(null)

  // Charger clients et produits une seule fois
  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
    api.get('/produits').then(r => setProduits(r.data)).catch(() => {})
  }, [])

  const loadBons = async (pg, statut, clientId, q) => {
    setLoading(true)
    try {
      const params = { skip: (pg - 1) * PAGE_SIZE, limit: PAGE_SIZE }
      if (statut)   params.statut    = statut
      if (clientId) params.client_id = clientId
      if (q)        params.q         = q
      const r = await api.get('/bons-livraison', { params })
      setBons(r.data.items)
      setTotal(r.data.total)
    } catch {
      setBons([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Chargement initial
  useEffect(() => { loadBons(1, null, null, '') }, [])

  const handleStatutChange = (val) => {
    setFilterStatut(val)
    setPage(1)
    loadBons(1, val, filterClient, search)
  }

  const handleClientChange = (val) => {
    setFilterClient(val)
    setPage(1)
    loadBons(1, filterStatut, val, search)
  }

  const handleSearchChange = (val) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      loadBons(1, filterStatut, filterClient, val)
    }, 400)
  }

  const handlePageChange = (pg) => {
    setPage(pg)
    loadBons(pg, filterStatut, filterClient, search)
  }

  const openAdd = () => {
    form.resetFields()
    setLignes([{ produit_id: null, quantite: 1, prix_unitaire: 0, remise: 0 }])
    setModalMode('create')
    setEditingId(null)
    setModalOpen(true)
  }

  useEffect(() => {
    if (location.state?.openAdd) {
      openAdd()
      window.history.replaceState({}, '')
    }
    if (location.state?.openBL) {
      const id = location.state.openBL
      window.history.replaceState({}, '')
      api.get(`/bons-livraison/${id}`)
        .then(r => { setSelected(r.data); setDrawer(true) })
        .catch(() => {})
    }
    if (location.state?.duplicateBL) {
      const src = location.state.duplicateBL
      window.history.replaceState({}, '')
      form.setFieldsValue({ client_id: src.client_id, notes: src.notes })
      setLignes(src.lignes)
      setModalMode('create')
      setEditingId(null)
      setModalOpen(true)
    }
  }, [])

  const openEdit = (record) => {
    form.setFieldsValue({ client_id: record.client_id, notes: record.notes || '' })
    setLignes(record.lignes.map(l => ({
      produit_id:    l.produit_id,
      quantite:      l.quantite,
      prix_unitaire: Number(l.prix_unitaire),
      remise:        Number(l.remise || 0),
    })))
    setModalMode('edit')
    setEditingId(record.id)
    setModalOpen(true)
  }

  const handleSave = async (values) => {
    if (lignes.some(l => !l.produit_id)) {
      message.error('Sélectionnez un produit pour chaque ligne')
      return
    }
    setFormLoading(true)
    try {
      const payload = {
        client_id: values.client_id,
        notes: values.notes || null,
        lignes: lignes.map(l => ({
          produit_id:    l.produit_id,
          quantite:      l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise:        l.remise || 0,
        })),
      }
      if (modalMode === 'edit') {
        await api.put(`/bons-livraison/${editingId}`, payload)
        message.success('Bon de livraison modifié')
      } else {
        await api.post('/bons-livraison', payload)
        message.success('Bon de livraison créé')
      }
      setModalOpen(false)
      loadBons(page, filterStatut, filterClient, search)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleAvancer = async (bl) => {
    const idx = CYCLE.indexOf(bl.statut)
    if (idx >= CYCLE.length - 1) return
    try {
      await api.put(`/bons-livraison/${bl.id}/statut`, { statut: CYCLE[idx + 1] })
      message.success(`Statut mis à jour : ${statutLabel[CYCLE[idx + 1]]}`)
      loadBons(page, filterStatut, filterClient, search)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/bons-livraison/${id}`)
      message.success('Bon de livraison supprimé')
      loadBons(page, filterStatut, filterClient, search)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const updateLigne = (idx, field, value) => {
    const updated = [...lignes]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'produit_id') {
      const produit = produits.find(p => p.id === value)
      if (produit) updated[idx].prix_unitaire = Number(produit.prix)
    }
    setLignes(updated)
  }

  const encaisserBL = async (values) => {
    setEncSubmitting(true)
    try {
      const r = await api.put(`/bons-livraison/${selected.id}/encaisser`, {
        mode_encaissement: values.mode,
        date_encaissement: values.date.format('YYYY-MM-DD'),
      })
      message.success('BL marqué comme réglé')
      setEncModal(false)
      encForm.resetFields()
      setSelected(r.data)
      loadBons(page, filterStatut, filterClient, search)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setEncSubmitting(false)
    }
  }

  const annulerEncaissement = async () => {
    try {
      const r = await api.delete(`/bons-livraison/${selected.id}/encaisser`)
      message.success('Encaissement annulé')
      setSelected(r.data)
      loadBons(page, filterStatut, filterClient, search)
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const genererFacture = async (bl) => {
    try {
      await api.post('/factures', { bon_livraison_id: bl.id })
      message.success('Facture générée')
      navigate('/factures')
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const addLigne    = () => setLignes([...lignes, { produit_id: null, quantite: 1, prix_unitaire: 0, remise: 0 }])
  const removeLigne = (idx) => setLignes(lignes.filter((_, i) => i !== idx))

  const totalBL = (bl) =>
    bl.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)

  const columns = [
    {
      title: 'N°',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      render: (v) => <Text code>#{v}</Text>,
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      key: 'client_id',
      render: (id) => {
        const c = clients.find(c => c.id === id)
        return <Text strong>{c?.nom || '—'}</Text>
      },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (v) => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      width: 120,
      render: (v) => <Badge status={statutColor[v]} text={statutLabel[v]} />,
    },
    {
      title: 'Articles',
      key: 'articles',
      width: 80,
      render: (_, r) => `${r.lignes.length} art.`,
    },
    {
      title: 'Total',
      key: 'total',
      width: 140,
      render: (_, r) => <Text strong>{totalBL(r).toFixed(2)} MAD</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Voir le détail">
            <Button size="small" onClick={() => { setSelected(record); setDrawer(true) }}>
              Détail
            </Button>
          </Tooltip>
          <PDFDownloadLink
            document={
              <BLPDF
                bl={record}
                client={clients.find(c => c.id === record.client_id)}
                produits={produits}
                entreprise={settings}
              />
            }
            fileName={`BL-${String(record.id).padStart(4, '0')}.pdf`}
            style={{ textDecoration: 'none' }}
          >
            {({ loading }) => (
              <Tooltip title="Télécharger PDF">
                <Button size="small" icon={<FilePdfOutlined />} loading={loading}
                  style={{ color: '#0ea5e9', borderColor: '#0ea5e9' }} />
              </Tooltip>
            )}
          </PDFDownloadLink>
          {record.statut !== 'livré' && (
            <Tooltip title="Modifier">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {nextAction[record.statut] && (
            <Tooltip title={nextAction[record.statut].label}>
              <Button size="small" type="primary" ghost
                icon={nextAction[record.statut].icon}
                onClick={() => handleAvancer(record)}
              />
            </Tooltip>
          )}
          {record.statut === 'livré' && (
            record.facture_id
              ? <Tag color="green" style={{ margin: 0 }}>Facturé</Tag>
              : record.encaisse
                ? (
                  <Space size={2}>
                    <Tag color="cyan" style={{ margin: 0 }}>Réglé</Tag>
                    <Tooltip title="Transformer en facture payée">
                      <Button size="small" icon={<FileDoneOutlined />}
                        onClick={() => genererFacture(record)}
                        style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
                      />
                    </Tooltip>
                  </Space>
                )
                : (
                  <Space size={2}>
                    <Tooltip title="Générer la facture">
                      <Button size="small" icon={<FileDoneOutlined />}
                        onClick={() => genererFacture(record)}
                        style={{ color: '#10b981', borderColor: '#10b981' }}
                      />
                    </Tooltip>
                    <Tooltip title="Régler sans facture">
                      <Button size="small" icon={<CreditCardOutlined />}
                        onClick={() => {
                          setSelected(record)
                          encForm.setFieldsValue({ date: dayjs(), mode: 'espèces' })
                          setEncModal(true)
                        }}
                        style={{ color: '#64748b', borderColor: '#cbd5e1' }}
                      />
                    </Tooltip>
                  </Space>
                )
          )}
          {record.statut !== 'livré' && (
            <Tooltip title="Supprimer">
              <Popconfirm
                title="Supprimer ce bon de livraison ?"
                onConfirm={() => handleDelete(record.id)}
                okText="Oui" cancelText="Non"
              >
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Bons de livraison</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Nouveau bon de livraison
        </Button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Rechercher par N°..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ width: 220 }}
            allowClear
            onClear={() => handleSearchChange('')}
          />
          <Select
            placeholder="Tous les statuts"
            allowClear
            style={{ width: 160 }}
            value={filterStatut}
            onChange={handleStatutChange}
            options={[
              { value: 'brouillon', label: 'Brouillon' },
              { value: 'validé',    label: 'Validé' },
              { value: 'livré',     label: 'Livré' },
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
          dataSource={bons}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: total,
            showTotal: (t) => `${t} bon(s)`,
            onChange: handlePageChange,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'Aucun bon de livraison' }}
        />
      </div>

      {/* Modal règlement sans facture */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined style={{ color: '#64748b' }} />
            Régler sans facture — BL #{selected?.id}
          </Space>
        }
        open={encModal}
        onCancel={() => setEncModal(false)}
        onOk={() => encForm.submit()}
        okText="Confirmer le règlement"
        cancelText="Annuler"
        confirmLoading={encSubmitting}
        width={420}
      >
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Montant total : <Text strong>{selected ? totalBL(selected).toFixed(2) : '—'} MAD</Text>
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            Aucune facture ne sera créée. Cette option est réservée aux arrangements exceptionnels.
          </Text>
        </div>
        <Form form={encForm} layout="vertical" onFinish={encaisserBL}>
          <Form.Item name="date" label="Date du règlement" rules={[{ required: true, message: 'Date requise' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="mode" label="Mode de paiement" rules={[{ required: true, message: 'Mode requis' }]}>
            <Select options={[
              { value: 'espèces',  label: 'Espèces' },
              { value: 'virement', label: 'Virement bancaire' },
              { value: 'chèque',   label: 'Chèque' },
              { value: 'carte',    label: 'Carte bancaire' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modale création / modification */}
      <Modal
        title={modalMode === 'edit' ? `Modifier le BL #${editingId}` : 'Nouveau bon de livraison'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={modalMode === 'edit' ? 'Enregistrer' : 'Créer'}
        cancelText="Annuler"
        confirmLoading={formLoading}
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="client_id" label="Client" rules={[{ required: true, message: 'Client requis' }]}>
              <Select
                placeholder="Sélectionner un client"
                options={clients.map(c => ({ value: c.id, label: c.nom }))}
                showSearch
                filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea placeholder="Remarques optionnelles..." autoSize={{ minRows: 1, maxRows: 3 }} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ fontSize: 13 }}>Lignes du bon</Divider>

          {/* En-têtes colonnes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 72px 150px 105px 110px 32px',
            gap: 8,
            paddingBottom: 6,
            borderBottom: '1px solid #e2e8f0',
            marginBottom: 8,
          }}>
            {['Produit', 'Qté', 'Prix unitaire', 'Remise', 'Sous-total', ''].map((h, i) => (
              <Text key={i} type="secondary" style={{ fontSize: 11, textAlign: i >= 1 && i <= 4 ? 'right' : 'left' }}>
                {h}
              </Text>
            ))}
          </div>

          {lignes.map((ligne, idx) => {
            const sousTotal = (ligne.quantite || 0) * (ligne.prix_unitaire || 0) * (1 - (ligne.remise || 0) / 100)
            return (
              <div key={idx} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 72px 150px 105px 110px 32px',
                gap: 8,
                marginBottom: 8,
                alignItems: 'center',
              }}>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <Select
                    placeholder="Sélectionner un produit..."
                    style={{ width: '100%' }}
                    value={ligne.produit_id}
                    onChange={(v) => updateLigne(idx, 'produit_id', v)}
                    options={produits.map(p => ({
                      value: p.id,
                      label: `${p.reference} — ${p.nom} (stock: ${p.stock})`,
                    }))}
                    showSearch
                    filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  />
                </div>
                <InputNumber
                  min={1}
                  value={ligne.quantite}
                  onChange={(v) => updateLigne(idx, 'quantite', v)}
                  style={{ width: '100%' }}
                />
                <InputNumber
                  min={0}
                  precision={2}
                  value={ligne.prix_unitaire}
                  onChange={(v) => updateLigne(idx, 'prix_unitaire', v)}
                  style={{ width: '100%' }}
                  addonAfter="MAD"
                />
                <InputNumber
                  min={0}
                  max={100}
                  precision={1}
                  value={ligne.remise || 0}
                  onChange={(v) => updateLigne(idx, 'remise', v || 0)}
                  style={{ width: '100%' }}
                  addonAfter="%"
                />
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 12 }}>{sousTotal.toFixed(2)}</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}> MAD</Text>
                </div>
                <Button
                  icon={<MinusCircleOutlined />}
                  danger
                  size="small"
                  disabled={lignes.length === 1}
                  onClick={() => removeLigne(idx)}
                />
              </div>
            )
          })}

          <Button type="dashed" onClick={addLigne} icon={<PlusOutlined />} block style={{ marginTop: 4 }}>
            + Ajouter une ligne
          </Button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingRight: 40 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px' }}>
              <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Total :</Text>
              <Text strong style={{ fontSize: 15 }}>
                {lignes.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0) * (1 - (l.remise || 0) / 100), 0).toFixed(2)} MAD
              </Text>
            </div>
          </div>
        </Form>
      </Modal>

      {/* Drawer détail */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontWeight: 700, fontSize: 16 }}>BL #{selected?.id}</Text>
            {selected && (
              <Tag color={statutColor[selected.statut]} style={{ margin: 0 }}>
                {statutLabel[selected.statut]}
              </Tag>
            )}
          </div>
        }
        open={drawer}
        onClose={() => setDrawer(false)}
        width={720}
        styles={{ body: { padding: 0, background: '#f8fafc' } }}
        extra={
          <Space>
            {selected && (
              <PDFDownloadLink
                document={
                  <BLPDF
                    bl={selected}
                    client={clients.find(c => c.id === selected.client_id)}
                    produits={produits}
                    entreprise={settings}
                  />
                }
                fileName={`BL-${String(selected.id).padStart(4, '0')}.pdf`}
                style={{ textDecoration: 'none' }}
              >
                {({ loading }) => (
                  <Button icon={<FilePdfOutlined />} loading={loading}
                    style={{ color: '#0ea5e9', borderColor: '#0ea5e9' }}>
                    PDF
                  </Button>
                )}
              </PDFDownloadLink>
            )}
            {selected?.statut !== 'livré' && (
              <Button icon={<EditOutlined />}
                onClick={() => { openEdit(selected); setDrawer(false) }}>
                Modifier
              </Button>
            )}
            {selected && nextAction[selected.statut] && (
              <Button type="primary"
                icon={nextAction[selected.statut].icon}
                onClick={() => { handleAvancer(selected); setDrawer(false) }}
                style={{ background: '#1e293b' }}>
                {nextAction[selected.statut].label}
              </Button>
            )}
          </Space>
        }
      >
        {selected && (() => {
          const client     = clients.find(c => c.id === selected.client_id)
          const total      = totalBL(selected)
          const qtyTotale  = selected.lignes.reduce((s, l) => s + l.quantite, 0)
          const hasRemise  = selected.lignes.some(l => Number(l.remise || 0) > 0)
          return (
            <>
              {/* ── Header gradient ── */}
              <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '22px 24px 26px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Client</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>{client?.nom || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Date</div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                      {new Date(selected.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  {client?.adresse && (
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Adresse</div>
                      <div style={{ color: '#cbd5e1', fontSize: 13 }}>{client.adresse}</div>
                    </div>
                  )}
                  {client?.telephone && (
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Téléphone</div>
                      <div style={{ color: '#cbd5e1', fontSize: 13 }}>{client.telephone}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── KPI cards ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '16px 20px 4px' }}>
                <Card size="small" style={{ borderRadius: 10, borderTop: '3px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total HT</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#10b981', lineHeight: 1.1 }}>{total.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>MAD</div>
                </Card>
                <Card size="small" style={{ borderRadius: 10, borderTop: '3px solid #3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Articles</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#3b82f6', lineHeight: 1.1 }}>{selected.lignes.length}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>ligne{selected.lignes.length !== 1 ? 's' : ''}</div>
                </Card>
                <Card size="small" style={{ borderRadius: 10, borderTop: '3px solid #8b5cf6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Qté totale</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#8b5cf6', lineHeight: 1.1 }}>{qtyTotale}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>unités</div>
                </Card>
              </div>

              {/* ── Notes ── */}
              {selected.notes && (
                <div style={{ margin: '10px 20px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 3 }}>Note</div>
                  <Text style={{ color: '#78350f', fontSize: 13 }}>{selected.notes}</Text>
                </div>
              )}

              {/* ── Règlement direct ── */}
              {selected.statut === 'livré' && !selected.facture_id && (
                <div style={{ margin: '12px 20px 0' }}>
                  {selected.encaisse ? (
                    <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>
                          <CheckCircleOutlined style={{ marginRight: 6 }} />
                          Réglé directement — {total.toFixed(2)} MAD
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(selected.date_encaissement).toLocaleDateString('fr-FR')} ·{' '}
                          {{ espèces: 'Espèces', virement: 'Virement', chèque: 'Chèque', carte: 'Carte bancaire' }[selected.mode_encaissement] || selected.mode_encaissement}
                        </Text>
                      </div>
                      <Space>
                        <Tooltip title="Convertir en facture payée">
                          <Button size="small" icon={<FileDoneOutlined />}
                            onClick={() => { setDrawer(false); genererFacture(selected) }}
                            style={{ color: '#7c3aed', borderColor: '#7c3aed' }}>
                            Facture
                          </Button>
                        </Tooltip>
                        <Popconfirm title="Annuler l'encaissement ?" onConfirm={annulerEncaissement} okText="Oui" cancelText="Non">
                          <Button size="small" danger>Annuler</Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <Button
                        icon={<CreditCardOutlined />}
                        onClick={() => { encForm.setFieldsValue({ date: dayjs(), mode: 'espèces' }); setEncModal(true) }}
                        style={{ color: '#64748b', borderColor: '#cbd5e1', fontSize: 12 }}
                      >
                        Régler sans facture (arrangement)
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Articles ── */}
              <div style={{ padding: '16px 20px 0' }}>
                <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 10 }}>
                  Détail des articles
                </Text>

                {selected.lignes.length === 0 ? (
                  <Empty description="Aucune ligne" />
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Colonnes header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 56px 120px 72px 110px',
                      gap: 8,
                      padding: '8px 14px',
                      background: '#f1f5f9',
                      borderBottom: '1px solid #e2e8f0',
                    }}>
                      {['Produit', 'Qté', 'Prix unit.', 'Remise', 'Sous-total'].map((h, i) => (
                        <Text key={i} type="secondary" style={{ fontSize: 11, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</Text>
                      ))}
                    </div>

                    {selected.lignes.map((l, i) => {
                      const p       = produits.find(x => x.id === l.produit_id)
                      const remise  = Number(l.remise || 0)
                      const sousTotal = l.quantite * Number(l.prix_unitaire) * (1 - remise / 100)
                      return (
                        <div key={l.id || i} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 56px 120px 72px 110px',
                          gap: 8,
                          padding: '11px 14px',
                          background: i % 2 === 0 ? '#fff' : '#f8fafc',
                          borderBottom: i < selected.lignes.length - 1 ? '1px solid #f0f0f0' : 'none',
                          alignItems: 'center',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p?.nom || '—'}
                            </div>
                            {p?.reference && (
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{p.reference}</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <Tag color="blue" style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{l.quantite}</Tag>
                          </div>
                          <Text style={{ fontSize: 12, textAlign: 'right', display: 'block', color: '#475569' }}>
                            {Number(l.prix_unitaire).toFixed(2)} MAD
                          </Text>
                          <div style={{ textAlign: 'right' }}>
                            {remise > 0
                              ? <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>{remise}%</Tag>
                              : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                            }
                          </div>
                          <Text strong style={{ fontSize: 13, textAlign: 'right', display: 'block', color: '#1e293b' }}>
                            {sousTotal.toFixed(2)} MAD
                          </Text>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Total footer ── */}
              <div style={{ margin: '16px 20px 24px', background: '#1e293b', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>{qtyTotale} unité{qtyTotale !== 1 ? 's' : ''} · {selected.lignes.length} ligne{selected.lignes.length !== 1 ? 's' : ''}{hasRemise ? ' · avec remises' : ''}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Total hors taxes</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{total.toFixed(2)}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>MAD</div>
                </div>
              </div>
            </>
          )
        })()}
      </Drawer>
    </div>
  )
}

import {
  Table, Button, Input, Space, Typography, Modal, Form,
  Select, InputNumber, Popconfirm, message, Drawer,
  Divider, Badge, Empty, DatePicker, Tabs, Tag, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, SendOutlined, StopOutlined,
  FilePdfOutlined, MinusCircleOutlined, EyeOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { pdf } from '@react-pdf/renderer'
import api from '../api/axios'
import { useSettings } from '../context/SettingsContext'
import DemandeAchatPDF from '../components/pdf/DemandeAchatPDF'

const { Title, Text } = Typography

const STATUT_COLOR = {
  brouillon: 'default',
  envoyée:   'processing',
  validée:   'success',
  annulée:   'error',
}
const STATUT_LABEL = {
  brouillon: 'Brouillon',
  envoyée:   'Envoyée',
  validée:   'Validée',
  annulée:   'Annulée',
}

const totalDA = (da) =>
  (da.lignes || []).reduce((s, l) => s + Number(l.quantite_demandee) * Number(l.prix_unitaire), 0)

const fmt = (n, devise = 'MAD') => {
  const p = Number(n).toFixed(2).split('.')
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return p.join(',') + ' ' + devise
}
const fmtQte = (n, unite = '') => {
  const v = Number(n)
  const s = v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
  return unite ? `${s} ${unite}` : s
}

export default function DemandesAchat() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const devise = settings.devise || 'MAD'

  const [demandes, setDemandes]   = useState([])
  const [filtered, setFiltered]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState('actives')

  const [fournisseurs, setFournisseurs] = useState([])
  const [produits, setProduits]         = useState([])

  // Modal création / édition
  const [modalOpen, setModalOpen]     = useState(false)
  const [modalMode, setModalMode]     = useState('create')
  const [editingId, setEditingId]     = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [lignes, setLignes]           = useState([{ produit_id: null, quantite_demandee: 1, prix_unitaire: 0 }])
  const [tvaActive, setTvaActive]     = useState(false)
  const [form] = Form.useForm()

  // Drawer détail
  const [drawer, setDrawer]   = useState(false)
  const [selected, setSelected] = useState(null)

  // Modal validation
  const [validerOpen, setValiderOpen]         = useState(false)
  const [validerDA, setValiderDA]             = useState(null)
  const [validerLignes, setValiderLignes]     = useState([])
  const [tvaValiderActive, setTvaValiderActive] = useState(false)
  const [validerForm] = Form.useForm()
  const [validerLoading, setValiderLoading]   = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [da, f, p] = await Promise.all([
        api.get('/demandes-achat'),
        api.get('/fournisseurs'),
        api.get('/produits'),
      ])
      setDemandes(da.data)
      setFournisseurs(f.data)
      setProduits(p.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    const base = demandes.filter(d => {
      return (
        d.numero.toLowerCase().includes(q) ||
        (d.fournisseur_nom || '').toLowerCase().includes(q)
      )
    })
    setFiltered(base)
  }, [search, demandes])

  const actives = useMemo(
    () => filtered.filter(d => d.statut !== 'validée' && d.statut !== 'annulée'),
    [filtered]
  )
  const archivees = useMemo(
    () => filtered.filter(d => d.statut === 'validée' || d.statut === 'annulée'),
    [filtered]
  )

  /* ── Actions API ── */
  const openCreate = () => {
    setModalMode('create')
    setEditingId(null)
    setLignes([{ produit_id: null, quantite_demandee: 1, prix_unitaire: 0 }])
    setTvaActive(false)
    form.resetFields()
    form.setFieldsValue({ date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (da) => {
    setModalMode('edit')
    setEditingId(da.id)
    const ls = da.lignes.map(l => ({
      produit_id: l.produit_id,
      quantite_demandee: l.quantite_demandee,
      prix_unitaire: l.prix_unitaire,
    }))
    setLignes(ls)
    setTvaActive(false)
    form.setFieldsValue({
      fournisseur_id: da.fournisseur_id,
      date: da.date ? dayjs(da.date) : dayjs(),
      notes: da.notes,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    if (lignes.some(l => !l.produit_id)) {
      message.error('Sélectionnez un produit pour chaque ligne')
      return
    }
    setFormLoading(true)
    try {
      const payload = {
        fournisseur_id: values.fournisseur_id,
        date: values.date?.format('YYYY-MM-DD'),
        notes: values.notes || null,
        lignes: lignes.map(l => ({
          produit_id: l.produit_id,
          quantite_demandee: l.quantite_demandee,
          prix_unitaire: tvaActive
            ? Math.round((l.prix_unitaire || 0) * 1.2 * 100) / 100
            : l.prix_unitaire,
        })),
      }
      if (modalMode === 'create') {
        await api.post('/demandes-achat', payload)
        message.success('Demande créée')
      } else {
        await api.put(`/demandes-achat/${editingId}`, {
          notes: payload.notes,
          lignes: payload.lignes,
        })
        message.success('Demande mise à jour')
      }
      setModalOpen(false)
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEnvoyer = async (da) => {
    try {
      await api.post(`/demandes-achat/${da.id}/envoyer`)
      message.success('Demande marquée envoyée')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const handleAnnuler = async (da) => {
    try {
      await api.post(`/demandes-achat/${da.id}/annuler`)
      message.success('Demande annulée')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/demandes-achat/${id}`)
      message.success('Demande supprimée')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  /* ── Validation ── */
  const openValider = (da) => {
    setValiderDA(da)
    const ls = da.lignes.map(l => ({
      produit_id: l.produit_id,
      produit_nom: l.produit_nom,
      produit_unite: l.produit_unite,
      quantite_demandee: l.quantite_demandee,
      quantite_confirmee: l.quantite_demandee,
      prix_unitaire: l.prix_unitaire,
    }))
    setValiderLignes(ls)
    setTvaValiderActive(false)
    validerForm.setFieldsValue({
      date_bc: dayjs(),
      notes_bc: '',
    })
    setValiderOpen(true)
  }

  const handleValider = async (values) => {
    setValiderLoading(true)
    try {
      await api.post(`/demandes-achat/${validerDA.id}/valider`, {
        lignes: validerLignes.map(l => ({
          produit_id: l.produit_id,
          quantite_confirmee: l.quantite_confirmee,
          prix_unitaire: tvaValiderActive
            ? Math.round((l.prix_unitaire || 0) * 1.2 * 100) / 100
            : l.prix_unitaire,
        })),
        date_bc: values.date_bc?.format('YYYY-MM-DD'),
        notes_bc: values.notes_bc || null,
      })
      message.success('Demande validée — Bon de commande créé')
      setValiderOpen(false)
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setValiderLoading(false)
    }
  }

  /* ── Export PDF ── */
  const handlePDF = async (da) => {
    const entreprise = {
      nom:             settings.nom,
      adresse:         settings.adresse,
      ville:           settings.ville,
      telephone:       settings.telephone,
      ice:             settings.ice,
      rc:              settings.rc,
      logo:            settings.logo,
      couleurPrimaire: settings.couleurPrimaire,
      couleurAccent:   settings.couleurAccent,
      devise:          settings.devise,
      piedDePage:      settings.piedDePage,
      mentionsLegales: settings.mentionsLegales,
    }
    const blob = await pdf(<DemandeAchatPDF demande={da} entreprise={entreprise} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${da.numero.replace(/\//g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Colonnes ── */
  const columns = [
    {
      title: 'N°',
      dataIndex: 'numero',
      render: (v, r) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => { setSelected(r); setDrawer(true) }}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Fournisseur',
      dataIndex: 'fournisseur_nom',
      render: v => <Text strong>{v}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      render: v => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: v => <Tag color={STATUT_COLOR[v]}>{STATUT_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Articles',
      render: (_, r) => `${(r.lignes || []).length} ligne${(r.lignes || []).length > 1 ? 's' : ''}`,
    },
    {
      title: 'Total estimé',
      render: (_, r) => <Text strong style={{ color: '#1e293b' }}>{fmt(totalDA(r), settings.devise || 'MAD')}</Text>,
    },
    {
      title: 'Actions',
      render: (_, r) => {
        const canEdit   = r.statut === 'brouillon' || r.statut === 'envoyée'
        const canSend   = r.statut === 'brouillon'
        const canValid  = r.statut === 'brouillon' || r.statut === 'envoyée'
        const canCancel = r.statut === 'brouillon' || r.statut === 'envoyée'
        const canDelete = r.statut !== 'validée'
        return (
          <Space>
            <Tooltip title="Télécharger PDF">
              <Button icon={<FilePdfOutlined />} size="small" onClick={() => handlePDF(r)} />
            </Tooltip>
            {canEdit && (
              <Tooltip title="Modifier">
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {canSend && (
              <Tooltip title="Marquer envoyée">
                <Button icon={<SendOutlined />} size="small" onClick={() => handleEnvoyer(r)} />
              </Tooltip>
            )}
            {canValid && (
              <Tooltip title="Valider → Bon de commande">
                <Button icon={<CheckCircleOutlined />} size="small" type="primary"
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  onClick={() => openValider(r)} />
              </Tooltip>
            )}
            {canCancel && (
              <Popconfirm title="Annuler cette demande ?" onConfirm={() => handleAnnuler(r)} okText="Oui" cancelText="Non">
                <Tooltip title="Annuler">
                  <Button icon={<StopOutlined />} size="small" danger />
                </Tooltip>
              </Popconfirm>
            )}
            {canDelete && (
              <Popconfirm title="Supprimer définitivement ?" onConfirm={() => handleDelete(r.id)} okText="Oui" cancelText="Non">
                <Tooltip title="Supprimer">
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const tabItems = [
    {
      key: 'actives',
      label: (
        <span>
          Demandes actives
          {actives.length > 0 && (
            <span style={{
              background: '#3b82f6', color: '#fff', borderRadius: 10,
              fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 6,
            }}>{actives.length}</span>
          )}
        </span>
      ),
      children: (
        <Table
          columns={columns}
          dataSource={actives}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="Aucune demande active" /> }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="small"
        />
      ),
    },
    {
      key: 'archivees',
      label: 'Validées & annulées',
      children: (
        <Table
          columns={columns}
          dataSource={archivees}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="Aucune demande archivée" /> }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="small"
        />
      ),
    },
  ]

  /* ── Ligne helper ── */
  const updateLigne = (i, field, val) => {
    setLignes(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      if (field === 'produit_id' && val) {
        const p = produits.find(x => x.id === val)
        if (p && !next[i].prix_unitaire) next[i].prix_unitaire = Number(p.prix) || 0
      }
      return next
    })
  }

  const totalLignes = lignes.reduce((s, l) => s + Number(l.quantite_demandee || 0) * Number(l.prix_unitaire || 0), 0)
  const totalValider = validerLignes.reduce((s, l) => s + Number(l.quantite_confirmee || 0) * Number(l.prix_unitaire || 0), 0)

  return (
    <div>
      {/* ── Titre ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Demandes d'achat</Title>
          <Text type="secondary">Créez vos demandes, envoyez-les aux fournisseurs et validez-les en bons de commande</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}
          onClick={openCreate}>
          Nouvelle demande
        </Button>
      </div>

      {/* ── Barre de recherche ── */}
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Rechercher par numéro ou fournisseur…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* ── Onglets ── */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      />

      {/* ── Modal Création / Édition ── */}
      <Modal
        title={modalMode === 'create' ? 'Nouvelle demande d\'achat' : 'Modifier la demande'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={formLoading}
        okText={modalMode === 'create' ? 'Créer' : 'Enregistrer'}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="fournisseur_id" label="Fournisseur" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Sélectionner un fournisseur"
                disabled={modalMode === 'edit'}
                options={fournisseurs.map(f => ({ value: f.id, label: f.nom }))}
              />
            </Form.Item>
            <Form.Item name="date" label="Date" style={{ width: 160 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Remarques, délai souhaité, etc." />
          </Form.Item>
        </Form>

        <Divider>Articles demandés</Divider>
        {lignes.map((ligne, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Produit"
              style={{ flex: 2 }}
              value={ligne.produit_id}
              onChange={v => updateLigne(i, 'produit_id', v)}
              options={produits.map(p => ({ value: p.id, label: `${p.nom} (${p.reference})` }))}
            />
            <InputNumber
              min={0.001} step={0.001} precision={3}
              value={ligne.quantite_demandee}
              onChange={v => updateLigne(i, 'quantite_demandee', v)}
              style={{ width: 110 }}
              placeholder="Quantité"
            />
            <InputNumber
              min={0} step={0.01} precision={2}
              value={ligne.prix_unitaire}
              onChange={v => updateLigne(i, 'prix_unitaire', v)}
              style={{ width: 120 }}
              placeholder="Prix U."
              addonAfter={settings.devise || 'MAD'}
            />
            <Button
              type="text" danger icon={<MinusCircleOutlined />}
              onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
              disabled={lignes.length <= 1}
            />
          </div>
        ))}
        <Button
          type="dashed" icon={<PlusOutlined />} block
          onClick={() => setLignes(prev => [...prev, { produit_id: null, quantite_demandee: 1, prix_unitaire: 0 }])}
          style={{ marginTop: 4 }}
        >
          Ajouter un article
        </Button>
        <div style={{ marginTop: 12 }}>
          {tvaActive && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: 1, marginBottom: 1, borderRadius: '8px 8px 0 0', overflow: 'hidden',
              border: '1px solid #e2e8f0', borderBottom: 'none',
            }}>
              <div style={{ background: '#f8fafc', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total HT</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginTop: 3 }}>{fmt(totalLignes, devise)}</div>
              </div>
              <div style={{ background: '#fffbeb', padding: '10px 14px', textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ color: '#b45309', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TVA 20%</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginTop: 3 }}>{fmt(totalLignes * 0.2, devise)}</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: '#166534', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total TTC</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d', marginTop: 3 }}>{fmt(totalLignes * 1.2, devise)}</div>
              </div>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: '#f8fafc',
            borderRadius: tvaActive ? '0 0 8px 8px' : 8,
            border: tvaActive ? '1px solid #e2e8f0' : 'none',
          }}>
            <Tooltip title={tvaActive ? "Désactiver l'affichage TVA" : 'Afficher le détail HT / TVA 20% / TTC'}>
              <Button
                size="small"
                type={tvaActive ? 'primary' : 'default'}
                style={tvaActive ? { background: '#b45309', borderColor: '#b45309' } : {}}
                onClick={() => setTvaActive(v => !v)}
              >
                TVA 20%
              </Button>
            </Tooltip>
            <Text strong style={{ fontSize: 15 }}>
              {tvaActive ? 'Total HT' : 'Total estimé'} : {fmt(totalLignes, devise)}
            </Text>
          </div>
        </div>
      </Modal>

      {/* ── Modal Validation ── */}
      <Modal
        title="Valider la demande → Bon de commande"
        open={validerOpen}
        onCancel={() => setValiderOpen(false)}
        onOk={() => validerForm.submit()}
        confirmLoading={validerLoading}
        okText="Valider et créer le BC"
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
        width={720}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Vérifiez et ajustez les quantités et prix avant de créer le bon de commande.
        </Text>
        <Form form={validerForm} layout="inline" onFinish={handleValider} style={{ marginBottom: 16 }}>
          <Form.Item name="date_bc" label="Date du BC">
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="notes_bc" label="Notes BC">
            <Input placeholder="Notes pour le BC" style={{ width: 200 }} />
          </Form.Item>
        </Form>

        <Divider>Articles à confirmer</Divider>
        {validerLignes.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Text style={{ flex: 2 }}>{l.produit_nom}</Text>
            <Text type="secondary" style={{ width: 100, textAlign: 'right', fontSize: 12 }}>
              Demandé : {fmtQte(l.quantite_demandee, l.produit_unite)}
            </Text>
            <InputNumber
              min={0.001} step={0.001} precision={3}
              value={l.quantite_confirmee}
              onChange={v => setValiderLignes(prev => {
                const next = [...prev]; next[i] = { ...next[i], quantite_confirmee: v }; return next
              })}
              style={{ width: 110 }}
              addonAfter={l.produit_unite}
            />
            <InputNumber
              min={0} step={0.01} precision={2}
              value={l.prix_unitaire}
              onChange={v => setValiderLignes(prev => {
                const next = [...prev]; next[i] = { ...next[i], prix_unitaire: v }; return next
              })}
              style={{ width: 120 }}
              addonAfter={settings.devise || 'MAD'}
            />
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          {tvaValiderActive && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: 1, marginBottom: 1, borderRadius: '8px 8px 0 0', overflow: 'hidden',
              border: '1px solid #e2e8f0', borderBottom: 'none',
            }}>
              <div style={{ background: '#f8fafc', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total HT</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginTop: 3 }}>{fmt(totalValider, devise)}</div>
              </div>
              <div style={{ background: '#fffbeb', padding: '10px 14px', textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ color: '#b45309', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TVA 20%</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginTop: 3 }}>{fmt(totalValider * 0.2, devise)}</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: '#166534', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total TTC</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d', marginTop: 3 }}>{fmt(totalValider * 1.2, devise)}</div>
              </div>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: '#f8fafc',
            borderRadius: tvaValiderActive ? '0 0 8px 8px' : 8,
            border: tvaValiderActive ? '1px solid #e2e8f0' : 'none',
          }}>
            <Tooltip title={tvaValiderActive ? "Désactiver l'affichage TVA" : 'Afficher le détail HT / TVA 20% / TTC'}>
              <Button
                size="small"
                type={tvaValiderActive ? 'primary' : 'default'}
                style={tvaValiderActive ? { background: '#b45309', borderColor: '#b45309' } : {}}
                onClick={() => setTvaValiderActive(v => !v)}
              >
                TVA 20%
              </Button>
            </Tooltip>
            <Text strong style={{ fontSize: 15 }}>
              {tvaValiderActive ? 'Total HT' : 'Total BC estimé'} : {fmt(totalValider, devise)}
            </Text>
          </div>
        </div>
      </Modal>

      {/* ── Drawer Détail ── */}
      <Drawer
        title={selected ? `Détail — ${selected.numero}` : ''}
        open={drawer}
        onClose={() => setDrawer(false)}
        width={520}
      >
        {selected && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Tag color={STATUT_COLOR[selected.statut]}>{STATUT_LABEL[selected.statut]}</Tag>
              {selected.bon_commande_id && (
                <Button
                  type="link"
                  size="small"
                  style={{ paddingLeft: 8, fontSize: 12, color: '#3b82f6' }}
                  onClick={() => { setDrawer(false); navigate('/achats') }}
                >
                  → Voir BC #{String(selected.bon_commande_id).padStart(4, '0')}
                </Button>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Fournisseur : </Text><Text>{selected.fournisseur_nom}</Text><br />
              <Text strong>Date : </Text><Text>{selected.date ? new Date(selected.date).toLocaleDateString('fr-FR') : '—'}</Text><br />
              {selected.notes && <><Text strong>Notes : </Text><Text>{selected.notes}</Text></>}
            </div>
            <Divider>Articles</Divider>
            {(selected.lignes || []).map((l, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid #f0f0f0',
              }}>
                <div>
                  <Text strong>{l.produit_nom}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{l.produit_reference}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text>Dem. : {fmtQte(l.quantite_demandee, l.produit_unite)}</Text>
                  {l.quantite_confirmee != null && (
                    <><br /><Text type="success">Conf. : {fmtQte(l.quantite_confirmee, l.produit_unite)}</Text></>
                  )}
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {fmt(l.prix_unitaire, settings.devise || 'MAD')} / {l.produit_unite}
                  </Text>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Text strong style={{ fontSize: 16 }}>
                Total : {fmt(totalDA(selected), settings.devise || 'MAD')}
              </Text>
            </div>
            <Divider />
            <Button icon={<FilePdfOutlined />} onClick={() => handlePDF(selected)} block>
              Télécharger le PDF
            </Button>
          </>
        )}
      </Drawer>
    </div>
  )
}

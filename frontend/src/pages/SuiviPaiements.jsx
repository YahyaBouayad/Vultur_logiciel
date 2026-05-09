import {
  Typography, Select, Input, Card, Row, Col, Tabs, Table, Tag, Button,
  Tooltip, Modal, Form, DatePicker, InputNumber, Popconfirm, message,
  Progress, Empty, Space, Statistic
} from 'antd'
import {
  CheckCircleOutlined, ExclamationCircleOutlined, PieChartOutlined,
  SearchOutlined, PlusOutlined, DeleteOutlined, ArrowUpOutlined,
  WalletOutlined, FileDoneOutlined, CreditCardOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useMemo } from 'react'
import dayjs from 'dayjs'
import api from '../api/axios'
import { useImpayes } from '../context/ImpayesContext'

const { Title, Text } = Typography

const MODE_OPTIONS = [
  { value: 'virement',  label: 'Virement bancaire' },
  { value: 'chèque',    label: 'Chèque' },
  { value: 'espèces',   label: 'Espèces' },
  { value: 'carte',     label: 'Carte bancaire' },
]

const MODE_COLOR = {
  virement: 'blue',
  chèque:   'purple',
  espèces:  'green',
  carte:    'cyan',
}

function statutPaiement(row) {
  // Le statut facture est prioritaire : si payée, c'est soldé
  if (row.statut === 'payée') return 'soldee'
  if (row.solde <= 0.01)      return 'soldee'
  if (row.montant_paye > 0)   return 'partiel'
  return 'en_attente'
}

function StatutTag({ row }) {
  const s = statutPaiement(row)
  if (s === 'soldee')  return <Tag color="success" icon={<CheckCircleOutlined />}>Payée</Tag>
  if (s === 'partiel') return <Tag color="processing">Partiel</Tag>
  return <Tag color="default">En attente</Tag>
}

export default function SuiviPaiements() {
  const { refresh: refreshImpayes } = useImpayes()
  const [data, setData]           = useState([])
  const [encaisses, setEncaisses] = useState([])
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(false)

  const [search, setSearch]             = useState('')
  const [filterClient, setFilterClient] = useState(null)
  const [activeTab, setActiveTab]       = useState('en_attente')

  const [blsEnAttente, setBlsEnAttente] = useState([])

  const [paiModal, setPaiModal]       = useState(false)
  const [paiRow, setPaiRow]           = useState(null)
  const [paiSubmitting, setPaiSubmitting] = useState(false)
  const [paiForm] = Form.useForm()

  const [encBlModal, setEncBlModal]           = useState(false)
  const [encBlSelected, setEncBlSelected]     = useState(null)
  const [encBlSubmitting, setEncBlSubmitting] = useState(false)
  const [encBlForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [sv, cl, enc, bls] = await Promise.all([
        api.get('/suivi-paiements'),
        api.get('/clients'),
        api.get('/bons-livraison/encaisses'),
        api.get('/bons-livraison', { params: { statut: 'livré', limit: 500 } }),
      ])
      setData(sv.data)
      setClients(cl.data)
      setEncaisses(enc.data)
      setBlsEnAttente(bls.data.items.filter(bl => !bl.facture_id && !bl.encaisse))
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const nomClient = (id) => clients.find(c => c.id === id)?.nom || '—'

  // Filtrage global
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(r => {
      const matchClient = !filterClient || r.client_id === filterClient
      const matchSearch = !q || r.facture_numero.toLowerCase().includes(q) || nomClient(r.client_id).toLowerCase().includes(q)
      return matchClient && matchSearch
    })
  }, [data, search, filterClient, clients])

  // Répartition par onglet (pour la table — suit les filtres)
  const soldesRestants    = useMemo(() => filtered.filter(r => statutPaiement(r) === 'en_attente'), [filtered])
  const paiementsPartiels = useMemo(() => filtered.filter(r => statutPaiement(r) === 'partiel'), [filtered])
  const facturesPayees    = useMemo(() => filtered.filter(r => statutPaiement(r) === 'soldee'), [filtered])

  // Totaux non filtrés pour les KPI (vue globale indépendante des filtres)
  const allSoldesRestants    = useMemo(() => data.filter(r => statutPaiement(r) === 'en_attente'), [data])
  const allPaiementsPartiels = useMemo(() => data.filter(r => statutPaiement(r) === 'partiel'), [data])
  const allFacturesPayees    = useMemo(() => data.filter(r => statutPaiement(r) === 'soldee'), [data])

  const totalBL = (bl) =>
    bl.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)

  // BLs livrés sans facture et non encaissés
  const blsEnAttenteFiltres = useMemo(() => {
    const q = search.toLowerCase()
    return blsEnAttente.filter(r => {
      const matchClient = !filterClient || r.client_id === filterClient
      const matchSearch = !q || `bl #${r.id}`.includes(q) || nomClient(r.client_id).toLowerCase().includes(q)
      return matchClient && matchSearch
    })
  }, [blsEnAttente, search, filterClient, clients])

  // Filtrage encaissements directs (BL sans facture)
  const encaissesFiltres = useMemo(() => {
    const q = search.toLowerCase()
    return encaisses.filter(r => {
      const matchClient = !filterClient || r.client_id === filterClient
      const matchSearch = !q || `BL #${r.id}`.toLowerCase().includes(q) || nomClient(r.client_id).toLowerCase().includes(q)
      return matchClient && matchSearch
    })
  }, [encaisses, search, filterClient, clients])

  // KPIs — toujours calculés sur les données non filtrées (vue globale)
  const totalEncaisseFactures = useMemo(() => data.reduce((s, r) => s + r.montant_paye, 0), [data])
  const totalEncaisseDirects  = useMemo(() => encaisses.reduce((s, r) => s + r.montant, 0), [encaisses])
  const totalEncaisse  = totalEncaisseFactures + totalEncaisseDirects
  const resteRecouvrer = useMemo(() => allSoldesRestants.reduce((s, r) => s + r.solde, 0), [allSoldesRestants])
  const restePartiel   = useMemo(() => allPaiementsPartiels.reduce((s, r) => s + r.solde, 0), [allPaiementsPartiels])
  const totalBLAttente = useMemo(() => blsEnAttente.reduce((s, r) => s + totalBL(r), 0), [blsEnAttente])

  // Table selon onglet
  const tableData = activeTab === 'soldes'    ? soldesRestants
                  : activeTab === 'partiels'  ? paiementsPartiels
                  : facturesPayees

  const openPaiModal = (row) => {
    setPaiRow(row)
    paiForm.setFieldsValue({ date: dayjs(), montant: +row.solde.toFixed(2), mode: 'virement', notes: '' })
    setPaiModal(true)
  }

  const submitPaiement = async (values) => {
    setPaiSubmitting(true)
    try {
      await api.post(`/factures/${paiRow.facture_id}/paiements`, {
        date:    values.date.format('YYYY-MM-DD'),
        montant: values.montant,
        mode:    values.mode,
        notes:   values.notes || null,
      })
      message.success('Paiement enregistré')
      setPaiModal(false)
      paiForm.resetFields()
      await load()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setPaiSubmitting(false)
    }
  }

  const genererFactureBL = async (bl) => {
    try {
      await api.post('/factures', { bon_livraison_id: bl.id })
      message.success('Facture générée — BL #' + bl.id)
      await load()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const openEncBlModal = (bl) => {
    setEncBlSelected(bl)
    encBlForm.setFieldsValue({ date: dayjs(), mode: 'espèces' })
    setEncBlModal(true)
  }

  const submitEncBl = async (values) => {
    setEncBlSubmitting(true)
    try {
      await api.put(`/bons-livraison/${encBlSelected.id}/encaisser`, {
        mode_encaissement: values.mode,
        date_encaissement: values.date.format('YYYY-MM-DD'),
      })
      message.success('BL #' + encBlSelected.id + ' marqué comme réglé')
      setEncBlModal(false)
      encBlForm.resetFields()
      await load()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setEncBlSubmitting(false)
    }
  }

  const deletePaiement = async (paiId) => {
    try {
      await api.delete(`/paiements/${paiId}`)
      message.success('Paiement supprimé')
      await load()
      refreshImpayes()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const fmt = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })

  const columns = [
    {
      title: 'Facture',
      dataIndex: 'facture_numero',
      width: 150,
      render: v => <Text code style={{ fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      render: id => <Text strong>{nomClient(id)}</Text>,
    },
    {
      title: 'Total HT',
      dataIndex: 'montant_ht',
      width: 140,
      align: 'right',
      render: v => <Text>{fmt(v)} MAD</Text>,
    },
    {
      title: 'Déjà payé',
      dataIndex: 'montant_paye',
      width: 140,
      align: 'right',
      render: v => (
        <Text strong style={{ color: v > 0 ? '#059669' : '#94a3b8' }}>
          {fmt(v)} MAD
        </Text>
      ),
    },
    {
      title: 'Reste à payer',
      dataIndex: 'solde',
      width: 140,
      align: 'right',
      render: v => (
        <Text strong style={{ color: v > 0.01 ? '#ef4444' : '#10b981' }}>
          {fmt(v)} MAD
        </Text>
      ),
    },
    {
      title: 'Progression',
      key: 'prog',
      width: 140,
      render: (_, r) => {
        const pct = r.montant_ht > 0 ? Math.round((r.montant_paye / r.montant_ht) * 100) : 0
        return (
          <Tooltip title={`${pct}% encaissé`}>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct >= 100 ? '#10b981' : pct > 0 ? '#3b82f6' : '#e2e8f0'}
              showInfo={false}
              style={{ marginBottom: 0 }}
            />
          </Tooltip>
        )
      },
    },
    {
      title: 'Statut',
      key: 'statut',
      width: 110,
      render: (_, r) => <StatutTag row={r} />,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => r.solde > 0.01 ? (
        <Tooltip title="Enregistrer un paiement">
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openPaiModal(r)}
            style={{ background: '#059669', borderColor: '#059669' }}
          />
        </Tooltip>
      ) : null,
    },
  ]

  const expandedRowRender = (r) => {
    if (!r.paiements || r.paiements.length === 0)
      return <Empty description="Aucun paiement enregistré" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '8px 0' }} />

    return (
      <Table
        size="small"
        dataSource={r.paiements}
        rowKey="id"
        pagination={false}
        style={{ margin: '0 8px' }}
        columns={[
          { title: 'Date', dataIndex: 'date', width: 120, render: v => new Date(v).toLocaleDateString('fr-FR') },
          { title: 'Mode', dataIndex: 'mode', width: 160, render: v => <Tag color={MODE_COLOR[v] || 'default'}>{v}</Tag> },
          { title: 'Montant', dataIndex: 'montant', width: 140, align: 'right', render: v => <Text strong style={{ color: '#059669' }}>{fmt(v)} MAD</Text> },
          { title: 'Note', dataIndex: 'notes', render: v => v || <Text type="secondary">—</Text> },
          {
            title: '',
            width: 50,
            render: (_, p) => (
              <Popconfirm title="Supprimer ce paiement ?" onConfirm={() => deletePaiement(p.id)} okText="Oui" cancelText="Non">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    )
  }

  const columnsBLAttente = [
    {
      title: 'Référence BL',
      key: 'ref',
      width: 130,
      render: (_, r) => <Text code style={{ fontWeight: 600 }}>BL #{r.id}</Text>,
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      render: id => <Text strong>{nomClient(id)}</Text>,
    },
    {
      title: 'Date livraison',
      dataIndex: 'date',
      width: 140,
      render: v => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Montant',
      key: 'montant',
      width: 150,
      align: 'right',
      render: (_, r) => <Text strong style={{ color: '#f59e0b' }}>{fmt(totalBL(r))} MAD</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, r) => (
        <Space size={6}>
          <Tooltip title="Générer la facture">
            <Button size="small" icon={<FileDoneOutlined />}
              onClick={() => genererFactureBL(r)}
              style={{ color: '#10b981', borderColor: '#10b981' }}>
              Facturer
            </Button>
          </Tooltip>
          <Tooltip title="Régler sans facture">
            <Button size="small" icon={<CreditCardOutlined />}
              onClick={() => openEncBlModal(r)}
              style={{ color: '#64748b', borderColor: '#cbd5e1' }}>
              Régler
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const columnsDirects = [
    {
      title: 'Référence BL',
      key: 'ref',
      width: 130,
      render: (_, r) => <Text code style={{ fontWeight: 600 }}>BL #{r.id}</Text>,
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      render: id => <Text strong>{nomClient(id)}</Text>,
    },
    {
      title: 'Date règlement',
      dataIndex: 'date_encaissement',
      width: 140,
      render: v => v ? new Date(v).toLocaleDateString('fr-FR') : <Text type="secondary">—</Text>,
    },
    {
      title: 'Mode',
      dataIndex: 'mode_encaissement',
      width: 150,
      render: v => v ? <Tag color={MODE_COLOR[v] || 'default'}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Montant',
      dataIndex: 'montant',
      width: 140,
      align: 'right',
      render: v => <Text strong style={{ color: '#059669' }}>{fmt(v)} MAD</Text>,
    },
    {
      title: 'Statut',
      key: 'statut',
      width: 160,
      render: () => <Tag color="success" icon={<CheckCircleOutlined />}>Réglé (sans facture)</Tag>,
    },
  ]

  const tabItems = [
    {
      key: 'en_attente',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 5 }} />
          BL non réglés
          {blsEnAttenteFiltres.length > 0 && (
            <span style={{ marginLeft: 6, background: '#f59e0b', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
              {blsEnAttenteFiltres.length}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'soldes',
      label: (
        <span>
          <ExclamationCircleOutlined style={{ marginRight: 5 }} />
          Soldes Restants
          {soldesRestants.length > 0 && (
            <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
              {soldesRestants.length}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'partiels',
      label: (
        <span>
          <PieChartOutlined style={{ marginRight: 5 }} />
          Paiements Partiels
          {paiementsPartiels.length > 0 && (
            <span style={{ marginLeft: 6, background: '#3b82f6', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
              {paiementsPartiels.length}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'payees',
      label: (
        <span>
          <CheckCircleOutlined style={{ marginRight: 5 }} />
          Factures Payées
          {facturesPayees.length > 0 && (
            <span style={{ marginLeft: 6, background: '#10b981', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
              {facturesPayees.length}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'directs',
      label: (
        <span>
          <WalletOutlined style={{ marginRight: 5 }} />
          Règlements directs
          {encaissesFiltres.length > 0 && (
            <span style={{ marginLeft: 6, background: '#8b5cf6', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
              {encaissesFiltres.length}
            </span>
          )}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Suivi Paiements</Title>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #10b981' }}>
            <Statistic
              title="Total encaissé"
              value={fmt(totalEncaisse)}
              suffix="MAD"
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
              prefix={<ArrowUpOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {allFacturesPayees.length} facture{allFacturesPayees.length !== 1 ? 's' : ''} soldée{allFacturesPayees.length !== 1 ? 's' : ''}
              {totalEncaisseDirects > 0 && ` · dont ${fmt(totalEncaisseDirects)} MAD direct`}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #f59e0b' }}>
            <Statistic
              title="BL non réglés"
              value={fmt(totalBLAttente)}
              suffix="MAD"
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
              prefix={<ClockCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {blsEnAttente.length} BL livré{blsEnAttente.length !== 1 ? 's' : ''} sans règlement
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #ef4444' }}>
            <Statistic
              title="Reste à recouvrer"
              value={fmt(resteRecouvrer)}
              suffix="MAD"
              valueStyle={{ color: '#ef4444', fontWeight: 700 }}
              prefix={<ExclamationCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{allSoldesRestants.length} facture{allSoldesRestants.length !== 1 ? 's' : ''} en attente</Text>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #3b82f6' }}>
            <Statistic
              title="Reste sur partiel"
              value={fmt(restePartiel)}
              suffix="MAD"
              valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
              prefix={<PieChartOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{allPaiementsPartiels.length} paiement{allPaiementsPartiels.length !== 1 ? 's' : ''} partiel{allPaiementsPartiels.length !== 1 ? 's' : ''}</Text>
          </Card>
        </Col>
      </Row>

      {/* Filtres + Tableau */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Rechercher par numéro ou client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Tous les clients"
            allowClear
            showSearch
            style={{ width: 220 }}
            value={filterClient}
            onChange={setFilterClient}
            filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            options={clients.map(c => ({ value: c.id, label: c.nom }))}
          />
        </Space>

        <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 4 }} />

        {activeTab === 'en_attente' ? (
          <Table
            columns={columnsBLAttente}
            dataSource={blsEnAttenteFiltres}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15, showTotal: t => `${t} BL en attente`, showSizeChanger: false }}
            locale={{ emptyText: 'Aucun BL livré sans règlement' }}
          />
        ) : activeTab === 'directs' ? (
          <Table
            columns={columnsDirects}
            dataSource={encaissesFiltres}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15, showTotal: t => `${t} règlement(s)`, showSizeChanger: false }}
            locale={{ emptyText: 'Aucun règlement direct enregistré' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tableData}
            rowKey="facture_id"
            loading={loading}
            pagination={{ pageSize: 15, showTotal: t => `${t} facture(s)`, showSizeChanger: false }}
            locale={{ emptyText: 'Aucune facture dans cette catégorie' }}
            expandable={{
              expandedRowRender,
              rowExpandable: r => r.paiements?.length > 0 || r.montant_paye > 0,
            }}
          />
        )}
      </div>

      {/* Modal régler BL sans facture */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined style={{ color: '#64748b' }} />
            Régler sans facture — BL #{encBlSelected?.id}
          </Space>
        }
        open={encBlModal}
        onCancel={() => setEncBlModal(false)}
        onOk={() => encBlForm.submit()}
        okText="Confirmer le règlement"
        cancelText="Annuler"
        confirmLoading={encBlSubmitting}
        width={420}
      >
        {encBlSelected && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Montant total : <Text strong>{fmt(totalBL(encBlSelected))} MAD</Text>
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
              Aucune facture ne sera créée. Le BL passera en "Réglé direct".
            </Text>
          </div>
        )}
        <Form form={encBlForm} layout="vertical" onFinish={submitEncBl}>
          <Form.Item name="date" label="Date du règlement" rules={[{ required: true, message: 'Date requise' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="mode" label="Mode de paiement" rules={[{ required: true, message: 'Mode requis' }]}>
            <Select options={MODE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal enregistrer paiement */}
      <Modal
        title={
          <span>
            <CheckCircleOutlined style={{ color: '#059669', marginRight: 8 }} />
            Enregistrer un paiement — {paiRow?.facture_numero}
          </span>
        }
        open={paiModal}
        onCancel={() => setPaiModal(false)}
        onOk={() => paiForm.submit()}
        okText="Enregistrer"
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
        cancelText="Annuler"
        confirmLoading={paiSubmitting}
        width={440}
      >
        {paiRow && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Solde restant : <Text strong style={{ color: '#ef4444' }}>{fmt(paiRow.solde)} MAD</Text>
              {' · '}Total : <Text strong>{fmt(paiRow.montant_ht)} MAD</Text>
            </Text>
          </div>
        )}
        <Form form={paiForm} layout="vertical" onFinish={submitPaiement}>
          <Form.Item name="date" label="Date du paiement" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="mode" label="Mode de paiement" rules={[{ required: true }]}>
            <Select options={MODE_OPTIONS} />
          </Form.Item>
          <Form.Item name="montant" label="Montant" rules={[{ required: true }, { type: 'number', min: 0.01 }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} precision={2} addonAfter="MAD" />
          </Form.Item>
          <Form.Item name="notes" label="Note (optionnelle)">
            <Input.TextArea rows={2} placeholder="Référence virement, n° chèque…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

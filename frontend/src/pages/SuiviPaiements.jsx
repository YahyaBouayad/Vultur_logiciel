import {
  Typography, Select, Input, Card, Row, Col, Tabs, Table, Tag, Button,
  Tooltip, Modal, Form, DatePicker, InputNumber, Popconfirm, message,
  Progress, Empty, Space, Statistic
} from 'antd'
import {
  CheckCircleOutlined, ExclamationCircleOutlined, PieChartOutlined,
  SearchOutlined, PlusOutlined, DeleteOutlined, ArrowUpOutlined,
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
  const [data, setData]       = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch]           = useState('')
  const [filterClient, setFilterClient] = useState(null)
  const [activeTab, setActiveTab]     = useState('soldes')

  const [paiModal, setPaiModal]       = useState(false)
  const [paiRow, setPaiRow]           = useState(null)
  const [paiSubmitting, setPaiSubmitting] = useState(false)
  const [paiForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [sv, cl] = await Promise.all([
        api.get('/suivi-paiements'),
        api.get('/clients'),
      ])
      setData(sv.data)
      setClients(cl.data)
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

  // Répartition par onglet
  const soldesRestants    = useMemo(() => filtered.filter(r => statutPaiement(r) === 'en_attente'), [filtered])
  const paiementsPartiels = useMemo(() => filtered.filter(r => statutPaiement(r) === 'partiel'), [filtered])
  const facturesPayees    = useMemo(() => filtered.filter(r => statutPaiement(r) === 'soldee'), [filtered])

  // KPIs
  const totalEncaisse  = useMemo(() => filtered.reduce((s, r) => s + r.montant_paye, 0), [filtered])
  const resteRecouvrer = useMemo(() => soldesRestants.reduce((s, r) => s + r.solde, 0), [soldesRestants])
  const restePartiel   = useMemo(() => paiementsPartiels.reduce((s, r) => s + r.solde, 0), [paiementsPartiels])

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

  const tabItems = [
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
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Suivi Paiements</Title>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #10b981' }}>
            <Statistic
              title="Total encaissé"
              value={fmt(totalEncaisse)}
              suffix="MAD"
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
              prefix={<ArrowUpOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{facturesPayees.length} facture{facturesPayees.length !== 1 ? 's' : ''} soldée{facturesPayees.length !== 1 ? 's' : ''}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #ef4444' }}>
            <Statistic
              title="Reste à recouvrer"
              value={fmt(resteRecouvrer)}
              suffix="MAD"
              valueStyle={{ color: '#ef4444', fontWeight: 700 }}
              prefix={<ExclamationCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{soldesRestants.length} facture{soldesRestants.length !== 1 ? 's' : ''} en attente</Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #3b82f6' }}>
            <Statistic
              title="Reste sur partiel"
              value={fmt(restePartiel)}
              suffix="MAD"
              valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
              prefix={<PieChartOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{paiementsPartiels.length} paiement{paiementsPartiels.length !== 1 ? 's' : ''} partiel{paiementsPartiels.length !== 1 ? 's' : ''}</Text>
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
      </div>

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

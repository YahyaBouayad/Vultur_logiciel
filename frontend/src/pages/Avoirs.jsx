import { Table, Typography, Tag, Button, Space, Tooltip, Select, Input, Card, Row, Col, Statistic } from 'antd'
import {
  FileProtectOutlined, FilePdfOutlined, SearchOutlined,
  EuroOutlined, FileTextOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import api from '../api/axios'
import { useSettings } from '../context/SettingsContext'
import AvoirPDF from '../components/pdf/AvoirPDF'

const { Title, Text } = Typography

const MOTIF_LABEL = {
  annulation: 'Annulation',
  retour:     'Retour marchandise',
  commercial: 'Geste commercial',
}
const MOTIF_COLOR = {
  annulation: 'error',
  retour:     'warning',
  commercial: 'blue',
}

export default function Avoirs() {
  const [avoirs, setAvoirs]     = useState([])
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [filterMotif, setFilterMotif]     = useState(null)
  const [filterClient, setFilterClient]   = useState(null)
  const [pdfLoadingIds, setPdfLoadingIds] = useState(new Set())

  const { settings } = useSettings()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/avoirs'),
      api.get('/clients'),
    ]).then(([av, cl]) => {
      setAvoirs(av.data)
      setClients(cl.data)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return avoirs.filter(a => {
      const matchSearch  = !q || a.numero.toLowerCase().includes(q) || a.facture_numero.toLowerCase().includes(q)
      const matchMotif   = !filterMotif  || a.motif === filterMotif
      const matchClient  = !filterClient || a.client_id === filterClient
      return matchSearch && matchMotif && matchClient
    })
  }, [avoirs, search, filterMotif, filterClient])

  const totalMontant = useMemo(() => filtered.reduce((s, a) => s + Number(a.montant_ht), 0), [filtered])

  const nomClient = (id) => clients.find(c => c.id === id)?.nom || '—'

  const downloadPDF = async (avoir) => {
    setPdfLoadingIds(prev => new Set([...prev, avoir.id]))
    try {
      const facture = { numero: avoir.facture_numero, date_emission: avoir.facture_date_emission || null }
      const client  = clients.find(c => c.id === avoir.client_id)
      const blob = await pdf(
        <AvoirPDF avoir={avoir} facture={facture} client={client} entreprise={settings} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${avoir.numero}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* silencieux */
    } finally {
      setPdfLoadingIds(prev => { const s = new Set(prev); s.delete(avoir.id); return s })
    }
  }

  const columns = [
    {
      title: 'N° Avoir',
      dataIndex: 'numero',
      width: 150,
      render: v => <Text code style={{ fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Facture',
      dataIndex: 'facture_numero',
      width: 150,
      render: (v, r) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          style={{ padding: 0, color: '#3b82f6' }}
          onClick={() => navigate('/factures')}
        >
          {v}
        </Button>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      render: id => <Text strong>{nomClient(id)}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      width: 120,
      render: v => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Motif',
      dataIndex: 'motif',
      width: 160,
      render: v => <Tag color={MOTIF_COLOR[v] || 'default'}>{MOTIF_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Montant HT',
      dataIndex: 'montant_ht',
      width: 140,
      align: 'right',
      render: v => <Text strong style={{ color: '#059669' }}>{Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</Text>,
    },
    {
      title: 'Note',
      dataIndex: 'notes',
      render: v => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, record) => (
        <Tooltip title="Télécharger PDF">
          <Button
            size="small"
            icon={<FilePdfOutlined />}
            loading={pdfLoadingIds.has(record.id)}
            onClick={() => downloadPDF(record)}
            style={{ color: '#059669', borderColor: '#059669' }}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>
          <FileProtectOutlined style={{ color: '#059669', marginRight: 8 }} />
          Avoirs / Notes de crédit
        </Title>
        <Text type="secondary">Historique de toutes les notes de crédit émises</Text>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #059669' }}>
            <Statistic
              title="Avoirs émis"
              value={filtered.length}
              valueStyle={{ color: '#059669', fontWeight: 700 }}
              prefix={<FileProtectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #3b82f6' }}>
            <Statistic
              title="Montant total HT"
              value={totalMontant.toFixed(2)}
              suffix="MAD"
              valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
              prefix={<EuroOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #f59e0b' }}>
            <Statistic
              title="Retours marchandise"
              value={filtered.filter(a => a.motif === 'retour').length}
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filtres + Tableau */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Rechercher par N° avoir ou facture..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Tous les motifs"
            allowClear
            style={{ width: 200 }}
            value={filterMotif}
            onChange={setFilterMotif}
            options={[
              { value: 'annulation', label: 'Annulation de facture' },
              { value: 'retour',     label: 'Retour marchandise' },
              { value: 'commercial', label: 'Geste commercial' },
            ]}
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

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: t => `${t} avoir(s)` }}
          locale={{ emptyText: 'Aucun avoir enregistré' }}
          summary={() => filtered.length > 0 && (
            <Table.Summary.Row>
              <Table.Summary.Cell colSpan={5} align="right">
                <Text strong>Total affiché</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell align="right">
                <Text strong style={{ color: '#059669' }}>
                  {totalMontant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell colSpan={2} />
            </Table.Summary.Row>
          )}
        />
      </div>
    </div>
  )
}

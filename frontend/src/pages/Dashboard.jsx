import { Card, Col, Row, Statistic, Typography, Select, Alert, Progress, Tag, Table, Button } from 'antd'
import {
  ArrowUpOutlined, FileTextOutlined, TeamOutlined, WarningOutlined,
  PlusOutlined, UserAddOutlined, InboxOutlined, RightOutlined,
  ExclamationCircleOutlined, AppstoreOutlined, CalendarOutlined, EyeOutlined,
} from '@ant-design/icons'
import { useImpayes } from '../context/ImpayesContext'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useEffect, useState, useMemo } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function getSalutation() {
  const h = new Date().getHours()
  return h < 18 ? 'Bonjour' : 'Bonsoir'
}

function getDateLabel() {
  const d = new Date()
  return `${JOURS_SEMAINE[d.getDay()]} ${d.getDate()} ${MOIS_LONG[d.getMonth()]} ${d.getFullYear()}`
}

const totalBL = (bl) =>
  bl.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)

function buildChartData(bons, periode) {
  const now = new Date()

  if (periode === '7j') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      const dateStr = d.toDateString()
      const ca = bons
        .filter(b => b.statut === 'livré' && new Date(b.date).toDateString() === dateStr)
        .reduce((s, b) => s + totalBL(b), 0)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, CA: +ca.toFixed(2) }
    })
  }

  if (periode === '30j') {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (29 - i))
      const dateStr = d.toDateString()
      const ca = bons
        .filter(b => b.statut === 'livré' && new Date(b.date).toDateString() === dateStr)
        .reduce((s, b) => s + totalBL(b), 0)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, CA: +ca.toFixed(2) }
    })
  }

  if (periode === '3m') {
    return Array.from({ length: 13 }, (_, i) => {
      const end = new Date(now)
      end.setDate(end.getDate() - (12 - i) * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      const ca = bons
        .filter(b => { const d = new Date(b.date); return b.statut === 'livré' && d >= start && d <= end })
        .reduce((s, b) => s + totalBL(b), 0)
      return { label: `S${i + 1}`, CA: +ca.toFixed(2) }
    })
  }

  if (periode === '6m') {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const ca = bons
        .filter(b => b.statut === 'livré' && new Date(b.date).getMonth() === d.getMonth() && new Date(b.date).getFullYear() === d.getFullYear())
        .reduce((s, b) => s + totalBL(b), 0)
      return { label: MOIS[d.getMonth()], CA: +ca.toFixed(2) }
    })
  }

  // 1an
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const ca = bons
      .filter(b => b.statut === 'livré' && new Date(b.date).getMonth() === d.getMonth() && new Date(b.date).getFullYear() === d.getFullYear())
      .reduce((s, b) => s + totalBL(b), 0)
    return { label: `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, CA: +ca.toFixed(2) }
  })
}

export default function Dashboard() {
  const [chartPeriode, setChartPeriode] = useState('6m')
  const [bons, setBons]       = useState([])
  const [produits, setProduits] = useState([])
  const [clients, setClients]   = useState([])
  const [factures, setFactures] = useState([])
  const { impayes } = useImpayes()
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/bons-livraison', { params: { limit: 10000 } }),
      api.get('/produits'),
      api.get('/clients'),
    ]).then(([bl, p, c]) => {
      setBons(bl.data.items || [])
      setProduits(p.data)
      setClients(c.data)
    }).catch(() => {})

    api.get('/factures', { params: { limit: 10000 } })
      .then(f => setFactures(f.data.items || []))
      .catch(() => setFactures([]))
  }, [])

  // KPI Row 1
  const revenusTotal = useMemo(() => {
    const fromFactures      = factures.filter(f => f.statut === 'payée').reduce((s, f) => s + (f.montant_ht || 0), 0)
    const fromArrangements  = bons.filter(b => b.encaisse && !b.facture_id).reduce((s, b) => s + totalBL(b), 0)
    return fromFactures + fromArrangements
  }, [factures, bons])

  const facturesImpayes = useMemo(() => factures.filter(f => f.statut === 'émise'), [factures])
  const sommeImpayes    = useMemo(() => facturesImpayes.reduce((s, f) => s + (f.montant_ht || 0), 0), [facturesImpayes])

  const clientsActifs = useMemo(() => {
    const ids = new Set(bons.filter(b => b.statut === 'livré').map(b => b.client_id))
    return ids.size
  }, [bons])

  // KPI Row 2
  const prodRupture = useMemo(() => produits.filter(p => p.stock === 0), [produits])
  const prodAlerte  = useMemo(() => produits.filter(p => p.stock > 0 && p.stock <= 5), [produits])

  const blEnCours = useMemo(() => bons.filter(b => b.statut === 'brouillon' || b.statut === 'validé').length, [bons])
  const blLivres  = useMemo(() => bons.filter(b => b.statut === 'livré').length, [bons])

  const statutsBL = useMemo(() => ({
    brouillon: bons.filter(b => b.statut === 'brouillon').length,
    valide:    bons.filter(b => b.statut === 'validé').length,
    livre:     bons.filter(b => b.statut === 'livré').length,
  }), [bons])

  const chartData = useMemo(() => buildChartData(bons, chartPeriode), [bons, chartPeriode])

  const chartOptions = [
    { value: '7j',  label: '7 jours' },
    { value: '30j', label: '30 jours' },
    { value: '3m',  label: '3 mois' },
    { value: '6m',  label: '6 mois' },
    { value: '1an', label: '1 an' },
  ]

  const actionCards = [
    { icon: <PlusOutlined style={{ fontSize: 22 }} />,     title: 'Nouveau BL',       color: '#3b82f6', bg: '#eff6ff', action: () => navigate('/bons-livraison', { state: { openAdd: true } }) },
    { icon: <UserAddOutlined style={{ fontSize: 22 }} />,  title: 'Ajouter un client', color: '#10b981', bg: '#f0fdf4', action: () => navigate('/clients', { state: { openAdd: true } }) },
    { icon: <InboxOutlined style={{ fontSize: 22 }} />,    title: 'Vérifier le stock', color: '#f59e0b', bg: '#fffbeb', action: () => navigate('/produits') },
    { icon: <FileTextOutlined style={{ fontSize: 22 }} />, title: 'Voir les factures', color: '#8b5cf6', bg: '#f5f3ff', action: () => navigate('/factures') },
  ]

  const derniersBL = useMemo(() => bons.slice(0, 5), [bons])

  const nbAlertesRetard = impayes.filter(i => i.niveau === 'retard' || i.niveau === 'critique').length

  const colonnesBL = [
    {
      title: 'N°',
      dataIndex: 'id',
      width: 60,
      render: v => <Text code>#{v}</Text>,
    },
    {
      title: 'Client',
      dataIndex: 'client_id',
      render: id => { const c = clients.find(c => c.id === id); return c?.nom || '—' },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      width: 110,
      render: v => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Total',
      key: 'total',
      width: 140,
      render: (_, r) => <Text strong>{totalBL(r).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      width: 100,
      render: v => {
        const color = { brouillon: 'default', validé: 'processing', livré: 'success' }
        const label = { brouillon: 'Brouillon', validé: 'Validé', livré: 'Livré' }
        return <Tag color={color[v]}>{label[v]}</Tag>
      },
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate('/bons-livraison', { state: { openBL: r.id } })}
        />
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>{getSalutation()} 👋</Title>
          <Text type="secondary">Vue d'ensemble de votre activité</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px' }}>
          <CalendarOutlined style={{ color: '#64748b', fontSize: 13 }} />
          <Text style={{ fontSize: 13, color: '#475569', textTransform: 'capitalize' }}>{getDateLabel()}</Text>
        </div>
      </div>

      {nbAlertesRetard > 0 && (
        <Alert
          type="error"
          showIcon
          message={
            <span>
              <strong>{nbAlertesRetard} facture{nbAlertesRetard > 1 ? 's' : ''} en retard de paiement</strong>
              {' — '}
              <a onClick={() => navigate('/factures')} style={{ color: '#dc2626', textDecoration: 'underline', cursor: 'pointer' }}>
                Voir les factures
              </a>
            </span>
          }
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {/* KPI Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #10b981' }}>
            <Statistic
              title="Revenu total"
              value={revenusTotal.toFixed(2)}
              suffix="MAD"
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
              prefix={<ArrowUpOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Factures payées</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 10, borderTop: '3px solid #ef4444', cursor: 'pointer' }}
            onClick={() => navigate('/factures')}
            hoverable
          >
            <Statistic
              title="Factures impayées"
              value={facturesImpayes.length}
              valueStyle={{ color: '#ef4444', fontWeight: 700 }}
              prefix={<ExclamationCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Solde : <Text strong style={{ color: '#ef4444' }}>{sommeImpayes.toFixed(2)} MAD</Text>
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #3b82f6' }}>
            <Statistic
              title="Clients actifs"
              value={clientsActifs}
              valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
              prefix={<TeamOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{clients.length} clients au total</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #8b5cf6' }}>
            <Statistic
              title="Produits catalogue"
              value={produits.length}
              valueStyle={{ color: '#8b5cf6', fontWeight: 700 }}
              prefix={<AppstoreOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {prodRupture.length} rupture{prodRupture.length !== 1 ? 's' : ''} · {prodAlerte.length} alerte{prodAlerte.length !== 1 ? 's' : ''}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* KPI Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #f59e0b' }}>
            <Statistic
              title="BL en cours"
              value={blEnCours}
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
              prefix={<FileTextOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{blLivres} BL livré{blLivres !== 1 ? 's' : ''} au total</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 10, borderTop: `3px solid ${prodRupture.length > 0 ? '#ef4444' : '#f59e0b'}`, cursor: 'pointer' }}
            onClick={() => navigate('/produits')}
            hoverable
          >
            <Statistic
              title="Alertes stock"
              value={prodRupture.length + prodAlerte.length}
              valueStyle={{ color: prodRupture.length > 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}
              prefix={<WarningOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {prodRupture.length} rupture{prodRupture.length !== 1 ? 's' : ''} · {prodAlerte.length} alerte{prodAlerte.length !== 1 ? 's' : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Statuts des bons de livraison" style={{ borderRadius: 10 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Brouillon</Text>
                <Text style={{ fontSize: 12, fontWeight: 600 }}>{statutsBL.brouillon}</Text>
              </div>
              <Progress
                percent={bons.length ? Math.round(statutsBL.brouillon / bons.length * 100) : 0}
                showInfo={false}
                strokeColor="#94a3b8"
                size="small"
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 12, color: '#3b82f6' }}>Validé</Text>
                <Text style={{ fontSize: 12, fontWeight: 600 }}>{statutsBL.valide}</Text>
              </div>
              <Progress
                percent={bons.length ? Math.round(statutsBL.valide / bons.length * 100) : 0}
                showInfo={false}
                strokeColor="#3b82f6"
                size="small"
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 12, color: '#10b981' }}>Livré</Text>
                <Text style={{ fontSize: 12, fontWeight: 600 }}>{statutsBL.livre}</Text>
              </div>
              <Progress
                percent={bons.length ? Math.round(statutsBL.livre / bons.length * 100) : 0}
                showInfo={false}
                strokeColor="#10b981"
                size="small"
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* CA Evolution */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card
            title="Évolution du chiffre d'affaires"
            style={{ borderRadius: 10 }}
            extra={
              <Select
                value={chartPeriode}
                onChange={setChartPeriode}
                options={chartOptions}
                style={{ width: 110 }}
                size="small"
              />
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={chartPeriode === '30j' ? 4 : 'preserveStartEnd'}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} MAD`, 'CA']} />
                <Area
                  type="monotone"
                  dataKey="CA"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#caGrad)"
                  dot={chartPeriode === '7j' ? { r: 4 } : false}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Derniers BL */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card
            title="Derniers bons de livraison"
            style={{ borderRadius: 10 }}
            extra={<a onClick={() => navigate('/bons-livraison')} style={{ fontSize: 12 }}>Voir tout</a>}
          >
            <Table
              size="small"
              dataSource={derniersBL}
              rowKey="id"
              pagination={false}
              columns={colonnesBL}
              locale={{ emptyText: 'Aucun bon de livraison' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions rapides */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14, color: '#1e293b' }}>Actions rapides</Text>
      </div>
      <Row gutter={[16, 16]}>
        {actionCards.map((card, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              hoverable
              onClick={card.action}
              style={{
                borderRadius: 10,
                cursor: 'pointer',
                background: card.bg,
                border: `1px solid ${card.color}33`,
              }}
              styles={{ body: { padding: '18px 22px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ color: card.color }}>{card.icon}</div>
                  <Text strong style={{ fontSize: 14, color: '#1e293b' }}>{card.title}</Text>
                </div>
                <RightOutlined style={{ color: card.color, fontSize: 11 }} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}

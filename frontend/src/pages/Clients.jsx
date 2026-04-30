import {
  Table, Button, Input, Space, Tag, Typography, Modal, Form, Select,
  Drawer, Popconfirm, message, Tooltip, Empty, Card, Row, Col, Statistic, Divider
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  HistoryOutlined, UserOutlined, BankOutlined, PhoneOutlined,
  MailOutlined, EnvironmentOutlined, FileTextOutlined, CheckCircleOutlined,
  ClockCircleOutlined, RiseOutlined, CopyOutlined, MedicineBoxOutlined, HeartOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axios'

const { Title, Text } = Typography

const statutColor = { brouillon: 'default', validé: 'processing', livré: 'success' }
const statutLabel = { brouillon: 'Brouillon', validé: 'Validé', livré: 'Livré' }

const TYPE_CLIENT = {
  pharmacie:      { label: 'Pharmacie',      color: 'green',   icon: <MedicineBoxOutlined /> },
  parapharmacie:  { label: 'Parapharmacie',  color: 'cyan',    icon: <MedicineBoxOutlined /> },
  clinique:       { label: 'Clinique',       color: 'blue',    icon: <HeartOutlined /> },
  hopital:        { label: 'Hôpital',        color: 'red',     icon: <BankOutlined /> },
  particulier:    { label: 'Particulier',    color: 'default', icon: <UserOutlined /> },
}

const TypeTag = ({ type }) => {
  const cfg = TYPE_CLIENT[type] || { label: type || '—', color: 'default', icon: null }
  return <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>
}

const TYPE_OPTIONS = Object.entries(TYPE_CLIENT).map(([value, { label }]) => ({ value, label }))

export default function Clients() {
  const location = useLocation()
  const navigate = useNavigate()
  const [clients, setClients]         = useState([])
  const [filtered, setFiltered]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')

  const [modalOpen, setModalOpen]     = useState(false)
  const [editingClient, setEditing]   = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [typeClient, setTypeClient]   = useState('pharmacie')

  const [drawer, setDrawer]             = useState(false)
  const [drawerClient, setDrawerClient] = useState(null)
  const [historique, setHistorique]     = useState([])
  const [histLoading, setHistLoading]   = useState(false)
  const [produits, setProduits]         = useState([])

  const [form] = Form.useForm()

  const fetchClients = async () => {
    setLoading(true)
    try {
      const res = await api.get('/clients')
      setClients(res.data)
      setFiltered(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
    api.get('/produits').then(r => setProduits(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(clients.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      (c.contact || '').toLowerCase().includes(q) ||
      (c.mail || '').toLowerCase().includes(q)
    ))
  }, [search, clients])

  const openAdd = () => {
    setEditing(null)
    setTypeClient('pharmacie')
    form.resetFields()
    form.setFieldValue('type_client', 'pharmacie')
    setModalOpen(true)
  }

  useEffect(() => {
    if (location.state?.openAdd) {
      openAdd()
      window.history.replaceState({}, '')
    }
  }, [])

  const openEdit = (client) => {
    setEditing(client)
    setTypeClient(client.type_client || 'pharmacie')
    form.setFieldsValue(client)
    setModalOpen(true)
  }

  const handleSave = async (values) => {
    setFormLoading(true)
    const payload = { ...values }
    if (payload.type_client === 'particulier') payload.ice = null
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, payload)
        message.success('Client modifié')
      } else {
        await api.post('/clients', payload)
        message.success('Client ajouté')
      }
      setModalOpen(false)
      fetchClients()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/${id}`)
      message.success('Client supprimé')
      fetchClients()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const openHistorique = async (client) => {
    setDrawerClient(client)
    setDrawer(true)
    setHistLoading(true)
    try {
      const res = await api.get('/bons-livraison', { params: { client_id: client.id, limit: 10000 } })
      setHistorique(res.data.items || [])
    } catch {
      setHistorique([])
    } finally {
      setHistLoading(false)
    }
  }

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type_client',
      key: 'type_client',
      width: 120,
      render: (v) => <TypeTag type={v} />,
    },
    {
      title: 'Nom / Société',
      dataIndex: 'nom',
      key: 'nom',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'Contact',
      dataIndex: 'contact',
      key: 'contact',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Téléphone',
      dataIndex: 'telephone',
      key: 'telephone',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'mail',
      key: 'mail',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'ICE',
      dataIndex: 'ice',
      key: 'ice',
      render: (v) => v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Space>
          <Tooltip title="Historique BL">
            <Button icon={<HistoryOutlined />} size="small" onClick={() => openHistorique(record)} />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Supprimer">
            <Popconfirm
              title="Supprimer ce client ?"
              onConfirm={() => handleDelete(record.id)}
              okText="Oui" cancelText="Non"
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const totalBL = (bl) =>
    bl.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)

  const nomProduit = (id) => produits.find(p => p.id === id)?.nom || `Produit #${id}`

  const histStats = useMemo(() => {
    const livres   = historique.filter(b => b.statut === 'livré')
    const enCours  = historique.filter(b => b.statut !== 'livré')
    const caLivre  = livres.reduce((s, b) => s + totalBL(b), 0)
    const caEnCours = enCours.reduce((s, b) => s + totalBL(b), 0)
    return { total: historique.length, livres: livres.length, enCours: enCours.length, caLivre, caEnCours }
  }, [historique])

  const blColumns = [
    {
      title: 'N°',
      dataIndex: 'id',
      width: 65,
      render: v => <Text code>#{v}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      width: 110,
      render: v => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Articles',
      dataIndex: 'lignes',
      width: 90,
      render: v => <Text type="secondary">{v.length} art.</Text>,
    },
    {
      title: 'Total HT',
      key: 'total',
      width: 130,
      render: (_, r) => <Text strong>{totalBL(r).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      width: 105,
      render: v => <Tag color={{ brouillon: 'default', validé: 'processing', livré: 'success' }[v]}>{statutLabel[v]}</Tag>,
    },
    {
      title: '',
      key: 'dupliquer',
      width: 46,
      render: (_, bl) => (
        <Tooltip title="Créer un BL similaire">
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => navigate('/bons-livraison', {
              state: {
                duplicateBL: {
                  client_id: bl.client_id,
                  notes: bl.notes || '',
                  lignes: bl.lignes.map(l => ({
                    produit_id:    l.produit_id,
                    quantite:      l.quantite,
                    prix_unitaire: Number(l.prix_unitaire),
                    remise:        Number(l.remise || 0),
                  })),
                },
              },
            })}
          />
        </Tooltip>
      ),
    },
  ]

  const ligneColumns = [
    {
      title: 'Produit',
      dataIndex: 'produit_id',
      render: id => <Text strong>{nomProduit(id)}</Text>,
    },
    {
      title: 'Qté',
      dataIndex: 'quantite',
      width: 60,
      align: 'center',
    },
    {
      title: 'Prix unit.',
      dataIndex: 'prix_unitaire',
      width: 110,
      render: v => `${Number(v).toFixed(2)} MAD`,
    },
    {
      title: 'Remise',
      dataIndex: 'remise',
      width: 80,
      align: 'center',
      render: v => Number(v) > 0 ? <Tag color="orange">{Number(v)}%</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Sous-total',
      key: 'soustotal',
      width: 120,
      render: (_, l) => {
        const val = l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100)
        return <Text strong style={{ color: '#1e293b' }}>{val.toFixed(2)} MAD</Text>
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Clients</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Ajouter un client
        </Button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Rechercher par nom, contact ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360, marginBottom: 16 }}
          allowClear
        />
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} client(s)` }}
          locale={{ emptyText: 'Aucun client enregistré' }}
        />
      </div>

      {/* Modale Ajouter / Modifier */}
      <Modal
        title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editingClient ? 'Modifier' : 'Ajouter'}
        cancelText="Annuler"
        confirmLoading={formLoading}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="type_client" label="Type de client" rules={[{ required: true, message: 'Type requis' }]}>
            <Select
              options={TYPE_OPTIONS}
              onChange={(v) => {
                setTypeClient(v)
                if (v === 'particulier') form.setFieldValue('ice', null)
              }}
              placeholder="Sélectionner un type"
            />
          </Form.Item>

          <Form.Item name="nom" label="Nom / Société" rules={[{ required: true, message: 'Nom requis' }]}>
            <Input placeholder="Ex : Pharmacie Centrale" />
          </Form.Item>

          <Form.Item name="contact" label="Nom du contact">
            <Input placeholder="Ex : Dr. Alaoui" />
          </Form.Item>

          <Form.Item name="telephone" label="Téléphone">
            <Input placeholder="Ex : +212 6 00 00 00 00" />
          </Form.Item>

          <Form.Item name="mail" label="Email">
            <Input placeholder="Ex : contact@pharmacie.ma" />
          </Form.Item>

          <Form.Item name="adresse" label="Adresse">
            <Input placeholder="Ex : 12 avenue Hassan II, Casablanca" />
          </Form.Item>

          {typeClient !== 'particulier' && (
            <Form.Item name="ice" label="ICE">
              <Input placeholder="Ex : 001234567000012" maxLength={15} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Drawer historique BL */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {(() => {
                const cfg = TYPE_CLIENT[drawerClient?.type_client]
                return cfg ? <span style={{ color: '#fff' }}>{cfg.icon}</span> : <UserOutlined style={{ color: '#fff' }} />
              })()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{drawerClient?.nom}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                {TYPE_CLIENT[drawerClient?.type_client]?.label || '—'}
                {drawerClient?.ice ? ` · ICE ${drawerClient.ice}` : ''}
              </div>
            </div>
          </div>
        }
        open={drawer}
        onClose={() => setDrawer(false)}
        width={740}
        styles={{ body: { padding: '20px 24px', background: '#f8fafc' } }}
      >
        {/* Fiche contact */}
        <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            {drawerClient?.telephone && (
              <Col xs={24} sm={12}>
                <Space>
                  <PhoneOutlined style={{ color: '#64748b' }} />
                  <Text>{drawerClient.telephone}</Text>
                </Space>
              </Col>
            )}
            {drawerClient?.mail && (
              <Col xs={24} sm={12}>
                <Space>
                  <MailOutlined style={{ color: '#64748b' }} />
                  <Text>{drawerClient.mail}</Text>
                </Space>
              </Col>
            )}
            {drawerClient?.adresse && (
              <Col xs={24}>
                <Space>
                  <EnvironmentOutlined style={{ color: '#64748b' }} />
                  <Text>{drawerClient.adresse}</Text>
                </Space>
              </Col>
            )}
            {drawerClient?.contact && (
              <Col xs={24} sm={12}>
                <Space>
                  <UserOutlined style={{ color: '#64748b' }} />
                  <Text type="secondary">Contact :</Text>
                  <Text>{drawerClient.contact}</Text>
                </Space>
              </Col>
            )}
            {!drawerClient?.telephone && !drawerClient?.mail && !drawerClient?.adresse && !drawerClient?.contact && (
              <Col xs={24}><Text type="secondary">Aucune coordonnée renseignée</Text></Col>
            )}
          </Row>
        </Card>

        {/* KPIs */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #3b82f6' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Total BL</span>}
                value={histStats.total}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #10b981' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Livrés</span>}
                value={histStats.livres}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>En cours</span>}
                value={histStats.enCours}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #8b5cf6' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>CA réalisé</span>}
                value={histStats.caLivre.toFixed(0)}
                suffix="MAD"
                valueStyle={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Tableau BL */}
        <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong>Historique des bons de livraison</Text>
            {histStats.caEnCours > 0 && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
                {histStats.caEnCours.toFixed(2)} MAD en attente de livraison
              </Text>
            )}
          </div>
          {historique.length === 0 && !histLoading ? (
            <Empty description="Aucun bon de livraison pour ce client" style={{ padding: 40 }} />
          ) : (
            <Table
              columns={blColumns}
              dataSource={historique}
              rowKey="id"
              size="small"
              loading={histLoading}
              pagination={historique.length > 10 ? { pageSize: 10, size: 'small' } : false}
              expandable={{
                expandedRowRender: (bl) => (
                  <div style={{ padding: '8px 0', background: '#fafafa' }}>
                    <Table
                      size="small"
                      dataSource={bl.lignes}
                      rowKey="id"
                      pagination={false}
                      columns={ligneColumns}
                      style={{ margin: '0 8px' }}
                      summary={() => (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={4} align="right">
                            <Text strong>Total HT</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4}>
                            <Text strong style={{ color: '#1e293b' }}>{totalBL(bl).toFixed(2)} MAD</Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                    />
                  </div>
                ),
                rowExpandable: bl => bl.lignes.length > 0,
              }}
            />
          )}
        </Card>
      </Drawer>
    </div>
  )
}

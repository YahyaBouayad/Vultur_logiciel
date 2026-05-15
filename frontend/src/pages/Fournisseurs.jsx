import {
  Table, Button, Input, Space, Tag, Typography, Modal, Form,
  Popconfirm, message, Tooltip, Switch, Drawer, Card, Row, Col,
  Statistic, Divider, Empty, Badge
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, BankOutlined, PhoneOutlined, MailOutlined,
  EnvironmentOutlined, HistoryOutlined, FileTextOutlined,
  CheckCircleOutlined, ClockCircleOutlined, RiseOutlined,
  FilePdfOutlined, CreditCardOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useMemo } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

const statutColor = { brouillon: 'default', envoyé: 'processing', reçu: 'success' }
const statutLabel = { brouillon: 'Brouillon', envoyé: 'Envoyé', reçu: 'Reçu' }

const totalBC = (bc) =>
  bc.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)

export default function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState([])
  const [filtered, setFiltered]         = useState([])
  const [produits, setProduits]         = useState([])
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')

  const [modalOpen, setModalOpen]       = useState(false)
  const [editingFourn, setEditing]      = useState(null)
  const [formLoading, setFormLoading]   = useState(false)
  const [particulier, setParticulier]   = useState(false)

  const [drawer, setDrawer]             = useState(false)
  const [drawerFourn, setDrawerFourn]   = useState(null)
  const [historique, setHistorique]     = useState([])
  const [histLoading, setHistLoading]   = useState(false)

  const [ribModal, setRibModal]         = useState(false)
  const [ribFourn, setRibFourn]         = useState(null)

  const [form] = Form.useForm()

  const fetchFournisseurs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/fournisseurs')
      setFournisseurs(res.data)
      setFiltered(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFournisseurs()
    api.get('/produits').then(r => setProduits(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(fournisseurs.filter(f =>
      f.nom.toLowerCase().includes(q) ||
      (f.contact || '').toLowerCase().includes(q) ||
      (f.mail || '').toLowerCase().includes(q)
    ))
  }, [search, fournisseurs])

  const openAdd = () => {
    setEditing(null)
    setParticulier(false)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (fourn) => {
    setEditing(fourn)
    setParticulier(fourn.particulier)
    form.setFieldsValue(fourn)
    setModalOpen(true)
  }

  const handleSave = async (values) => {
    setFormLoading(true)
    const payload = { ...values, particulier: values.particulier ?? false }
    if (payload.particulier) payload.ice = null
    try {
      if (editingFourn) {
        await api.put(`/fournisseurs/${editingFourn.id}`, payload)
        message.success('Fournisseur modifié')
      } else {
        await api.post('/fournisseurs', payload)
        message.success('Fournisseur ajouté')
      }
      setModalOpen(false)
      fetchFournisseurs()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/fournisseurs/${id}`)
      message.success('Fournisseur supprimé')
      fetchFournisseurs()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const openHistorique = async (fourn) => {
    setDrawerFourn(fourn)
    setDrawer(true)
    setHistLoading(true)
    try {
      const res = await api.get('/bons-commande', { params: { fournisseur_id: fourn.id } })
      setHistorique(res.data)
    } catch {
      setHistorique([])
    } finally {
      setHistLoading(false)
    }
  }

  const nomProduit = (id) => {
    const p = produits.find(p => p.id === id)
    return p ? `${p.reference} — ${p.nom}` : `Produit #${id}`
  }

  const histStats = useMemo(() => {
    const recus    = historique.filter(b => b.statut === 'reçu')
    const enCours  = historique.filter(b => b.statut !== 'reçu')
    const totalAchete  = recus.reduce((s, b) => s + totalBC(b), 0)
    const totalEnCours = enCours.reduce((s, b) => s + totalBC(b), 0)
    return { total: historique.length, recus: recus.length, enCours: enCours.length, totalAchete, totalEnCours }
  }, [historique])

  const downloadPdf = (bc) => {
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${bc.pdf_base64}`
    link.download = `BC-${String(bc.id).padStart(4, '0')}.pdf`
    link.click()
  }

  const bcColumns = [
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
      width: 80,
      render: v => <Text type="secondary">{v.length} art.</Text>,
    },
    {
      title: 'Total HT',
      key: 'total',
      width: 140,
      render: (_, r) => <Text strong>{totalBC(r).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      width: 110,
      render: v => <Badge status={statutColor[v]} text={statutLabel[v]} />,
    },
    {
      title: '',
      key: 'pdf',
      width: 40,
      render: (_, bc) => bc.pdf_base64
        ? <Tooltip title="Télécharger PDF">
            <Button size="small" icon={<FilePdfOutlined />}
              style={{ color: '#dc2626', borderColor: '#fecaca' }}
              onClick={() => downloadPdf(bc)} />
          </Tooltip>
        : null,
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
      width: 120,
      render: v => `${Number(v).toFixed(2)} MAD`,
    },
    {
      title: 'Remise',
      dataIndex: 'remise',
      width: 80,
      align: 'center',
      render: v => Number(v) > 0
        ? <Tag color="orange">{Number(v)}%</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Sous-total',
      key: 'soustotal',
      width: 130,
      render: (_, l) => {
        const val = l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100)
        return <Text strong style={{ color: '#1e293b' }}>{val.toFixed(2)} MAD</Text>
      },
    },
  ]

  const columns = [
    {
      title: 'Type',
      dataIndex: 'particulier',
      key: 'particulier',
      width: 110,
      render: (v) => v
        ? <Tag icon={<UserOutlined />}  color="blue">Particulier</Tag>
        : <Tag icon={<BankOutlined />}  color="geekblue">Entreprise</Tag>,
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
      title: 'RIB',
      key: 'rib',
      width: 150,
      render: (_, record) => record.rib
        ? (
          <Button
            size="small"
            icon={<CreditCardOutlined />}
            onClick={() => { setRibFourn(record); setRibModal(true) }}
            style={{ color: '#64748b', borderColor: '#cbd5e1', fontSize: 12 }}
          >
            Afficher le RIB
          </Button>
        )
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Historique achats">
            <Button icon={<HistoryOutlined />} size="small" onClick={() => openHistorique(record)} />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Supprimer">
            <Popconfirm
              title="Supprimer ce fournisseur ?"
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Fournisseurs</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Ajouter un fournisseur
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
          pagination={{ pageSize: 10, showTotal: (t) => `${t} fournisseur(s)` }}
          locale={{ emptyText: 'Aucun fournisseur enregistré' }}
        />
      </div>

      {/* Modal Ajouter / Modifier */}
      <Modal
        title={editingFourn ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editingFourn ? 'Modifier' : 'Ajouter'}
        cancelText="Annuler"
        confirmLoading={formLoading}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="particulier" label="Type" valuePropName="checked" initialValue={false}>
            <Switch
              checkedChildren="Particulier"
              unCheckedChildren="Entreprise"
              onChange={(v) => { setParticulier(v); if (v) form.setFieldValue('ice', null) }}
            />
          </Form.Item>
          <Form.Item name="nom" label="Nom / Société" rules={[{ required: true, message: 'Nom requis' }]}>
            <Input placeholder="Ex : Fournisseur Atlas" />
          </Form.Item>
          <Form.Item name="contact" label="Nom du contact">
            <Input placeholder="Ex : Ahmed Benali" />
          </Form.Item>
          <Form.Item name="telephone" label="Téléphone">
            <Input placeholder="Ex : +212 5 00 00 00 00" />
          </Form.Item>
          <Form.Item name="mail" label="Email">
            <Input placeholder="Ex : contact@fournisseur.ma" />
          </Form.Item>
          <Form.Item name="adresse" label="Adresse">
            <Input placeholder="Ex : Zone industrielle, Casablanca" />
          </Form.Item>
          {!particulier && (
            <Form.Item name="ice" label="ICE">
              <Input placeholder="Ex : 001234567000012" maxLength={15} />
            </Form.Item>
          )}
          <Form.Item name="rib" label="RIB bancaire">
            <Input placeholder="Ex : 011 780 0001234567890123 45" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer historique achats */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {drawerFourn?.particulier
                ? <UserOutlined  style={{ color: '#fff', fontSize: 16 }} />
                : <BankOutlined  style={{ color: '#fff', fontSize: 16 }} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{drawerFourn?.nom}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                {drawerFourn?.particulier ? 'Particulier' : 'Entreprise'}
                {drawerFourn?.ice ? ` · ICE ${drawerFourn.ice}` : ''}
              </div>
            </div>
          </div>
        }
        open={drawer}
        onClose={() => setDrawer(false)}
        width={760}
        styles={{ body: { padding: '20px 24px', background: '#f8fafc' } }}
      >
        {/* Fiche contact */}
        <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            {drawerFourn?.telephone && (
              <Col xs={24} sm={12}>
                <Space><PhoneOutlined style={{ color: '#64748b' }} /><Text>{drawerFourn.telephone}</Text></Space>
              </Col>
            )}
            {drawerFourn?.mail && (
              <Col xs={24} sm={12}>
                <Space><MailOutlined style={{ color: '#64748b' }} /><Text>{drawerFourn.mail}</Text></Space>
              </Col>
            )}
            {drawerFourn?.adresse && (
              <Col xs={24}>
                <Space><EnvironmentOutlined style={{ color: '#64748b' }} /><Text>{drawerFourn.adresse}</Text></Space>
              </Col>
            )}
            {drawerFourn?.contact && (
              <Col xs={24} sm={12}>
                <Space>
                  <UserOutlined style={{ color: '#64748b' }} />
                  <Text type="secondary">Contact :</Text>
                  <Text>{drawerFourn.contact}</Text>
                </Space>
              </Col>
            )}
            {drawerFourn?.rib && (
              <Col xs={24}>
                <Space>
                  <CreditCardOutlined style={{ color: '#64748b' }} />
                  <Text type="secondary">RIB :</Text>
                  <Text code style={{ letterSpacing: 0.5 }}>{drawerFourn.rib}</Text>
                </Space>
              </Col>
            )}
            {!drawerFourn?.telephone && !drawerFourn?.mail && !drawerFourn?.adresse && !drawerFourn?.contact && !drawerFourn?.rib && (
              <Col xs={24}><Text type="secondary">Aucune coordonnée renseignée</Text></Col>
            )}
          </Row>
        </Card>

        {/* KPIs */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #3b82f6' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Total BC</span>}
                value={histStats.total}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #10b981' }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Reçus</span>}
                value={histStats.recus}
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
                title={<span style={{ fontSize: 11 }}>Total acheté</span>}
                value={histStats.totalAchete.toFixed(0)}
                suffix="MAD"
                valueStyle={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Tableau BC */}
        <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Historique des bons de commande</Text>
            {histStats.totalEnCours > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {histStats.totalEnCours.toFixed(2)} MAD en attente de réception
              </Text>
            )}
          </div>
          {historique.length === 0 && !histLoading ? (
            <Empty description="Aucun bon de commande pour ce fournisseur" style={{ padding: 40 }} />
          ) : (
            <Table
              columns={bcColumns}
              dataSource={historique}
              rowKey="id"
              size="small"
              loading={histLoading}
              pagination={historique.length > 10 ? { pageSize: 10, size: 'small' } : false}
              expandable={{
                expandedRowRender: (bc) => (
                  <div style={{ padding: '8px 0', background: '#fafafa' }}>
                    <Table
                      size="small"
                      dataSource={bc.lignes}
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
                            <Text strong style={{ color: '#1e293b' }}>{totalBC(bc).toFixed(2)} MAD</Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                    />
                  </div>
                ),
                rowExpandable: bc => bc.lignes.length > 0,
              }}
            />
          )}
        </Card>
      </Drawer>

      {/* Modal RIB */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined style={{ color: '#64748b' }} />
            RIB bancaire — {ribFourn?.nom}
          </Space>
        }
        open={ribModal}
        onCancel={() => setRibModal(false)}
        footer={null}
        width={400}
      >
        {ribFourn?.rib && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>Relevé d'Identité Bancaire</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: '#1e293b' }}>
              {ribFourn.rib}
            </Text>
          </div>
        )}
      </Modal>
    </div>
  )
}

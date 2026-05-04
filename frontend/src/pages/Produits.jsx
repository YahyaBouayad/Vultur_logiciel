import {
  Table, Button, Input, Space, Tag, Typography, Modal, Form,
  InputNumber, Drawer, Timeline, Popconfirm, message, Tooltip,
  Card, Row, Col, Statistic, Segmented
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  PlusCircleOutlined, MinusCircleOutlined, HistoryOutlined, BellOutlined,
  ExclamationCircleOutlined, WarningOutlined, EyeInvisibleOutlined,
  AppstoreOutlined, RiseOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useMemo } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

const SEUIL = 5

function stockTag(stock, ignoree) {
  if (ignoree)      return <Tag color="default"   style={{ fontWeight: 500 }}>{stock} — ignoré</Tag>
  if (stock === 0)  return <Tag color="error"     style={{ fontWeight: 600 }}>Rupture</Tag>
  if (stock <= SEUIL) return <Tag color="warning" style={{ fontWeight: 600 }}>{stock}</Tag>
  return               <Tag color="success"       style={{ fontWeight: 600 }}>{stock}</Tag>
}

export default function Produits() {
  const [produits, setProduits]           = useState([])
  const [filtered, setFiltered]           = useState([])
  const [loading, setLoading]             = useState(false)
  const [search, setSearch]               = useState('')
  const [filtre, setFiltre]               = useState('all')

  const [modalOpen, setModalOpen]         = useState(false)
  const [editingProduit, setEditing]      = useState(null)
  const [formLoading, setFormLoading]     = useState(false)

  const [stockModal, setStockModal]       = useState(false)
  const [stockProduit, setStockProduit]   = useState(null)
  const [stockForm]                       = Form.useForm()

  const [sortieModal, setSortieModal]     = useState(false)
  const [sortieProduit, setSortieProduit] = useState(null)
  const [sortieForm]                      = Form.useForm()

  const [drawer, setDrawer]               = useState(false)
  const [mouvements, setMouvements]       = useState([])
  const [drawerProduit, setDrawerProduit] = useState(null)

  const [form] = Form.useForm()

  const fetchProduits = async () => {
    setLoading(true)
    try {
      const res = await api.get('/produits')
      setProduits(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProduits() }, [])

  const kpis = useMemo(() => {
    const actifs = produits.filter(p => !p.alerte_ignoree)
    return {
      total:       produits.length,
      rupture:     actifs.filter(p => p.stock === 0).length,
      faible:      actifs.filter(p => p.stock > 0 && p.stock <= SEUIL).length,
      ignoree:     produits.filter(p => p.alerte_ignoree).length,
      valeurStock: produits.reduce((s, p) => s + p.stock * Number(p.prix), 0),
    }
  }, [produits])

  useEffect(() => {
    const q = search.toLowerCase()
    let base = produits.filter(p =>
      p.nom.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
    )
    if (filtre === 'rupture') base = base.filter(p => p.stock === 0 && !p.alerte_ignoree)
    if (filtre === 'faible')  base = base.filter(p => p.stock > 0 && p.stock <= SEUIL && !p.alerte_ignoree)
    if (filtre === 'ignore')  base = base.filter(p => p.alerte_ignoree)
    setFiltered(base)
  }, [search, produits, filtre])

  const openAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (produit) => {
    setEditing(produit)
    form.setFieldsValue(produit)
    setModalOpen(true)
  }

  const handleSave = async (values) => {
    setFormLoading(true)
    try {
      if (editingProduit) {
        await api.put(`/produits/${editingProduit.id}`, values)
        message.success('Produit modifié')
      } else {
        await api.post('/produits', values)
        message.success('Produit ajouté')
      }
      setModalOpen(false)
      fetchProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/produits/${id}`)
      message.success('Produit supprimé')
      fetchProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const toggleIgnore = async (produit) => {
    try {
      await api.put(`/produits/${produit.id}`, { alerte_ignoree: !produit.alerte_ignoree })
      message.success(produit.alerte_ignoree ? 'Alerte réactivée' : 'Alerte de rupture ignorée')
      fetchProduits()
    } catch {
      message.error('Erreur')
    }
  }

  const openStockModal = (produit) => {
    setStockProduit(produit)
    stockForm.resetFields()
    setStockModal(true)
  }

  const openSortieModal = (produit) => {
    setSortieProduit(produit)
    sortieForm.resetFields()
    setSortieModal(true)
  }

  const handleSortieStock = async (values) => {
    setFormLoading(true)
    try {
      await api.post('/stock/sortie', { produit_id: sortieProduit.id, quantite: values.quantite, notes: values.notes || null })
      message.success(`−${values.quantite} unités retirées`)
      setSortieModal(false)
      fetchProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEntreeStock = async (values) => {
    setFormLoading(true)
    try {
      await api.post('/stock/entree', { produit_id: stockProduit.id, quantite: values.quantite, notes: values.notes || null })
      message.success(`+${values.quantite} unités ajoutées`)
      setStockModal(false)
      fetchProduits()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const openDrawer = async (produit) => {
    setDrawerProduit(produit)
    setDrawer(true)
    try {
      const res = await api.get(`/stock/mouvements/${produit.id}`)
      setMouvements(res.data)
    } catch {
      setMouvements([])
    }
  }

  const columns = [
    {
      title: 'Référence',
      dataIndex: 'reference',
      key: 'reference',
      width: 140,
      render: (v) => <Text code>{v}</Text>,
    },
    {
      title: 'Nom',
      dataIndex: 'nom',
      key: 'nom',
    },
    {
      title: 'Prix',
      dataIndex: 'prix',
      key: 'prix',
      width: 130,
      sorter: (a, b) => Number(a.prix) - Number(b.prix),
      render: (v) => <Text strong>{Number(v).toFixed(2)} MAD</Text>,
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 130,
      sorter: (a, b) => a.stock - b.stock,
      render: (v, r) => stockTag(v, r.alerte_ignoree),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 190,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Entrée de stock">
            <Button icon={<PlusCircleOutlined />} size="small" type="primary" ghost
              onClick={() => openStockModal(record)} />
          </Tooltip>
          <Tooltip title="Sortie de stock">
            <Button icon={<MinusCircleOutlined />} size="small" danger ghost
              onClick={() => openSortieModal(record)} />
          </Tooltip>
          <Tooltip title="Historique mouvements">
            <Button icon={<HistoryOutlined />} size="small"
              onClick={() => openDrawer(record)} />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button icon={<EditOutlined />} size="small"
              onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title={record.alerte_ignoree ? 'Réactiver l\'alerte rupture' : 'Ignorer l\'alerte rupture'}>
            <Button
              icon={record.alerte_ignoree ? <BellOutlined /> : <EyeInvisibleOutlined />}
              size="small"
              onClick={() => toggleIgnore(record)}
              style={record.alerte_ignoree
                ? { color: '#10b981', borderColor: '#10b981' }
                : { color: '#94a3b8', borderColor: '#e2e8f0' }}
            />
          </Tooltip>
          <Tooltip title="Supprimer">
            <Popconfirm title="Supprimer ce produit ?"
              onConfirm={() => handleDelete(record.id)}
              okText="Oui" cancelText="Non">
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
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Produits & Stock</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Ajouter un produit
        </Button>
      </div>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, borderTop: '3px solid #3b82f6' }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>Total produits</span>}
              value={kpis.total}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${kpis.rupture > 0 ? '#ef4444' : '#e2e8f0'}` }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>En rupture</span>}
              value={kpis.rupture}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: kpis.rupture > 0 ? '#ef4444' : '#94a3b8' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${kpis.faible > 0 ? '#f59e0b' : '#e2e8f0'}` }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>Stock faible (≤ {SEUIL})</span>}
              value={kpis.faible}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: kpis.faible > 0 ? '#f59e0b' : '#94a3b8' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, borderTop: '3px solid #8b5cf6' }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>Valeur stock</span>}
              value={kpis.valeurStock.toFixed(0)}
              suffix="MAD"
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Barre recherche + filtres */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Rechercher par nom ou référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
            allowClear
          />
          <Segmented
            value={filtre}
            onChange={setFiltre}
            options={[
              { label: `Tous (${produits.length})`,       value: 'all' },
              { label: `Rupture (${kpis.rupture})`,       value: 'rupture' },
              { label: `Stock faible (${kpis.faible})`,   value: 'faible' },
              { label: `Ignorés (${kpis.ignoree})`,       value: 'ignore' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} produit(s)` }}
          locale={{ emptyText: 'Aucun produit dans cette catégorie' }}
          rowClassName={(r) => r.stock === 0 && !r.alerte_ignoree ? 'row-rupture' : ''}
        />
      </div>

      {/* Modal Ajouter / Modifier */}
      <Modal
        title={editingProduit ? 'Modifier le produit' : 'Nouveau produit'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editingProduit ? 'Modifier' : 'Ajouter'}
        cancelText="Annuler"
        confirmLoading={formLoading}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Nom requis' }]}>
            <Input placeholder="Ex : Amoxicilline 500mg" />
          </Form.Item>
          <Form.Item name="reference" label="Référence" rules={[{ required: true, message: 'Référence requise' }]}>
            <Input placeholder="Ex : AMX-500" />
          </Form.Item>
          <Form.Item name="prix" label="Prix de vente (MAD)" rules={[{ required: true, message: 'Prix requis' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          {!editingProduit && (
            <Form.Item name="stock" label="Stock initial" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Modal Entrée de stock */}
      <Modal
        title={`Entrée de stock — ${stockProduit?.nom}`}
        open={stockModal}
        onCancel={() => setStockModal(false)}
        onOk={() => stockForm.submit()}
        okText="Confirmer"
        cancelText="Annuler"
        confirmLoading={formLoading}
      >
        <Form form={stockForm} layout="vertical" onFinish={handleEntreeStock} style={{ marginTop: 16 }}>
          <Form.Item name="quantite" label="Quantité à ajouter"
            rules={[{ required: true, message: 'Quantité requise' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Provenance (optionnel)">
            <Input placeholder="Ex : Achat fournisseur, Retour client, Inventaire…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Sortie de stock */}
      <Modal
        title={`Sortie de stock — ${sortieProduit?.nom}`}
        open={sortieModal}
        onCancel={() => setSortieModal(false)}
        onOk={() => sortieForm.submit()}
        okText="Confirmer"
        okButtonProps={{ danger: true }}
        cancelText="Annuler"
        confirmLoading={formLoading}
      >
        <Form form={sortieForm} layout="vertical" onFinish={handleSortieStock} style={{ marginTop: 16 }}>
          <Form.Item name="quantite" label={`Quantité à retirer (stock actuel : ${sortieProduit?.stock ?? '—'})`}
            rules={[{ required: true, message: 'Quantité requise' }]}>
            <InputNumber min={1} max={sortieProduit?.stock} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Motif (optionnel)">
            <Input placeholder="Ex : Casse, Usage interne, Périmé…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer historique */}
      <Drawer
        title={`Historique — ${drawerProduit?.nom}`}
        open={drawer}
        onClose={() => setDrawer(false)}
        width={380}
      >
        {mouvements.length === 0 ? (
          <Text type="secondary">Aucun mouvement enregistré.</Text>
        ) : (
          <Timeline
            items={mouvements.map((m) => {
              const isEntree = m.type === 'entrée'
              const source = m.bon_livraison_id
                ? `BL #${m.bon_livraison_id}`
                : m.notes || (isEntree ? 'Entrée manuelle' : 'Sortie manuelle')
              return {
                color: isEntree ? 'green' : 'red',
                children: (
                  <div>
                    <Text strong style={{ color: isEntree ? '#10b981' : '#ef4444' }}>
                      {isEntree ? '+' : '−'}{m.quantite} unités
                    </Text>
                    <br />
                    <Text style={{ fontSize: 12, color: '#64748b' }}>{source}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(m.date).toLocaleString('fr-FR')}
                    </Text>
                  </div>
                ),
              }
            })}
          />
        )}
      </Drawer>
    </div>
  )
}

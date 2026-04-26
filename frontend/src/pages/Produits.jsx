import {
  Table, Button, Input, Space, Tag, Typography, Modal, Form,
  InputNumber, Drawer, Timeline, Popconfirm, message, Tooltip
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  PlusCircleOutlined, HistoryOutlined
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

function stockTag(stock) {
  if (stock === 0) return <Tag color="error">Rupture</Tag>
  if (stock <= 5)  return <Tag color="warning">{stock}</Tag>
  return <Tag color="success">{stock}</Tag>
}

export default function Produits() {
  const [produits, setProduits]         = useState([])
  const [filtered, setFiltered]         = useState([])
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')

  const [modalOpen, setModalOpen]       = useState(false)
  const [editingProduit, setEditing]    = useState(null)
  const [formLoading, setFormLoading]   = useState(false)

  const [stockModal, setStockModal]     = useState(false)
  const [stockProduit, setStockProduit] = useState(null)
  const [stockForm]                     = Form.useForm()

  const [drawer, setDrawer]             = useState(false)
  const [mouvements, setMouvements]     = useState([])
  const [drawerProduit, setDrawerProduit] = useState(null)

  const [form] = Form.useForm()

  const fetchProduits = async () => {
    setLoading(true)
    try {
      const res = await api.get('/produits')
      setProduits(res.data)
      setFiltered(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProduits() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(produits.filter(p =>
      p.nom.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
    ))
  }, [search, produits])

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

  const openStockModal = (produit) => {
    setStockProduit(produit)
    stockForm.resetFields()
    setStockModal(true)
  }

  const handleEntreeStock = async (values) => {
    setFormLoading(true)
    try {
      await api.post('/stock/entree', { produit_id: stockProduit.id, quantite: values.quantite })
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
      width: 120,
      render: (v) => <Text strong>{Number(v).toFixed(2)} MAD</Text>,
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (v) => stockTag(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="Entrée de stock">
            <Button
              icon={<PlusCircleOutlined />}
              size="small"
              type="primary"
              ghost
              onClick={() => openStockModal(record)}
            />
          </Tooltip>
          <Tooltip title="Historique">
            <Button
              icon={<HistoryOutlined />}
              size="small"
              onClick={() => openDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Supprimer">
            <Popconfirm
              title="Supprimer ce produit ?"
              onConfirm={() => handleDelete(record.id)}
              okText="Oui"
              cancelText="Non"
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
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Produits & Stock</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Ajouter un produit
        </Button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Rechercher par nom ou référence..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320, marginBottom: 16 }}
          allowClear
        />
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} produit(s)` }}
          locale={{ emptyText: 'Aucun produit enregistré' }}
        />
      </div>

      {/* Modale Ajouter / Modifier */}
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
            <Input placeholder="Ex : Câble HDMI" />
          </Form.Item>
          <Form.Item name="reference" label="Référence" rules={[{ required: true, message: 'Référence requise' }]}>
            <Input placeholder="Ex : CAB-HDMI-001" />
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

      {/* Modale Entrée de stock */}
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
          <Form.Item name="quantite" label="Quantité à ajouter" rules={[{ required: true, message: 'Quantité requise' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
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
            items={mouvements.map((m) => ({
              color: m.type === 'entrée' ? 'green' : 'red',
              children: (
                <div>
                  <Text strong style={{ color: m.type === 'entrée' ? '#10b981' : '#ef4444' }}>
                    {m.type === 'entrée' ? '+' : '-'}{m.quantite} unités
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(m.date).toLocaleString('fr-FR')}
                  </Text>
                </div>
              ),
            }))}
          />
        )}
      </Drawer>
    </div>
  )
}

import {
  Table, Button, Input, Space, Tag, Typography, Modal, Form,
  Popconfirm, message, Tooltip, Switch
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, BankOutlined
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

export default function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState([])
  const [filtered, setFiltered]         = useState([])
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')

  const [modalOpen, setModalOpen]       = useState(false)
  const [editingFourn, setEditing]      = useState(null)
  const [formLoading, setFormLoading]   = useState(false)
  const [particulier, setParticulier]   = useState(false)

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

  useEffect(() => { fetchFournisseurs() }, [])

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

  const columns = [
    {
      title: 'Type',
      dataIndex: 'particulier',
      key: 'particulier',
      width: 110,
      render: (v) => v
        ? <Tag icon={<UserOutlined />} color="blue">Particulier</Tag>
        : <Tag icon={<BankOutlined />} color="geekblue">Entreprise</Tag>,
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
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="Modifier">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Supprimer">
            <Popconfirm
              title="Supprimer ce fournisseur ?"
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

      {/* Modale Ajouter / Modifier */}
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
        </Form>
      </Modal>
    </div>
  )
}

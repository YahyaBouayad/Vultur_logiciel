import {
  Table, Button, Input, Space, Tag, Typography, Modal, Form,
  Select, InputNumber, Popconfirm, message, Tooltip, Drawer,
  Divider, Badge, Empty
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, SendOutlined, MinusCircleOutlined
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

const CYCLE       = ['brouillon', 'envoyé', 'reçu']
const statutColor = { brouillon: 'default', envoyé: 'processing', reçu: 'success' }
const statutLabel = { brouillon: 'Brouillon', envoyé: 'Envoyé', reçu: 'Reçu' }

const nextAction = {
  brouillon: { label: 'Marquer envoyé', icon: <SendOutlined /> },
  envoyé:    { label: 'Marquer reçu',   icon: <CheckCircleOutlined /> },
}

export default function Achats() {
  const [bons, setBons]               = useState([])
  const [filtered, setFiltered]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')

  const [fournisseurs, setFournisseurs] = useState([])
  const [produits, setProduits]         = useState([])

  const [modalOpen, setModalOpen]     = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [lignes, setLignes]           = useState([{ produit_id: null, quantite: 1, prix_unitaire: 0 }])

  const [drawer, setDrawer]           = useState(false)
  const [selected, setSelected]       = useState(null)

  const [form] = Form.useForm()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [bc, f, p] = await Promise.all([
        api.get('/bons-commande'),
        api.get('/fournisseurs'),
        api.get('/produits'),
      ])
      setBons(bc.data)
      setFiltered(bc.data)
      setFournisseurs(f.data)
      setProduits(p.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(bons.filter(b => {
      const fourn = fournisseurs.find(f => f.id === b.fournisseur_id)
      return (
        String(b.id).includes(q) ||
        (fourn?.nom || '').toLowerCase().includes(q)
      )
    }))
  }, [search, bons, fournisseurs])

  const openAdd = () => {
    form.resetFields()
    setLignes([{ produit_id: null, quantite: 1, prix_unitaire: 0 }])
    setModalOpen(true)
  }

  const handleSave = async (values) => {
    if (lignes.some(l => !l.produit_id)) {
      message.error('Sélectionnez un produit pour chaque ligne')
      return
    }
    setFormLoading(true)
    try {
      await api.post('/bons-commande', {
        fournisseur_id: values.fournisseur_id,
        notes: values.notes || null,
        lignes: lignes.map(l => ({
          produit_id: l.produit_id,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
        })),
      })
      message.success('Bon de commande créé')
      setModalOpen(false)
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setFormLoading(false)
    }
  }

  const handleAvancer = async (bc) => {
    const idx = CYCLE.indexOf(bc.statut)
    if (idx >= CYCLE.length - 1) return
    try {
      await api.put(`/bons-commande/${bc.id}/statut`, { statut: CYCLE[idx + 1] })
      message.success(`Statut mis à jour : ${statutLabel[CYCLE[idx + 1]]}`)
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/bons-commande/${id}`)
      message.success('Bon de commande supprimé')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const updateLigne = (idx, field, value) => {
    const updated = [...lignes]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'produit_id') {
      const produit = produits.find(p => p.id === value)
      if (produit) updated[idx].prix_unitaire = Number(produit.prix)
    }
    setLignes(updated)
  }

  const addLigne   = () => setLignes([...lignes, { produit_id: null, quantite: 1, prix_unitaire: 0 }])
  const removeLigne = (idx) => setLignes(lignes.filter((_, i) => i !== idx))

  const totalBC = (bc) =>
    bc.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire), 0)

  const columns = [
    {
      title: 'N°',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      render: (v) => <Text code>#{v}</Text>,
    },
    {
      title: 'Fournisseur',
      dataIndex: 'fournisseur_id',
      key: 'fournisseur_id',
      render: (id) => {
        const f = fournisseurs.find(f => f.id === id)
        return <Text strong>{f?.nom || '—'}</Text>
      },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (v) => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      width: 120,
      render: (v) => <Badge status={statutColor[v]} text={statutLabel[v]} />,
    },
    {
      title: 'Total',
      key: 'total',
      width: 140,
      render: (_, r) => <Text strong>{totalBC(r).toFixed(2)} MAD</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="Voir le détail">
            <Button size="small" onClick={() => { setSelected(record); setDrawer(true) }}>
              Détail
            </Button>
          </Tooltip>
          {nextAction[record.statut] && (
            <Tooltip title={nextAction[record.statut].label}>
              <Button
                size="small"
                type="primary"
                ghost
                icon={nextAction[record.statut].icon}
                onClick={() => handleAvancer(record)}
              />
            </Tooltip>
          )}
          {record.statut === 'brouillon' && (
            <Tooltip title="Supprimer">
              <Popconfirm
                title="Supprimer ce bon de commande ?"
                onConfirm={() => handleDelete(record.id)}
                okText="Oui" cancelText="Non"
              >
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Achats — Bons de commande</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
          style={{ background: '#1e293b', borderColor: '#1e293b' }}>
          Nouveau bon de commande
        </Button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Rechercher par N° ou fournisseur..."
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
          pagination={{ pageSize: 10, showTotal: (t) => `${t} bon(s)` }}
          locale={{ emptyText: 'Aucun bon de commande' }}
        />
      </div>

      {/* Modale création */}
      <Modal
        title="Nouveau bon de commande"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Créer"
        cancelText="Annuler"
        confirmLoading={formLoading}
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="fournisseur_id" label="Fournisseur" rules={[{ required: true, message: 'Fournisseur requis' }]}>
            <Select
              placeholder="Sélectionner un fournisseur"
              options={fournisseurs.map(f => ({ value: f.id, label: f.nom }))}
              showSearch
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Remarques optionnelles..." />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Lignes de commande</Divider>

          {lignes.map((ligne, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
              <Select
                placeholder="Produit"
                style={{ flex: 2 }}
                value={ligne.produit_id}
                onChange={(v) => updateLigne(idx, 'produit_id', v)}
                options={produits.map(p => ({ value: p.id, label: `${p.reference} — ${p.nom}` }))}
                showSearch
                filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              />
              <InputNumber
                min={1}
                value={ligne.quantite}
                onChange={(v) => updateLigne(idx, 'quantite', v)}
                placeholder="Qté"
                style={{ width: 80 }}
              />
              <InputNumber
                min={0}
                precision={2}
                value={ligne.prix_unitaire}
                onChange={(v) => updateLigne(idx, 'prix_unitaire', v)}
                placeholder="Prix unit."
                style={{ width: 120 }}
                addonAfter="MAD"
              />
              <Button
                icon={<MinusCircleOutlined />}
                danger
                disabled={lignes.length === 1}
                onClick={() => removeLigne(idx)}
              />
            </div>
          ))}

          <Button type="dashed" onClick={addLigne} icon={<PlusOutlined />} block>
            Ajouter une ligne
          </Button>

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Text strong>
              Total : {lignes.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0).toFixed(2)} MAD
            </Text>
          </div>
        </Form>
      </Modal>

      {/* Drawer détail */}
      <Drawer
        title={`Bon de commande #${selected?.id}`}
        open={drawer}
        onClose={() => setDrawer(false)}
        width={500}
      >
        {selected && (
          <>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Fournisseur</Text>
                <Text strong>{fournisseurs.find(f => f.id === selected.fournisseur_id)?.nom}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Date</Text>
                <Text>{new Date(selected.date).toLocaleDateString('fr-FR')}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Statut</Text>
                <Badge status={statutColor[selected.statut]} text={statutLabel[selected.statut]} />
              </div>
              {selected.notes && (
                <div>
                  <Text type="secondary">Notes</Text>
                  <br />
                  <Text>{selected.notes}</Text>
                </div>
              )}
            </Space>

            <Divider />

            {selected.lignes.length === 0 ? (
              <Empty description="Aucune ligne" />
            ) : (
              <Table
                size="small"
                dataSource={selected.lignes}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'Produit',
                    dataIndex: 'produit_id',
                    render: (id) => {
                      const p = produits.find(p => p.id === id)
                      return p ? `${p.reference} — ${p.nom}` : id
                    },
                  },
                  { title: 'Qté', dataIndex: 'quantite', width: 60 },
                  {
                    title: 'Prix unit.',
                    dataIndex: 'prix_unitaire',
                    width: 110,
                    render: (v) => `${Number(v).toFixed(2)} MAD`,
                  },
                  {
                    title: 'Sous-total',
                    width: 110,
                    render: (_, l) => (
                      <Text strong>{(l.quantite * Number(l.prix_unitaire)).toFixed(2)} MAD</Text>
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3} align="right">
                      <Text strong>Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell>
                      <Text strong type="danger">{totalBC(selected).toFixed(2)} MAD</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}

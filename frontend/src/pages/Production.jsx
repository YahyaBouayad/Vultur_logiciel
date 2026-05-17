import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Typography, message, Popconfirm, Tag, Tooltip, Divider,
  Row, Col,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined,
  HistoryOutlined, ExperimentOutlined, MinusCircleOutlined, RollbackOutlined,
} from '@ant-design/icons'
import api from '../api/axios'
import { useSettings } from '../context/SettingsContext'

const { Title, Text } = Typography
const { Option } = Select

const UNITES = ['unité', 'kg', 'g', 'L', 'mL']

function fmtNum(n) {
  const x = parseFloat(n)
  return x % 1 === 0 ? String(x) : x.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function fmtQte(qte, unite) {
  return `${fmtNum(qte)} ${unite}`
}

function batchesPossibles(r) {
  if (!r.lignes || r.lignes.length === 0) return null
  const ratios = r.lignes
    .filter(l => parseFloat(l.quantite) > 0)
    .map(l => parseFloat(l.produit_stock) / parseFloat(l.quantite))
  if (ratios.length === 0) return null
  return Math.floor(Math.min(...ratios) * 1000) / 1000
}

export default function Production() {
  const { settings } = useSettings()
  const [activeTab, setActiveTab] = useState('recettes')
  const [recettes, setRecettes]   = useState([])
  const [ordres, setOrdres]       = useState([])
  const [produits, setProduits]   = useState([])
  const [loading, setLoading]     = useState(false)

  const [recetteModal, setRecetteModal]   = useState(false)
  const [editingRecette, setEditingRecette] = useState(null)
  const [recetteForm]                     = Form.useForm()
  const [recetteLoading, setRecetteLoading] = useState(false)

  const [fabModal, setFabModal]     = useState(false)
  const [fabRecette, setFabRecette] = useState(null)
  const [fabForm]                   = Form.useForm()
  const [fabLoading, setFabLoading] = useState(false)
  const [nbBatches, setNbBatches]   = useState(1)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, o, p] = await Promise.all([
        api.get('/recettes'),
        api.get('/production'),
        api.get('/produits'),
      ])
      setRecettes(r.data)
      setOrdres(o.data)
      setProduits(p.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openNewRecette = () => {
    setEditingRecette(null)
    recetteForm.resetFields()
    setRecetteModal(true)
  }

  const openEditRecette = (r) => {
    setEditingRecette(r)
    recetteForm.setFieldsValue({
      quantite_produite: r.quantite_produite,
      notes: r.notes || '',
      lignes: r.lignes.map(l => ({ produit_id: l.produit_id, quantite: l.quantite })),
    })
    setRecetteModal(true)
  }

  const handleSaveRecette = async (values) => {
    setRecetteLoading(true)
    try {
      if (editingRecette) {
        await api.put(`/recettes/${editingRecette.id}`, {
          quantite_produite: values.quantite_produite,
          notes: values.notes || null,
          lignes: values.lignes,
        })
        message.success('Recette mise à jour')
      } else {
        await api.post('/recettes', values)
        message.success('Recette créée avec le produit fini')
      }
      setRecetteModal(false)
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setRecetteLoading(false)
    }
  }

  const handleDeleteRecette = async (id) => {
    try {
      await api.delete(`/recettes/${id}`)
      message.success('Recette supprimée')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur')
    }
  }

  const openFabriquer = (r) => {
    setFabRecette(r)
    setNbBatches(1)
    fabForm.resetFields()
    fabForm.setFieldsValue({ nombre_batches: 1, quantite_reelle: parseFloat(r.quantite_produite) })
    setFabModal(true)
  }

  const onFabValuesChange = (changed) => {
    if (changed.nombre_batches !== undefined && fabRecette) {
      const n = changed.nombre_batches || 0
      const theorique = parseFloat((parseFloat(fabRecette.quantite_produite) * n).toFixed(3))
      fabForm.setFieldValue('quantite_reelle', theorique)
      setNbBatches(n)
    }
  }

  const handleAnnuler = async (id) => {
    try {
      await api.delete(`/production/${id}`)
      message.success('Fabrication annulée — stocks restaurés')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur lors de l\'annulation')
    }
  }

  const handleFabriquer = async (values) => {
    setFabLoading(true)
    try {
      await api.post('/production', {
        recette_id: fabRecette.id,
        nombre_batches: values.nombre_batches,
        quantite_reelle: values.quantite_reelle,
        notes: values.notes || null,
      })
      message.success('Production lancée avec succès !')
      setFabModal(false)
      setActiveTab('historique')
      fetchAll()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur lors de la fabrication')
    } finally {
      setFabLoading(false)
    }
  }

  const statsByRecette = useMemo(() => {
    const map = {}
    for (const o of ordres) {
      if (!map[o.recette_id]) map[o.recette_id] = { totalTheorique: 0, totalReelle: 0, totalPerte: 0, count: 0 }
      map[o.recette_id].totalTheorique += parseFloat(o.quantite_produite)
      map[o.recette_id].totalReelle    += parseFloat(o.quantite_reelle)
      map[o.recette_id].totalPerte     += parseFloat(o.perte)
      map[o.recette_id].count++
    }
    return map
  }, [ordres])

  const recetteColumns = (() => {
    const cols = [
      {
        title: 'Produit fini',
        key: 'produit',
        render: (_, r) => (
          <div>
            <Text strong>{r.produit_nom}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{r.produit_reference}</Text>
          </div>
        ),
      },
      {
        title: 'Qté / batch',
        key: 'qte',
        width: 130,
        render: (_, r) => <Tag color="blue">{fmtQte(r.quantite_produite, r.produit_unite)}</Tag>,
      },
      {
        title: 'Ingrédients',
        key: 'ingredients',
        render: (_, r) => (
          <Space size={4} wrap>
            {r.lignes.map(l => (
              <Tag key={l.id} color="default">
                {l.produit_nom} — {fmtQte(l.quantite, l.produit_unite)}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: 'Stock actuel',
        key: 'stock',
        width: 130,
        render: (_, r) => <Text>{fmtQte(r.produit_stock, r.produit_unite)}</Text>,
      },
    ]

    if (settings.prodAfficherBatches !== false) {
      cols.push({
        title: 'Batches possibles',
        key: 'batches_possibles',
        width: 150,
        render: (_, r) => {
          const n = batchesPossibles(r)
          if (n === null) return <Text type="secondary">—</Text>
          if (n === 0) return <Tag color="red">Stock insuffisant</Tag>
          return (
            <Tooltip title={`Avec le stock actuel des ingrédients`}>
              <Tag color={n < 1 ? 'orange' : 'green'}>{fmtNum(n)} batch{n > 1 ? 'es' : ''}</Tag>
            </Tooltip>
          )
        },
      })
    }

    if (settings.prodAfficherStats !== false) {
      cols.push({
        title: 'Taux de perte moy.',
        key: 'stats_pertes',
        width: 150,
        render: (_, r) => {
          const s = statsByRecette[r.id]
          if (!s || s.count === 0) return <Text type="secondary" style={{ fontSize: 12 }}>Aucune fabrication</Text>
          const taux = s.totalTheorique > 0 ? (s.totalPerte / s.totalTheorique) * 100 : 0
          return (
            <Tooltip title={`${s.count} fabrication(s) — ${fmtNum(s.totalPerte)} ${r.produit_unite} perdus au total`}>
              <div>
                <Tag color={taux === 0 ? 'green' : taux < 5 ? 'orange' : 'red'}>
                  {taux.toFixed(1)} %
                </Tag>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {s.count} fabrication{s.count > 1 ? 's' : ''}
                </div>
              </div>
            </Tooltip>
          )
        },
      })
    }

    cols.push({
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Lancer une fabrication">
            <Button
              type="primary" icon={<ThunderboltOutlined />} size="small"
              style={{ background: '#10b981', borderColor: '#10b981' }}
              onClick={() => openFabriquer(r)}
            />
          </Tooltip>
          <Tooltip title="Modifier la recette">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEditRecette(r)} />
          </Tooltip>
          <Tooltip title="Supprimer la recette">
            <Popconfirm
              title="Supprimer cette recette ?" okText="Oui" cancelText="Non"
              onConfirm={() => handleDeleteRecette(r.id)}
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    })

    return cols
  })()

  const ordreColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
      render: (d) => new Date(d).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Produit fabriqué',
      dataIndex: 'produit_nom',
      key: 'produit',
    },
    {
      title: 'Batches',
      dataIndex: 'nombre_batches',
      key: 'batches',
      width: 100,
      render: (v) => <Tag color="purple">{fmtNum(v)} batch(es)</Tag>,
    },
    {
      title: 'Quantité produite',
      key: 'qte',
      width: 160,
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#10b981' }}>
            +{fmtQte(r.quantite_reelle, r.produit_unite)}
          </Text>
          {r.perte > 0 && (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              théorique : {fmtQte(r.quantite_produite, r.produit_unite)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Perte',
      key: 'perte',
      width: 130,
      render: (_, r) => r.perte > 0
        ? <Tag color="red">−{fmtQte(r.perte, r.produit_unite)}</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    ...(settings.prodAfficherCout !== false ? [{
      title: 'Coût de revient',
      key: 'cout',
      width: 160,
      render: (_, r) => r.cout_production > 0 ? (
        <div>
          <Text strong style={{ color: '#8b5cf6' }}>{r.cout_production.toFixed(2)} MAD</Text>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {r.cout_unitaire.toFixed(3)} MAD / {r.produit_unite}
          </div>
        </div>
      ) : <Text type="secondary">—</Text>,
    }] : []),
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (v) => v ? <Text type="secondary">{v}</Text> : '—',
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => (
        <Popconfirm
          title="Annuler cette fabrication ?"
          description="Les ingrédients consommés seront remis en stock et le produit fini sera retiré."
          onConfirm={() => handleAnnuler(r.id)}
          okText="Annuler la fabrication"
          okButtonProps={{ danger: true }}
          cancelText="Garder"
        >
          <Tooltip title="Annuler la fabrication">
            <Button icon={<RollbackOutlined />} size="small" danger />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Production</Title>
        {activeTab === 'recettes' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewRecette}
            style={{ background: '#1e293b', borderColor: '#1e293b' }}>
            Nouvelle recette
          </Button>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'recettes',
            label: <span><ExperimentOutlined /> Recettes ({recettes.length})</span>,
            children: (
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Table
                  columns={recetteColumns}
                  dataSource={recettes}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, showTotal: (t) => `${t} recette(s)` }}
                  locale={{ emptyText: 'Aucune recette. Créez-en une pour commencer.' }}
                />
              </div>
            ),
          },
          {
            key: 'historique',
            label: <span><HistoryOutlined /> Historique ({ordres.length})</span>,
            children: (
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Table
                  columns={ordreColumns}
                  dataSource={ordres}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15, showTotal: (t) => `${t} fabrication(s)` }}
                  locale={{ emptyText: 'Aucune fabrication enregistrée.' }}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Modal Nouvelle / Modifier Recette */}
      <Modal
        title={editingRecette ? `Modifier la recette — ${editingRecette.produit_nom}` : 'Nouvelle recette'}
        open={recetteModal}
        onCancel={() => setRecetteModal(false)}
        onOk={() => recetteForm.submit()}
        okText={editingRecette ? 'Enregistrer' : 'Créer'}
        cancelText="Annuler"
        confirmLoading={recetteLoading}
        width={660}
        destroyOnClose
      >
        <Form form={recetteForm} layout="vertical" onFinish={handleSaveRecette} style={{ marginTop: 16 }}>
          {!editingRecette && (
            <>
              <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
                Produit fini
              </Divider>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="nom" label="Nom du produit" rules={[{ required: true, message: 'Requis' }]}>
                    <Input placeholder="Ex : Crème hydratante 50g" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="reference" label="Référence" rules={[{ required: true, message: 'Requis' }]}>
                    <Input placeholder="Ex : CRE-001" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="prix" label="Prix de vente (MAD)" rules={[{ required: true, message: 'Requis' }]}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="unite" label="Unité de vente" initialValue="unité" rules={[{ required: true }]}>
                    <Select>
                      {UNITES.map(u => <Option key={u} value={u}>{u}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quantite_produite" label="Qté produite / batch" rules={[{ required: true, message: 'Requis' }]}>
                    <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} placeholder="Ex : 10" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {editingRecette && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="quantite_produite" label={`Qté produite / batch (${editingRecette.produit_unite})`} rules={[{ required: true }]}>
                  <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="notes" label="Notes">
                  <Input placeholder="Optionnel" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, color: '#64748b' }}>
            Ingrédients
          </Divider>

          <Form.List
            name="lignes"
            rules={[{
              validator: async (_, v) =>
                !v || v.length === 0
                  ? Promise.reject('Au moins un ingrédient requis')
                  : Promise.resolve(),
            }]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row key={key} gutter={8} align="middle">
                    <Col span={14}>
                      <Form.Item {...rest} name={[name, 'produit_id']} rules={[{ required: true, message: 'Requis' }]}>
                        <Select
                          showSearch
                          placeholder="Sélectionner un ingrédient"
                          filterOption={(input, opt) =>
                            opt.label.toLowerCase().includes(input.toLowerCase())
                          }
                          options={produits.map(p => ({
                            value: p.id,
                            label: `${p.nom} (${p.reference}) — ${fmtNum(p.stock)} ${p.unite}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...rest} name={[name, 'quantite']} rules={[{ required: true, message: 'Requis' }]}>
                        <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} placeholder="Quantité" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Form.Item>
                        <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                      </Form.Item>
                    </Col>
                  </Row>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Ajouter un ingrédient
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>

          {!editingRecette && (
            <Form.Item name="notes" label="Notes (optionnel)">
              <Input.TextArea rows={2} placeholder="Ex : Conditions de fabrication, précautions…" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Modal Fabriquer */}
      <Modal
        title={`Lancer une fabrication — ${fabRecette?.produit_nom}`}
        open={fabModal}
        onCancel={() => setFabModal(false)}
        onOk={() => fabForm.submit()}
        okText="Lancer la production"
        okButtonProps={{ style: { background: '#10b981', borderColor: '#10b981' } }}
        cancelText="Annuler"
        confirmLoading={fabLoading}
        destroyOnClose
      >
        {fabRecette && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Recette — {fmtQte(fabRecette.quantite_produite, fabRecette.produit_unite)} par batch
            </Text>
            <div style={{ marginTop: 8 }}>
              {fabRecette.lignes.map(l => {
                const totalRequis = parseFloat(l.quantite) * nbBatches
                const insuffisant = parseFloat(l.produit_stock) < totalRequis
                return (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                    <Text>{l.produit_nom}</Text>
                    <Text type={insuffisant ? 'danger' : 'secondary'}>
                      stock : {fmtQte(l.produit_stock, l.produit_unite)} | requis : {fmtQte(totalRequis, l.produit_unite)}
                    </Text>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <Form form={fabForm} layout="vertical" onFinish={handleFabriquer} onValuesChange={onFabValuesChange}>
          <Form.Item
            name="nombre_batches"
            label="Nombre de batches"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <InputNumber min={0.001} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="quantite_reelle"
            label={`Quantité réellement obtenue (${fabRecette?.produit_unite || 'unité'}) — théorique : ${fabRecette ? fmtQte(parseFloat(fabRecette.quantite_produite) * nbBatches, fabRecette.produit_unite) : '—'}`}
            rules={[
              { required: true, message: 'Requis' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const theorique = parseFloat(fabRecette?.quantite_produite || 0) * (getFieldValue('nombre_batches') || 0)
                  if (value > theorique + 0.001) return Promise.reject('Ne peut pas dépasser la quantité théorique')
                  if (value < 0) return Promise.reject('Doit être positive')
                  return Promise.resolve()
                },
              }),
            ]}
          >
            <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes (optionnel)">
            <Input placeholder="Ex : Lot #42, légère perte en mélange…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

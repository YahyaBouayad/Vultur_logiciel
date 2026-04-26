import { Tabs, Table, Typography, Spin, Tag, Alert } from 'antd'
import { useEffect, useState } from 'react'
import api from '../api/axios'

const { Title, Text } = Typography

function JsonCell({ value }) {
  if (value === null || value === undefined) return <Text type="secondary">—</Text>
  if (typeof value === 'boolean') return <Tag color={value ? 'blue' : 'default'}>{value ? 'true' : 'false'}</Tag>
  return <span>{String(value)}</span>
}

function AutoTable({ data, error }) {
  if (error) return <Alert type="error" message={`Erreur : ${error}`} style={{ margin: 16 }} />
  if (!data || !data.length) return <Text type="secondary" style={{ padding: 16, display: 'block' }}>Aucune donnée</Text>

  const columns = Object.keys(data[0]).map((key) => ({
    title: <Text strong style={{ fontSize: 12 }}>{key}</Text>,
    dataIndex: key,
    key,
    ellipsis: true,
    width: 150,
    render: (v) => <JsonCell value={v} />,
  }))

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey={(r, i) => r.id ?? i}
      size="small"
      scroll={{ x: true }}
      pagination={{ pageSize: 20, showTotal: (t) => `${t} ligne(s)` }}
    />
  )
}

async function safeFetch(url) {
  try {
    const res = await api.get(url)
    // Supporte les réponses paginées {items, total} et les tableaux directs
    const data = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
    return { data, error: null }
  } catch (e) {
    return { data: [], error: e.response?.data?.detail || e.message }
  }
}

export default function Admin() {
  const [loading, setLoading]   = useState(true)
  const [tables, setTables]     = useState([])

  useEffect(() => {
    async function load() {
      const [produits, clients, fournisseurs, bl, bc, factures, mouvements, utilisateurs] =
        await Promise.all([
          safeFetch('/produits'),
          safeFetch('/clients'),
          safeFetch('/fournisseurs'),
          safeFetch('/bons-livraison?limit=10000'),
          safeFetch('/bons-commande'),
          safeFetch('/factures?limit=10000'),
          safeFetch('/stock/mouvements'),
          safeFetch('/auth/me'),
        ])

      const lignesBL = bl.data.flatMap(b =>
        (b.lignes || []).map(l => ({ id: l.id, bon_livraison_id: b.id, produit_id: l.produit_id, quantite: l.quantite, prix_unitaire: l.prix_unitaire }))
      )
      const lignesBC = bc.data.flatMap(b =>
        (b.lignes || []).map(l => ({ id: l.id, bon_commande_id: b.id, produit_id: l.produit_id, quantite: l.quantite, prix_unitaire: l.prix_unitaire }))
      )

      setTables([
        { label: 'Produits',          data: produits.data,                                                 error: produits.error },
        { label: 'Clients',           data: clients.data,                                                  error: clients.error },
        { label: 'Fournisseurs',      data: fournisseurs.data,                                             error: fournisseurs.error },
        { label: 'Bons de livraison', data: bl.data.map(({ lignes, ...r }) => r),                          error: bl.error },
        { label: 'Lignes BL',         data: lignesBL,                                                      error: bl.error },
        { label: 'Bons de commande',  data: bc.data.map(({ lignes, ...r }) => r),                          error: bc.error },
        { label: 'Lignes BC',         data: lignesBC,                                                      error: bc.error },
        { label: 'Factures',          data: factures.data,                                                 error: factures.error },
        { label: 'Stock mouvements',  data: mouvements.data,                                               error: mouvements.error },
      ])
      setLoading(false)
    }
    load()
  }, [])

  const tabItems = tables.map(({ label, data, error }) => ({
    key: label,
    label: (
      <span>
        {label}
        {error
          ? <Tag color="error" style={{ marginLeft: 6, fontSize: 10 }}>!</Tag>
          : <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({data.length})</Text>
        }
      </span>
    ),
    children: <AutoTable data={data} error={error} />,
  }))

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20, color: '#1e293b' }}>
        Admin — Contenu des tables
      </Title>
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {loading
          ? <Spin style={{ display: 'block', margin: '60px auto' }} />
          : <Tabs items={tabItems} type="card" />
        }
      </div>
    </div>
  )
}

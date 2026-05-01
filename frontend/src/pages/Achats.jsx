import {
  Table, Button, Input, Space, Typography, Modal, Form,
  Select, InputNumber, Popconfirm, message, Tooltip, Drawer,
  Divider, Badge, Empty, DatePicker, Upload, Popover
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, SendOutlined, MinusCircleOutlined,
  FilePdfOutlined, UploadOutlined
} from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import api from '../api/axios'

const { Title, Text } = Typography

const CYCLE       = ['brouillon', 'envoyé', 'reçu']
const statutColor = { brouillon: 'default', envoyé: 'processing', reçu: 'success' }
const statutLabel = { brouillon: 'Brouillon', envoyé: 'Envoyé', reçu: 'Reçu' }

const nextAction = {
  brouillon: { label: 'Marquer envoyé', icon: <SendOutlined /> },
  envoyé:    { label: 'Marquer reçu',   icon: <CheckCircleOutlined /> },
}

const totalLigne = (l) =>
  (l.quantite || 0) * (l.prix_unitaire || 0) * (1 - (l.remise || 0) / 100)

const totalBC = (bc) =>
  bc.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100), 0)

export default function Achats() {
  const [bons, setBons]         = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')

  const [fournisseurs, setFournisseurs] = useState([])
  const [produits, setProduits]         = useState([])

  const [modalOpen, setModalOpen]     = useState(false)
  const [modalMode, setModalMode]     = useState('create')
  const [editingId, setEditingId]     = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [lignes, setLignes]           = useState([{ produit_id: null, quantite: 1, prix_unitaire: 0, remise: 0 }])
  const [pdfBase64, setPdfBase64]     = useState(null)

  const [drawer, setDrawer]     = useState(false)
  const [selected, setSelected] = useState(null)
  const [noteEdit, setNoteEdit] = useState({ id: null, value: '' })

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
    form.setFieldsValue({ date: dayjs() })
    setLignes([{ produit_id: null, quantite: 1, prix_unitaire: 0, remise: 0 }])
    setPdfBase64(null)
    setModalMode('create')
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (record) => {
    form.setFieldsValue({
      fournisseur_id: record.fournisseur_id,
      date: dayjs(record.date),
      notes: record.notes || '',
    })
    setLignes(record.lignes.map(l => ({
      produit_id:    l.produit_id,
      quantite:      l.quantite,
      prix_unitaire: Number(l.prix_unitaire),
      remise:        Number(l.remise || 0),
    })))
    setPdfBase64(record.pdf_base64 || null)
    setModalMode('edit')
    setEditingId(record.id)
    setModalOpen(true)
  }

  const handleSave = async (values) => {
    if (lignes.some(l => !l.produit_id)) {
      message.error('Sélectionnez un produit pour chaque ligne')
      return
    }
    setFormLoading(true)
    try {
      const payload = {
        fournisseur_id: Number(values.fournisseur_id),
        date: values.date ? values.date.format('YYYY-MM-DD') : null,
        notes: values.notes || null,
        lignes: lignes.map(l => ({
          produit_id:    Number(l.produit_id),
          quantite:      Math.max(1, Math.round(Number(l.quantite ?? 1))),
          prix_unitaire: Number((l.prix_unitaire ?? 0)),
          remise:        Number((l.remise ?? 0)),
        })),
        pdf_base64: pdfBase64 || null,
      }
      console.log('payload envoyé:', JSON.stringify(payload, null, 2))
      if (modalMode === 'edit') {
        await api.put(`/bons-commande/${editingId}`, payload)
        message.success('Bon de commande modifié')
      } else {
        await api.post('/bons-commande', payload)
        message.success('Bon de commande créé')
      }
      setModalOpen(false)
      fetchAll()
    } catch (e) {
      const detail = e.response?.data?.detail
      console.error('Erreur API:', e.response?.data)
      if (Array.isArray(detail)) {
        const msg = detail.map(d => `${d.loc?.slice(1).join('.')} : ${d.msg}`).join(' | ')
        message.error(msg, 6)
      } else {
        message.error(detail || 'Erreur')
      }
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

  const addLigne    = () => setLignes([...lignes, { produit_id: null, quantite: 1, prix_unitaire: 0, remise: 0 }])
  const removeLigne = (idx) => setLignes(lignes.filter((_, i) => i !== idx))

  const handlePdfUpload = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      message.error('Le fichier PDF ne doit pas dépasser 5 Mo')
      return false
    }
    const reader = new FileReader()
    reader.onload = (e) => setPdfBase64(e.target.result.split(',')[1])
    reader.readAsDataURL(file)
    return false
  }

  const removePdfFromBC = async (bc) => {
    try {
      const res = await api.put(`/bons-commande/${bc.id}`, { pdf_base64: null })
      message.success('PDF supprimé')
      setSelected(res.data)
      fetchAll()
    } catch {
      message.error('Erreur lors de la suppression du PDF')
    }
  }

  const saveNote = async (bc, value) => {
    try {
      await api.put(`/bons-commande/${bc.id}`, { notes: value || null })
      message.success('Note mise à jour')
      setNoteEdit({ id: null, value: '' })
      fetchAll()
    } catch {
      message.error('Erreur lors de la sauvegarde')
    }
  }

  const handlePdfUploadDirect = (file, bc) => {
    if (file.size > 5 * 1024 * 1024) {
      message.error('Le fichier PDF ne doit pas dépasser 5 Mo')
      return false
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1]
      try {
        const res = await api.put(`/bons-commande/${bc.id}`, { pdf_base64: base64 })
        message.success('PDF ajouté')
        setSelected(res.data)
        fetchAll()
      } catch {
        message.error("Erreur lors de l'ajout du PDF")
      }
    }
    reader.readAsDataURL(file)
    return false
  }

  const downloadPdf = (bc) => {
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${bc.pdf_base64}`
    link.download = `BC-${String(bc.id).padStart(4, '0')}.pdf`
    link.click()
  }

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
      title: 'Notes',
      key: 'notes',
      render: (_, record) => (
        <Popover
          open={noteEdit.id === record.id}
          onOpenChange={(open) => {
            if (open) setNoteEdit({ id: record.id, value: record.notes || '' })
            else setNoteEdit({ id: null, value: '' })
          }}
          trigger="click"
          title={<span style={{ fontWeight: 600 }}>Note — BC #{record.id}</span>}
          content={
            <div style={{ width: 280 }}>
              <Input.TextArea
                rows={3}
                value={noteEdit.value}
                onChange={(e) => setNoteEdit((prev) => ({ ...prev, value: e.target.value }))}
                placeholder="Ajouter une note de suivi..."
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => setNoteEdit({ id: null, value: '' })}>
                  Annuler
                </Button>
                <Button size="small" type="primary"
                  style={{ background: '#1e293b', borderColor: '#1e293b' }}
                  onClick={() => saveNote(record, noteEdit.value)}>
                  Enregistrer
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 200 }}>
            {record.notes ? (
              <Text style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {record.notes}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Ajouter une note…</Text>
            )}
            <EditOutlined style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }} />
          </div>
        </Popover>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Voir le détail">
            <Button size="small" onClick={() => { setSelected(record); setDrawer(true) }}>
              Détail
            </Button>
          </Tooltip>
          {record.pdf_base64 && (
            <Tooltip title="Télécharger le PDF">
              <Button size="small" icon={<FilePdfOutlined />}
                style={{ color: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => downloadPdf(record)} />
            </Tooltip>
          )}
          {record.statut === 'brouillon' && (
            <Tooltip title="Modifier">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {nextAction[record.statut] && (
            <Tooltip title={nextAction[record.statut].label}>
              <Button size="small" type="primary" ghost
                icon={nextAction[record.statut].icon}
                onClick={() => handleAvancer(record)} />
            </Tooltip>
          )}
          {record.statut === 'brouillon' && (
            <Tooltip title="Supprimer">
              <Popconfirm title="Supprimer ce bon de commande ?"
                onConfirm={() => handleDelete(record.id)} okText="Oui" cancelText="Non">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const totalFormulaire = lignes.reduce((s, l) => s + totalLigne(l), 0)

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

      {/* Modal création / modification */}
      <Modal
        title={modalMode === 'edit' ? `Modifier le BC #${editingId}` : 'Nouveau bon de commande'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={modalMode === 'edit' ? 'Enregistrer' : 'Créer'}
        cancelText="Annuler"
        confirmLoading={formLoading}
        width={920}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="fournisseur_id" label="Fournisseur"
              rules={[{ required: true, message: 'Fournisseur requis' }]}
              style={{ flex: 2 }}>
              <Select
                placeholder="Sélectionner un fournisseur"
                options={fournisseurs.map(f => ({ value: f.id, label: f.nom }))}
                showSearch
                filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
            <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Date requise' }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Remarques optionnelles..." />
          </Form.Item>

          <Form.Item label="PDF du bon de commande (optionnel)">
            <Upload beforeUpload={handlePdfUpload} accept=".pdf" maxCount={1} showUploadList={false}>
              <Button icon={<UploadOutlined />}>
                {pdfBase64 ? '✓ PDF chargé — cliquer pour remplacer' : 'Joindre un PDF'}
              </Button>
            </Upload>
            {pdfBase64 && (
              <Button type="link" danger size="small" style={{ marginLeft: 8 }}
                onClick={() => setPdfBase64(null)}>
                Supprimer
              </Button>
            )}
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Lignes de commande</Divider>

          {/* En-tête colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 70px 130px 100px 120px 32px', gap: 8, marginBottom: 6, padding: '0 2px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Produit</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Qté</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Prix unitaire</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Remise</Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>Sous-total</Text>
            <div />
          </div>

          {lignes.map((ligne, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 70px 130px 100px 120px 32px', gap: 8, marginBottom: 10, alignItems: 'center', minWidth: 0 }}>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <Select
                  placeholder="Produit"
                  value={ligne.produit_id}
                  onChange={(v) => updateLigne(idx, 'produit_id', v)}
                  options={produits.map(p => ({ value: p.id, label: `${p.reference} — ${p.nom}` }))}
                  showSearch
                  filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  style={{ width: '100%' }}
                />
              </div>
              <InputNumber
                min={1} value={ligne.quantite}
                onChange={(v) => updateLigne(idx, 'quantite', v)}
                style={{ width: '100%' }}
              />
              <InputNumber
                min={0} precision={2} value={ligne.prix_unitaire}
                onChange={(v) => updateLigne(idx, 'prix_unitaire', v)}
                style={{ width: '100%' }} addonAfter="MAD"
              />
              <InputNumber
                min={0} max={100} precision={1} value={ligne.remise || 0}
                onChange={(v) => updateLigne(idx, 'remise', v || 0)}
                style={{ width: '100%' }} addonAfter="%"
              />
              <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {totalLigne(ligne).toFixed(2)} MAD
              </div>
              <Button icon={<MinusCircleOutlined />} danger
                disabled={lignes.length === 1} onClick={() => removeLigne(idx)} />
            </div>
          ))}

          <Button type="dashed" onClick={addLigne} icon={<PlusOutlined />} block>
            Ajouter une ligne
          </Button>

          <div style={{ textAlign: 'right', marginTop: 14, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 15 }}>
              Total : {totalFormulaire.toFixed(2)} MAD
            </Text>
          </div>
        </Form>
      </Modal>

      {/* Drawer détail */}
      <Drawer
        title={null}
        open={drawer}
        onClose={() => setDrawer(false)}
        width={560}
        styles={{ body: { padding: 0 } }}
      >
        {selected && (
          <>
            {/* En-tête coloré */}
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Bon de commande
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginTop: 4, letterSpacing: '-0.5px' }}>
                    #{String(selected.id).padStart(4, '0')}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: selected.statut === 'reçu' ? '#22c55e22' : selected.statut === 'envoyé' ? '#3b82f622' : '#ffffff22',
                      color: selected.statut === 'reçu' ? '#86efac' : selected.statut === 'envoyé' ? '#93c5fd' : '#cbd5e1',
                      border: `1px solid ${selected.statut === 'reçu' ? '#22c55e55' : selected.statut === 'envoyé' ? '#3b82f655' : '#ffffff33'}`,
                    }}>
                      {statutLabel[selected.statut]}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                    {totalBC(selected).toFixed(2)}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>MAD</div>
                </div>
              </div>
            </div>

            {/* Corps */}
            <div style={{ padding: 24 }}>

              {/* Infos principales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fournisseur</div>
                  <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 6, fontSize: 14 }}>
                    {fournisseurs.find(f => f.id === selected.fournisseur_id)?.nom || '—'}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</div>
                  <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 6, fontSize: 14 }}>
                    {new Date(selected.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <div style={{ color: '#92400e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
                  <div style={{ color: '#78350f', fontSize: 13 }}>{selected.notes}</div>
                </div>
              )}

              {/* PDF */}
              <div style={{ marginBottom: 20 }}>
                {selected.pdf_base64 ? (
                  <Space>
                    <Button icon={<FilePdfOutlined />}
                      onClick={() => downloadPdf(selected)}
                      style={{ borderColor: '#fecaca', color: '#dc2626', background: '#fff5f5' }}>
                      Télécharger le PDF joint
                    </Button>
                    <Popconfirm
                      title="Supprimer le PDF joint ?"
                      onConfirm={() => removePdfFromBC(selected)}
                      okText="Oui" cancelText="Non" okButtonProps={{ danger: true }}>
                      <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                  </Space>
                ) : (
                  <Upload beforeUpload={(file) => handlePdfUploadDirect(file, selected)} accept=".pdf" maxCount={1} showUploadList={false}>
                    <Button icon={<UploadOutlined />} type="dashed" style={{ borderColor: '#cbd5e1', color: '#64748b' }}>
                      Joindre un PDF à ce bon
                    </Button>
                  </Upload>
                )}
              </div>

              {/* Lignes */}
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                  {selected.lignes.length} ligne{selected.lignes.length > 1 ? 's' : ''} de commande
                </Text>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {selected.lignes.map((l) => {
                  const p = produits.find(pr => pr.id === l.produit_id)
                  const sousTotal = l.quantite * Number(l.prix_unitaire) * (1 - Number(l.remise || 0) / 100)
                  return (
                    <div key={l.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Infos produit */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p ? p.nom : `Produit #${l.produit_id}`}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                          {p?.reference && <span style={{ marginRight: 6 }}>{p.reference} ·</span>}
                          {Number(l.prix_unitaire).toFixed(2)} MAD / u.
                          {Number(l.remise || 0) > 0 && (
                            <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 600 }}>−{Number(l.remise).toFixed(1)}%</span>
                          )}
                        </div>
                      </div>
                      {/* Badge quantité */}
                      <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, background: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>{l.quantite}</span>
                        <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 500, marginTop: 2 }}>unité{l.quantite > 1 ? 's' : ''}</span>
                      </div>
                      {/* Sous-total */}
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14, whiteSpace: 'nowrap', textAlign: 'right', minWidth: 90 }}>
                        {sousTotal.toFixed(2)} MAD
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total bas */}
              <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>Total TTC</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{totalBC(selected).toFixed(2)} MAD</span>
              </div>

              {/* Bouton modifier */}
              <Button icon={<EditOutlined />} block size="large"
                onClick={() => { setDrawer(false); openEdit(selected) }}
                style={{ borderColor: '#e2e8f0', color: '#1e293b', fontWeight: 600 }}>
                Modifier ce bon de commande
              </Button>

            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}

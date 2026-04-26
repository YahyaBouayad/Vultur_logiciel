import { Card, Col, Row, Statistic, Typography, Table, Tabs, Button, Badge, Empty, Dropdown, Modal } from 'antd'
import { DownloadOutlined, FilePdfOutlined, FileZipOutlined, DownOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import { DatePicker } from 'antd'
import { pdf } from '@react-pdf/renderer'
import JSZip from 'jszip'
import api from '../api/axios'
import { useSettings } from '../context/SettingsContext'
import FacturePDF from '../components/pdf/FacturePDF'
import AllFacturesPDF from '../components/pdf/AllFacturesPDF'

dayjs.extend(quarterOfYear)

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const rangePresets = [
  { label: 'Ce mois',             value: [dayjs().startOf('month'),                      dayjs().endOf('month')] },
  { label: 'Mois précédent',      value: [dayjs().subtract(1,'month').startOf('month'),   dayjs().subtract(1,'month').endOf('month')] },
  { label: 'Ce trimestre',        value: [dayjs().startOf('quarter'),                     dayjs().endOf('quarter')] },
  { label: 'Trimestre précédent', value: [dayjs().subtract(1,'quarter').startOf('quarter'), dayjs().subtract(1,'quarter').endOf('quarter')] },
  { label: 'Cette année',         value: [dayjs().startOf('year'),                        dayjs().endOf('year')] },
  { label: 'Année précédente',    value: [dayjs().subtract(1,'year').startOf('year'),      dayjs().subtract(1,'year').endOf('year')] },
]

const fmt = (n) => Number(n || 0).toFixed(2)

function exportCSV(filename, headers, rows) {
  const lines = [
    headers.join(';'),
    ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Comptabilite() {
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')])
  const [factures,     setFactures]     = useState([])
  const [achats,       setAchats]       = useState([])
  const [clients,      setClients]      = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [produits,     setProduits]     = useState([])
  const [loading, setLoading] = useState(false)
  const { settings } = useSettings()
  const tauxTVA = Number(settings.tva) || 0

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
    api.get('/fournisseurs').then(r => setFournisseurs(r.data)).catch(() => {})
    api.get('/produits').then(r => setProduits(r.data)).catch(() => {})
    load([dayjs().startOf('month'), dayjs().endOf('month')])
  }, [])

  const load = async ([debut, fin]) => {
    setLoading(true)
    try {
      const [f, a] = await Promise.all([
        api.get('/factures', { params: { date_debut: debut.format('YYYY-MM-DD'), date_fin: fin.format('YYYY-MM-DD'), skip: 0, limit: 10000 } }),
        api.get('/bons-commande', { params: { date_debut: debut.format('YYYY-MM-DD'), date_fin: fin.format('YYYY-MM-DD') } }),
      ])
      setFactures(f.data.items || [])
      setAchats(a.data || [])
    } catch {
      setFactures([])
      setAchats([])
    } finally {
      setLoading(false)
    }
  }

  const handleRangeChange = (range) => {
    setDateRange(range)
    if (range?.[0] && range?.[1]) load(range)
  }

  const totalBC = (bc) =>
    bc.lignes.reduce((s, l) => s + l.quantite * Number(l.prix_unitaire), 0)

  // KPIs calculés
  const facturesActives = factures.filter(f => f.statut !== 'annulée')
  const achatsFiltres   = achats.filter(a => a.statut === 'reçu')
  const caHT            = facturesActives.reduce((s, f) => s + (f.montant_ht || 0), 0)
  const achatsHT        = achatsFiltres.reduce((s, a) => s + totalBC(a), 0)
  const tvaCollectee    = caHT * tauxTVA / 100
  const tvaDeductible   = achatsHT * tauxTVA / 100
  const soldeTVA        = tvaCollectee - tvaDeductible
  const margeBrute      = caHT - achatsHT
  const tauxMarge       = caHT > 0 ? (margeBrute / caHT) * 100 : null

  // ─── Colonnes journal des ventes ────────────────────────
  const colVentes = [
    {
      title: 'Numéro', dataIndex: 'numero', width: 150,
      render: v => <Text code style={{ fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Client', dataIndex: 'client_id',
      render: id => clients.find(c => c.id === id)?.nom || '—',
    },
    {
      title: 'Date', dataIndex: 'date_emission', width: 110,
      render: v => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Échéance', dataIndex: 'date_echeance', width: 110,
      render: v => v ? new Date(v).toLocaleDateString('fr-FR') : <Text type="secondary">—</Text>,
    },
    {
      title: 'HT', key: 'ht', width: 120,
      render: (_, r) => `${fmt(r.montant_ht)} MAD`,
    },
    {
      title: `TVA ${tauxTVA}%`, key: 'tva', width: 110,
      render: (_, r) => `${fmt((r.montant_ht || 0) * tauxTVA / 100)} MAD`,
    },
    {
      title: 'TTC', key: 'ttc', width: 130,
      render: (_, r) => <Text strong>{fmt((r.montant_ht || 0) * (1 + tauxTVA / 100))} MAD</Text>,
    },
    {
      title: 'Statut', dataIndex: 'statut', width: 100,
      render: v => {
        const map = { émise: ['processing','Émise'], payée: ['success','Payée'], annulée: ['error','Annulée'] }
        const [status, label] = map[v] || ['default', v]
        return <Badge status={status} text={label} />
      },
    },
  ]

  // ─── Colonnes journal des achats ─────────────────────────
  const colAchats = [
    {
      title: 'N°', dataIndex: 'id', width: 60,
      render: v => <Text code>#{v}</Text>,
    },
    {
      title: 'Fournisseur', dataIndex: 'fournisseur_id',
      render: id => fournisseurs.find(f => f.id === id)?.nom || '—',
    },
    {
      title: 'Date', dataIndex: 'date', width: 110,
      render: v => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'HT', key: 'ht', width: 120,
      render: (_, r) => `${fmt(totalBC(r))} MAD`,
    },
    {
      title: `TVA ${tauxTVA}%`, key: 'tva', width: 110,
      render: (_, r) => `${fmt(totalBC(r) * tauxTVA / 100)} MAD`,
    },
    {
      title: 'TTC', key: 'ttc', width: 130,
      render: (_, r) => <Text strong>{fmt(totalBC(r) * (1 + tauxTVA / 100))} MAD</Text>,
    },
    {
      title: 'Statut', dataIndex: 'statut', width: 100,
      render: v => {
        const map = { brouillon: ['default','Brouillon'], envoyé: ['processing','Envoyé'], reçu: ['success','Reçu'] }
        const [status, label] = map[v] || ['default', v]
        return <Badge status={status} text={label} />
      },
    },
  ]

  const [exportLoading, setExportLoading] = useState(false)

  const fetchAllBL = async () => {
    const bls = await Promise.all(
      facturesActives.map(f =>
        api.get(`/bons-livraison/${f.bon_livraison_id}`).then(r => r.data)
      )
    )
    return facturesActives.map((f, i) => ({ facture: f, bl: bls[i] }))
  }

  const downloadMergedPDF = async () => {
    if (facturesActives.length === 0) return
    setExportLoading(true)
    try {
      const invoices = await fetchAllBL()
      const blob = await pdf(
        <AllFacturesPDF
          invoices={invoices}
          produits={produits}
          clients={clients}
          entreprise={settings}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factures-${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      Modal.error({ title: 'Erreur', content: 'Impossible de générer le PDF fusionné.' })
    } finally {
      setExportLoading(false)
    }
  }

  const downloadZip = async () => {
    if (facturesActives.length === 0) return
    setExportLoading(true)
    try {
      const invoices = await fetchAllBL()
      const zip = new JSZip()
      await Promise.all(
        invoices.map(async ({ facture, bl }) => {
          const blob = await pdf(
            <FacturePDF
              facture={facture}
              client={clients.find(c => c.id === facture.client_id)}
              bl={bl}
              produits={produits}
              entreprise={settings}
            />
          ).toBlob()
          zip.file(`${facture.numero}.pdf`, blob)
        })
      )
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `factures-${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      Modal.error({ title: 'Erreur', content: 'Impossible de générer le dossier ZIP.' })
    } finally {
      setExportLoading(false)
    }
  }

  const exportMenuItems = [
    {
      key: 'pdf',
      icon: <FilePdfOutlined style={{ color: '#dc2626' }} />,
      label: 'Un seul PDF fusionné',
      onClick: downloadMergedPDF,
    },
    {
      key: 'zip',
      icon: <FileZipOutlined style={{ color: '#f59e0b' }} />,
      label: 'Dossier ZIP (PDF séparés)',
      onClick: downloadZip,
    },
  ]

  const exportVentes = () => {
    exportCSV(
      `journal-ventes-${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.csv`,
      ['Numéro', 'Client', 'Date émission', 'Échéance', 'Montant HT', `TVA ${tauxTVA}%`, 'Montant TTC', 'Statut'],
      facturesActives.map(f => [
        f.numero,
        clients.find(c => c.id === f.client_id)?.nom || '',
        new Date(f.date_emission).toLocaleDateString('fr-FR'),
        f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '',
        fmt(f.montant_ht),
        fmt((f.montant_ht || 0) * tauxTVA / 100),
        fmt((f.montant_ht || 0) * (1 + tauxTVA / 100)),
        f.statut,
      ])
    )
  }

  const exportAchats = () => {
    exportCSV(
      `journal-achats-${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.csv`,
      ['N°', 'Fournisseur', 'Date', 'Montant HT', `TVA ${tauxTVA}%`, 'Montant TTC', 'Statut'],
      achatsFiltres.map(a => [
        `#${a.id}`,
        fournisseurs.find(f => f.id === a.fournisseur_id)?.nom || '',
        new Date(a.date).toLocaleDateString('fr-FR'),
        fmt(totalBC(a)),
        fmt(totalBC(a) * tauxTVA / 100),
        fmt(totalBC(a) * (1 + tauxTVA / 100)),
        a.statut,
      ])
    )
  }

  const tabItems = [
    {
      key: 'ventes',
      label: `Journal des ventes (${facturesActives.length})`,
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={exportVentes} disabled={facturesActives.length === 0}>
              Exporter CSV
            </Button>
          </div>
          {facturesActives.length === 0 && !loading
            ? <Empty description="Aucune facture sur cette période" />
            : (
              <Table
                columns={colVentes}
                dataSource={facturesActives}
                rowKey="id"
                size="small"
                loading={loading}
                pagination={{ pageSize: 20, showTotal: t => `${t} facture(s)` }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#f8fafc' }}>
                      <Table.Summary.Cell colSpan={4} align="right">
                        <Text strong>Totaux période</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Text strong>{fmt(caHT)} MAD</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Text strong>{fmt(tvaCollectee)} MAD</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Text strong style={{ color: '#10b981' }}>
                          {fmt(caHT * (1 + tauxTVA / 100))} MAD
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell />
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            )
          }
        </>
      ),
    },
    {
      key: 'achats',
      label: `Journal des achats (${achatsFiltres.length})`,
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={exportAchats} disabled={achatsFiltres.length === 0}>
              Exporter CSV
            </Button>
          </div>
          {achatsFiltres.length === 0 && !loading
            ? <Empty description="Aucun achat reçu sur cette période" />
            : (
              <Table
                columns={colAchats}
                dataSource={achatsFiltres}
                rowKey="id"
                size="small"
                loading={loading}
                pagination={{ pageSize: 20, showTotal: t => `${t} achat(s)` }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#f8fafc' }}>
                      <Table.Summary.Cell colSpan={3} align="right">
                        <Text strong>Totaux période</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Text strong>{fmt(achatsHT)} MAD</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Text strong>{fmt(tvaDeductible)} MAD</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Text strong style={{ color: '#ef4444' }}>
                          {fmt(achatsHT * (1 + tauxTVA / 100))} MAD
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell />
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            )
          }
        </>
      ),
    },
  ]

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Comptabilité</Title>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <RangePicker
            value={dateRange}
            onChange={handleRangeChange}
            format="DD/MM/YYYY"
            presets={rangePresets}
            size="large"
            allowClear={false}
          />
          <Dropdown
            menu={{ items: exportMenuItems }}
            disabled={facturesActives.length === 0 || exportLoading}
            trigger={['click']}
          >
            <Button
              size="large"
              icon={<DownloadOutlined />}
              loading={exportLoading}
              style={{ background: '#1e293b', borderColor: '#1e293b', color: '#fff' }}
            >
              Factures PDF <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </div>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #10b981' }}>
            <Statistic
              title="CA HT"
              value={fmt(caHT)}
              suffix="MAD"
              valueStyle={{ color: '#10b981', fontSize: 17, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{facturesActives.length} facture(s)</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #ef4444' }}>
            <Statistic
              title="Achats HT"
              value={fmt(achatsHT)}
              suffix="MAD"
              valueStyle={{ color: '#ef4444', fontSize: 17, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{achatsFiltres.length} commande(s)</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ borderRadius: 10, borderTop: `3px solid ${margeBrute >= 0 ? '#3b82f6' : '#f59e0b'}` }}>
            <Statistic
              title="Marge brute HT"
              value={fmt(margeBrute)}
              suffix="MAD"
              valueStyle={{ color: margeBrute >= 0 ? '#3b82f6' : '#f59e0b', fontSize: 17, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {tauxMarge !== null ? `${tauxMarge.toFixed(1)}% du CA` : '—'}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #8b5cf6' }}>
            <Statistic
              title={`TVA collectée (${tauxTVA}%)`}
              value={fmt(tvaCollectee)}
              suffix="MAD"
              valueStyle={{ color: '#8b5cf6', fontSize: 17, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Sur ventes HT</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ borderRadius: 10, borderTop: '3px solid #06b6d4' }}>
            <Statistic
              title={`TVA déductible (${tauxTVA}%)`}
              value={fmt(tvaDeductible)}
              suffix="MAD"
              valueStyle={{ color: '#06b6d4', fontSize: 17, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Sur achats HT</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ borderRadius: 10, borderTop: `3px solid ${soldeTVA >= 0 ? '#f59e0b' : '#10b981'}` }}>
            <Statistic
              title="Solde TVA"
              value={fmt(Math.abs(soldeTVA))}
              suffix="MAD"
              valueStyle={{ color: soldeTVA >= 0 ? '#f59e0b' : '#10b981', fontSize: 17, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {soldeTVA > 0 ? 'À reverser' : soldeTVA < 0 ? 'Crédit TVA' : 'Équilibré'}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Journaux */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Tabs items={tabItems} />
      </div>
    </div>
  )
}

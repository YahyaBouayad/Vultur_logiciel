import {
  Form, Input, InputNumber, Button, Typography, Tabs,
  message, Divider, Row, Col, Card, Select, Alert,
  Upload, ColorPicker, Tooltip, Switch
} from 'antd'
import {
  BankOutlined, FileTextOutlined, LockOutlined, SaveOutlined,
  InfoCircleOutlined, UploadOutlined, DeleteOutlined, BgColorsOutlined,
  PercentageOutlined,
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import api from '../api/axios'

const { Title, Text } = Typography

function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, marginTop: 4 }}>
      <span style={{ color: '#64748b', fontSize: 16 }}>{icon}</span>
      <Text strong style={{ fontSize: 15, color: '#1e293b' }}>{children}</Text>
    </div>
  )
}

// Redimensionne le logo avant stockage (évite de saturer le localStorage)
function resizeImage(dataUrl, maxW = 400, maxH = 160) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png', 0.85))
    }
    img.src = dataUrl
  })
}

/* ─── Onglet : Ma société ─────────────────────────────────── */
function OngletSociete({ settings, saveSettings }) {
  const [form] = Form.useForm()
  useEffect(() => { form.setFieldsValue(settings) }, [settings, form])

  const onSave = (values) => {
    saveSettings(values)
    message.success('Informations de la société sauvegardées')
  }

  return (
    <Form form={form} layout="vertical" onFinish={onSave} style={{ maxWidth: 700 }}>
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        message="Ces informations apparaissent en en-tête de vos factures et bons de livraison PDF."
        style={{ marginBottom: 24, borderRadius: 8 }}
      />
      <SectionTitle icon={<BankOutlined />}>Identification</SectionTitle>
      <Row gutter={16}>
        <Col span={24}>
          <Form.Item name="nom" label="Nom de la société" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="VOTRE SOCIÉTÉ SARL" size="large" style={{ fontWeight: 600 }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="ice" label="ICE (Identifiant Commun de l'Entreprise)">
            <Input placeholder="XXXXXXXXXXXXXXX" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="rc" label="RC (Registre de Commerce)">
            <Input placeholder="XXXXX / Ville" />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <SectionTitle icon={<BankOutlined />}>Coordonnées</SectionTitle>
      <Row gutter={16}>
        <Col span={24}>
          <Form.Item name="adresse" label="Adresse">
            <Input placeholder="123 Rue Exemple, Quartier" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="ville" label="Ville / Région">
            <Input placeholder="Fès, Maroc" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="telephone" label="Téléphone">
            <Input placeholder="+212 5XX XXX XXX" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="email" label="E-mail">
            <Input type="email" placeholder="contact@societe.ma" style={{ maxWidth: 340 }} />
          </Form.Item>
        </Col>
      </Row>

      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large"
        style={{ background: '#1e293b', borderColor: '#1e293b', marginTop: 8 }}>
        Enregistrer
      </Button>
    </Form>
  )
}

/* ─── Onglet : Facturation ────────────────────────────────── */
function OngletFacturation({ settings, saveSettings }) {
  const [form] = Form.useForm()
  useEffect(() => { form.setFieldsValue(settings) }, [settings, form])

  const onSave = (values) => {
    saveSettings(values)
    message.success('Paramètres de facturation sauvegardés')
  }

  const tvaActuelle = Form.useWatch('tva', form)

  return (
    <Form form={form} layout="vertical" onFinish={onSave} style={{ maxWidth: 700 }}>

      {/* TVA en premier et mis en avant */}
      <SectionTitle icon={<FileTextOutlined />}>Taxe sur la valeur ajoutée (TVA)</SectionTitle>
      <Row gutter={16} align="bottom">
        <Col span={8}>
          <Form.Item
            name="tva"
            label={<span style={{ fontWeight: 600, fontSize: 14 }}>Taux de TVA appliqué</span>}
            tooltip="Ce taux est appliqué sur toutes les factures PDF. Mettez 0% si vous êtes exonéré."
          >
            <InputNumber
              min={0} max={100} precision={1}
              style={{ width: '100%' }}
              addonAfter="%"
              size="large"
            />
          </Form.Item>
        </Col>
        <Col span={16}>
          <div style={{
            background: tvaActuelle > 0 ? '#fefce8' : '#f0fdf4',
            border: `1px solid ${tvaActuelle > 0 ? '#fde047' : '#86efac'}`,
            borderRadius: 8, padding: '10 16', marginBottom: 24,
          }}>
            <Text strong style={{ color: tvaActuelle > 0 ? '#854d0e' : '#166534' }}>
              {tvaActuelle > 0
                ? `TVA à ${tvaActuelle}% — Les factures afficheront le montant HT, la TVA (${tvaActuelle}%) et le Total TTC.`
                : 'TVA à 0% — Les factures affichent "TVA 0%" mais restent conformes (exonération).'}
            </Text>
          </div>
        </Col>
      </Row>

      <Divider />
      <SectionTitle icon={<FileTextOutlined />}>Numérotation &amp; devise</SectionTitle>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="prefixeFacture" label="Préfixe des factures"
            tooltip="Exemple : FAC → FAC-2026-0001">
            <Input placeholder="FAC" maxLength={6} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="devise" label="Devise">
            <Select options={[
              { value: 'MAD', label: 'MAD — Dirham marocain' },
              { value: 'EUR', label: 'EUR — Euro' },
              { value: 'USD', label: 'USD — Dollar américain' },
            ]} />
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <SectionTitle icon={<FileTextOutlined />}>Conditions de paiement</SectionTitle>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="delaiPaiement" label="Délai de paiement par défaut"
            tooltip="Sert à calculer la date d'échéance">
            <InputNumber min={0} max={365} style={{ width: '100%' }} addonAfter="jours" />
          </Form.Item>
        </Col>
      </Row>

      <Alert type="info" showIcon
        message="La numérotation des factures est gérée par le serveur. Les autres paramètres s'appliquent immédiatement aux nouveaux PDFs générés."
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large"
        style={{ background: '#1e293b', borderColor: '#1e293b' }}>
        Enregistrer
      </Button>
    </Form>
  )
}

/* ─── Onglet : Personnalisation PDF ──────────────────────── */
function OngletPDF({ settings, saveSettings }) {
  const [logoPreview, setLogoPreview] = useState(settings.logo || null)
  const [couleurPrimaire, setCouleurPrimaire] = useState(settings.couleurPrimaire || '#1e293b')
  const [couleurAccent,   setCouleurAccent]   = useState(settings.couleurAccent   || '#10b981')
  const [conditions, setConditions]   = useState(settings.conditionsPaiement || '')
  const [mentions,   setMentions]     = useState(settings.mentionsLegales     || '')
  const [piedPage,   setPiedPage]     = useState(settings.piedDePage          || '')
  const [afficherRemise, setAfficherRemise] = useState(settings.afficherRemise !== false)

  const handleRemiseToggle = (val) => {
    setAfficherRemise(val)
    saveSettings({ afficherRemise: val })
    message.success(val ? 'Colonne remise affichée dans les PDFs' : 'Colonne remise masquée dans les PDFs')
  }

  const handleLogoUpload = async (file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const resized = await resizeImage(e.target.result)
      setLogoPreview(resized)
      saveSettings({ logo: resized })
      message.success('Logo enregistré')
    }
    reader.readAsDataURL(file)
    return false
  }

  const removeLogo = () => {
    setLogoPreview(null)
    saveSettings({ logo: null })
    message.success('Logo supprimé')
  }

  const handleSaveColors = () => {
    saveSettings({ couleurPrimaire, couleurAccent })
    message.success('Couleurs enregistrées')
  }

  const handleSaveTextes = () => {
    saveSettings({
      conditionsPaiement: conditions,
      mentionsLegales:    mentions,
      piedDePage:         piedPage,
    })
    message.success('Textes enregistrés')
  }

  return (
    <div style={{ maxWidth: 720 }}>

      {/* LOGO */}
      <SectionTitle icon={<UploadOutlined />}>Logo de la société</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
        <div style={{
          width: 220, height: 110, border: '1.5px dashed #cbd5e1',
          borderRadius: 8, background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {logoPreview
            ? <img src={logoPreview} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', padding: 16 }}>
                Aucun logo<br />Aperçu ici
              </Text>
          }
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Upload accept="image/png,image/jpeg,image/svg+xml,image/webp"
            showUploadList={false} beforeUpload={handleLogoUpload}>
            <Button icon={<UploadOutlined />} size="large">
              {logoPreview ? 'Changer le logo' : 'Télécharger un logo'}
            </Button>
          </Upload>
          {logoPreview && (
            <Button icon={<DeleteOutlined />} danger onClick={removeLogo}>
              Supprimer le logo
            </Button>
          )}
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Formats : PNG, JPG, SVG<br />
            Fond transparent recommandé (PNG)<br />
            Taille idéale : 400 × 160 px max
          </Text>
        </div>
      </div>

      <Divider />

      {/* COULEURS */}
      <SectionTitle icon={<BgColorsOutlined />}>Couleurs du document</SectionTitle>
      <Row gutter={32} style={{ marginBottom: 20 }}>
        <Col>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>Couleur principale</Text><br />
            <Text type="secondary" style={{ fontSize: 12 }}>En-tête, tableau, boutons</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ColorPicker
              value={couleurPrimaire}
              onChange={(_, hex) => setCouleurPrimaire(hex)}
              showText
              presets={[{
                label: 'Suggestions',
                colors: ['#1e293b', '#1e3a5f', '#312e81', '#4c1d95', '#7f1d1d', '#14532d', '#0c4a6e', '#374151'],
              }]}
            />
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: couleurPrimaire, border: '1px solid #e2e8f0',
            }} />
          </div>
        </Col>
        <Col>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>Couleur d'accent</Text><br />
            <Text type="secondary" style={{ fontSize: 12 }}>Totaux, montants, soulignements</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ColorPicker
              value={couleurAccent}
              onChange={(_, hex) => setCouleurAccent(hex)}
              showText
              presets={[{
                label: 'Suggestions',
                colors: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'],
              }]}
            />
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: couleurAccent, border: '1px solid #e2e8f0',
            }} />
          </div>
        </Col>
      </Row>

      {/* Aperçu des couleurs */}
      <div style={{
        borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0',
        marginBottom: 20, width: '100%',
      }}>
        <div style={{ background: couleurPrimaire, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Aperçu en-tête</Text>
          <Text style={{ color: couleurAccent, fontWeight: 700, fontSize: 14 }}>FAC-2026-0001</Text>
        </div>
        <div style={{ background: '#f8fafc', padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
          <Text style={{ color: '#64748b', fontSize: 12 }}>Total TTC :</Text>
          <Text style={{ color: couleurAccent, fontWeight: 700, fontSize: 13 }}>13 800,00 MAD</Text>
        </div>
      </div>

      <Button onClick={handleSaveColors} icon={<SaveOutlined />} type="primary"
        style={{ background: '#1e293b', borderColor: '#1e293b', marginBottom: 32 }}>
        Enregistrer les couleurs
      </Button>

      <Divider />

      {/* REMISES */}
      <SectionTitle icon={<PercentageOutlined />}>Affichage des remises</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <Switch
          checked={afficherRemise}
          onChange={handleRemiseToggle}
          checkedChildren="Affichée"
          unCheckedChildren="Masquée"
        />
        <div>
          <Text strong>Colonne remise dans les BL et factures PDF</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {afficherRemise
              ? 'Une colonne "Remise %" apparaît dans le tableau des articles.'
              : 'Les remises sont appliquées dans les totaux mais la colonne est masquée.'}
          </Text>
        </div>
      </div>

      <Divider />

      {/* TEXTES LIBRES */}
      <SectionTitle icon={<FileTextOutlined />}>Textes du document PDF</SectionTitle>
      <Row gutter={16}>
        <Col span={24}>
          <div style={{ marginBottom: 6 }}>
            <Text strong>Conditions de paiement</Text>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              Affiché en bas de chaque facture
            </Text>
          </div>
          <Input.TextArea
            rows={3}
            value={conditions}
            onChange={e => setConditions(e.target.value)}
            placeholder="Ex : Paiement à 30 jours date de facture. Tout retard de paiement entraîne des pénalités de 1,5% par mois."
            style={{ marginBottom: 16 }}
          />
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 6 }}>
            <Text strong>Mentions légales</Text>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              Affiché en bas de tous les documents
            </Text>
          </div>
          <Input.TextArea
            rows={3}
            value={mentions}
            onChange={e => setMentions(e.target.value)}
            placeholder="Ex : TVA non applicable, art. 293 B du CGI. Escompte pour paiement anticipé : néant."
            style={{ marginBottom: 16 }}
          />
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 6 }}>
            <Text strong>Pied de page personnalisé</Text>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              Remplace le pied de page par défaut (coordonnées société + numéro de page)
            </Text>
          </div>
          <Input
            value={piedPage}
            onChange={e => setPiedPage(e.target.value)}
            placeholder="Ex : Merci de votre confiance — contact@societe.ma — +212 5XX XXX XXX"
            allowClear
            style={{ marginBottom: 20 }}
          />
        </Col>
      </Row>

      <Button onClick={handleSaveTextes} icon={<SaveOutlined />} type="primary"
        style={{ background: '#1e293b', borderColor: '#1e293b' }}>
        Enregistrer les textes
      </Button>
    </div>
  )
}

/* ─── Onglet : Sécurité ──────────────────────────────────── */
function OngletCompte() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const onSave = async (values) => {
    if (values.nouveau !== values.confirmation) {
      message.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await api.put('/auth/change-password', {
        ancien: values.ancien,
        nouveau: values.nouveau,
      })
      message.success('Mot de passe modifié avec succès')
      form.resetFields()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Erreur lors du changement de mot de passe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={onSave} style={{ maxWidth: 420 }}>
      <SectionTitle icon={<LockOutlined />}>Changer le mot de passe</SectionTitle>
      <Form.Item name="ancien" label="Mot de passe actuel" rules={[{ required: true }]}>
        <Input.Password />
      </Form.Item>
      <Form.Item name="nouveau" label="Nouveau mot de passe" rules={[{ required: true, min: 6 }]}>
        <Input.Password />
      </Form.Item>
      <Form.Item name="confirmation" label="Confirmer le nouveau mot de passe" rules={[{ required: true }]}>
        <Input.Password />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large"
        style={{ background: '#1e293b', borderColor: '#1e293b' }}>
        Changer le mot de passe
      </Button>
    </Form>
  )
}

/* ─── Page principale ────────────────────────────────────── */
export default function Parametres() {
  const { settings, saveSettings } = useSettings()

  const tabItems = [
    {
      key: 'societe',
      label: <span><BankOutlined style={{ marginRight: 6 }} />Ma société</span>,
      children: <OngletSociete settings={settings} saveSettings={saveSettings} />,
    },
    {
      key: 'facturation',
      label: <span><FileTextOutlined style={{ marginRight: 6 }} />Facturation</span>,
      children: <OngletFacturation settings={settings} saveSettings={saveSettings} />,
    },
    {
      key: 'pdf',
      label: <span><BgColorsOutlined style={{ marginRight: 6 }} />Personnalisation PDF</span>,
      children: <OngletPDF settings={settings} saveSettings={saveSettings} />,
    },
    {
      key: 'compte',
      label: <span><LockOutlined style={{ marginRight: 6 }} />Sécurité</span>,
      children: <OngletCompte />,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>Paramètres</Title>
        <Text type="secondary">Configuration de l'application et de votre société</Text>
      </div>

      <Card style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: '24px 32px' } }}>
        <Tabs items={tabItems} defaultActiveKey="societe" size="large" />
      </Card>
    </div>
  )
}

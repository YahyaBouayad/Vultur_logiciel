import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd'
import {
  DashboardOutlined, InboxOutlined, TeamOutlined, ShopOutlined,
  FileTextOutlined, ShoppingCartOutlined, LogoutOutlined,
  UserOutlined, FileDoneOutlined, AppstoreOutlined,
  ShoppingOutlined, DatabaseOutlined, SettingOutlined,
  AccountBookOutlined, FileProtectOutlined, CreditCardOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useImpayes } from '../context/ImpayesContext'

const { Sider, Header, Content } = Layout
const { Text } = Typography

function BadgeCount({ count }) {
  if (!count) return null
  return (
    <span style={{
      background: '#ef4444', color: '#fff', borderRadius: 10,
      fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 6,
    }}>
      {count}
    </span>
  )
}

function buildMenuItems(nbRetard) {
  return [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Tableau de bord',
    },
    {
      key: 'ventes',
      icon: <ShoppingOutlined />,
      label: 'Ventes',
      children: [
        { key: '/bons-livraison', icon: <FileTextOutlined />,    label: 'Bons de livraison' },
        {
          key: '/factures',
          icon: <FileDoneOutlined />,
          label: (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              Factures <BadgeCount count={nbRetard} />
            </span>
          ),
        },
        { key: '/avoirs', icon: <FileProtectOutlined />, label: 'Avoirs' },
      ],
    },
    {
      key: 'achats',
      icon: <ShoppingCartOutlined />,
      label: 'Achats',
      children: [
        { key: '/achats', icon: <AppstoreOutlined />, label: 'Bons de commande' },
      ],
    },
    {
      key: 'referentiel',
      icon: <DatabaseOutlined />,
      label: 'Référentiel',
      children: [
        { key: '/produits',     icon: <InboxOutlined />, label: 'Produits & Stock' },
        { key: '/clients',      icon: <TeamOutlined />,  label: 'Clients' },
        { key: '/fournisseurs', icon: <ShopOutlined />,  label: 'Fournisseurs' },
      ],
    },
    {
      key: '/comptabilite',
      icon: <AccountBookOutlined />,
      label: 'Comptabilité',
    },
    {
      key: '/suivi-paiements',
      icon: <CreditCardOutlined />,
      label: 'Suivi Paiements',
    },
  ]
}

export default function AppLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()
  const { impayes } = useImpayes()

  const nbRetard = impayes.filter(i => i.niveau === 'retard' || i.niveau === 'critique').length

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Se déconnecter',
        danger: true,
        onClick: () => { logout(); navigate('/login') },
      },
    ],
  }

  const openKeys = () => {
    if (['/bons-livraison', '/factures', '/avoirs'].includes(location.pathname)) return ['ventes']
    if (['/achats'].includes(location.pathname)) return ['achats']
    if (['/produits', '/clients', '/fournisseurs'].includes(location.pathname)) return ['referentiel']
    if (location.pathname === '/comptabilite') return []
    return []
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          background: '#1e293b',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #334155' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
            Vultur
          </Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={openKeys()}
          onClick={({ key }) => {
            if (!['ventes', 'achats', 'referentiel'].includes(key)) navigate(key)
          }}
          items={buildMenuItems(nbRetard)}
          style={{ background: '#1e293b', border: 'none', marginTop: 8 }}
          theme="dark"
        />

        {/* Bouton Paramètres */}
        <div
          onClick={() => navigate('/parametres')}
          style={{
            position: 'absolute',
            bottom: 48,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            cursor: 'pointer',
            color: location.pathname === '/parametres' ? '#fff' : '#64748b',
            background: location.pathname === '/parametres' ? '#334155' : 'transparent',
            transition: 'all 0.2s',
            borderTop: '1px solid #334155',
          }}
          onMouseEnter={e => {
            if (location.pathname !== '/parametres') {
              e.currentTarget.style.background = '#273549'
              e.currentTarget.style.color = '#cbd5e1'
            }
          }}
          onMouseLeave={e => {
            if (location.pathname !== '/parametres') {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#64748b'
            }
          }}
        >
          <SettingOutlined style={{ fontSize: 15 }} />
          <span style={{ fontSize: 14 }}>Paramètres</span>
        </div>

        {/* Point caché Admin */}
        <div
          onClick={() => navigate('/admin')}
          title="Admin"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#334155',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#64748b'}
          onMouseLeave={e => e.currentTarget.style.background = '#334155'}
        />
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#3b82f6' }} />
              <Text strong>{user?.nom}</Text>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: '24px', minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ImpayesProvider } from './context/ImpayesContext'
import { SettingsProvider } from './context/SettingsContext'
import AppLayout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Produits from './pages/Produits'
import Clients from './pages/Clients'
import Fournisseurs from './pages/Fournisseurs'
import Achats from './pages/Achats'
import BonsLivraison from './pages/BonsLivraison'
import Factures from './pages/Factures'
import Admin from './pages/Admin'
import Parametres from './pages/Parametres'
import Comptabilite from './pages/Comptabilite'
import Avoirs from './pages/Avoirs'
import SuiviPaiements from './pages/SuiviPaiements'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spin fullscreen />
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="produits" element={<Produits />} />
        <Route path="clients" element={<Clients />} />
        <Route path="fournisseurs" element={<Fournisseurs />} />
        <Route path="achats" element={<Achats />} />
        <Route path="bons-livraison" element={<BonsLivraison />} />
        <Route path="factures" element={<Factures />} />
        <Route path="comptabilite" element={<Comptabilite />} />
        <Route path="avoirs" element={<Avoirs />} />
        <Route path="suivi-paiements" element={<SuiviPaiements />} />
        <Route path="admin" element={<Admin />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ConfigProvider locale={frFR} theme={{ token: { colorPrimary: '#1e293b' } }}>
      <AuthProvider>
        <SettingsProvider>
          <ImpayesProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ImpayesProvider>
        </SettingsProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

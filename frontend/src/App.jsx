import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ImpayesProvider } from './context/ImpayesContext'
import { SettingsProvider } from './context/SettingsContext'
import { lazy } from 'react'
import AppLayout from './components/Layout'
import Login from './pages/Login'

// Pages chargées à la demande : chaque page (et ses librairies lourdes : PDF, graphiques, ZIP)
// n'est téléchargée qu'à sa première ouverture
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Produits       = lazy(() => import('./pages/Produits'))
const Clients        = lazy(() => import('./pages/Clients'))
const Fournisseurs   = lazy(() => import('./pages/Fournisseurs'))
const Achats         = lazy(() => import('./pages/Achats'))
const BonsLivraison  = lazy(() => import('./pages/BonsLivraison'))
const Factures       = lazy(() => import('./pages/Factures'))
const Admin          = lazy(() => import('./pages/Admin'))
const Parametres     = lazy(() => import('./pages/Parametres'))
const Comptabilite   = lazy(() => import('./pages/Comptabilite'))
const Avoirs         = lazy(() => import('./pages/Avoirs'))
const SuiviPaiements = lazy(() => import('./pages/SuiviPaiements'))
const Production     = lazy(() => import('./pages/Production'))
const DemandesAchat  = lazy(() => import('./pages/DemandesAchat'))
const SuiviHulio     = lazy(() => import('./pages/SuiviHulio'))

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
        <Route path="demandes-achat" element={<DemandesAchat />} />
        <Route path="bons-livraison" element={<BonsLivraison />} />
        <Route path="factures" element={<Factures />} />
        <Route path="comptabilite" element={<Comptabilite />} />
        <Route path="avoirs" element={<Avoirs />} />
        <Route path="suivi-paiements" element={<SuiviPaiements />} />
        <Route path="production" element={<Production />} />
        <Route path="suivi-hulio" element={<SuiviHulio />} />
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

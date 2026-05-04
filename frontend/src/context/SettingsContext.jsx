import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const SettingsContext = createContext(null)

export const DEFAULT_SETTINGS = {
  // Société
  nom: '',
  adresse: '',
  ville: '',
  telephone: '',
  email: '',
  ice: '',
  rc: '',
  // Facturation
  tva: 20,
  delaiPaiement: 30,
  devise: 'MAD',
  prefixeFacture: 'FAC',
  // Personnalisation PDF
  logo: null,
  couleurPrimaire: '#0d2c6e',
  couleurAccent: '#f06020',
  conditionsPaiement: '',
  mentionsLegales: '',
  piedDePage: '',
  afficherRemise: true,
}

// snake_case API → camelCase frontend
function fromApi(data) {
  return {
    nom:                data.nom                ?? '',
    adresse:            data.adresse            ?? '',
    ville:              data.ville              ?? '',
    telephone:          data.telephone          ?? '',
    email:              data.email              ?? '',
    ice:                data.ice                ?? '',
    rc:                 data.rc                 ?? '',
    tva:                data.tva                ?? 20,
    delaiPaiement:      data.delai_paiement     ?? 30,
    devise:             data.devise             ?? 'MAD',
    prefixeFacture:     data.prefixe_facture    ?? 'FAC',
    logo:               data.logo               ?? null,
    couleurPrimaire:    data.couleur_primaire    ?? '#0d2c6e',
    couleurAccent:      data.couleur_accent      ?? '#f06020',
    conditionsPaiement: data.conditions_paiement ?? '',
    mentionsLegales:    data.mentions_legales    ?? '',
    piedDePage:         data.pied_de_page        ?? '',
    afficherRemise:     data.afficher_remise     ?? true,
  }
}

// camelCase frontend → snake_case API
const CAMEL_TO_SNAKE = {
  delaiPaiement:      'delai_paiement',
  prefixeFacture:     'prefixe_facture',
  couleurPrimaire:    'couleur_primaire',
  couleurAccent:      'couleur_accent',
  conditionsPaiement: 'conditions_paiement',
  mentionsLegales:    'mentions_legales',
  piedDePage:         'pied_de_page',
  afficherRemise:     'afficher_remise',
}

function toApi(updates) {
  const result = {}
  for (const [k, v] of Object.entries(updates)) {
    result[CAMEL_TO_SNAKE[k] || k] = v
  }
  return result
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded]     = useState(false)

  const reload = useCallback(() => {
    return api.get('/parametres')
      .then(r => {
        setSettings({ ...DEFAULT_SETTINGS, ...fromApi(r.data) })
        setLoaded(true)
      })
      .catch(() => { setLoaded(true) })
  }, [])

  // Charge uniquement si un token est déjà présent (page refresh avec session active)
  // Sinon, `reload()` est appelé explicitement après le login
  useEffect(() => {
    if (localStorage.getItem('token')) reload()
    else setLoaded(true)
  }, [reload])

  const saveSettings = useCallback(async (updates) => {
    setSettings(prev => ({ ...prev, ...updates }))
    try {
      const r = await api.put('/parametres', toApi(updates))
      setSettings({ ...DEFAULT_SETTINGS, ...fromApi(r.data) })
    } catch {
      setSettings(prev => ({ ...prev }))
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, saveSettings, reload, loaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)

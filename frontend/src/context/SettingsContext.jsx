import { createContext, useContext, useState } from 'react'

const SettingsContext = createContext(null)

const STORAGE_KEY = 'vultur_settings'

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

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const saveSettings = (updates) => {
    const merged = { ...settings, ...updates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    setSettings(merged)
  }

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)

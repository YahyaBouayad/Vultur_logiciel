import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'

const ImpayesContext = createContext({ impayes: [], refresh: () => {} })

export function ImpayesProvider({ children }) {
  const { user } = useAuth()
  const [impayes, setImpayes] = useState([])

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const res = await api.get('/factures/impayes')
      setImpayes(res.data)
    } catch {
      setImpayes([])
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return (
    <ImpayesContext.Provider value={{ impayes, refresh }}>
      {children}
    </ImpayesContext.Provider>
  )
}

export const useImpayes = () => useContext(ImpayesContext)

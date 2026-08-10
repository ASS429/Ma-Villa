import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../services/api'
import type { User } from '../types'

interface RegisterData {
  name: string
  email: string
  password: string
  password_confirmation: string
  role: 'client' | 'proprietaire'
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<{ user: User }>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function lireUtilisateurStocke(): User | null {
  try {
    const brut = localStorage.getItem('user')
    return brut ? (JSON.parse(brut) as User) : null
  } catch {
    // Entrée corrompue : on repart d'une session propre plutôt que de planter.
    localStorage.removeItem('user')
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(lireUtilisateurStocke)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(false)

  const effacerSession = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])

  const enregistrerSession = useCallback((utilisateur: User, jeton: string) => {
    setToken(jeton)
    setUser(utilisateur)
    localStorage.setItem('token', jeton)
    localStorage.setItem('user', JSON.stringify(utilisateur))
  }, [])

  // Un jeton sans utilisateur en cache : on le valide auprès du serveur.
  useEffect(() => {
    if (!token || user) return

    let annule = false
    api.get('/auth/me')
      .then((res) => { if (!annule) setUser(res.data) })
      // Jeton invalide ou expiré : inutile d'appeler /auth/logout avec, on
      // nettoie simplement la session locale.
      .catch(() => { if (!annule) effacerSession() })

    return () => { annule = true }
  }, [token, user, effacerSession])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      enregistrerSession(data.user, data.token)
      return { user: data.user as User }
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (donnees: RegisterData) => {
    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/register', donnees)
      enregistrerSession(data.user, data.token)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    // On révoque le jeton côté serveur sans bloquer la déconnexion locale.
    api.post('/auth/logout').catch(() => {})
    effacerSession()
  }

  const updateUser = (miseAJour: User) => {
    setUser(miseAJour)
    localStorage.setItem('user', JSON.stringify(miseAJour))
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- convention des modules de contexte : le hook vit auprès de son provider
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider')
  return ctx
}

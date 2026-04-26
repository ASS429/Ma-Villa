import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

interface User {
  id: number
  name: string
  email: string
  role: 'client' | 'proprietaire' | 'admin'
  phone: string | null
  avatar: string | null
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

interface RegisterData {
  name: string
  email: string
  password: string
  password_confirmation: string
  role: 'client' | 'proprietaire'
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (token && !user) {
      api.get('/auth/me').then((res) => setUser(res.data)).catch(() => logout())
    }
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return { user: data.user }
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: RegisterData) => {
    setIsLoading(true)
    try {
      const { data: res } = await api.post('/auth/register', data)
      setToken(res.token)
      setUser(res.user)
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    api.post('/auth/logout').catch(() => {})
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const updateUser = (updated: User) => {
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

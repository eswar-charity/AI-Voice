import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api, { refreshAuthToken } from '../lib/api'
import {
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
  shouldRefreshAuthToken,
  type AuthTokenPayload,
} from '../lib/auth-token'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    fullName: string,
    role: 'recruiter' | 'candidate'
  ) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function persistSession(payload: AuthTokenPayload) {
  saveAuthToken(payload)
  const me = await api.get<User>('/auth/me')
  return me.data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAuthToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        if (shouldRefreshAuthToken()) {
          const refreshed = await refreshAuthToken()
          saveAuthToken(refreshed)
        }
        const me = await api.get<User>('/auth/me')
        setUser(me.data)
      } catch {
        clearAuthToken()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthTokenPayload>('/auth/login', { email, password })
    const me = await persistSession(res.data)
    setUser(me)
  }

  const register = async (
    email: string,
    password: string,
    fullName: string,
    role: 'recruiter' | 'candidate'
  ) => {
    const res = await api.post<AuthTokenPayload>('/auth/register', {
      email,
      password,
      full_name: fullName,
      role,
    })
    const me = await persistSession(res.data)
    setUser(me)
  }

  const logout = () => {
    clearAuthToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

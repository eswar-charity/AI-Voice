import axios from 'axios'
import {
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
  type AuthTokenPayload,
} from './auth-token'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<AuthTokenPayload> | null = null

async function refreshAuthToken(): Promise<AuthTokenPayload> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<AuthTokenPayload>('/auth/refresh')
      .then((res) => {
        saveAuthToken(res.data)
        return res.data
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as (typeof err.config & { _retry?: boolean }) | undefined
    const isAuthRoute =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/auth/refresh')

    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthRoute &&
      getAuthToken()
    ) {
      original._retry = true
      try {
        const refreshed = await refreshAuthToken()
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${refreshed.access_token}`
        return api(original)
      } catch {
        clearAuthToken()
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
    }

    if (err.response?.status === 401 && !isAuthRoute) {
      clearAuthToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }

    return Promise.reject(err)
  }
)

export { refreshAuthToken }
export default api

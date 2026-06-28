const TOKEN_KEY = 'access_token'
const EXPIRES_KEY = 'token_expires_at'

export interface AuthTokenPayload {
  access_token: string
  expires_in: number
}

export function saveAuthToken(payload: AuthTokenPayload) {
  localStorage.setItem(TOKEN_KEY, payload.access_token)
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + payload.expires_in * 1000))
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/** Refresh if missing expiry metadata or less than 2 days remain. */
export function shouldRefreshAuthToken() {
  const token = getAuthToken()
  if (!token) return false

  const expiresAt = localStorage.getItem(EXPIRES_KEY)
  if (!expiresAt) return true

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000
  return Date.now() > Number(expiresAt) - twoDaysMs
}

export function isAuthTokenExpired() {
  const expiresAt = localStorage.getItem(EXPIRES_KEY)
  if (!expiresAt) return false
  return Date.now() >= Number(expiresAt)
}

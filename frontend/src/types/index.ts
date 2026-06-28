export interface User {
  id: string
  email: string
  full_name: string
  role: 'recruiter' | 'candidate'
  avatar_url?: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
}

export interface ApiError {
  detail: string
}

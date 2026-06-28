import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function RecruiterOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export function CandidateOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'candidate') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ResumesPage from './pages/ResumesPage'
import JobsPage from './pages/JobsPage'
import CandidatesPage from './pages/CandidatesPage'
import InterviewPage from './pages/InterviewPage'
import ReportsPage from './pages/ReportsPage'
import CandidateInterviewsPage from './pages/CandidateInterviewsPage'
import { RecruiterOnly, CandidateOnly } from './components/auth/RoleGuard'

function Spinner() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  return !user ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function InterviewRoute() {
  const { id } = useParams<{ id: string }>()
  return <InterviewPage key={id} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Guest routes */}
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

          {/* Standalone — no sidebar (fullscreen interview room) */}
          <Route
            path="/interview/:id"
            element={<RequireAuth><InterviewRoute /></RequireAuth>}
          />

          {/* Authenticated routes wrapped in AppShell layout */}
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/resumes" element={<ResumesPage />} />
            <Route path="/jobs" element={<RecruiterOnly><JobsPage /></RecruiterOnly>} />
            <Route path="/candidates/:jobId" element={<RecruiterOnly><CandidatesPage /></RecruiterOnly>} />
            <Route path="/candidates" element={<RecruiterOnly><CandidatesPage /></RecruiterOnly>} />
            <Route path="/interviews" element={<CandidateOnly><CandidateInterviewsPage /></CandidateOnly>} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

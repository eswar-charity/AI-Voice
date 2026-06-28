import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Users,
  Video,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const RECRUITER_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/resumes', icon: FileText, label: 'Resumes' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/candidates', icon: Users, label: 'Candidates' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

const CANDIDATE_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/resumes', icon: FileText, label: 'My Resume' },
  { to: '/interviews', icon: Video, label: 'AI Interviews' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const NAV = user?.role === 'candidate' ? CANDIDATE_NAV : RECRUITER_NAV

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-base flex">
      {/* Sidebar */}
      <aside className="w-56 bg-surface border-r border-line flex flex-col py-5 px-3 shrink-0">
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path
                d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-display font-semibold text-ink text-sm tracking-widest">
            ORION
          </span>
        </div>

        <nav className="flex-1 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-fog hover:text-mist hover:bg-elevated'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line pt-4 px-2">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold font-mono shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-ink text-xs font-medium truncate">{user?.full_name}</div>
              <div className="text-fog text-xs capitalize truncate">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-fog hover:text-mist hover:bg-elevated text-xs transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

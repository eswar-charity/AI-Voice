import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Briefcase, Users, BarChart3, ArrowRight, Video, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface Stats {
  resumes: number
  jobs: number
  interviews: number
  reports: number
  matches: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isCandidate = user?.role === 'candidate'
  const [stats, setStats] = useState<Stats>({
    resumes: 0,
    jobs: 0,
    interviews: 0,
    reports: 0,
    matches: 0,
  })

  useEffect(() => {
    if (isCandidate) {
      Promise.all([
        api.get('/resumes').catch(() => ({ data: [] })),
        api.get('/interviews/my').catch(() => ({ data: [] })),
        api.get('/matches/my').catch(() => ({ data: [] })),
        api.get('/reports').catch(() => ({ data: [] })),
      ]).then(([r, i, m, rep]) => {
        setStats({
          resumes: Array.isArray(r.data) ? r.data.length : 0,
          jobs: 0,
          interviews: Array.isArray(i.data) ? i.data.length : 0,
          matches: Array.isArray(m.data) ? m.data.length : 0,
          reports: Array.isArray(rep.data) ? rep.data.length : 0,
        })
      })
    } else {
      Promise.all([
        api.get('/resumes').catch(() => ({ data: [] })),
        api.get('/jobs').catch(() => ({ data: [] })),
        api.get('/reports').catch(() => ({ data: [] })),
      ]).then(([r, j, rep]) => {
        setStats({
          resumes: Array.isArray(r.data) ? r.data.length : 0,
          jobs: Array.isArray(j.data) ? j.data.length : 0,
          interviews: 0,
          matches: 0,
          reports: Array.isArray(rep.data) ? rep.data.length : 0,
        })
      })
    }
  }, [isCandidate])

  const RECRUITER_ACTIONS = [
    {
      icon: FileText,
      label: 'Upload Resume',
      desc: 'Add a new candidate PDF',
      to: '/resumes',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: Briefcase,
      label: 'Create Job',
      desc: 'Define a new open position',
      to: '/jobs',
      color: 'text-ai',
      bg: 'bg-ai/10',
    },
    {
      icon: Users,
      label: 'View Candidates',
      desc: 'See AI-ranked shortlists',
      to: '/candidates',
      color: 'text-teal',
      bg: 'bg-teal/10',
    },
    {
      icon: BarChart3,
      label: 'View Reports',
      desc: 'Evaluation summaries',
      to: '/reports',
      color: 'text-mist',
      bg: 'bg-elevated',
    },
  ]

  const CANDIDATE_ACTIONS = [
    {
      icon: FileText,
      label: 'Upload Resume',
      desc: 'Add or update your PDF resume',
      to: '/resumes',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: Video,
      label: 'AI Interviews',
      desc: 'Enter matched role interview rooms',
      to: '/interviews',
      color: 'text-ai',
      bg: 'bg-ai/10',
    },
    {
      icon: BarChart3,
      label: 'View Reports',
      desc: 'Your interview evaluations',
      to: '/reports',
      color: 'text-teal',
      bg: 'bg-teal/10',
    },
  ]

  const quickActions = isCandidate ? CANDIDATE_ACTIONS : RECRUITER_ACTIONS

  const statCards = isCandidate
    ? [
        { label: 'My Resumes', value: stats.resumes },
        { label: 'Matched Roles', value: stats.matches },
        { label: 'Interviews', value: stats.interviews },
        { label: 'Reports', value: stats.reports },
      ]
    : [
        { label: 'Resumes', value: stats.resumes },
        { label: 'Open Jobs', value: stats.jobs },
        { label: 'Interviews', value: stats.interviews },
        { label: 'Reports', value: stats.reports },
      ]

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-10">
        <p className="text-fog text-xs font-mono uppercase tracking-widest mb-1">Dashboard</p>
        <h1 className="font-display text-2xl font-bold text-ink">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-mist text-sm mt-1 capitalize">{user?.role} workspace</p>
      </div>

      {isCandidate && stats.matches > 0 && (
        <div className="mb-8 p-4 bg-ai/5 border border-ai/20 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-ai/10 flex items-center justify-center">
              <Zap size={16} className="text-ai" />
            </div>
            <div>
              <p className="text-ink text-sm font-medium">
                You have {stats.matches} matched role{stats.matches > 1 ? 's' : ''}
              </p>
              <p className="text-fog text-xs">Enter the fullscreen AI interview room when ready.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/interviews')}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs rounded-lg transition-colors shrink-0"
          >
            View Interviews
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {statCards.map(({ label, value }) => (
          <div key={label} className="bg-surface border border-line rounded-xl p-4">
            <div className="font-mono text-2xl font-medium text-ink">{value}</div>
            <div className="text-fog text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-5">
        <h2 className="font-display text-sm font-semibold text-mist uppercase tracking-wider">
          Quick actions
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="group flex items-center gap-4 p-4 bg-surface border border-line rounded-xl hover:border-primary/30 hover:bg-elevated transition-all text-left"
          >
            <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center shrink-0`}>
              <action.icon size={16} className={action.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-ink text-sm font-medium">{action.label}</div>
              <div className="text-fog text-xs mt-0.5">{action.desc}</div>
            </div>
            <ArrowRight
              size={14}
              className="text-fog group-hover:text-primary group-hover:translate-x-0.5 transition-all"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

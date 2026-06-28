import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import api from '../lib/api'
import ScoreRing from '../components/ui/ScoreRing'
import { useAuth } from '../contexts/AuthContext'

interface Report {
  id: string
  interview_id: string
  candidate_id: string
  job_id: string
  overall_score?: number
  technical_score?: number
  communication_score?: number
  cultural_fit_score?: number
  summary?: string
  strengths: string[]
  areas_for_improvement: string[]
  recommendation?: string
  status: string
  created_at: string
  candidate_name?: string
  job_title?: string
}

const RECOMMENDATION_STYLE: Record<string, string> = {
  'Strong Hire': 'text-teal bg-teal/10 border-teal/20',
  'Hire': 'text-primary bg-primary/10 border-primary/20',
  'No Hire': 'text-red-400 bg-red-400/10 border-red-400/20',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReportsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retakingId, setRetakingId] = useState<string | null>(null)

  const loadReports = () =>
    api.get<Report[]>('/reports').then((r) => setReports(r.data))

  useEffect(() => {
    loadReports().finally(() => setLoading(false))
  }, [])

  const handleRetake = async (interviewId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRetakingId(interviewId)
    try {
      const res = await api.post<{ id: string }>(`/interviews/${interviewId}/retake`)
      navigate(`/interview/${res.data.id}`)
    } catch {
      setRetakingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <p className="text-fog text-xs font-mono uppercase tracking-widest mb-1">Phase 5</p>
        <h1 className="font-display text-2xl font-bold text-ink">Evaluation Reports</h1>
        <p className="text-mist text-sm mt-1">AI-generated assessments from completed interviews.</p>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <BarChart3 size={20} className="text-primary" />
          </div>
          <p className="text-fog text-sm">No reports yet. Complete an interview to generate one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const isExpanded = expanded === r.id
            const recStyle = r.recommendation ? RECOMMENDATION_STYLE[r.recommendation] : 'text-fog bg-elevated border-line'

            return (
              <div key={r.id} className="bg-surface border border-line rounded-xl overflow-hidden hover:border-primary/20 transition-colors">
                {/* Summary row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                >
                  <ScoreRing score={r.overall_score ?? 0} size={52} strokeWidth={4} />

                  <div className="flex-1 min-w-0">
                    <div className="text-ink text-sm font-medium truncate">
                      {r.candidate_name || 'Candidate'}
                    </div>
                    <div className="text-fog text-xs mt-0.5">
                      {r.job_title || 'Position'} · {fmtDate(r.created_at)}
                    </div>
                  </div>

                  {r.recommendation && (
                    <span className={`text-xs px-3 py-1 rounded-full border font-medium shrink-0 ${recStyle}`}>
                      {r.recommendation}
                    </span>
                  )}

                  {user?.role === 'candidate' && r.status === 'ready' && (
                    <button
                      onClick={(e) => handleRetake(r.interview_id, e)}
                      disabled={retakingId === r.interview_id}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-line text-mist shrink-0 hover:bg-elevated hover:text-ink transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={11} className={retakingId === r.interview_id ? 'animate-spin' : ''} />
                      Retake
                    </button>
                  )}

                  {r.status === 'error' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        api.post(`/reports/generate/${r.interview_id}`).then(() => loadReports())
                      }}
                      className="text-xs px-3 py-1 rounded-full border border-primary/30 text-primary shrink-0 hover:bg-primary/10"
                    >
                      Regenerate
                    </button>
                  )}

                  {r.status === 'generating' && (
                    <span className="text-amber-400 text-xs flex items-center gap-1.5 shrink-0">
                      <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </span>
                  )}

                  <div className="text-fog shrink-0">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && r.status === 'ready' && (
                  <div className="border-t border-line px-5 py-5 space-y-5">
                    {/* Score breakdown */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Technical', value: r.technical_score },
                        { label: 'Communication', value: r.communication_score },
                        { label: 'Culture Fit', value: r.cultural_fit_score },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center gap-2">
                          <ScoreRing score={value ?? 0} size={48} strokeWidth={4} />
                          <span className="text-fog text-xs">{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    {r.summary && (
                      <div>
                        <p className="text-fog text-xs font-medium uppercase tracking-wider mb-2">Summary</p>
                        <p className="text-mist text-sm leading-relaxed">{r.summary}</p>
                      </div>
                    )}

                    {/* Strengths & improvements */}
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <p className="text-fog text-xs font-medium uppercase tracking-wider mb-2">Strengths</p>
                        <ul className="space-y-1.5">
                          {r.strengths.map((s) => (
                            <li key={s} className="flex items-start gap-2 text-xs text-mist">
                              <span className="w-1 h-1 rounded-full bg-teal mt-1.5 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-fog text-xs font-medium uppercase tracking-wider mb-2">Areas to Improve</p>
                        <ul className="space-y-1.5">
                          {r.areas_for_improvement.map((a) => (
                            <li key={a} className="flex items-start gap-2 text-xs text-mist">
                              <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

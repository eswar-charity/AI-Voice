import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, Video, CheckCircle2, XCircle } from 'lucide-react'
import api from '../lib/api'
import ScoreRing from '../components/ui/ScoreRing'
import { useAuth } from '../contexts/AuthContext'

interface Match {
  id: string
  resume_id: string
  job_id: string
  score: number
  reasoning: string
  strengths: string[]
  weaknesses: string[]
  status: string
  candidate_name?: string
  candidate_email?: string
  candidate_user_id?: string
  resume_file_name?: string
}

interface Job {
  id: string
  title: string
  company: string
}

export default function CandidatesPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [scheduled, setScheduled] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return
    api.get<Job>(`/jobs/${jobId}`).then((r) => setJob(r.data)).catch(() => {})
    api.get<Match[]>(`/matches/${jobId}`).then((r) => setMatches(r.data)).catch(() => {})
  }, [jobId])

  const runMatching = async () => {
    if (!jobId) return
    setRunning(true)
    setError('')
    try {
      const res = await api.post<Match[]>(`/matches/${jobId}/run`)
      setMatches(res.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Matching failed. Ensure resumes are uploaded and in Ready status.'
      )
    } finally {
      setRunning(false)
    }
  }

  const startInterview = async (match: Match) => {
    if (!match.candidate_user_id) {
      setError('Cannot schedule interview — candidate user not found for this resume.')
      return
    }
    try {
      await api.post<{ id: string }>('/interviews', {
        candidate_id: match.candidate_user_id,
        job_id: jobId,
        match_id: match.id,
        round_type: 'hr',
      })
      setScheduled(match.id)
      setError('')
      setTimeout(() => setScheduled(null), 4000)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Failed to schedule interview session. Check your connection and try again.'
      )
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-1.5 text-fog hover:text-mist text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Jobs
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-fog text-xs font-mono uppercase tracking-widest mb-1">Phase 3 — AI Matching</p>
          <h1 className="font-display text-2xl font-bold text-ink">
            {job ? `${job.title} at ${job.company}` : 'Candidates'}
          </h1>
          <p className="text-mist text-sm mt-1">
            {matches.length > 0
              ? `${matches.length} candidates ranked by AI`
              : 'No matches yet. Run AI matching to rank candidates.'}
          </p>
        </div>

        <button
          onClick={runMatching}
          disabled={running}
          className="flex items-center gap-2 bg-ai hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity disabled:opacity-50"
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Zap size={14} /> Run AI Matching
            </>
          )}
        </button>
      </div>

      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}

      {matches.length === 0 && !running && (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-full bg-ai/10 flex items-center justify-center mx-auto mb-3">
            <Zap size={20} className="text-ai" />
          </div>
          <p className="text-fog text-sm">Click "Run AI Matching" to score all uploaded resumes against this role.</p>
        </div>
      )}

      <div className="space-y-3">
        {matches.map((m, i) => (
          <div
            key={m.id}
            className="bg-surface border border-line rounded-xl overflow-hidden hover:border-primary/20 transition-colors"
          >
            <div
              className="flex items-center gap-4 p-4 cursor-pointer"
              onClick={() => setExpanded(expanded === m.id ? null : m.id)}
            >
              {/* Rank */}
              <div className="w-7 text-center font-mono text-xs text-fog shrink-0">
                #{i + 1}
              </div>

              {/* Score ring */}
              <ScoreRing score={m.score} size={52} strokeWidth={4} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-ink text-sm font-medium truncate">
                  {m.candidate_name || m.resume_file_name || 'Candidate'}
                </div>
                <div className="text-fog text-xs mt-0.5 truncate">
                  {m.candidate_email || ''}
                </div>
              </div>

              {/* Top strength */}
              {m.strengths?.[0] && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-teal/10 rounded-full text-teal text-xs max-w-[180px] truncate">
                  <CheckCircle2 size={11} />
                  <span className="truncate">{m.strengths[0]}</span>
                </div>
              )}

              {user?.role === 'recruiter' && (
                <button
                  onClick={(e) => { e.stopPropagation(); startInterview(m) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs rounded-lg transition-all shrink-0"
                >
                  <Video size={12} />
                  {scheduled === m.id ? 'Scheduled!' : 'Schedule Interview'}
                </button>
              )}
            </div>

            {/* Expanded details */}
            {expanded === m.id && (
              <div className="px-4 pb-4 border-t border-line pt-4 space-y-4">
                <p className="text-mist text-sm leading-relaxed">{m.reasoning}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-fog text-xs font-medium uppercase tracking-wider mb-2">Strengths</p>
                    <ul className="space-y-1">
                      {m.strengths.map((s) => (
                        <li key={s} className="flex items-start gap-1.5 text-xs text-mist">
                          <CheckCircle2 size={12} className="text-teal mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-fog text-xs font-medium uppercase tracking-wider mb-2">Gaps</p>
                    <ul className="space-y-1">
                      {m.weaknesses.map((w) => (
                        <li key={w} className="flex items-start gap-1.5 text-xs text-mist">
                          <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

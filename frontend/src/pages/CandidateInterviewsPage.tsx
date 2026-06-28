import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video,
  Zap,
  CheckCircle2,
  Clock,
  RotateCcw,
  Lock,
  ArrowRight,
} from 'lucide-react'
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
  job_title?: string
  job_company?: string
}

interface SeriesRound {
  round_type: string
  label: string
  voice_name: string
  interviewer_title: string
  interview_id: string | null
  status: string
  unlocked: boolean
  available: boolean
}

interface SeriesProgress {
  job_id: string
  match_id?: string
  series_complete: boolean
  rounds: SeriesRound[]
}

export default function CandidateInterviewsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState<Match[]>([])
  const [seriesMap, setSeriesMap] = useState<Record<string, SeriesProgress>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try {
      const matchRes = await api.get<Match[]>('/matches/my')
      setMatches(matchRes.data)

      const progressEntries = await Promise.all(
        matchRes.data.map(async (m) => {
          const res = await api.get<SeriesProgress>('/interviews/series/progress', {
            params: { job_id: m.job_id, match_id: m.id },
          })
          return [m.id, res.data] as const
        })
      )
      setSeriesMap(Object.fromEntries(progressEntries))
    } catch {
      setError('Failed to load your interviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startRound = async (match: Match, round: SeriesRound) => {
    if (!round.unlocked || !round.available) return

    if (round.interview_id && round.status === 'in_progress') {
      navigate(`/interview/${round.interview_id}`)
      return
    }
    if (round.interview_id && round.status === 'pending') {
      navigate(`/interview/${round.interview_id}`)
      return
    }

    const key = `${match.id}-${round.round_type}`
    setBusy(key)
    setError('')
    try {
      const res = await api.post<{ id: string }>('/interviews', {
        candidate_id: user!.id,
        job_id: match.job_id,
        match_id: match.id,
        round_type: round.round_type,
      })
      navigate(`/interview/${res.data.id}`)
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Could not start this round. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const retakeSeries = async (match: Match) => {
    const series = seriesMap[match.id]
    const managerRound = series?.rounds.find((r) => r.round_type === 'manager')
    const anyRound = series?.rounds.find((r) => r.interview_id)
    const refId = managerRound?.interview_id || anyRound?.interview_id
    if (!refId) return

    setBusy(`retake-${match.id}`)
    setError('')
    try {
      const res = await api.post<{ id: string }>(`/interviews/${refId}/retake`)
      await load()
      navigate(`/interview/${res.data.id}`)
    } catch {
      setError('Could not start retake. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const roundStatusLabel = (round: SeriesRound) => {
    if (round.status === 'completed') return 'Completed'
    if (round.status === 'in_progress') return 'In progress'
    if (round.status === 'pending') return 'Ready to start'
    if (!round.unlocked) return 'Locked'
    return 'Not started'
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
        <p className="text-fog text-xs font-mono uppercase tracking-widest mb-1">AI Interviews</p>
        <h1 className="font-display text-2xl font-bold text-ink">Your Matched Roles</h1>
        <p className="text-mist text-sm mt-1">
          Each role has three separate interview rounds — HR, Technical, and Manager. Complete them
          at your own pace and prepare between rounds.
        </p>
      </div>

      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}

      {matches.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-full bg-ai/10 flex items-center justify-center mx-auto mb-3">
            <Zap size={20} className="text-ai" />
          </div>
          <p className="text-fog text-sm">No matching roles yet.</p>
          <p className="text-fog text-xs mt-2">
            Upload your resume and wait for a recruiter to run AI matching against open jobs.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((m) => {
            const series = seriesMap[m.id]
            const isRetaking = busy === `retake-${m.id}`

            return (
              <div
                key={m.id}
                className="bg-surface border border-line rounded-xl p-5 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start gap-4 mb-4">
                  <ScoreRing score={m.score} size={52} strokeWidth={4} />
                  <div className="flex-1 min-w-0">
                    <div className="text-ink text-sm font-medium">
                      {m.job_title || 'Position'}
                      {m.job_company ? ` at ${m.job_company}` : ''}
                    </div>
                    <p className="text-fog text-xs mt-0.5 line-clamp-2">{m.reasoning}</p>
                    {series?.series_complete && (
                      <span className="inline-flex items-center gap-1.5 mt-2 text-teal text-xs">
                        <CheckCircle2 size={11} />
                        All rounds complete
                      </span>
                    )}
                  </div>
                  {series?.series_complete && (
                    <button
                      onClick={() => retakeSeries(m)}
                      disabled={isRetaking}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-elevated hover:bg-surface border border-line text-ink text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={12} className={isRetaking ? 'animate-spin' : ''} />
                      {isRetaking ? 'Starting…' : 'Retake all'}
                    </button>
                  )}
                </div>

                <div className="space-y-2 border-t border-line pt-4">
                  {(series?.rounds || []).map((round, i) => {
                    const busyKey = `${m.id}-${round.round_type}`
                    const isBusy = busy === busyKey
                    const locked = !round.unlocked
                    const completed = round.status === 'completed'
                    const actionable = round.available && !completed

                    return (
                      <div
                        key={round.round_type}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          completed
                            ? 'bg-teal/5 border-teal/20'
                            : actionable
                            ? 'bg-primary/5 border-primary/20'
                            : locked
                            ? 'bg-elevated/50 border-line opacity-70'
                            : 'bg-elevated border-line'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-surface border border-line flex items-center justify-center text-fog text-xs font-mono shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-ink text-xs font-medium">{round.label}</div>
                          <div className="text-fog text-[10px] mt-0.5">
                            {round.voice_name} · {round.interviewer_title}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] ${
                              completed
                                ? 'text-teal'
                                : round.status === 'in_progress'
                                ? 'text-amber-400'
                                : locked
                                ? 'text-fog'
                                : 'text-primary'
                            }`}
                          >
                            {locked && <Lock size={10} className="inline mr-1 -mt-0.5" />}
                            {roundStatusLabel(round)}
                          </span>
                          {actionable && (
                            <button
                              onClick={() => startRound(m, round)}
                              disabled={isBusy}
                              className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-[10px] rounded-md transition-colors disabled:opacity-50"
                            >
                              {isBusy ? (
                                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Video size={10} />
                                  {round.status === 'in_progress' ? 'Resume' : 'Start'}
                                  <ArrowRight size={10} />
                                </>
                              )}
                            </button>
                          )}
                          {completed && (
                            <CheckCircle2 size={14} className="text-teal" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mic, MicOff, PhoneOff, AlertTriangle, Shield, Maximize, RotateCcw, ArrowRight } from 'lucide-react'
import api from '../lib/api'
import { getAuthToken } from '../lib/auth-token'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useActivityMonitor } from '../hooks/useActivityMonitor'

interface TranscriptEntry {
  role: 'candidate' | 'interviewer'
  content: string
}

interface RoundInfo {
  id: string
  label: string
  voice_name?: string
}

const DEFAULT_ROUNDS: RoundInfo[] = [
  { id: 'hr', label: 'HR Round', voice_name: 'Bella' },
  { id: 'technical', label: 'Technical Round', voice_name: 'Domi' },
  { id: 'manager', label: 'Manager Round', voice_name: 'Adam' },
]

const NEXT_ROUND: Record<string, { type: string; label: string }> = {
  hr: { type: 'technical', label: 'Technical Round' },
  technical: { type: 'manager', label: 'Manager Round' },
}

type InterviewPhase = 'preflight' | 'connecting' | 'ready' | 'listening' | 'processing' | 'speaking' | 'complete'

interface InterviewMeta {
  id: string
  candidate_id: string
  job_id: string
  match_id?: string
  round_type: string
  status: string
}

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace('http', 'ws')

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const token = getAuthToken() || ''

  const [phase, setPhase] = useState<InterviewPhase>('preflight')
  const [entered, setEntered] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [violations, setViolations] = useState(0)
  const [violationAlert, setViolationAlert] = useState<string | null>(null)
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [retaking, setRetaking] = useState(false)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(1)
  const [, setRoundsList] = useState<RoundInfo[]>(DEFAULT_ROUNDS)
  const [, setCurrentRoundIndex] = useState(0)
  const [currentRoundLabel, setCurrentRoundLabel] = useState('HR Round')
  const [voiceName, setVoiceName] = useState('Bella')
  const [interviewerTitle, setInterviewerTitle] = useState('HR Partner')
  const [seriesComplete, setSeriesComplete] = useState(false)
  const [nextRoundLabel, setNextRoundLabel] = useState<string | null>(null)
  const [nextRoundType, setNextRoundType] = useState<string | null>(null)
  const [roundComplete, setRoundComplete] = useState(false)
  const [interviewMeta, setInterviewMeta] = useState<InterviewMeta | null>(null)
  const [startingNext, setStartingNext] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const pendingSpeechTextRef = useRef<string | null>(null)
  const phaseRef = useRef<InterviewPhase>('preflight')
  const roundCompleteRef = useRef(false)
  phaseRef.current = phase
  roundCompleteRef.current = roundComplete

  const finishSpeaking = useCallback(() => {
    setAiSpeaking(false)
    if (roundCompleteRef.current) {
      setPhase('complete')
    } else if (phaseRef.current !== 'complete') {
      setPhase('ready')
    }
  }, [])

  const wsUrl = id && entered ? `${WS_BASE}/ws/interview/${id}?token=${token}` : null

  const addEntry = useCallback((role: 'candidate' | 'interviewer', content: string) => {
    setTranscript((prev) => [...prev, { role, content }])
  }, [])

  const speakWithBrowser = useCallback((text: string) => {
    if (!text.trim()) {
      finishSpeaking()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.onstart = () => {
      setAiSpeaking(true)
      setPhase('speaking')
    }
    utterance.onend = finishSpeaking
    utterance.onerror = finishSpeaking
    window.speechSynthesis.speak(utterance)
  }, [finishSpeaking])

  const playAiResponse = useCallback(
    (text: string, audio?: string, useBrowserTts?: boolean) => {
      if (audio && audio.length > 50 && !useBrowserTts) {
        const blob = b64ToBlob(audio, 'audio/mpeg')
        const url = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.onplay = () => {
            setAiSpeaking(true)
            setPhase('speaking')
          }
          audioRef.current.onended = () => {
            URL.revokeObjectURL(url)
            finishSpeaking()
          }
          audioRef.current.onerror = () => {
            URL.revokeObjectURL(url)
            speakWithBrowser(text)
          }
          audioRef.current.play().catch(() => speakWithBrowser(text))
        } else {
          speakWithBrowser(text)
        }
      } else {
        speakWithBrowser(text)
      }
    },
    [speakWithBrowser, finishSpeaking]
  )

  const markRoundComplete = useCallback((msg: Record<string, unknown>) => {
    setRoundComplete(true)
    setSeriesComplete(Boolean(msg.series_complete))
    setNextRoundLabel(typeof msg.next_round_label === 'string' ? msg.next_round_label : null)
    setNextRoundType(typeof msg.next_round_type === 'string' ? msg.next_round_type : null)
    if (phaseRef.current !== 'speaking') {
      setPhase('complete')
    }
  }, [])

  const applyRoundMeta = useCallback((msg: Record<string, unknown>) => {
    if (typeof msg.question_count === 'number') setTotalQuestions(msg.question_count)
    if (typeof msg.question_index === 'number') setQuestionIndex(msg.question_index)
    if (typeof msg.round_index === 'number') setCurrentRoundIndex(msg.round_index)
    if (typeof msg.round_label === 'string') setCurrentRoundLabel(msg.round_label)
    if (typeof msg.voice_name === 'string') setVoiceName(msg.voice_name)
    if (typeof msg.interviewer_title === 'string') setInterviewerTitle(msg.interviewer_title)
    if (Array.isArray(msg.rounds)) {
      setRoundsList(
        msg.rounds.map((r) => {
          const round = r as RoundInfo
          return { id: round.id, label: round.label, voice_name: round.voice_name }
        })
      )
    }
  }, [])

  const handleWsMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (phaseRef.current === 'connecting') setPhase('ready')

      switch (msg.type) {
        case 'opening':
        case 'response': {
          const text = msg.text as string
          const audio = msg.audio as string | undefined
          const useBrowserTts = Boolean(msg.use_browser_tts)
          applyRoundMeta(msg)
          addEntry('interviewer', text)
          playAiResponse(text, audio, useBrowserTts)
          if (msg.is_complete || msg.round_complete) {
            markRoundComplete(msg)
          }
          break
        }
        case 'transcript':
          addEntry('candidate', msg.candidate as string)
          if (!roundCompleteRef.current) setPhase('processing')
          setSessionError('')
          break
        case 'complete':
          markRoundComplete(msg)
          if (msg.series_complete) {
            setGeneratingReport(true)
            setTimeout(() => setGeneratingReport(false), 3000)
          }
          break
        case 'error':
          setSessionError(
            typeof msg.message === 'string'
              ? msg.message.replace(/^Error code: \d+ - /, '').slice(0, 200)
              : 'Something went wrong. Hold the mic and try again.'
          )
          if (phaseRef.current !== 'complete' && !roundCompleteRef.current) setPhase('ready')
          break
      }
    },
    [addEntry, playAiResponse, applyRoundMeta, markRoundComplete, id]
  )

  const { connected, send: wsSend } = useWebSocket(wsUrl, handleWsMessage)

  const reportViolation = useCallback(
    (event: string) => {
      setViolations((v) => v + 1)
      setViolationAlert(VIOLATION_LABELS[event] || event)
      setTimeout(() => setViolationAlert(null), 4000)
      wsSend({
        type: 'activity',
        event,
        timestamp: new Date().toISOString(),
      })
    },
    [wsSend]
  )

  useActivityMonitor(
    reportViolation,
    entered && phase !== 'connecting' && phase !== 'complete' && phase !== 'preflight' && !roundComplete
  )

  // Load interview metadata (for next-round navigation and resumed sessions)
  useEffect(() => {
    if (!id) return
    api
      .get<InterviewMeta>(`/interviews/${id}`)
      .then((res) => {
        setInterviewMeta(res.data)
        if (res.data.status === 'completed') {
          setRoundComplete(true)
          setPhase('complete')
          const rt = res.data.round_type || 'hr'
          if (rt === 'manager') {
            setSeriesComplete(true)
          } else {
            const nxt = NEXT_ROUND[rt]
            if (nxt) {
              setNextRoundType(nxt.type)
              setNextRoundLabel(nxt.label)
            }
          }
        }
      })
      .catch(() => {})
  }, [id])

  const enterRoom = async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // User may deny fullscreen — still allow interview
    }
    setEntered(true)
    setPhase('connecting')
  }

  // ── Fullscreen cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  // ── Elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'complete') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase])

  // ── Scroll transcript to bottom ──────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // ── Request opening message once WS connects ─────────────────────────────
  const started = useRef(false)
  useEffect(() => {
    if (!connected || phase !== 'connecting' || started.current) return
    started.current = true
    setSessionError('')
    wsSend({ type: 'start' })
  }, [connected, phase, wsSend])

  function b64ToBlob(b64: string, type: string) {
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new Blob([arr], { type })
  }

  const speechSupportedRef = useRef(false)
  const { supported: speechSupported, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition()
  speechSupportedRef.current = speechSupported

  const onAudioReady = useCallback(
    (base64: string) => {
      if (roundCompleteRef.current) return

      const spokenText = pendingSpeechTextRef.current
      pendingSpeechTextRef.current = null
      setSessionError('')

      if (spokenText) {
        setPhase('processing')
        wsSend({ type: 'text', text: spokenText })
        return
      }

      if (speechSupportedRef.current) {
        setSessionError('No speech detected. Hold the mic button longer and speak clearly.')
        setPhase('ready')
        return
      }

      setPhase('processing')
      wsSend({ type: 'audio', data: base64 })
    },
    [wsSend]
  )

  const { recording, error: micError, start: startRecording, stop: stopRecording } =
    useMediaRecorder(onAudioReady)

  const candidateAnswers = transcript.filter((t) => t.role === 'candidate').length

  const handleRecordPress = () => {
    if (roundComplete || phase !== 'ready') return
    if (totalQuestions > 0 && candidateAnswers >= totalQuestions) return
    setSessionError('')
    pendingSpeechTextRef.current = null
    setPhase('listening')
    if (speechSupported) startSpeech()
    startRecording()
  }

  const handleRecordRelease = async () => {
    if (!recording) return
    if (speechSupported) {
      const text = await stopSpeech()
      if (text) pendingSpeechTextRef.current = text
    }
    stopRecording()
  }

  const endInterview = () => {
    const expected = totalQuestions || 7
    if (candidateAnswers < expected) {
      const remaining = expected - candidateAnswers
      const proceed = window.confirm(
        `You have answered ${candidateAnswers} of ${expected} tailored questions. ` +
          `${remaining} question${remaining > 1 ? 's' : ''} remaining.\n\n` +
          'End anyway? You can retake the interview later to improve your score.'
      )
      if (!proceed) return
    }
    wsSend({ type: 'end' })
    setPhase('complete')
    setGeneratingReport(true)
    setTimeout(() => setGeneratingReport(false), 3000)
  }

  const handleRetake = async () => {
    if (!id) return
    setRetaking(true)
    try {
      const res = await api.post<{ id: string }>(`/interviews/${id}/retake`)
      navigate(`/interview/${res.data.id}`, { replace: true })
    } catch {
      setSessionError('Could not start a retake. Please try again from AI Interviews.')
      setRetaking(false)
    }
  }

  const startNextRound = async () => {
    if (!interviewMeta || !nextRoundType || !user) return
    setStartingNext(true)
    setSessionError('')
    try {
      const res = await api.post<{ id: string }>('/interviews', {
        candidate_id: user.id,
        job_id: interviewMeta.job_id,
        match_id: interviewMeta.match_id,
        round_type: nextRoundType,
      })
      navigate(`/interview/${res.data.id}`, { replace: true })
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSessionError(detail || 'Could not start the next round. Try from AI Interviews.')
      setStartingNext(false)
    }
  }

  const micAllowed =
    !roundComplete &&
    phase !== 'complete' &&
    (totalQuestions === 0 || candidateAnswers < totalQuestions)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (phase === 'preflight') {
    return (
      <div className="fixed inset-0 bg-base flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Maximize size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-ink">AI Interview Room</h1>
            <p className="text-mist text-sm mt-2 leading-relaxed">
              You are about to enter a fullscreen, proctored interview. Tab switches, copy/paste,
              right-click, and developer tools are monitored.
            </p>
          </div>
          <ul className="text-left text-xs text-fog space-y-2">
            <li>· Use a quiet environment with a working microphone</li>
            <li>· Three separate rounds: HR, Technical, and Manager — start each when you're ready</li>
            <li>· Questions are tailored to your resume and the job description</li>
            <li>· Hold the record button while speaking</li>
            <li>· Stay in fullscreen for the duration of the interview</li>
          </ul>
          <button
            onClick={enterRoom}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-xl transition-colors"
          >
            Enter Fullscreen Interview Room
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-base flex flex-col select-none overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* ── Violation alert ── */}
      {violationAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl backdrop-blur-sm animate-fade-up">
          <AlertTriangle size={14} />
          {violationAlert}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-display font-semibold text-ink text-sm tracking-widest">ORION</span>
          <span className="text-fog text-xs">· AI Interview</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-fog text-xs">
            <Shield size={12} className={violations > 0 ? 'text-red-400' : 'text-teal'} />
            {violations > 0 ? (
              <span className="text-red-400">{violations} violation{violations > 1 ? 's' : ''}</span>
            ) : (
              <span className="text-teal">Clean session</span>
            )}
          </div>
          <div className="font-mono text-xs text-fog">{formatTime(elapsed)}</div>
          {!roundComplete && phase !== 'complete' && (
            <button
              onClick={endInterview}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors"
            >
              <PhoneOff size={13} /> End
            </button>
          )}
        </div>
      </div>

      {/* ── Round context (read-only overview) ── */}
      {phase !== 'connecting' && (
        <div className="px-6 py-2 border-b border-line bg-surface/30 shrink-0">
          <p className="text-center text-fog text-[10px]">
            {currentRoundLabel} · {voiceName} · Take this round at your own pace — return to AI
            Interviews when finished to prepare for the next round
          </p>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: AI avatar + record button */}
        <div className="flex flex-col items-center justify-center flex-1 gap-8 p-8">
          {/* AI Avatar */}
          <div className="relative">
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                aiSpeaking
                  ? 'bg-primary/20 shadow-[0_0_60px_rgba(61,107,255,0.4)]'
                  : 'bg-elevated'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12">
                <path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
                  stroke={aiSpeaking ? '#3D6BFF' : '#4A5568'}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            {aiSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                <div className="absolute -inset-3 rounded-full border border-primary/10 animate-pulse" />
              </>
            )}
          </div>

          {/* Phase label */}
          <div className="text-center">
            <p className="text-fog text-xs uppercase tracking-wider mb-1">
              {currentRoundLabel}
              {voiceName ? ` · ${voiceName}` : ''}
              {interviewerTitle ? ` · ${interviewerTitle}` : ''}
            </p>
            <p className="text-ink text-sm font-medium">
              {phase === 'connecting' && 'Connecting…'}
              {phase === 'ready' && 'Hold to speak'}
              {phase === 'listening' && 'Listening…'}
              {phase === 'processing' && 'Processing…'}
              {phase === 'speaking' && 'AI is speaking…'}
              {phase === 'complete' && (seriesComplete ? 'All rounds complete' : `${currentRoundLabel} complete`)}
            </p>
            {!roundComplete && phase !== 'complete' && phase !== 'connecting' && totalQuestions > 0 && (
              <p className="text-fog text-xs mt-1">
                Question {Math.min(questionIndex, totalQuestions)} of {totalQuestions}
                {candidateAnswers >= totalQuestions ? ' — all questions complete' : ''}
              </p>
            )}
            {phase !== 'complete' && phase !== 'connecting' && totalQuestions === 0 && (
              <p className="text-fog text-xs mt-1">Loading tailored questions…</p>
            )}
            {micError && <p className="text-red-400 text-xs mt-1">{micError}</p>}
            {sessionError && <p className="text-red-400 text-xs mt-1">{sessionError}</p>}
            {speechSupported && phase === 'ready' && micAllowed && (
              <p className="text-fog text-xs mt-1">Browser speech recognition enabled</p>
            )}
          </div>

          {/* Record button — hidden once round is complete */}
          {micAllowed && (
            <button
              onMouseDown={handleRecordPress}
              onMouseUp={handleRecordRelease}
              onTouchStart={handleRecordPress}
              onTouchEnd={handleRecordRelease}
              disabled={phase !== 'ready' && phase !== 'listening'}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                recording
                  ? 'bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                  : phase === 'ready'
                  ? 'bg-primary hover:scale-105 shadow-[0_0_20px_rgba(61,107,255,0.3)]'
                  : 'bg-elevated opacity-50 cursor-not-allowed'
              }`}
            >
              {recording ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
            </button>
          )}

          {(roundComplete || phase === 'complete') && (
            <div className="text-center space-y-4">
              {seriesComplete ? (
                <>
                  <p className="text-mist text-sm">
                    {generatingReport
                      ? 'Generating your evaluation report…'
                      : 'All three rounds are complete. Your full evaluation is ready.'}
                  </p>
                  <p className="text-fog text-xs max-w-xs mx-auto">
                    Not happy with your score? Retake from the HR round — your latest attempt will
                    be evaluated separately.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={handleRetake}
                      disabled={generatingReport || retaking}
                      className="flex items-center gap-2 px-5 py-2.5 bg-elevated hover:bg-surface border border-line text-ink text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={14} className={retaking ? 'animate-spin' : ''} />
                      {retaking ? 'Starting retake…' : 'Retake All Rounds'}
                    </button>
                    <button
                      onClick={() => navigate('/reports')}
                      disabled={generatingReport}
                      className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      View Report
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-mist text-sm">
                    {currentRoundLabel} is complete. Take a break and prepare before your next
                    session.
                  </p>
                  {nextRoundLabel && (
                    <p className="text-fog text-xs max-w-sm mx-auto">
                      When you're ready, start the{' '}
                      <strong className="text-ink">{nextRoundLabel}</strong> or return later from
                      AI Interviews.
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {nextRoundType && (
                      <button
                        onClick={startNextRound}
                        disabled={startingNext}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                      >
                        <ArrowRight size={14} />
                        {startingNext ? 'Starting…' : `Start ${nextRoundLabel || 'Next Round'}`}
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/interviews')}
                      className="px-5 py-2.5 bg-elevated hover:bg-surface border border-line text-ink text-sm rounded-lg transition-colors"
                    >
                      Back to AI Interviews
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Transcript */}
        <div className="w-80 border-l border-line bg-surface flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-fog text-xs font-medium uppercase tracking-wider">Transcript</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={`text-xs leading-relaxed ${
                  entry.role === 'interviewer' ? 'text-primary' : 'text-mist'
                }`}
              >
                <span className="font-medium uppercase tracking-wider text-fog text-[10px]">
                  {entry.role === 'interviewer' ? 'AI' : 'You'}&nbsp;·&nbsp;
                </span>
                {entry.content}
              </div>
            ))}
            {transcript.length === 0 && (
              <p className="text-fog text-xs">Transcript will appear here…</p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

const VIOLATION_LABELS: Record<string, string> = {
  tab_switch: 'Tab switch detected — please stay on this page',
  fullscreen_exit: 'Fullscreen exit detected',
  copy: 'Copy is not allowed during the interview',
  paste: 'Paste is not allowed during the interview',
  right_click: 'Right-click is not allowed during the interview',
  devtools_open: 'Developer tools detected',
}

import { useState, useEffect, useCallback } from 'react'
import { FileText, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import DropZone from '../components/ui/DropZone'
import { useAuth } from '../contexts/AuthContext'

interface Resume {
  id: string
  file_name: string
  file_size: number
  status: 'processing' | 'ready' | 'error'
  created_at: string
  parsed_content?: Record<string, unknown>
}

const STATUS_CONFIG = {
  processing: { label: 'Processing', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ready: { label: 'Ready', icon: CheckCircle, color: 'text-teal', bg: 'bg-teal/10' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ResumesPage() {
  const { user } = useAuth()
  const isCandidate = user?.role === 'candidate'
  const [resumes, setResumes] = useState<Resume[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get<Resume[]>('/resumes')
      setResumes(res.data)
    } catch {
      setError('Failed to load resumes')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const hasProcessing = resumes.some((r) => r.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(load, 2500)
    return () => clearInterval(interval)
  }, [resumes, load])

  const handleFile = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<Resume>('/resumes', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResumes((prev) => {
        const without = prev.filter((r) => r.id !== res.data.id)
        return [res.data, ...without]
      })
      if (res.data.status === 'processing') {
        load()
      }
    } catch {
      setError('Upload failed. Please try a valid PDF under 10 MB.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/resumes/${id}`)
      setResumes((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('Failed to delete resume')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <p className="text-fog text-xs font-mono uppercase tracking-widest mb-1">
          {isCandidate ? 'Your Profile' : 'Phase 2'}
        </p>
        <h1 className="font-display text-2xl font-bold text-ink">
          {isCandidate ? 'My Resume' : 'Resumes'}
        </h1>
        <p className="text-mist text-sm mt-1">
          {isCandidate
            ? 'Upload your PDF resume — AI parses it so recruiters can match you to open roles.'
            : 'Upload candidate PDFs — AI parses them and stores to OpenAI Files.'}
        </p>
      </div>

      <div className="mb-8">
        <DropZone onFile={handleFile} loading={uploading} />
        {error && (
          <p className="mt-2 text-red-400 text-xs">{error}</p>
        )}
      </div>

      {resumes.length === 0 ? (
        <div className="text-center py-20 text-fog text-sm">
          No resumes yet. Upload your first PDF above.
        </div>
      ) : (
        <div className="space-y-2">
          {resumes.map((r) => {
            const cfg = STATUS_CONFIG[r.status]
            const StatusIcon = cfg.icon
            const name = (r.parsed_content as Record<string, string>)?.name

            return (
              <div
                key={r.id}
                className="flex items-center gap-4 p-4 bg-surface border border-line rounded-xl hover:border-primary/20 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-ink text-sm font-medium truncate">
                    {name || r.file_name}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-fog text-xs">{fmtBytes(r.file_size)}</span>
                    <span className="text-fog text-xs">·</span>
                    <span className="text-fog text-xs">{fmtDate(r.created_at)}</span>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}
                >
                  <StatusIcon size={11} />
                  {cfg.label}
                </div>

                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-fog hover:text-red-400 transition-colors p-1"
                  aria-label="Delete resume"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

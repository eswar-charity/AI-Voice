import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Briefcase, MapPin, Trash2, Users, Edit2 } from 'lucide-react'
import api from '../lib/api'
import Modal from '../components/ui/Modal'

interface Job {
  id: string
  title: string
  company: string
  location?: string
  employment_type: string
  description: string
  requirements: string
  status: string
  created_at: string
}

const schema = z.object({
  title: z.string().min(2, 'Required'),
  company: z.string().min(1, 'Required'),
  location: z.string().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship']),
  description: z.string().min(20, 'Describe the role in at least 20 characters'),
  requirements: z.string().min(20, 'List at least one requirement'),
})
type FormData = z.infer<typeof schema>

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-teal bg-teal/10',
  closed: 'text-fog bg-elevated',
  draft: 'text-amber-400 bg-amber-400/10',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function JobFormFields({ errors, register }: { errors: Record<string, { message?: string } | undefined>; register: ReturnType<typeof useForm<FormData>>['register'] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Job title</label>
          <input {...register('title')} className="input" placeholder="Senior Engineer" />
          {errors.title && <p className="err">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label">Company</label>
          <input {...register('company')} className="input" placeholder="Acme Corp" />
          {errors.company && <p className="err">{errors.company.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Location</label>
          <input {...register('location')} className="input" placeholder="Remote / NYC" />
        </div>
        <div>
          <label className="label">Employment type</label>
          <select {...register('employment_type')} className="input">
            {Object.entries(EMPLOYMENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea {...register('description')} className="input min-h-24 resize-none" placeholder="Describe the role and responsibilities…" />
        {errors.description && <p className="err">{errors.description.message}</p>}
      </div>
      <div>
        <label className="label">Requirements</label>
        <textarea {...register('requirements')} className="input min-h-20 resize-none" placeholder="List required skills and experience…" />
        {errors.requirements && <p className="err">{errors.requirements.message}</p>}
      </div>
    </div>
  )
}

export default function JobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { employment_type: 'full_time' } })

  const load = async () => {
    try {
      const res = await api.get<Job[]>('/jobs')
      setJobs(res.data)
    } catch { /* silent */ }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditJob(null)
    reset({ employment_type: 'full_time' })
    setServerError('')
    setModalOpen(true)
  }

  const openEdit = (job: Job) => {
    setEditJob(job)
    setValue('title', job.title)
    setValue('company', job.company)
    setValue('location', job.location ?? '')
    setValue('employment_type', job.employment_type as FormData['employment_type'])
    setValue('description', job.description)
    setValue('requirements', job.requirements)
    setServerError('')
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      if (editJob) {
        const res = await api.patch<Job>(`/jobs/${editJob.id}`, data)
        setJobs((prev) => prev.map((j) => (j.id === editJob.id ? res.data : j)))
      } else {
        const res = await api.post<Job>('/jobs', data)
        setJobs((prev) => [res.data, ...prev])
      }
      setModalOpen(false)
    } catch {
      setServerError('Failed to save job. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/jobs/${id}`)
      setJobs((prev) => prev.filter((j) => j.id !== id))
    } catch { /* silent */ }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <style>{`.label{display:block;color:#8892A4;font-size:.7rem;font-weight:500;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.375rem}.input{width:100%;background:#162030;border:1px solid #1E2D45;border-radius:.5rem;padding:.625rem 1rem;color:#EEF2FF;font-size:.875rem;outline:none;transition:border-color .2s}.input:focus{border-color:#3D6BFF;box-shadow:0 0 0 1px rgba(61,107,255,.2)}.err{margin-top:.25rem;color:#f87171;font-size:.75rem}`}</style>

      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-fog text-xs font-mono uppercase tracking-widest mb-1">Phase 2</p>
          <h1 className="font-display text-2xl font-bold text-ink">Job Descriptions</h1>
          <p className="text-mist text-sm mt-1">Create roles and run AI candidate matching.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> New Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-20 text-fog text-sm">
          No job descriptions yet. Create your first role above.
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="p-5 bg-surface border border-line rounded-xl hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Briefcase size={15} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-ink font-medium text-sm">{job.title}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[job.status]}`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-fog text-xs">
                      <span>{job.company}</span>
                      {job.location && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} />
                            {job.location}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{EMPLOYMENT_LABELS[job.employment_type]}</span>
                      <span>·</span>
                      <span>{fmtDate(job.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => navigate(`/candidates/${job.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-mist hover:text-ink hover:bg-elevated rounded-lg transition-colors"
                  >
                    <Users size={13} /> Candidates
                  </button>
                  <button
                    onClick={() => openEdit(job)}
                    className="p-1.5 text-fog hover:text-mist hover:bg-elevated rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-1.5 text-fog hover:text-red-400 hover:bg-elevated rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editJob ? 'Edit Job' : 'New Job Description'}
        width="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <JobFormFields errors={errors} register={register} />
          {serverError && (
            <p className="mt-3 text-red-400 text-xs">{serverError}</p>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-fog hover:text-mist hover:bg-elevated rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : editJob ? 'Save changes' : 'Create job'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

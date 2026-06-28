import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Users, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const schema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

const WORKFLOW_STEPS = [
  { label: 'Upload resumes', desc: 'Bulk upload and auto-parse in seconds' },
  { label: 'Create job descriptions', desc: 'AI extracts requirements and weights them' },
  { label: 'Review ranked matches', desc: 'Agents score every candidate against every role' },
  { label: 'Interview with AI', desc: 'Voice-based interviews run 24/7, automatically' },
]

export default function RegisterPage() {
  const { register: authRegister } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'recruiter' | 'candidate'>('recruiter')
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      setServerError('')
      await authRegister(data.email, data.password, data.fullName, role)
      navigate('/dashboard')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail
      if (typeof detail === 'string') {
        setServerError(detail)
      } else {
        setServerError('Registration failed. Please try again.')
      }
    }
  }

  return (
    <div className="min-h-screen flex bg-base">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden flex-col justify-center p-20">
        <div className="absolute inset-0 bg-grid opacity-50" />

        <div
          className="absolute top-1/3 right-1/3 w-[420px] h-[420px] rounded-full animate-orb-pulse"
          style={{
            background: 'radial-gradient(circle, #00C896 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-[380px] h-[380px] rounded-full animate-orb-pulse-slow"
          style={{
            background: 'radial-gradient(circle, #3D6BFF 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path
                  d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-display font-semibold text-lg text-ink tracking-widest">
              ORION
            </span>
          </div>

          <h1 className="font-display text-[3.25rem] font-bold text-ink leading-[1.1] mb-5">
            Start hiring
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #00C896 0%, #3D6BFF 100%)' }}
            >
              smarter today.
            </span>
          </h1>

          <p className="text-mist text-lg leading-relaxed mb-12">
            AI-powered matching, real-time interviews, and deep candidate insights —
            built for modern recruiting teams.
          </p>

          <div className="space-y-5">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-start gap-4">
                <span className="font-mono text-xs text-fog pt-0.5 w-5 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="text-ink text-sm font-medium">{step.label}</div>
                  <div className="text-fog text-xs mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-surface border-l border-line">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
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
            <span className="font-display font-semibold text-ink">ORION</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-ink mb-1">Create account</h2>
          <p className="text-mist text-sm mb-6">Set up your workspace in under a minute</p>

          {/* Role toggle */}
          <div className="flex rounded-lg bg-elevated border border-line p-1 mb-6">
            <button
              type="button"
              onClick={() => setRole('recruiter')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                role === 'recruiter'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-fog hover:text-mist'
              }`}
            >
              <Users size={14} />
              Recruiter
            </button>
            <button
              type="button"
              onClick={() => setRole('candidate')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                role === 'candidate'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-fog hover:text-mist'
              }`}
            >
              <User size={14} />
              Candidate
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <div>
              <label className="block text-mist text-xs font-medium mb-1.5 uppercase tracking-wider">
                Full name
              </label>
              <input
                type="text"
                autoComplete="name"
                {...register('fullName')}
                className="w-full bg-elevated border border-line rounded-lg px-4 py-2.5 text-ink text-sm placeholder:text-fog focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors outline-none"
                placeholder="Alex Johnson"
              />
              {errors.fullName && (
                <p className="mt-1.5 text-red-400 text-xs">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-mist text-xs font-medium mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full bg-elevated border border-line rounded-lg px-4 py-2.5 text-ink text-sm placeholder:text-fog focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors outline-none"
                placeholder="you@company.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-red-400 text-xs">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-mist text-xs font-medium mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password')}
                  className="w-full bg-elevated border border-line rounded-lg px-4 py-2.5 pr-10 text-ink text-sm placeholder:text-fog focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fog hover:text-mist transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-red-400 text-xs">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                <>
                  Create account <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-fog text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-dark transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

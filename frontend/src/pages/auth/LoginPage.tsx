import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

function OrionLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const svgSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const textSize = size === 'sm' ? 'text-sm' : 'text-lg'
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSize} rounded-lg bg-primary flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className={svgSize}>
          <path
            d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className={`font-display font-semibold ${textSize} text-ink tracking-widest`}>
        ORION
      </span>
    </div>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      setServerError('')
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch {
      setServerError('Invalid email or password. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex bg-base">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden flex-col justify-center p-20">
        {/* Grid */}
        <div className="absolute inset-0 bg-grid opacity-50" />

        {/* Orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-[480px] h-[480px] rounded-full animate-orb-pulse"
          style={{
            background: 'radial-gradient(circle, #3D6BFF 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-[360px] h-[360px] rounded-full animate-orb-pulse-slow"
          style={{
            background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="relative z-10 max-w-lg">
          <div className="mb-16">
            <OrionLogo />
          </div>

          <h1 className="font-display text-[3.25rem] font-bold text-ink leading-[1.1] mb-5">
            The intelligence
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #3D6BFF 0%, #7C3AED 100%)' }}
            >
              behind your hires.
            </span>
          </h1>

          <p className="text-mist text-lg leading-relaxed mb-14">
            Match resumes to roles with precision. Run AI interviews at scale.
            Every hire, data-backed.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '94%', label: 'Match accuracy' },
              { value: '2.4×', label: 'Faster shortlisting' },
              { value: '10k+', label: 'Interviews run' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border border-line rounded-xl p-4 bg-surface/60 backdrop-blur-sm"
              >
                <div className="font-mono text-2xl font-medium text-primary">{stat.value}</div>
                <div className="text-fog text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-surface border-l border-line">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <OrionLogo size="sm" />
          </div>

          <h2 className="font-display text-2xl font-bold text-ink mb-1">Sign in</h2>
          <p className="text-mist text-sm mb-8">Access your recruitment dashboard</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {serverError && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {serverError}
              </div>
            )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-mist text-xs font-medium uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-xs text-primary hover:text-primary-dark transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
                  Signing in…
                </span>
              ) : (
                <>
                  Sign in <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-fog text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:text-primary-dark transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

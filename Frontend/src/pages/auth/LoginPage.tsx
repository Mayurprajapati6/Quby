import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { useAuthStore, useSocketStore } from '@/stores'
import api from '@/lib/axios'
import { getRoleDashboard } from '@/lib/utils'
import { usePageTitle } from '@/hooks'

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  usePageTitle('Login')
  const navigate  = useNavigate()
  const { login, isAuthenticated, user } = useAuthStore()
  const { connect } = useSocketStore()

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  if (isAuthenticated && user) {
    return <Navigate to={getRoleDashboard(user.role)} replace />
  }

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      const { accessToken, refreshToken, user } = res.data.data

      login(accessToken, refreshToken, user)
      connect(accessToken)

      toast.success(`Login successfully 🎉`)
      navigate(getRoleDashboard(user.role), { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Login failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="auth-shell min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-page)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="flex justify-center mb-7">
          <Logo variant="full" />
        </div>

        {/* Card */}
        <div
          className="w-full mx-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '32px'
          }}
        >
          <h1 className="font-outfit font-bold text-[24px] mb-1" style={{ color: 'var(--text-1)' }}>
            Welcome back
          </h1>
          <p className="text-[13px] mb-6" style={{ color: 'var(--text-2)' }}>
            Sign in to your Quby account
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full h-11 px-4 rounded-[9px]"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                  outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--violet)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--violet-bg)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              {errors.email && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-10 rounded-[9px]"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--violet)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--violet-bg)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.password.message}</p>
              )}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-[12px] font-syne font-bold"
                style={{ color: 'var(--violet-light)' }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full h-11 rounded-[9px] font-syne font-bold text-[13px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--violet), #3B7FFF)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign in'}
            </motion.button>
          </form>

          {/* Register link */}
          <p className="text-center text-[12px] mt-5" style={{ color: 'var(--text-3)' }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-syne font-bold"
              style={{ color: 'var(--violet-light)' }}
            >
              Register
            </Link>
          </p>
        </div>

      </motion.div>
    </div>
  )
}

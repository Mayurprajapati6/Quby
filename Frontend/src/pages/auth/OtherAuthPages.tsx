// ── ForgotPasswordPage ────────────────────────────────────────────
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import api from '@/lib/axios'
import { useAuthStore, useSocketStore } from '@/stores'
import { getRoleDashboard } from '@/lib/utils'
import { usePageTitle } from '@/hooks'
import { useLocation } from 'react-router-dom'

// ── Forgot Password ───────────────────────────────────────────────
const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export function ForgotPasswordPage() {
  usePageTitle('Forgot Password')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: { email: string }) => {
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', data)
      setSent(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Something went wrong.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-page)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-8"><Logo variant="full" /></div>
        <div className="q-card p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--green)' }} />
              <h2 className="font-syne font-bold text-[16px] mb-2" style={{ color: 'var(--text-1)' }}>
                Check your email
              </h2>
              <p className="text-[12px] mb-4" style={{ color: 'var(--text-3)' }}>
                We sent a password reset link to your email address.
              </p>
              <Link to="/login" className="font-syne font-bold text-[12px]" style={{ color: 'var(--violet-light)' }}>
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" className="flex items-center gap-1 text-[12px] mb-4" style={{ color: 'var(--text-3)' }}>
                <ArrowLeft size={13} /> Back
              </Link>
              <h1 className="font-syne font-bold text-[18px] mb-1" style={{ color: 'var(--text-1)' }}>
                Reset password
              </h1>
              <p className="text-[12px] mb-5" style={{ color: 'var(--text-3)' }}>
                Enter your email and we'll send a reset link.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="q-label">Email</label>
                  <input {...register('email')} type="email" placeholder="you@example.com" className="q-input" />
                  {errors.email && <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.email.message}</p>}
                </div>
                <button type="submit" disabled={loading} className="q-btn-primary w-full h-10 flex items-center justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Reset Password ────────────────────────────────────────────────
const resetSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export function ResetPasswordPage() {
  usePageTitle('Reset Password')
  const navigate   = useNavigate()
  const [loading, setLoading]  = useState(false)
  const [show, setShow]        = useState(false)
  const [success, setSuccess]  = useState(false)

  // Get token from URL query
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const { register, handleSubmit, formState: { errors } } = useForm<{ newPassword: string }>({
    resolver: zodResolver(resetSchema),
  })

  const onSubmit = async (data: { newPassword: string }) => {
    if (!token) { toast.error('Invalid reset link.'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Reset failed.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-page)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo variant="full" /></div>
        <div className="q-card p-6">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--green)' }} />
              <h2 className="font-syne font-bold text-[16px] mb-2" style={{ color: 'var(--text-1)' }}>Password reset!</h2>
              <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Redirecting to login…</p>
            </div>
          ) : (
            <>
              <h1 className="font-syne font-bold text-[18px] mb-1" style={{ color: 'var(--text-1)' }}>New password</h1>
              <p className="text-[12px] mb-5" style={{ color: 'var(--text-3)' }}>Enter your new password below.</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="q-label">New password</label>
                  <div className="relative">
                    <input {...register('newPassword')} type={show ? 'text' : 'password'} placeholder="Min 8 characters" className="q-input pr-10" />
                    <button type="button" onClick={() => setShow((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.newPassword && <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.newPassword.message}</p>}
                </div>
                <button type="submit" disabled={loading} className="q-btn-primary w-full h-10 flex items-center justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Staff Setup ───────────────────────────────────────────────────
const setupSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export function StaffSetupPage() {
  usePageTitle('Setup Account')
  const navigate   = useNavigate()
  const { login }  = useAuthStore()
  const { connect }= useSocketStore()
  const [loading, setLoading]  = useState(false)
  const [show, setShow]        = useState(false)

  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const { register, handleSubmit, formState: { errors } } = useForm<{ newPassword: string }>({
    resolver: zodResolver(setupSchema),
  })

  const onSubmit = async (data: { newPassword: string }) => {
    if (!token) { toast.error('Invalid setup link.'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/staff-setup', { token, newPassword: data.newPassword })
      const { accessToken, refreshToken, user } = res.data.data
      login(accessToken, refreshToken, user)
      connect(accessToken)
      toast.success('Account setup complete! Welcome to Quby.')
      navigate('/staff/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Setup failed.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-page)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo variant="full" /></div>
        <div className="q-card p-6">
          <h1 className="font-syne font-bold text-[18px] mb-1" style={{ color: 'var(--text-1)' }}>Set up your account</h1>
          <p className="text-[12px] mb-5" style={{ color: 'var(--text-3)' }}>
            Create a password to complete your Quby staff account setup.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="q-label">Password</label>
              <div className="relative">
                <input {...register('newPassword')} type={show ? 'text' : 'password'} placeholder="Min 8 characters" className="q-input pr-10" autoComplete="new-password" />
                <button type="button" onClick={() => setShow((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.newPassword && <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.newPassword.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="q-btn-primary w-full h-10 flex items-center justify-center">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Complete setup'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

// ── Suspended ────────────────────────────────────────────────────

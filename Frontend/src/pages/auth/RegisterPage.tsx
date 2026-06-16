import axios from 'axios'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, User, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { StateCitySelect } from '@/components/shared'
import api from '@/lib/axios'
import { usePageTitle } from '@/hooks'

// ── SCHEMA ────────────────────────────────────────────────────────
const baseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  role: z.enum(['CUSTOMER', 'OWNER']),
  username: z.string().optional(),
  phone: z.string().optional(),
})

type RegisterForm = z.infer<typeof baseSchema>

// ── COMPONENT ─────────────────────────────────────────────────────
export default function RegisterPage() {
  usePageTitle('Register')

  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'CUSTOMER' | 'OWNER'>('CUSTOMER')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(baseSchema),
    defaultValues: { role: 'CUSTOMER' },
  })

  const handleRoleChange = (r: 'CUSTOMER' | 'OWNER') => {
    setSelectedRole(r)
    setValue('role', r)
  }

  const onSubmit = async (data: RegisterForm) => {
    if (loading) return

    if (selectedRole === 'CUSTOMER' && !data.username) {
      toast.error('Username is required')
      return
    }

    if (selectedRole === 'OWNER' && !data.phone) {
      toast.error('Phone number is required')
      return
    }

    setLoading(true)

    try {
      const payload = {
        name: data.name,
        email: data.email,
        password: data.password,
        role: selectedRole,
        city,
        state,
        ...(selectedRole === 'CUSTOMER' && { username: data.username }),
        ...(selectedRole === 'OWNER' && { phone: data.phone }),
      }

      await api.post('/auth/register', payload)

      toast.success('Signup successful 🎉 Please login')

      navigate('/login', { replace: true })
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.code === 'ERR_NETWORK') {
        toast.error('Server not running. Please try again.')
        return
      }

      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.message
          : 'Registration failed'

      toast.error(msg || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-4 py-8" style={{ background: 'var(--bg-page)' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-[420px]"
      >
        <div className="flex justify-center mb-7">
          <Logo variant="full" />
        </div>

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
            Create your account
          </h1>

          <p className="text-[13px] mb-6" style={{ color: 'var(--text-2)' }}>
            Start using Quby in seconds
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(['CUSTOMER', 'OWNER'] as const).map((r) => {
              const isActive = selectedRole === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className="h-11 rounded-[9px] font-syne font-bold text-[13px]"
                  style={{
                    background: isActive ? 'var(--violet-bg)' : 'var(--bg-surface)',
                    border: isActive ? '1px solid var(--violet-border)' : '1px solid var(--border)',
                    color: isActive ? 'var(--violet-light)' : 'var(--text-2)'
                  }}
                >
                  {r === 'CUSTOMER' ? 'Customer' : 'Salon Owner'}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                Full name
              </label>
              <input
                {...register('name')}
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
                placeholder="John Doe"
              />
              {errors.name && <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.name.message}</p>}
            </div>

            <div>
              <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                Email
              </label>
              <input
                {...register('email')}
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
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.email.message}</p>}
            </div>

            {selectedRole === 'CUSTOMER' ? (
              <div>
                <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                  Username
                </label>
                <input
                  {...register('username')}
                  key="username"
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
                  placeholder="mayur_123"
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                  Phone
                </label>
                <input
                  {...register('phone')}
                  key="phone"
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
                  placeholder="9876543210"
                />
              </div>
            )}

            {/* State + City */}
            <div>
              <StateCitySelect
                stateValue={state}
                cityValue={city}
                onStateChange={(v) => {
                  setState(v)
                  setValue('state', v)
                }}
                onCityChange={(v) => {
                  setCity(v)
                  setValue('city', v)
                }}
              />
            </div>

            <div>
              <label className="text-[11px] font-syne font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-3)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
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
                  placeholder="••••••••"
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
              {errors.password && <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{errors.password.message}</p>}
            </div>

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
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                selectedRole === 'CUSTOMER'
                  ? 'Create Customer Account'
                  : 'Create Owner Account'
              )}
            </motion.button>
          </form>

          <p className="text-center text-[12px] mt-5" style={{ color: 'var(--text-3)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-syne font-bold" style={{ color: 'var(--violet-light)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

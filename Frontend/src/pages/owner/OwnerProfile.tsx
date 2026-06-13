import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Upload, Camera, AlertTriangle, Trash2, Edit3, Save, X, MapPin, Calendar, Mail, Phone } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { StateCitySelect, Skeleton } from '@/components/shared'
import { useAuthStore } from '@/stores'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { toast } from 'sonner'

const profileSchema = z.object({
  name:          z.string().min(2, 'Min 2 chars').max(100).optional(),
  phone:         z.string().regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile').optional().or(z.literal('')),
  address_line1: z.string().max(200).optional().or(z.literal('')),
  address_line2: z.string().max(200).optional().or(z.literal('')),
})
type ProfileForm = z.infer<typeof profileSchema>

// ✅ Helper: persist owner avatar to localStorage so login() can restore it
function cacheOwnerAvatar(avatar_url: string | null) {
  try {
    localStorage.setItem('quby-owner-profile-v1', JSON.stringify({ state: { avatar_url } }))
  } catch { /* ignore */ }
}

// Profile Edit Modal Component
function ProfileEditModal({
  profile, user, form, errors, state, city, setState, setCity,
  avatarPreview, avatarFile, setAvatarFile, setAvatarPreview, avatarRef, updateMutation, onClose
}: {
  profile: any
  user: any
  form: any
  errors: any
  state: string
  city: string
  setState: (s: string) => void
  setCity: (c: string) => void
  avatarPreview: string | null
  avatarFile: File | null
  setAvatarFile: (f: File | null) => void
  setAvatarPreview: (p: string | null) => void
  avatarRef: React.RefObject<HTMLInputElement>
  updateMutation: any
  onClose: () => void
}) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-[850px] q-card pointer-events-auto flex flex-col"
          style={{ maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden' }}>

          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <h3 className="font-syne font-bold text-[18px]" style={{ color: 'var(--text-1)' }}>Edit Profile</h3>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center font-syne font-bold text-[20px] text-white border-2"
                  style={{ background: 'var(--avatar-gradient)', borderColor: 'var(--violet-border)' }}>
                  {(avatarPreview || profile?.avatar_url || user?.avatar_url)
                    ? <img src={avatarPreview || profile?.avatar_url || user?.avatar_url!} alt={profile?.name ?? user?.name} className="w-full h-full object-cover" />
                    : (profile?.name ?? user?.name ?? '').slice(0,2).toUpperCase()}
                </div>
                <button onClick={() => avatarRef.current?.click()}
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <Camera size={18} color="white" />
                </button>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) }
                }} />
              <div>
                <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Profile Photo</p>
                <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Click to change your avatar</p>
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Basic Info</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="q-label">Full Name</label>
                  <input {...form('name')} className="q-input" placeholder="Your name" />
                  {errors.name && (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{String(errors.name.message)}</p>
                  )}
                </div>
                <div>
                  <label className="q-label">Phone Number</label>
                  <input {...form('phone')} className="q-input" placeholder="10-digit mobile" maxLength={10} />
                  {errors.phone && (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--red)' }}>{String(errors.phone.message)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address Info */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Address</p>
              <div className="space-y-3">
                <div>
                  <label className="q-label">Address Line 1</label>
                  <input {...form('address_line1')} className="q-input" placeholder="Street address" />
                </div>
                <div>
                  <label className="q-label">Address Line 2</label>
                  <input {...form('address_line2')} className="q-input" placeholder="Apartment, suite, etc." />
                </div>
                <StateCitySelect
                  stateValue={state} cityValue={city}
                  onStateChange={setState} onCityChange={setCity} />
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 px-4 py-3 pb-safe" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 h-10 q-btn-ghost text-[12px] font-bold">
                Cancel
              </button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 h-10 rounded-[10px] font-syne font-bold text-[12px] flex items-center justify-center gap-1.5"
                style={{ background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer', opacity: updateMutation.isPending ? 0.7 : 1 }}>
                {updateMutation.isPending
                  ? <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin border-white" />
                  : <><Save size={14} /> Save Changes</>}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default function OwnerProfile() {
  usePageTitle('Profile')
  const ql = useQueryClient()
  const { user, setUser, setUserAvatar } = useAuthStore()
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPrev, setAvatarPrev] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['owner-profile'],
    queryFn: async () => {
      const r = await api.get('/owner/profile')
      const d = r.data.data
      if (d.state) setState(d.state)
      if (d.city) setCity(d.city)
      return d
    },
    staleTime: 5 * 60_000,
  })

  const { register: regP, handleSubmit: hsP, formState: { errors: eP }, reset: resetP } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name,
      phone: profile?.phone || '',
      address_line1: profile?.address_line1 || '',
      address_line2: profile?.address_line2 || '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const fd = new FormData()
      Object.entries(data).forEach(([k, v]) => { if (v) fd.append(k, String(v)) })
      if (state) fd.append('state', state)
      if (city) fd.append('city', city)
      if (avatarFile) fd.append('avatar', avatarFile)
      const res = await api.patch('/owner/profile', fd)
      return res.data.data
    },
    onSuccess: (data) => {
      toast.success('Profile updated.')
      ql.invalidateQueries({ queryKey: ['owner-profile'] })
      if (user) {
        const updatedUser = {
          ...user,
          name: data?.name ?? user.name,
          avatar_url: data?.avatar_url ?? user.avatar_url,
        }
        setUser(updatedUser)
      }
      if (data?.avatar_url !== undefined) {
        setUserAvatar(data.avatar_url)
      }
      if (data?.avatar_url !== undefined) {
        cacheOwnerAvatar(data.avatar_url)
      }
      setAvatarFile(null)
      setAvatarPrev(null)
      setShowEditModal(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Update failed.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (password: string) => api.delete('/owner/account', { data: { password } }),
    onSuccess: () => {
      toast.success('Account deleted successfully')
      window.location.href = '/login'
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Deletion failed.'),
  })

  const displayAvatar = avatarPrev ?? profile?.avatar_url ?? user?.avatar_url ?? null

  if (isLoading) return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-7xl mx-auto space-y-5" style={{ background: 'var(--bg-page)' }}>
      {[100, 200, 180].map((h, i) => <div key={i} className="q-card animate-pulse skeleton" style={{ height: h }} />)}
    </div>
  )

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-7xl mx-auto space-y-5" style={{ background: 'var(--bg-page)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-bold text-[18px]" style={{ color: 'var(--text-1)' }}>Profile</h1>
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Manage your personal information and account settings</p>
        </div>
      </div>

      {/* Top row: Profile Hero + Personal Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* ── LEFT: Hero profile card (35%) ── */}
        <div className="lg:col-span-4 space-y-4 h-full">

          {/* Hero card */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="q-card p-5 relative overflow-hidden h-full flex flex-col"
            style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(124,58,237,0.05) 100%)' }}>
            {/* Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(circle, var(--violet) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />

            {/* Avatar */}
            <div className="relative w-28 h-28 mx-auto mb-4">
              <div className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center font-syne font-bold text-[28px] text-white border-2"
                style={{ background: 'var(--avatar-gradient)', borderColor: 'var(--violet-border)', boxShadow: '0 0 30px rgba(124,58,237,0.35)' }}>
                {displayAvatar
                  ? <img src={displayAvatar} alt={profile?.name ?? user?.name} className="w-full h-full object-cover" />
                  : (profile?.name ?? user?.name ?? '').slice(0,2).toUpperCase()}
              </div>
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)]"
                style={{ background: 'var(--green)' }} />
            </div>

            <div className="text-center relative z-10">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>{profile?.name ?? user?.name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-full text-[9px] font-syne font-bold uppercase tracking-wide"
                  style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                  Business Owner
                </span>
                {profile?.city && profile?.state && (
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    📍 {profile.city}, {profile.state}
                  </span>
                )}
              </div>
            </div>

            {/* Member since */}
            {profile?.join_date && (
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  Member since {new Date(profile.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT: Personal Info (65%) ── */}
        <div className="lg:col-span-8 space-y-4">

          {/* Personal Info */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="q-card p-4 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-[7px]" style={{ background: 'var(--violet-bg)' }}>
                  <Edit3 size={13} style={{ color: 'var(--violet-light)' }} />
                </div>
                <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Personal Information</p>
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowEditModal(true)}
                className="q-btn-primary h-9 px-4 text-[12px] flex items-center gap-1.5">
                <Edit3 size={12} /> Edit
              </motion.button>
            </div>

            {/* View mode - 2-column layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
              {[
                { label: 'Email', val: user?.email || 'N/A', icon: <Mail size={12} /> },
                { label: 'Phone', val: profile?.phone || 'N/A', icon: <Phone size={12} /> },
                { label: 'Address', val: profile?.address_line1 || 'N/A', icon: <MapPin size={12} /> },
                { label: 'City', val: profile?.city || 'N/A', icon: <MapPin size={12} /> },
                { label: 'State', val: profile?.state || 'N/A', icon: <MapPin size={12} /> },
                { label: 'Joined', val: profile?.join_date ? new Date(profile.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A', icon: <Calendar size={12} /> },
              ].map(({ label, val, icon }) => (
                <div key={label} className="flex items-start gap-3 py-2 px-1 border-b hover:bg-[var(--bg-surface)] transition-colors rounded-[6px]"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-3)' }}>{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
                    <p className="text-[13px] font-medium mt-0.5 truncate" style={{ color: 'var(--text-1)' }}>{val}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Full width sections */}
      <div className="space-y-5">
        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="q-card p-4">
          <div className="flex items-center gap-2 mb-3 p-3 rounded-[9px]"
            style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
            <div>
              <p className="font-syne font-bold text-[12px]" style={{ color: 'var(--red)' }}>Danger Zone</p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>These actions are permanent</p>
            </div>
          </div>
          <div className="space-y-2">
            <button className="w-full h-10 text-[12px] font-syne font-bold rounded-[9px] flex items-center justify-center gap-2"
              style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}
              onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={13} /> Delete Account
            </button>
          </div>
        </motion.div>
      </div>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <ProfileEditModal
            profile={profile}
            user={user}
            form={regP}
            errors={eP}
            state={state}
            city={city}
            setState={setState}
            setCity={setCity}
            avatarPreview={avatarPrev}
            avatarFile={avatarFile}
            setAvatarFile={setAvatarFile}
            setAvatarPreview={setAvatarPrev}
            avatarRef={avatarRef}
            updateMutation={updateMutation}
            onClose={() => {
              setShowEditModal(false)
              setAvatarFile(null)
              setAvatarPrev(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
              onClick={() => setShowDeleteConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative w-full max-w-sm q-card p-5 z-10"
              style={{ borderTopWidth: 3, borderTopColor: 'var(--red)' }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-[10px]" style={{ background: 'var(--red-bg)' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
                </div>
                <div>
                  <p className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>Delete Account</p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-2)' }}>
                    This action is permanent and cannot be undone. All your data will be deleted.
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <label className="q-label">Enter your password to confirm</label>
                <input type="password" className="q-input" placeholder="Your password"
                  value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 q-btn-ghost h-10 text-[12px]">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }}
                  disabled={!deletePassword || deleteMutation.isPending}
                  onClick={() => { if (deletePassword) deleteMutation.mutate(deletePassword) }}
                  className="flex-1 h-10 rounded-[9px] font-syne font-bold text-[12px] flex items-center justify-center gap-2"
                  style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', opacity: !deletePassword ? 0.5 : 1 }}>
                  {deleteMutation.isPending ? <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> : <><Trash2 size={13} /> Delete</>}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}







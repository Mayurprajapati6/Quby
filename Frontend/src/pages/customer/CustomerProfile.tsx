import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Loader2, Trash2, LogOut, User, Phone, MapPin, ChevronDown, Check, Edit3, Save, X, Mail, Calendar, AlertTriangle } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { ConfirmDialog } from '@/components/shared'
import { useAuthStore } from '@/stores'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { INDIA_STATES, getCitiesForState } from '@/data/india'

/* ─── Gender selector ──────────────────────────────────────────── */
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

function GenderSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="q-input flex items-center justify-between w-full text-left"
        style={{ cursor: 'pointer' }}
      >
        <span style={{ color: value ? 'var(--text-1)' : 'var(--text-3)' }}>{value || 'Select gender'}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          {GENDERS.map(g => (
            <div
              key={g}
              onClick={() => { onChange(g); setOpen(false) }}
              className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
              style={{
                color: value === g ? 'var(--violet-light)' : 'var(--text-2)',
                background: value === g ? 'var(--violet-bg)' : 'transparent',
                fontSize: 14,
              }}
            >
              {g}
              {value === g && <Check size={14} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Select component ─────────────────────────────────────────── */
function SelectField({ label, value, options, onChange, disabled, placeholder }: {
  label: string; value: string; options: string[]
  onChange: (v: string) => void; disabled?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="q-label">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="q-input"
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', appearance: 'none' }}
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════ */
/*  CUSTOMER PROFILE                                               */
/* ════════════════════════════════════════════════════════════════ */

// Profile Edit Modal Component
function ProfileEditModal({
  profile, user, name, phone, gender, state, city, address1, address2,
  setName, setPhone, setGender, setState, setCity, setAddress1, setAddress2,
  avatarPreview, avatarFile, setAvatarFile, setAvatarPreview, avatarRef, updateMutation, onClose
}: {
  profile: any
  user: any
  name: string
  phone: string
  gender: string
  state: string
  city: string
  address1: string
  address2: string
  setName: (s: string) => void
  setPhone: (s: string) => void
  setGender: (s: string) => void
  setState: (s: string) => void
  setCity: (s: string) => void
  setAddress1: (s: string) => void
  setAddress2: (s: string) => void
  avatarPreview: string | null
  avatarFile: File | null
  setAvatarFile: (f: File | null) => void
  setAvatarPreview: (p: string | null) => void
  avatarRef: React.RefObject<HTMLInputElement>
  updateMutation: any
  onClose: () => void
}) {
  const cities = getCitiesForState(state)

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
                    : (profile?.name ?? user?.name ?? '').charAt(0).toUpperCase()}
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
                  <input value={name} onChange={e => setName(e.target.value)} className="q-input" placeholder="Your name" />
                </div>
                <div>
                  <label className="q-label">Phone Number</label>
                  <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className="q-input" placeholder="10-digit mobile" type="tel" />
                </div>
                <div>
                  <label className="q-label">Gender</label>
                  <GenderSelect value={gender} onChange={setGender} />
                </div>
                <div>
                  <label className="q-label">Email</label>
                  <input value={profile?.email ?? user?.email ?? ''} readOnly className="q-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>

            {/* Address Info */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Address</p>
              <div className="space-y-3">
                <div>
                  <label className="q-label">Address Line 1</label>
                  <input value={address1} onChange={e => setAddress1(e.target.value)} className="q-input" placeholder="Street address" />
                </div>
                <div>
                  <label className="q-label">Address Line 2</label>
                  <input value={address2} onChange={e => setAddress2(e.target.value)} className="q-input" placeholder="Apartment, suite, etc." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="State"
                    value={state}
                    options={INDIA_STATES}
                    onChange={v => { setState(v); setCity('') }}
                    placeholder="Select state"
                  />
                  <SelectField
                    label="City"
                    value={city}
                    options={cities}
                    onChange={setCity}
                    disabled={!state}
                    placeholder={state ? 'Select city' : 'Select state first'}
                  />
                </div>
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

export default function CustomerProfile() {
  usePageTitle('My Profile')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, logout, setUser, setUserAvatar } = useAuthStore()

  // Form state – mirrors backend UpdateCustomerProfileDTO
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [gender, setGender] = useState('')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')

  const [showEditModal, setShowEditModal] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deletePass, setDeletePass] = useState('')
  const avatarRef = useRef<HTMLInputElement>(null)

  const cities = getCitiesForState(state)

  // Load profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: async () => {
      const r = await api.get('/customer/profile')
      return r.data.data
    },
    staleTime: 5 * 60_000,
  })

  // Populate form when profile loads
  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? '')
    setPhone(profile.phone ?? '')
    setCity(profile.city ?? '')
    setState(profile.state ?? '')
    setGender(profile.gender ?? '')
    setAddress1(profile.address_line1 ?? '')
    setAddress2(profile.address_line2 ?? '')
  }, [profile])

  // Update profile
  const updateMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (name) fd.append('name', name)
      if (phone) fd.append('phone', phone)
      if (city) fd.append('city', city)
      if (state) fd.append('state', state)
      if (gender) fd.append('gender', gender)
      if (address1) fd.append('address_line1', address1)
      if (address2) fd.append('address_line2', address2)
      if (avatarFile) fd.append('image', avatarFile)
      const res = await api.patch('/customer/profile', fd)
      return res.data.data
    },
    onSuccess: (data) => {
      toast.success('Profile updated successfully.')
      qc.invalidateQueries({ queryKey: ['customer-profile'] })
      if (user) {
        setUser({
          ...user,
          name: name || user.name,
          avatar_url: data?.avatar_url ?? user.avatar_url,
        })
      }
      if (data?.avatar_url !== undefined) setUserAvatar(data.avatar_url)
      setAvatarFile(null)
      setAvatarPreview(null)
      setShowEditModal(false)
    },
    onError: (err: unknown) =>
      toast.error((err as any)?.response?.data?.message ?? 'Update failed.'),
  })

  // Delete account
  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/customer/account', { data: { password: deletePass } }),
    onSuccess: () => {
      toast.success('Account deleted. Goodbye!')
      logout()
      navigate('/login')
    },
    onError: (err: unknown) =>
      toast.error((err as any)?.response?.data?.message ?? 'Failed to delete account.'),
  })

  // Logout
  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('quby_refresh_token')
      if (rt) await api.post('/customer/logout', { refresh_token: rt }).catch(() => {})
    } finally {
      logout()
      navigate('/login')
    }
  }

  const displayAvatar = avatarPreview ?? profile?.avatar_url ?? user?.avatar_url
  const displayName   = profile?.name ?? user?.name ?? ''

  if (isLoading) return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-5" style={{ background: 'var(--bg-page)' }}>
      {[100, 200, 180].map((h, i) => <div key={i} className="q-card animate-pulse skeleton" style={{ height: h }} />)}
    </div>
  )

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-5" style={{ background: 'var(--bg-page)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-bold text-[18px]" style={{ color: 'var(--text-1)' }}>My Profile</h1>
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
                  ? <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                  : displayName.charAt(0).toUpperCase()}
              </div>
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)]"
                style={{ background: 'var(--green)' }} />
            </div>

            <div className="text-center relative z-10">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>{displayName}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>@{profile?.username || user?.email}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-full text-[9px] font-syne font-bold uppercase tracking-wide"
                  style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                  Customer
                </span>
                {profile?.city && profile?.state && (
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    📍 {profile.city}, {profile.state}
                  </span>
                )}
              </div>
            </div>

            {/* Member since */}
            {(profile?.join_date || profile?.joined_at || profile?.created_at) && (
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
                { label: 'Email', val: profile?.email || user?.email || 'N/A', icon: <Mail size={12} /> },
                { label: 'Phone', val: profile?.phone || 'N/A', icon: <Phone size={12} /> },
                { label: 'Gender', val: profile?.gender || 'N/A', icon: <User size={12} /> },
                { label: 'State', val: profile?.state || 'N/A', icon: <MapPin size={12} /> },
                { label: 'City', val: profile?.city || 'N/A', icon: <MapPin size={12} /> },
                { label: 'Address', val: profile?.address_line1 || 'N/A', icon: <MapPin size={12} /> },
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
        {/* Account Actions */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="q-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-[7px]" style={{ background: 'var(--bg-surface)' }}>
              <LogOut size={13} style={{ color: 'var(--text-3)' }} />
            </div>
            <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Account Actions</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={handleLogout} className="h-10 text-[12px] font-syne font-bold rounded-[9px] flex items-center justify-center gap-2"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <LogOut size={13} /> Logout
            </button>
            <button onClick={() => setShowDelete(true)} className="h-10 text-[12px] font-syne font-bold rounded-[9px] flex items-center justify-center gap-2"
              style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}>
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
            name={name}
            phone={phone}
            gender={gender}
            state={state}
            city={city}
            address1={address1}
            address2={address2}
            setName={setName}
            setPhone={setPhone}
            setGender={setGender}
            setState={setState}
            setCity={setCity}
            setAddress1={setAddress1}
            setAddress2={setAddress2}
            avatarPreview={avatarPreview}
            avatarFile={avatarFile}
            setAvatarFile={setAvatarFile}
            setAvatarPreview={setAvatarPreview}
            avatarRef={avatarRef}
            updateMutation={updateMutation}
            onClose={() => {
              setShowEditModal(false)
              setAvatarFile(null)
              setAvatarPreview(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete account dialog */}
      <ConfirmDialog
        open={showDelete}
        title="Delete account?"
        danger
        description="This permanently deletes your account and all data. This cannot be undone. Only confirm if you're absolutely sure."
        confirmLabel="Delete my account"
        onCancel={() => { setShowDelete(false); setDeletePass('') }}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      >
        <div>
          <label className="q-label">Enter your password to confirm</label>
          <input
            type="password"
            value={deletePass}
            onChange={e => setDeletePass(e.target.value)}
            className="q-input"
            placeholder="Your password"
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}

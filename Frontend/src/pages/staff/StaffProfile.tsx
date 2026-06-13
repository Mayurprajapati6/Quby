import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { usePageTitle } from '@/hooks'
import { useAuthStore } from '@/stores'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  Edit3, Save, X, Camera as CameraIcon, Shield, ShieldOff,
  Mail, Phone, MapPin, Briefcase, Calendar, Star, AlertTriangle, Lock, Trash2
} from 'lucide-react'
import { useCameraStore } from '@/lib/cameraStore'

// ── Persisted store — changes survive page navigation until account deletion ──
interface PersistedProfile {
  id: string; name: string; email: string; phone: string | null
  avatar_url: string | null; bio: string | null
  specialization: string | null; experience_years: number | null
  city: string | null; state: string | null
  is_active: boolean; is_verified: boolean
  average_rating: number; total_reviews: number
  current_streak: number; longest_streak: number; join_date: string
  business: { id: string; business_name: string; logo_url: string | null; owner_name: string | null; owner_phone: string | null; owner_avatar: string | null }
  services: Array<{ id: string; name: string; category: string | null; image_url: string | null; price: number | null; discounted_price: number | null; duration_minutes: number; is_available: boolean }>
  schedule: Array<{ day_of_week: string; is_available: boolean; start_time: string | null; end_time: string | null }>
}

export const useProfileStore = create<{
  profile: PersistedProfile | null
  setProfile: (p: PersistedProfile) => void
  clearProfile: () => void
}>()(persist(
  set => ({
    profile: null,
    setProfile: p => set({ profile: p }),
    clearProfile: () => set({ profile: null }),
  }),
  { name: 'quby-staff-profile-v3', storage: createJSONStorage(() => localStorage) }  // v3: added image_url, price, discounted_price to services
))

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']
const DAY_SHORT: Record<string, string> = {
  MONDAY:'Mon', TUESDAY:'Tue', WEDNESDAY:'Wed', THURSDAY:'Thu', FRIDAY:'Fri', SATURDAY:'Sat', SUNDAY:'Sun'
}

// Profile Edit Modal Component
function ProfileEditModal({
  profile, form, setForm, avatarPreview, avatarFile, setAvatarFile, setAvatarPreview, avatarRef, updateMutation, onClose
}: {
  profile: PersistedProfile
  form: any
  setForm: (f: any) => void
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
        <div className="relative w-full max-w-[900px] q-card pointer-events-auto flex flex-col"
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
                  {(avatarPreview || profile.avatar_url)
                    ? <img src={avatarPreview || profile.avatar_url!} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.slice(0,2).toUpperCase()}
                </div>
                <button onClick={() => avatarRef.current?.click()}
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <CameraIcon size={18} color="white" />
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
                  <input type="text" className="q-input"
                    value={form.name}
                    onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="q-label">Phone Number</label>
                  <input type="tel" className="q-input"
                    value={form.phone}
                    onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Professional Info</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="q-label">Experience (years)</label>
                  <input type="number" className="q-input"
                    value={form.experience_years}
                    onChange={e => setForm((p: any) => ({ ...p, experience_years: e.target.value }))} />
                </div>
                <div>
                  <label className="q-label">City</label>
                  <input type="text" className="q-input"
                    value={form.city}
                    onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <label className="q-label">State</label>
                  <input type="text" className="q-input"
                    value={form.state}
                    onChange={e => setForm((p: any) => ({ ...p, state: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Specialization — read only */}
            <div className="p-3 rounded-[9px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                Specialization (set by owner — read only)
              </p>
              <p className="text-[13px] font-medium" style={{ color: 'var(--violet-light)' }}>{profile.specialization || 'Not set'}</p>
            </div>

            {/* Bio */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Bio</p>
              <textarea className="q-input" rows={3} value={form.bio}
                onChange={e => setForm((p: any) => ({ ...p, bio: e.target.value }))}
                placeholder="Brief professional bio..." />
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

// Service emoji helper
// ── Staff Service Card ────────────────────────────────────────────
// ── Profile Service Card (proper component so hooks work) ────────
function ProfileServiceCard({ svc, index }: { svc: any; index: number }) {
  const [imgErr, setImgErr] = useState(false)
  const hasImg = !!(svc.image_url && !imgErr)
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-[13px]"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', height: '72px' }}>
      {/* Real service image from admin — no random */}
      <div className="w-14 h-14 rounded-[10px] overflow-hidden flex-shrink-0"
        style={{ background: 'var(--violet-bg)', border: '1px solid var(--border)' }}>
        {hasImg ? (
          <img src={svc.image_url} alt={svc.name} onError={() => setImgErr(true)}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[24px]">
            {svcEmoji(svc.category)}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>{svc.name}</p>
      </div>
      {/* Duration pill — inline so "30 min" and "15 min" look identical */}
      {svc.duration_minutes > 0 && (
        <div className="flex items-center gap-1 px-2.5 h-8 rounded-[9px] flex-shrink-0"
          style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
          <span className="font-syne font-black text-[14px] tabular-nums" style={{ color: 'var(--violet-light)', lineHeight: 1 }}>{svc.duration_minutes}</span>
          <span className="font-syne font-bold text-[10px]" style={{ color: 'var(--text-3)', lineHeight: 1 }}>min</span>
        </div>
      )}
    </motion.div>
  )
}

function StaffServiceCard({ svc, index }: { svc: any; index: number }) {
  const [imgErr, setImgErr] = useState(false)
  const hasImg = svc.image_url && !imgErr

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-[12px]"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {/* Service image or emoji fallback */}
      {hasImg ? (
        <img src={svc.image_url} alt={svc.name} onError={() => setImgErr(true)}
          className="w-11 h-11 rounded-[10px] object-cover flex-shrink-0"
          style={{ border: '1px solid var(--border)' }} />
      ) : (
        <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[20px] flex-shrink-0"
          style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
          {svcEmoji(svc.category)}
        </div>
      )}
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>{svc.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {svc.duration_minutes > 0 && (
            <span className="text-[10px] font-syne font-bold flex items-center gap-0.5" style={{ color: 'var(--violet-light)' }}>
              ⏱ {svc.duration_minutes} min
            </span>
          )}
          {svc.category && (
            <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>{svc.category}</span>
          )}
        </div>
      </div>
      {/* Price + status */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {(svc.price || svc.discounted_price) && (
          <div className="text-right">
            {svc.discounted_price ? (
              <>
                <span className="font-syne font-black text-[13px]" style={{ color: 'var(--green)' }}>₹{svc.discounted_price}</span>
                <span className="text-[10px] line-through ml-1 opacity-50" style={{ color: 'var(--text-3)' }}>₹{svc.price}</span>
              </>
            ) : (
              <span className="font-syne font-black text-[13px]" style={{ color: 'var(--green)' }}>₹{svc.price}</span>
            )}
          </div>
        )}
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-syne font-bold"
          style={{
            background: svc.is_available ? 'var(--green-bg)' : 'rgba(100,100,100,0.1)',
            color: svc.is_available ? 'var(--green)' : 'var(--text-4)',
          }}>
          {svc.is_available ? '● Active' : '○ Inactive'}
        </span>
      </div>
    </motion.div>
  )
}

function svcEmoji(cat?: string | null) {
  if (!cat) return '✂️'
  const c = cat.toLowerCase()
  if (c.includes('hair')) return '💇'
  if (c.includes('nail')) return '💅'
  if (c.includes('beard')) return '🪒'
  if (c.includes('colour') || c.includes('color')) return '🎨'
  if (c.includes('treatment')) return '✨'
  if (c.includes('styling')) return '💁'
  return '✂️'
}

export default function StaffProfile() {
  usePageTitle('Profile')
  const qc = useQueryClient()
  const setUserAvatar = useAuthStore(s => s.setUserAvatar)
  const { profile: cached, setProfile, clearProfile } = useProfileStore()
  const { permissionGranted, setPermissionGranted } = useCameraStore()

  const [isEditing,     setIsEditing]     = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string|null>(null)
  const [avatarFile,    setAvatarFile]    = useState<File|null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [confirmCameraAction, setConfirmCameraAction] = useState<'enable' | 'disable' | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '', phone: '', bio: '', experience_years: '', city: '', state: '',
  })

  const { data: fetched, isLoading } = useQuery<PersistedProfile>({
    queryKey: ['staff-profile'],
    queryFn: async () => { const r = await api.get('/staff/profile'); return r.data.data },
    staleTime: 0,         // ✅ always fetch fresh — services/schedule assigned by owner must show immediately
    gcTime: 5 * 60_000,  // keep in memory 5 min but always revalidate
  })

  useEffect(() => { if (fetched) setProfile(fetched) }, [fetched, setProfile])
  // ✅ use fetched data; fall back to cache only while loading
  const profile = fetched ?? (isLoading ? cached : null)

  useEffect(() => {
    if (profile && !isEditing) {
      setForm({
        name:             profile.name             ?? '',
        phone:            profile.phone            ?? '',
        bio:              profile.bio              ?? '',
        experience_years: String(profile.experience_years ?? ''),
        city:             profile.city             ?? '',
        state:            profile.state            ?? '',
      })
    }
  }, [profile?.id, isEditing])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => { if (v.trim()) fd.append(k, v) })
      if (avatarFile) fd.append('avatar', avatarFile)
      const r = await api.patch('/staff/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      return r.data.data as PersistedProfile
    },
    onSuccess: updated => {
      setProfile(updated)
      qc.setQueryData(['staff-profile'], updated)
      if (updated.avatar_url) setUserAvatar(updated.avatar_url)
      setIsEditing(false); setAvatarFile(null); setAvatarPreview(null)
      toast.success('Profile saved!')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (password: string) => api.delete('/staff/account', { data: { password } }),
    onSuccess: () => { clearProfile(); window.location.href = '/login' },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Deletion failed'),
  })

  if (isLoading && !profile) {
    return (
      <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-7xl mx-auto space-y-4" style={{ background: 'var(--bg-page)' }}>
        {[100, 200, 180].map((h, i) => <div key={i} className="q-card animate-pulse skeleton" style={{ height: h }} />)}
      </div>
    )
  }
  if (!profile) return null

  const avatarSrc = avatarPreview ?? profile.avatar_url

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-7xl mx-auto space-y-5" style={{ background: 'var(--bg-page)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-bold text-[18px]" style={{ color: 'var(--text-1)' }}>Profile</h1>
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Manage your personal information, services and preferences</p>
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
                {avatarSrc
                  ? <img src={avatarSrc} alt={profile.name} className="w-full h-full object-cover" />
                  : profile.name.slice(0,2).toUpperCase()}
              </div>
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)]"
                style={{ background: profile.is_active ? 'var(--green)' : 'var(--red)' }} />
            </div>

            <div className="text-center relative z-10">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>{profile.name}</p>
              {profile.specialization && (
                <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--violet-light)' }}>{profile.specialization}</p>
              )}
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{profile.business.business_name}</p>
            </div>

            {/* KPI grid - 2 columns, 72px height */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                { label: 'Rating', val: profile.average_rating.toFixed(1), col: 'var(--yellow)', bg: 'rgba(245,158,11,0.1)' },
                { label: 'Reviews', val: profile.total_reviews, col: 'var(--text-1)', bg: 'var(--bg-surface)' },
              ].map(({ label, val, col, bg }) => (
                <div key={label} className="text-center p-3 rounded-[10px]" style={{ background: bg, height: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                  <p className="font-syne font-bold text-[18px]" style={{ color: col }}>{val}</p>
                </div>
              ))}
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
                { label: 'Email', val: profile.email || 'N/A', icon: <Mail size={12} /> },
                { label: 'Phone', val: profile.phone || 'N/A', icon: <Phone size={12} /> },
                { label: 'Experience', val: profile.experience_years ? `${profile.experience_years} years` : 'N/A', icon: <Briefcase size={12} /> },
                { label: 'Location', val: [profile.city, profile.state].filter(Boolean).join(', ') || 'N/A', icon: <MapPin size={12} /> },
                { label: 'Business', val: profile.business.business_name || 'N/A', icon: <Briefcase size={12} /> },
                { label: 'Joined', val: new Date(profile.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), icon: <Calendar size={12} /> },
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
              <div className="flex items-start gap-3 py-2 px-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-3)' }}><Star size={12} /></span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Specialization</p>
                  <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--violet-light)' }}>{profile.specialization || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-2 px-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="mt-0.5 flex-shrink-0" style={{ color: profile.is_active ? 'var(--green)' : 'var(--red)' }}>●</span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Status</p>
                  <p className="text-[13px] font-medium mt-0.5" style={{ color: profile.is_active ? 'var(--green)' : 'var(--red)' }}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
            {profile.bio && (
              <div className="pt-2 px-1">
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>Bio</p>
                <p className="text-[13px]" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{profile.bio}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Full width sections */}
      <div className="space-y-5">
        {/* Services */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="q-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: 'var(--violet-bg)' }}>
                <span style={{ fontSize: 16 }}>✂️</span>
              </div>
              <div>
                <p className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>My Services</p>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {profile.services.length > 0 ? `${profile.services.length} assigned` : 'None assigned yet'}
                </p>
              </div>
            </div>
            <span className="text-[9px] px-2.5 py-1 rounded-full font-syne font-bold uppercase tracking-wide"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-4)', border: '1px solid var(--border)' }}>
              Managed by owner
            </span>
          </div>

          {profile.services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-[18px] flex items-center justify-center text-[32px]"
                style={{ background: 'var(--bg-surface)', border: '2px dashed var(--border-2)' }}>✂️</div>
              <div className="text-center">
                <p className="font-syne font-bold text-[13px]" style={{ color: 'var(--text-3)' }}>No services assigned yet</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-4)' }}>Your owner will assign services to you</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {profile.services.map((svc, i) => (
                <ProfileServiceCard key={svc.id} svc={svc} index={i} />
              ))}
            </div>
          )}
        </motion.div>

        {/* Weekly Schedule */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="q-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-[7px]" style={{ background: 'var(--blue-bg)' }}>
                <Calendar size={13} style={{ color: 'var(--blue)' }} />
              </div>
              <div>
                <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Weekly Schedule</p>
                {profile.schedule.length > 0 && (
                  <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    {profile.schedule.filter(s => s.is_available).length} working days
                  </p>
                )}
              </div>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full font-syne font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              Set by owner
            </span>
          </div>

          {profile.schedule.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-[14px] flex items-center justify-center text-[28px] mx-auto mb-3"
                style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-2)' }}>📅</div>
              <p className="text-[13px] font-syne font-bold" style={{ color: 'var(--text-3)' }}>No schedule set yet</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-4)' }}>Your owner will configure your working hours</p>
            </div>
          ) : (() => {
            const todayDow = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][new Date().getDay()]
            return (
              <div className="space-y-1">
                {/* Header row */}
                <div className="flex items-center px-3 pb-2 mb-1 gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
                  <span className="w-20 text-[9px] font-syne font-bold uppercase tracking-widest flex-shrink-0" style={{ color:'var(--text-3)' }}>Day</span>
                  <span className="flex-1 text-[9px] font-syne font-bold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Start</span>
                  <span className="flex-1 text-[9px] font-syne font-bold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>End</span>
                  <span className="w-20 text-[9px] font-syne font-bold uppercase tracking-widest text-right" style={{ color:'var(--text-3)' }}>Status</span>
                </div>
                {DAYS.map(day => {
                  const sched = profile.schedule.find(s => s.day_of_week === day)
                  const on = sched?.is_available ?? false
                  const isToday = day === todayDow
                  return (
                    <div key={day}
                      className="flex items-center gap-2 px-3 py-2 rounded-[11px]"
                      style={{
                        background: isToday
                          ? 'linear-gradient(135deg,rgba(124,58,237,0.18),rgba(99,102,241,0.1))'
                          : on ? 'var(--bg-surface)' : 'rgba(239,68,68,0.04)',
                        border: isToday
                          ? '1px solid var(--violet-border)'
                          : on ? '1px solid var(--border)' : '1px solid rgba(239,68,68,0.12)',
                        height: '52px',
                      }}>
                      {/* Day — fixed width, TODAY on its own line below */}
                      <div className="w-20 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: isToday ? 'var(--violet-light)' : on ? 'var(--green)' : '#f87171', opacity: isToday ? 1 : 0.7 }} />
                          <span className="font-syne font-bold text-[13px]"
                            style={{ color: isToday ? 'var(--violet-light)' : on ? 'var(--text-1)' : 'var(--text-3)' }}>
                            {DAY_SHORT[day]}
                          </span>
                        </div>
                        {isToday && (
                          <span className="inline-block mt-0.5 text-[7px] px-1.5 py-0.5 rounded font-syne font-black"
                            style={{ background:'var(--violet)', color:'#fff', letterSpacing:'0.05em' }}>TODAY</span>
                        )}
                      </div>
                      {/* Start */}
                      <span className="flex-1 font-syne font-bold text-[12px] tabular-nums"
                        style={{ color: !on ? 'var(--text-4)' : isToday ? 'var(--green)' : 'var(--text-2)' }}>
                        {on && sched?.start_time ? sched.start_time : '—'}
                      </span>
                      {/* End */}
                      <span className="flex-1 font-syne font-bold text-[12px] tabular-nums"
                        style={{ color: !on ? 'var(--text-4)' : isToday ? 'var(--green)' : 'var(--text-2)' }}>
                        {on && sched?.end_time ? sched.end_time : '—'}
                      </span>
                      {/* Status badge */}
                      <div className="w-20 flex justify-end">
                        <span className="text-[9px] px-2 py-1 rounded-full font-syne font-bold whitespace-nowrap"
                          style={{
                            background: on ? 'var(--green-bg)' : 'rgba(239,68,68,0.1)',
                            color: on ? 'var(--green)' : '#f87171',
                            border: `1px solid ${on ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                          {on ? '● Working' : '○ Off'}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {/* Today's shift summary */}
                {(() => {
                  const todaySched = profile.schedule.find(s => s.day_of_week === todayDow)
                  if (!todaySched?.is_available) return null
                  return (
                    <div className="flex items-center gap-3 mt-2 p-3 rounded-[10px]"
                      style={{ background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)' }}>
                      <span className="text-[18px]">⏰</span>
                      <div>
                        <p className="text-[10px] font-syne font-bold uppercase tracking-wide" style={{ color:'var(--green)' }}>Today's Shift</p>
                        <p className="font-syne font-black text-[14px]" style={{ color:'var(--text-1)' }}>
                          {todaySched.start_time} – {todaySched.end_time}
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
        </motion.div>

        {/* Camera Permission */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="q-card p-4">
          <p className="text-[10px] font-syne font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
            📷 Camera Permission
          </p>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>QR Scanner Camera</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {permissionGranted ? 'Camera access is enabled' : 'Camera access is disabled'}
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => setConfirmCameraAction(permissionGranted ? 'disable' : 'enable')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: permissionGranted ? 'var(--green-bg)' : 'var(--bg-surface)',
                color: permissionGranted ? 'var(--green)' : 'var(--text-3)',
                border: `1px solid ${permissionGranted ? 'var(--green-border)' : 'var(--border)'}`,
              }}>
              {permissionGranted ? <><Shield size={11} /> On</> : <><ShieldOff size={11} /> Off</>}
            </motion.button>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-3)', lineHeight: 1.5 }}>
            Once enabled, the camera starts automatically on the Scan page — no repeated prompts until you turn it off here.
          </p>
        </motion.div>

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
            <button className="w-full q-btn-ghost h-10 text-[12px] flex items-center justify-center gap-2"
              onClick={() => toast.info('Use the password reset flow from the login page')}>
              <Lock size={13} /> Change Password
            </button>
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
            form={form}
            setForm={setForm}
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

      {/* Camera permission confirm modal */}
      <AnimatePresence>
        {confirmCameraAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              onClick={() => setConfirmCameraAction(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative w-full max-w-xs q-card p-5 z-10 text-center"
              style={{ borderTopWidth: 3, borderTopColor: confirmCameraAction === 'enable' ? 'var(--green)' : 'var(--yellow)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: confirmCameraAction === 'enable' ? 'var(--green-bg)' : 'rgba(245,158,11,0.1)' }}>
                <span style={{ fontSize: 24 }}>{confirmCameraAction === 'enable' ? '📷' : '🚫'}</span>
              </div>
              <p className="font-syne font-bold text-[16px] mb-1" style={{ color: 'var(--text-1)' }}>
                {confirmCameraAction === 'enable' ? 'Enable Camera Access?' : 'Disable Camera Access?'}
              </p>
              <p className="text-[12px] mb-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
                {confirmCameraAction === 'enable'
                  ? 'The camera will auto-start when you visit the Scan QR page. You can turn it off anytime.'
                  : 'Camera will be disabled. You can still use manual QR entry on the Scan page.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmCameraAction(null)} className="flex-1 q-btn-ghost h-9 text-[12px]">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setPermissionGranted(confirmCameraAction === 'enable')
                    toast.success(confirmCameraAction === 'enable' ? '📷 Camera enabled — will auto-start on Scan page' : 'Camera disabled')
                    setConfirmCameraAction(null)
                  }}
                  className="flex-1 h-9 rounded-[9px] font-syne font-bold text-[12px] flex items-center justify-center"
                  style={{
                    background: confirmCameraAction === 'enable' ? 'var(--green)' : 'rgba(245,158,11,0.8)',
                    color: '#fff', border: 'none', cursor: 'pointer'
                  }}>
                  {confirmCameraAction === 'enable' ? 'Enable' : 'Disable'}
                </motion.button>
              </div>
            </motion.div>
          </div>
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

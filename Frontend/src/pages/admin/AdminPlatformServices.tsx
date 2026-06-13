import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Edit2, Loader2, X, Upload,
  Power, Scissors, Camera, Check, Save,
  Phone, MapPin, User as UserIcon, LogOut,
  Edit3, Mail, Calendar, Shield, AlertTriangle,
} from 'lucide-react'
import { EmptyState, Skeleton, ConfirmDialog, StateCitySelect } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore } from '@/stores'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { toast } from 'sonner'
import type { PlatformServiceDTO } from '@/types'

/* ─── modal backdrop ─── */
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-lg z-10 rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ─── service card ─── */
function ServiceCard({
  service, onEdit, onToggle, onDelete, toggling,
}: {
  service: PlatformServiceDTO
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  toggling: boolean
}) {
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="q-card flex flex-col" style={{ padding: '14px 16px' }}>
      <div className="flex items-start gap-3 mb-3">
        {service.image_url ? (
          <img src={service.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt={service.name} />
        ) : (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
            style={{ background: 'var(--violet-bg)' }}>✂️</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-syne font-black text-[15px] leading-tight" style={{ color: 'var(--text-1)' }}>{service.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {service.category && (
              <span className="text-xs px-2 py-0.5 rounded-md font-syne font-bold"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                {service.category}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-md font-syne font-bold"
              style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
              {service.service_for}
            </span>
          </div>
        </div>
      </div>

      {service.description && (
        <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-3)', lineHeight: 1.5 }}>
          {service.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <button type="button" onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-syne font-bold text-sm"
          style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer' }}>
          <Edit2 size={13} /> Edit
        </button>
        <button type="button" onClick={onToggle} disabled={toggling} title={service.is_active ? 'Deactivate' : 'Activate'}
          className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            background: service.is_active ? 'rgba(245,158,11,0.12)' : 'var(--green-bg)',
            color: service.is_active ? '#f59e0b' : 'var(--green)',
            border: `1px solid ${service.is_active ? 'rgba(245,158,11,0.25)' : 'var(--green-border)'}`,
            cursor: 'pointer',
          }}>
          <Power size={14} />
        </button>
        <button type="button" onClick={onDelete} title="Delete"
          className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

/* ════════════════ PLATFORM SERVICES PAGE ════════════════ */
export default function AdminPlatformServices() {
  usePageTitle('Platform Services · Admin')
  const qc = useQueryClient()

  const [modalOpen,   setModalOpen]   = useState(false)
  const [editItem,    setEditItem]    = useState<PlatformServiceDTO | null>(null)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [filterFor,   setFilterFor]   = useState<'ALL' | 'MEN' | 'UNISEX'>('ALL')

  // form state
  const [name,        setName]        = useState('')
  const [category,    setCategory]    = useState('')
  const [serviceFor,  setServiceFor]  = useState<'MEN' | 'UNISEX'>('UNISEX')
  const [description, setDescription] = useState('')
  const [imageFile,   setImageFile]   = useState<File | null>(null)
  const [imagePrev,   setImagePrev]   = useState<string | null>(null)

  const { data: services, isLoading } = useQuery({
    queryKey: ['admin-platform-services'],
    queryFn: async () => {
      const res = await api.get('/admin/platform-services')
      return res.data.data as PlatformServiceDTO[]
    },
    staleTime: 2 * 60_000,  // 2 min — services change rarely; avoids re-fetch on every visit
  })

  const resetForm = () => {
    setName(''); setCategory(''); setServiceFor('UNISEX'); setDescription('')
    setImageFile(null); setImagePrev(null); setEditItem(null)
  }

  const openCreate = () => { resetForm(); setModalOpen(true) }

  const openEdit = (s: PlatformServiceDTO) => {
    setEditItem(s)
    setName(s.name)
    setCategory(s.category ?? '')
    setServiceFor(s.service_for as 'MEN' | 'UNISEX')
    setDescription(s.description ?? '')
    setImagePrev(s.image_url ?? null)
    setImageFile(null)
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); resetForm() }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('service_for', serviceFor)
      fd.append('category', 'SALON')  // always SALON per schema
      if (description) fd.append('description', description)
      if (imageFile)   fd.append('image', imageFile)
      if (editItem) {
        await api.patch(`/admin/platform-services/${editItem.id}`, fd)
      } else {
        await api.post('/admin/platform-services', fd)
      }
    },
    onSuccess: () => {
      toast.success(editItem ? 'Service updated.' : 'Service created.')
      qc.invalidateQueries({ queryKey: ['admin-platform-services'] })
      qc.invalidateQueries({ queryKey: ['platform-services'] })
      closeModal()
    },
    onError: (err: unknown) =>
      toast.error((err as any)?.response?.data?.message ?? 'Failed to save service.'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/platform-services/${id}`, { is_active } as unknown as FormData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-platform-services'] }),
    onError: (err: unknown) => toast.error((err as any)?.response?.data?.message ?? 'Failed.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/platform-services/${deleteId}`),
    onSuccess: () => {
      toast.success('Service deleted.')
      qc.invalidateQueries({ queryKey: ['admin-platform-services'] })
      qc.invalidateQueries({ queryKey: ['platform-services'] })
      setDeleteId(null)
    },
    onError: (err: unknown) => toast.error((err as any)?.response?.data?.message ?? 'Cannot delete — service may be in use.'),
  })

  const allFiltered = (services ?? []).filter(s => filterFor === 'ALL' ? true : s.service_for === filterFor)
  // Show newest first (most recently created)
  const sorted   = [...allFiltered].reverse()
  const active   = sorted.filter(s => s.is_active)
  const inactive = sorted.filter(s => !s.is_active)

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto space-y-4" style={{ background: 'var(--bg-page)' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-syne font-black text-2xl lg:text-3xl" style={{ color: 'var(--text-1)' }}>
            Platform Services
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {services?.length ?? 0} services · {active.length} active
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="flex items-center gap-2 font-syne font-bold text-sm px-5 py-2.5 rounded-xl flex-shrink-0"
          style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={16} /> Add Service
        </motion.button>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['ALL', 'MEN', 'UNISEX'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilterFor(f)}
            className="px-4 py-1.5 rounded-xl font-syne font-bold text-sm transition-all"
            style={{
              background: filterFor === f ? 'var(--violet)' : 'var(--bg-surface)',
              color: filterFor === f ? '#fff' : 'var(--text-3)',
              border: `1px solid ${filterFor === f ? 'transparent' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            {f === 'ALL' ? 'All Services' : f === 'MEN' ? 'Men' : 'Unisex'}
            {f !== 'ALL' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({(services ?? []).filter(s => s.service_for === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Services grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} height="140px" className="rounded-2xl" />)}
        </div>
      ) : allFiltered.length === 0 ? (
        <EmptyState icon={<Scissors size={26} />}
          title="No services yet"
          description="Add platform services that salons can offer."
          action={
            <button type="button" onClick={openCreate}
              className="flex items-center gap-2 font-syne font-bold text-sm px-4 py-2 rounded-xl mt-2"
              style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} /> Add First Service
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
                <p className="font-syne font-black text-sm uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                  Active — {active.length}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {active.map(s => (
                  <ServiceCard key={s.id} service={s}
                    onEdit={() => openEdit(s)}
                    onToggle={() => toggleMutation.mutate({ id: s.id, is_active: false })}
                    onDelete={() => setDeleteId(s.id)}
                    toggling={toggleMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div className="opacity-60">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--text-4)' }} />
                <p className="font-syne font-black text-sm uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  Inactive — {inactive.length}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {inactive.map(s => (
                  <ServiceCard key={s.id} service={s}
                    onEdit={() => openEdit(s)}
                    onToggle={() => toggleMutation.mutate({ id: s.id, is_active: true })}
                    onDelete={() => setDeleteId(s.id)}
                    toggling={toggleMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal open={modalOpen} onClose={closeModal}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-syne font-black text-lg" style={{ color: 'var(--text-1)' }}>
            {editItem ? 'Edit Service' : 'New Service'}
          </h2>
          <button type="button" onClick={closeModal}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-3)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-5 py-5 space-y-4">

          {/* Image */}
          <div>
            <p className="text-xs font-syne font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
              Service Icon
            </p>
            <label className="block cursor-pointer">
              <div className="h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-colors"
                style={{
                  borderColor: imagePrev ? 'var(--violet-border)' : 'var(--border)',
                  background: imagePrev ? 'transparent' : 'var(--bg-surface)',
                }}>
                {imagePrev ? (
                  <img src={imagePrev} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center p-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--violet-bg)' }}>
                      <Camera size={18} style={{ color: 'var(--violet-light)' }} />
                    </div>
                    <p className="font-syne font-bold text-sm" style={{ color: 'var(--text-2)' }}>Upload icon</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>PNG, JPG, WebP</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return
                  setImageFile(f); setImagePrev(URL.createObjectURL(f))
                }} />
            </label>
            {imagePrev && (
              <button type="button" onClick={() => { setImageFile(null); setImagePrev(null) }}
                className="text-xs font-syne font-bold mt-2 px-3 py-1 rounded-lg"
                style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                Remove image
              </button>
            )}
          </div>

          {/* Name + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="q-label">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="q-input" placeholder="e.g. Haircut" style={{ fontSize: 14 }} />
            </div>
            <div>
              <label className="q-label">Category</label>
              <div className="q-input flex items-center text-sm" style={{ opacity: 0.65, cursor: 'default', userSelect: 'none' }}>
                SALON
              </div>
            </div>
          </div>

          {/* Service For */}
          <div>
            <label className="q-label mb-2">Service For</label>
            <div className="flex gap-2">
              {(['MEN', 'UNISEX'] as const).map(v => (
                <button key={v} type="button" onClick={() => setServiceFor(v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-syne font-bold text-sm transition-all"
                  style={{
                    background: serviceFor === v ? 'var(--violet-bg)' : 'var(--bg-surface)',
                    color: serviceFor === v ? 'var(--violet-light)' : 'var(--text-3)',
                    border: `1px solid ${serviceFor === v ? 'var(--violet-border)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}>
                  {serviceFor === v && <Check size={14} />}
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="q-label">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="q-input resize-none" rows={3} maxLength={500}
              placeholder="Describe this service…" style={{ fontSize: 14 }} />
            <p className="text-xs mt-0.5 text-right" style={{ color: 'var(--text-3)' }}>{description.length}/500</p>
          </div>
        </div>

        {/* Modal footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button type="button" onClick={closeModal}
            className="flex-1 font-syne font-bold text-sm py-3 rounded-xl"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            Cancel
          </button>
          <motion.button whileTap={{ scale: 0.97 }}
            disabled={!name.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="flex-1 flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-xl"
            style={{
              background: 'var(--violet)', color: '#fff', border: 'none',
              cursor: !name.trim() || saveMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: !name.trim() || saveMutation.isPending ? 0.6 : 1,
            }}>
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saveMutation.isPending ? 'Saving…' : editItem ? 'Update Service' : 'Create Service'}
          </motion.button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete service?"
        danger
        description="This removes the service from the platform permanently. Businesses already using it won't be affected immediately."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}

/* ════════════════ ADMIN PROFILE ════════════════ */

// Profile Edit Modal Component
function ProfileEditModal({
  profile, user, name, phone, state, city, addressLine1,
  setName, setPhone, setState, setCity, setAddressLine1,
  avatarPrev, avatarFile, setAvatarFile, setAvatarPrev, avatarRef, updateMutation, onClose
}: {
  profile: any
  user: any
  name: string
  phone: string
  state: string
  city: string
  addressLine1: string
  setName: (s: string) => void
  setPhone: (s: string) => void
  setState: (s: string) => void
  setCity: (s: string) => void
  setAddressLine1: (s: string) => void
  avatarPrev: string | null
  avatarFile: File | null
  setAvatarFile: (f: File | null) => void
  setAvatarPrev: (p: string | null) => void
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
                  {(avatarPrev || profile?.avatar_url || user?.avatar_url)
                    ? <img src={avatarPrev || profile?.avatar_url || user?.avatar_url!} alt={profile?.name ?? user?.name} className="w-full h-full object-cover" />
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
                  if (f) { setAvatarFile(f); setAvatarPrev(URL.createObjectURL(f)) }
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
                  <label className="q-label">Address</label>
                  <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} className="q-input" placeholder="Street address" />
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

export function AdminProfile() {
  usePageTitle('My Profile · Admin')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, logout, setUser } = useAuthStore()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPrev, setAvatarPrev] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => { const r = await api.get('/admin/profile'); return r.data.data },
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? '')
    setPhone(profile.phone ?? '')
    setCity(profile.city ?? '')
    setState(profile.state ?? '')
    setAddressLine1(profile.address_line1 ?? '')
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (name) fd.append('name', name)
      if (phone) fd.append('phone', phone)
      if (city) fd.append('city', city)
      if (state) fd.append('state', state)
      if (addressLine1) fd.append('address_line1', addressLine1)
      if (avatarFile) fd.append('avatar', avatarFile)
      await api.patch('/admin/profile', fd)
    },
    onSuccess: async () => {
      toast.success('Profile updated.')
      const refreshed = await api.get('/admin/profile').catch(() => null)
      if (refreshed?.data?.data && user) {
        const updatedAvatar = refreshed.data.data.avatar_url ?? user.avatar_url ?? null
        setUser({ ...user, name: refreshed.data.data.name ?? user.name, avatar_url: updatedAvatar })
        try {
          localStorage.setItem('quby-admin-profile-v1', JSON.stringify({ state: { avatar_url: updatedAvatar } }))
        } catch { /* ignore */ }
      }
      qc.invalidateQueries({ queryKey: ['admin-profile'] })
      setAvatarFile(null)
      setAvatarPrev(null)
      setShowEditModal(false)
    },
    onError: (err: unknown) => toast.error((err as any)?.response?.data?.message ?? 'Update failed.'),
  })

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('quby_refresh_token')
      if (rt) await api.post('/admin/logout', { refresh_token: rt }).catch(() => {})
    } catch { /* ignore */ } finally {
      logout()
      toast.success('Logged out.')
      navigate('/login')
    }
  }

  const displayName = profile?.name ?? user?.name ?? ''
  const displayAvatar = avatarPrev ?? profile?.avatar_url ?? user?.avatar_url

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
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Manage your administrator account</p>
        </div>
      </div>

      {/* Top row: Admin Card + Account Information */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* ── LEFT: Admin profile card (35%) ── */}
        <div className="lg:col-span-4 space-y-4 h-full">

          {/* Admin Hero card */}
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
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{profile?.email ?? user?.email}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-full text-[9px] font-syne font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.22)' }}>
                  Administrator
                </span>
                {profile?.city && profile?.state && (
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    📍 {profile.city}, {profile.state}
                  </span>
                )}
              </div>
            </div>

            {/* Member since */}
            {profile?.joined_at && (
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  Member since {new Date(profile.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT: Account Information (65%) ── */}
        <div className="lg:col-span-8 space-y-4">

          {/* Account Information */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="q-card p-4 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-[7px]" style={{ background: 'var(--violet-bg)' }}>
                  <Edit3 size={13} style={{ color: 'var(--violet-light)' }} />
                </div>
                <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Account Information</p>
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
                { label: 'State', val: profile?.state || 'N/A', icon: <MapPin size={12} /> },
                { label: 'City', val: profile?.city || 'N/A', icon: <MapPin size={12} /> },
                { label: 'Address', val: profile?.address_line1 || 'N/A', icon: <MapPin size={12} /> },
                { label: 'Status', val: profile?.is_active ? 'Active' : 'Inactive', icon: <Shield size={12} />, color: profile?.is_active ? 'var(--green)' : 'var(--red)' },
                { label: 'Joined', val: profile?.joined_at ? new Date(profile.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A', icon: <Calendar size={12} /> },
              ].map(({ label, val, icon, color }) => (
                <div key={label} className="flex items-start gap-3 py-2 px-1 border-b hover:bg-[var(--bg-surface)] transition-colors rounded-[6px]"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-3)' }}>{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
                    <p className="text-[13px] font-medium mt-0.5 truncate" style={{ color: color || 'var(--text-1)' }}>{val}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Full width sections */}
      <div className="space-y-5">
        {/* Session & Security */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="q-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-[7px]" style={{ background: 'var(--bg-surface)' }}>
              <Shield size={13} style={{ color: 'var(--text-3)' }} />
            </div>
            <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Session & Security</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-[9px]" style={{ background: 'var(--bg-surface)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Status</p>
              <p className="text-[13px] font-medium mt-1" style={{ color: profile?.is_active ? 'var(--green)' : 'var(--red)' }}>{profile?.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <div className="p-3 rounded-[9px]" style={{ background: 'var(--violet-bg)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--violet-light)' }}>Access</p>
              <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--violet-light)' }}>Administrator</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full h-10 text-[12px] font-syne font-bold rounded-[9px] flex items-center justify-center gap-2"
            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}>
            <LogOut size={13} /> Sign Out
          </button>
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
            state={state}
            city={city}
            addressLine1={addressLine1}
            setName={setName}
            setPhone={setPhone}
            setState={setState}
            setCity={setCity}
            setAddressLine1={setAddressLine1}
            avatarPrev={avatarPrev}
            avatarFile={avatarFile}
            setAvatarFile={setAvatarFile}
            setAvatarPrev={setAvatarPrev}
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
    </div>
  )
}

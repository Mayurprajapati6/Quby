import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, UmbrellaOff, Building2, ChevronDown, X, Trash2, Loader2, Check, AlertCircle } from 'lucide-react'
import { EmptyState, Skeleton, ConfirmDialog } from '@/components/shared'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Avatar } from '@/components/shared/Avatar'

const today = format(new Date(), 'yyyy-MM-dd')

type HolidayTab = 'upcoming' | 'running' | 'completed'

const TAB_DOT: Record<HolidayTab, string> = {
  upcoming: 'var(--blue)',
  running:  'var(--green)',
  completed:'var(--text-3)',
}

export default function OwnerHoliday() {
  usePageTitle('Holidays')
  const qc = useQueryClient()
  const [bizId, setBizId] = useState('')
  const [tab, setTab] = useState<HolidayTab>('upcoming')
  const [showBizModal, setShowBizModal] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteId, setDeleteId] = useState<{ id: string; businessId: string } | null>(null)

  // Form
  const [form, setForm] = useState({
    holiday_name: '',
    start_date: today,
    end_date: today,
    description: '',
    applies_to_all_staff: true,
  })
  const u = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const { data: bizList } = useQuery({
    queryKey: ['owner-businesses-simple'],
    queryFn: async () => {
      const r = await api.get('/owner/businesses', { params: { limit: 100 } })
      return (r.data.data?.businesses ?? []) as any[]
    },
    staleTime: 10 * 60_000,
  })

  const { data: holidays, isLoading, refetch } = useQuery({
    queryKey: ['owner-holidays', bizId, tab],
    queryFn: async () => {
      if (!bizId) return []
      const r = await api.get(`/owner/businesses/${bizId}/holidays`, { params: { tab } })
      return (r.data.data ?? []) as any[]
    },
    enabled: !!bizId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const selectedBiz = bizId ? bizList?.find((b: any) => b.id === bizId) : null
  const hasBusinesses = (bizList ?? []).length > 0

  const [formBizId, setFormBizId] = useState('')

  const createMut = useMutation({
    mutationFn: async () => {
      const targetBizId = formBizId || bizId
      if (!targetBizId) throw new Error('Select a business')
      if (!form.holiday_name.trim()) throw new Error('Holiday name is required')
      if (!form.start_date || !form.end_date) throw new Error('Dates are required')
      if (form.start_date < today) throw new Error('Start date must be today or later')
      if (form.end_date < form.start_date) throw new Error('End date must be on or after start date')
      await api.post(`/owner/businesses/${targetBizId}/holidays`, {
        ...form,
        business_id: targetBizId,
      })
    },
    onSuccess: () => {
      toast.success('Holiday created! Staff and customers notified.')
      setShowAdd(false)
      setForm({ holiday_name: '', start_date: today, end_date: today, description: '', applies_to_all_staff: true })
      setFormBizId('')
      refetch()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) => api.delete(`/owner/businesses/${businessId}/holidays/${id}`),
    onSuccess: () => {
      toast.success('Holiday cancelled. Staff notified.')
      refetch()
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Mobile Header */}
        <div className="md:hidden mb-4">
          <div>
            <h1 className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>Holidays</h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              Manage holidays for your salons
            </p>
          </div>
        </div>

        {/* Mobile Business Filter */}
        <div className="md:hidden mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBizModal(true)}
              className="flex-1 flex items-center gap-2 h-10 px-3 rounded-[10px] text-[12px] font-syne font-bold"
              style={{
                background: bizId ? 'var(--violet-bg)' : 'var(--bg-surface)',
                color: bizId ? 'var(--violet-light)' : 'var(--text-3)',
                border: `1px solid ${bizId ? 'var(--violet-border)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--violet-bg)' }}>
                <Building2 size={12} style={{ color: 'var(--violet-light)' }} />
              </div>
              <span className="flex-1 text-left truncate">
                {selectedBiz?.business_name ?? 'All Businesses'}
              </span>
              <ChevronDown size={12} style={{ flexShrink: 0 }} />
            </button>
            {hasBusinesses && bizId && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)}
                className="flex items-center justify-center gap-1.5 px-3 h-10 rounded-[10px] text-[12px] font-syne font-bold flex-shrink-0"
                style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer', minWidth: 100 }}>
                <Plus size={12} />Add
              </motion.button>
            )}
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block mb-6">
          <div>
            <h1 className="font-syne font-black text-[28px]" style={{ color: 'var(--text-1)' }}>Holidays</h1>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              Manage holidays for your salons
            </p>
          </div>
        </div>

        {/* Desktop Business Filter + Add Holiday */}
        <div className="hidden md:flex items-center gap-3 mb-5">
          <button onClick={() => setShowBizModal(true)}
            className="flex-1 flex items-center gap-2 h-11 px-4 rounded-[10px] text-[13px] font-syne font-bold"
            style={{
              background: bizId ? 'var(--violet-bg)' : 'var(--bg-surface)',
              color: bizId ? 'var(--violet-light)' : 'var(--text-3)',
              border: `1px solid ${bizId ? 'var(--violet-border)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--violet-bg)' }}>
              <Building2 size={14} style={{ color: 'var(--violet-light)' }} />
            </div>
            <span className="flex-1 text-left">
              {selectedBiz?.business_name ?? 'All Businesses'}
            </span>
            <ChevronDown size={14} />
          </button>
          {hasBusinesses && bizId && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 h-11 rounded-[10px] text-[13px] font-syne font-bold flex-shrink-0"
              style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} />Add Holiday
            </motion.button>
          )}
        </div>

        {!bizId ? (
          <EmptyState icon={<Building2 size={32} />} title="Select a business"
            description="Choose a business to view and manage its holidays." />
        ) : (
          <>
            {/* Tabs - Full width, no gaps */}
            <div className="grid grid-cols-3 mb-5">
              {(['upcoming', 'running', 'completed'] as HolidayTab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="h-10 text-[11px] font-syne font-bold capitalize flex items-center justify-center"
                  style={{
                    background: tab === t ? 'var(--violet-bg)' : 'var(--bg-surface)',
                    color: tab === t ? 'var(--violet-light)' : 'var(--text-3)',
                    border: `1px solid ${tab === t ? 'var(--violet-border)' : 'transparent'}`,
                    cursor: 'pointer',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} height="80px" className="rounded-[14px]" />)}
              </div>
            ) : !holidays?.length ? (
              <EmptyState icon={<UmbrellaOff size={28} />}
                title={`No ${tab} holidays`}
                description={tab === 'upcoming' ? 'Add a holiday to close the business on specific dates.' : 'No holidays in this period.'} />
            ) : (
              <div className="space-y-3">
                {holidays.map((h: any) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-[14px] p-4 flex items-start gap-3"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${tab === 'running' ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
                    }}>
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--violet-bg)' }}>
                      <UmbrellaOff size={18} style={{ color: 'var(--violet-light)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>
                            {h.holiday_name}
                          </p>
                          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {h.business_name}
                          </p>
                        </div>
                        {tab === 'upcoming' && (
                          <button onClick={() => setDeleteId({ id: h.id, businessId: h.business_id })}
                            className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
                        {formatDate(h.start_date)} – {formatDate(h.end_date)}
                      </p>
                      {h.description && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>{h.description}</p>
                      )}
                      <p className="text-[10px] mt-1 font-syne font-bold"
                        style={{ color: h.applies_to_all_staff ? 'var(--violet-light)' : 'var(--text-3)' }}>
                        {h.applies_to_all_staff ? '● Applies to all staff' : `● ${(h.staff_ids ?? []).length} specific staff`}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Business Select Modal */}
        <AnimatePresence>
          {showBizModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
                onClick={() => setShowBizModal(false)} />
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="relative w-full max-w-sm rounded-[14px] overflow-hidden z-10"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '60vh' }}>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Select Business</h3>
                  <button onClick={() => setShowBizModal(false)}
                    className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
                    <X size={12} />
                  </button>
                </div>
                <div className="overflow-y-auto p-2">
                  <button onClick={() => { setBizId(''); setShowBizModal(false) }}
                    className="w-full flex items-center gap-3 p-3 rounded-[9px] text-left mb-1"
                    style={{
                      background: !bizId ? 'var(--violet-bg)' : 'transparent',
                      border: `1px solid ${!bizId ? 'var(--violet-border)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}>
                    <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--violet-bg)' }}>
                      <Building2 size={14} style={{ color: 'var(--violet-light)' }} />
                    </div>
                    <span className="font-syne font-bold text-[13px]"
                      style={{ color: !bizId ? 'var(--violet-light)' : 'var(--text-1)' }}>
                      All Businesses
                    </span>
                  </button>
                  {(bizList ?? []).map((b: any) => (
                    <button key={b.id} onClick={() => { setBizId(b.id); setShowBizModal(false) }}
                      className="w-full flex items-center gap-3 p-3 rounded-[9px] text-left mb-1"
                      style={{
                        background: bizId === b.id ? 'var(--violet-bg)' : 'transparent',
                        border: `1px solid ${bizId === b.id ? 'var(--violet-border)' : 'transparent'}`,
                        cursor: 'pointer',
                      }}>
                      <Avatar name={b.business_name} src={b.logo_url || undefined} size="xs" />
                      <span className="font-syne font-bold text-[13px]"
                        style={{ color: bizId === b.id ? 'var(--violet-light)' : 'var(--text-1)' }}>
                        {b.business_name}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* Add Holiday Modal */}
          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
                onClick={() => setShowAdd(false)} />
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                className="relative w-full max-w-md z-10 overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px 16px 0 0', maxHeight: '90vh' }}>
                <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '90vh' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-syne font-black text-[16px]" style={{ color: 'var(--text-1)' }}>Add Holiday</h3>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {selectedBiz?.business_name || 'All Businesses'}
                      </p>
                    </div>
                    <button onClick={() => setShowAdd(false)}
                      className="w-8 h-8 rounded-[8px] flex items-center justify-center"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex items-start gap-2 p-3 rounded-[10px]"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <AlertCircle size={13} style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-[11px]" style={{ color: 'var(--yellow)' }}>
                      Start date must be today or later. Staff will receive notification emails.
                    </p>
                  </div>

                  {!bizId && (
                    <div>
                      <label className="block text-[11px] font-syne font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>
                        Select Business <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <select value={formBizId} onChange={e => setFormBizId(e.target.value)}
                        className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
                        <option value="">Choose a business...</option>
                        {(bizList ?? []).map((b: any) => (
                          <option key={b.id} value={b.id}>{b.business_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-syne font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>
                      Holiday Name <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input value={form.holiday_name} onChange={e => u('holiday_name', e.target.value)}
                      placeholder="e.g. Diwali, Republic Day…"
                      className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-syne font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>
                        Start Date <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input type="date" value={form.start_date} min={today}
                        onChange={e => {
                          u('start_date', e.target.value)
                          if (e.target.value > form.end_date) u('end_date', e.target.value)
                        }}
                        className="w-full h-10 rounded-[9px] px-3 text-[12px] font-syne outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-syne font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>
                        End Date <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input type="date" value={form.end_date} min={form.start_date}
                        onChange={e => u('end_date', e.target.value)}
                        className="w-full h-10 rounded-[9px] px-3 text-[12px] font-syne outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-syne font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>
                      Description (optional)
                    </label>
                    <textarea value={form.description} onChange={e => u('description', e.target.value)}
                      rows={2} placeholder="Any notes about this holiday…"
                      className="w-full rounded-[9px] px-3 py-2 text-[12px] font-syne outline-none resize-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-[10px]"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => u('applies_to_all_staff', !form.applies_to_all_staff)}
                      className="relative w-9 h-5 rounded-full flex-shrink-0"
                      style={{ background: form.applies_to_all_staff ? 'var(--green)' : 'var(--border-2)', border: 'none', cursor: 'pointer' }}>
                      <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
                        style={{ background: '#fff', left: form.applies_to_all_staff ? 'calc(100% - 18px)' : '2px' }} />
                    </button>
                    <div>
                      <p className="text-[12px] font-syne font-bold" style={{ color: 'var(--text-1)' }}>Applies to all staff</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>All staff will have this day off</p>
                    </div>
                  </label>

                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => createMut.mutate()}
                    disabled={createMut.isPending}
                    className="w-full h-11 rounded-[10px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold disabled:opacity-60"
                    style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {createMut.isPending ? 'Creating…' : 'Create Holiday'}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <ConfirmDialog open={!!deleteId} danger
          title="Cancel Holiday?"
          description="This will remove the holiday. Staff will be notified."
          confirmLabel="Cancel Holiday" loading={deleteMut.isPending}
          onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
          onCancel={() => setDeleteId(null)} />
      </div>
    </div>
  )
}


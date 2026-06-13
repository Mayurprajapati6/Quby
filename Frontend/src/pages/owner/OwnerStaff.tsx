import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Trash2, RefreshCw, Star, X, Plus, Loader2, Upload,
  Building2, Users, Clock, Search, ChevronDown, MessageSquare,
  AlertCircle, Tag, Calendar, Check,
  Shield, PhoneCall, Mail, Pencil, BookOpen,
} from 'lucide-react'
import { EmptyState, Skeleton, ConfirmDialog } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useDebounce, usePageTitle, useIntersectionObserver, useSocketEvent } from '@/hooks'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'] as const
const DAY_SHORT: Record<string, string> = {
  MONDAY:'Mon',TUESDAY:'Tue',WEDNESDAY:'Wed',THURSDAY:'Thu',FRIDAY:'Fri',SATURDAY:'Sat',SUNDAY:'Sun'
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="time" value={value} onChange={e => onChange(e.target.value)}
      className="h-8 px-2 rounded-[7px] text-[12px] font-syne outline-none flex-1 min-w-0"
      style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)}
      className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
      style={{ background: checked ? 'var(--violet)' : 'var(--border-2)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200"
        style={{ background: '#fff', left: checked ? 'calc(100% - 18px)' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

function ServiceImage({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  const [imgErr, setImgErr] = useState(false)
  const showImg = !!url && !imgErr
  return (
    <div className="rounded-[8px] overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: 'var(--violet-bg)', flexShrink: 0 }}>
      {showImg
        ? <img src={url!} alt={name} onError={() => setImgErr(true)} className="w-full h-full object-cover" />
        : <span style={{ fontSize: Math.round(size * 0.42) }}>✂️</span>
      }
    </div>
  )
}

/* ─── Shared Modal Wrapper — always centered on mobile too ──── */
function ModalWrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      {children}
    </div>
  )
}

/* ─── Staff Detail Modal ─────────────────────────────────────── */
function StaffDetailModal({ staffId, businessId, onClose }: { staffId: string; businessId: string; onClose: () => void }) {
  const [view, setView] = useState<'info'|'services'|'schedule'|'reviews'>('info')
  const [reviewPage, setReviewPage] = useState(1)
  const [reviews, setReviews] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const loaderRef = useRef<HTMLDivElement>(null)

  const { data: detail, isLoading, refetch } = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: async () => { const r = await api.get(`/owner/staff/${staffId}/detail`); return r.data.data },
    staleTime: 60_000,
  })

  const { data: bizServices } = useQuery({
    queryKey: ['biz-services', businessId],
    queryFn: async () => { const r = await api.get(`/owner/businesses/${businessId}/services`); return r.data.data ?? [] },
    enabled: !!businessId && view === 'services',
    staleTime: 60_000,
  })

  const { data: staffBookings, isLoading: bkLoading } = useQuery({
    queryKey: ['owner-staff-bookings', staffId],
    queryFn: async () => {
      const r = await api.get('/owner/bookings', { params: { staff_id: staffId, tab: 'past', limit: 20 } })
      return (r.data.data?.bookings ?? []) as any[]
    },
    enabled: view === 'bookings' as any,
    staleTime: 30_000,
  })

  const { isFetching: reviewsFetching } = useQuery({
    queryKey: ['staff-reviews', staffId, reviewPage],
    queryFn: async () => {
      const r = await api.get('/owner/reviews', { params: { staff_id: staffId, page: reviewPage, limit: 10 } })
      const newR = r.data.data?.reviews ?? []
      setReviews(prev => reviewPage === 1 ? newR : [...prev, ...newR])
      setHasMore(newR.length === 10)
      return newR
    },
    enabled: view === 'reviews',
    staleTime: 60_000,
  })

  useIntersectionObserver(useCallback(() => {
    if (hasMore && !reviewsFetching && view === 'reviews') setReviewPage(p => p + 1)
  }, [hasMore, reviewsFetching, view]), { threshold: 0.1 })

  const [svcSel, setSvcSel] = useState<{ service_offering_id: string; duration_minutes: number }[]>([])
  const [svcEditing, setSvcEditing] = useState(false)
  const startSvcEdit = () => {
    setSvcSel((detail?.services ?? []).map((s: any) => ({ service_offering_id: s.id, duration_minutes: s.duration_minutes ?? 0 })))
    setSvcEditing(true)
  }
  const saveSvcMut = useMutation({
    mutationFn: async () => {
      if (svcSel.length === 0) throw new Error('Select at least one service')
      await api.patch(`/owner/staff/${staffId}/services`, { services: svcSel })
    },
    onSuccess: () => { toast.success('Services updated!'); setSvcEditing(false); refetch() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'),
  })

  const [schEdit, setSchEdit] = useState(false)
  const [sched, setSched] = useState(
    DAYS.map(d => ({ day_of_week: d, is_available: d !== 'SUNDAY', start_time: '09:00', end_time: '20:00' }))
  )
  const startSchEdit = () => {
    const existing = detail?.schedule ?? []
    setSched(DAYS.map(d => {
      const ex = existing.find((s: any) => s.day_of_week === d)
      return ex ? { day_of_week: d, is_available: ex.is_available ?? true, start_time: ex.start_time ?? '09:00', end_time: ex.end_time ?? '20:00' }
        : { day_of_week: d, is_available: d !== 'SUNDAY', start_time: '09:00', end_time: '20:00' }
    }))
    setSchEdit(true)
  }
  const saveSchMut = useMutation({
    mutationFn: async () => { await api.patch(`/owner/staff/${staffId}/schedule`, { schedule: sched }) },
    onSuccess: () => { toast.success('Schedule updated!'); setSchEdit(false); refetch() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const VIEW_TABS = [
    { k: 'info' as const,     icon: Users,         label: 'Info' },
    { k: 'services' as const, icon: Tag,           label: 'Services' },
    { k: 'schedule' as const, icon: Calendar,      label: 'Schedule' },
    { k: 'reviews' as const,  icon: MessageSquare, label: 'Reviews' },
  ]

  return (
    <ModalWrap onClose={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg z-10 flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, maxHeight: '90vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-syne font-black text-[16px]" style={{ color: 'var(--text-1)' }}>Staff Details</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        {!isLoading && (
          <div className="flex items-center px-5 py-2 border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: 'var(--border)', scrollbarWidth: 'none' }}>
            {VIEW_TABS.map(t => (
              <button key={t.k} onClick={() => setView(t.k)}
                className="flex items-center justify-center gap-1 py-1.5 rounded-[8px] text-[11px] font-syne font-bold flex-1 transition-all"
                style={{
                  background: view === t.k ? 'var(--violet-bg)' : 'transparent',
                  color: view === t.k ? 'var(--violet-light)' : 'var(--text-3)',
                  border: `1px solid ${view === t.k ? 'var(--violet-border)' : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                <t.icon size={10} />{t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex gap-3"><Skeleton width="56px" height="56px" className="rounded-full" /><div className="flex-1 space-y-2"><Skeleton height="16px" /><Skeleton height="12px" width="60%" /></div></div>
              <Skeleton height="80px" className="rounded-[12px]" />
            </div>
          ) : !detail ? null : (
            <>
              {view === 'info' && (
                <>
                  <div className="flex items-start gap-4">
                    <Avatar name={detail.name} src={detail.avatar_url} size="xl" />
                    <div className="flex-1 min-w-0">
                      <p className="font-syne font-black text-[17px]" style={{ color: 'var(--text-1)' }}>{detail.name}</p>
                      <div className="flex items-center gap-2 mt-1">
  <Avatar
    name={detail.business_name}
    src={detail.business_logo}
    size="xs"
  />

  <span
    className="text-[12px]"
    style={{ color: 'var(--text-3)' }}
  >
    {detail.business_name}
  </span>
</div>
                      {detail.spelialization && <p className="text-[12px] mt-0.5" style={{ color: 'var(--violet-light)' }}>{detail.spelialization}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {detail.average_rating > 0 && (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: '#f59e0b' }}>
                            <Star size={11} fill="#f59e0b" />{detail.average_rating.toFixed(1)} ({detail.total_reviews})
                          </span>
                        )}
                        {detail.experience_years && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{detail.experience_years} yrs exp</span>}
                        <span className="px-2 py-0.5 rounded text-[9px] font-syne font-bold"
                          style={{ background: detail.is_active ? 'var(--green-bg)' : 'var(--bg-surface)', color: detail.is_active ? 'var(--green)' : 'var(--text-4)' }}>
                          {detail.is_active ? '● Active' : '○ Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[{ icon: Mail, value: detail.email }, detail.phone && { icon: PhoneCall, value: detail.phone }].filter(Boolean).map((l: any, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded-[9px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <l.icon size={12} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
                        <span className="text-[12px] truncate" style={{ color: 'var(--text-2)' }}>{l.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-[10px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                      <p className="text-[9px] font-syne uppercase" style={{ color: 'var(--text-3)' }}>Completed</p>
                      <p className="font-syne font-black text-[16px]" style={{ color: 'var(--text-1)' }}>{detail.stats?.completed_bookings ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-[10px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                      <p className="text-[9px] font-syne uppercase" style={{ color: 'var(--text-3)' }}>Revenue (₹)</p>
                      <p className="font-syne font-black text-[16px]" style={{ color: 'var(--text-1)' }}>{(detail.stats?.revenue_inr ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  {detail.bio && (
                    <div className="p-3 rounded-[10px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] font-syne font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>Bio</p>
                      <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>{detail.bio}</p>
                    </div>
                  )}
                </>
              )}

              {view === 'services' && (
                <>
                  {!svcEditing ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Assigned Services ({detail.services?.length ?? 0})</p>
                        <motion.button whileTap={{ scale: 0.97 }} onClick={startSvcEdit}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[11px] font-syne font-bold"
                          style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer' }}>
                          <Pencil size={11} />Edit Services
                        </motion.button>
                      </div>
                      {!detail.services?.length ? (
                        <div className="text-center py-8"><Tag size={24} style={{ color: 'var(--text-4)', margin: '0 auto 8px' }} /><p className="text-[13px] font-syne font-bold" style={{ color: 'var(--text-3)' }}>No services assigned</p></div>
                      ) : (
                        <div className="space-y-2">
                          {detail.services.map((s: any) => (
                            <div key={s.id} className="flex items-center gap-3 p-3 rounded-[11px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                              <ServiceImage url={s.image_url ?? null} name={s.name} size={40} />
                              <div className="flex-1 min-w-0"><p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>{s.name}</p></div>
                              <div className="flex items-center gap-1 px-3 h-9 rounded-[9px] flex-shrink-0" style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                                <span className="font-syne font-black text-[16px] tabular-nums leading-none" style={{ color: 'var(--violet-light)' }}>{s.duration_minutes}</span>
                                <span className="font-syne font-bold text-[11px] leading-none" style={{ color: 'var(--text-3)' }}>min</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Edit Services</p>
                        <button onClick={() => setSvcEditing(false)} className="text-[11px] font-syne font-bold" style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Select services and set duration for {detail.name}</p>
                      {(bizServices ?? []).length === 0 ? (
                        <p className="text-[12px] text-center py-6" style={{ color: 'var(--text-3)' }}>No services in this business.</p>
                      ) : (
                        <div className="space-y-2">
                          {(bizServices ?? []).map((svc: any) => {
                            const isSel = svcSel.some(s => s.service_offering_id === svc.id)
                            const entry = svcSel.find(s => s.service_offering_id === svc.id)
                            const svcName = svc.platform_service?.name ?? 'Service'
                            const imgUrl = svc.platform_service?.image_url ?? null
                            return (
                              <div key={svc.id} className="flex items-center gap-3 p-3 rounded-[11px] transition-all"
                                style={{ background: isSel ? 'var(--violet-bg)' : 'var(--bg-surface)', border: `1px solid ${isSel ? 'var(--violet-border)' : 'var(--border)'}` }}>
                                <button onClick={() => setSvcSel(prev => isSel ? prev.filter(s => s.service_offering_id !== svc.id) : [...prev, { service_offering_id: svc.id, duration_minutes: 0 }])}
                                  className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0"
                                  style={{ background: isSel ? 'var(--violet)' : 'var(--bg-card)', border: `1.5px solid ${isSel ? 'var(--violet)' : 'var(--border-2)'}`, cursor: 'pointer' }}>
                                  {isSel && <Check size={10} color="#fff" strokeWidth={3} />}
                                </button>
                                <ServiceImage url={imgUrl} name={svcName} size={36} />
                                <div className="flex-1 min-w-0"><p className="font-syne font-bold text-[13px] truncate" style={{ color: isSel ? 'var(--violet-light)' : 'var(--text-1)' }}>{svcName}</p></div>
                                {isSel && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <input type="text" inputMode="numeric"
                                      value={entry?.duration_minutes === 0 ? '' : String(entry?.duration_minutes ?? '')}
                                      placeholder="0"
                                      onChange={e => {
                                        const v = e.target.value.replace(/\D/g, '')
                                        setSvcSel(prev => prev.map(s => s.service_offering_id === svc.id ? { ...s, duration_minutes: v === '' ? 0 : Math.min(480, parseInt(v)) } : s))
                                      }}
                                      className="w-14 h-10 rounded-[8px] text-[15px] text-center font-syne font-black outline-none tabular-nums"
                                      style={{ background: 'var(--bg-card)', border: '1.5px solid var(--violet-border)', color: 'var(--violet-light)' }}
                                    />
                                    <span className="text-[11px] font-syne font-bold" style={{ color: 'var(--text-3)' }}>min</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => saveSvcMut.mutate()} disabled={saveSvcMut.isPending || svcSel.length === 0}
                        className="w-full h-10 rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold disabled:opacity-60"
                        style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        {saveSvcMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Save Services
                      </motion.button>
                    </>
                  )}
                </>
              )}

              {view === 'schedule' && (
                <>
                  {!schEdit ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Work Schedule</p>
                        <motion.button whileTap={{ scale: 0.97 }} onClick={startSchEdit}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[11px] font-syne font-bold"
                          style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer' }}>
                          <Pencil size={11} />Edit Schedule
                        </motion.button>
                      </div>
                      {!detail.schedule?.length ? (
                        <div className="text-center py-8"><Calendar size={24} style={{ color: 'var(--text-4)', margin: '0 auto 8px' }} /><p className="text-[13px] font-syne font-bold" style={{ color: 'var(--text-3)' }}>No schedule set</p></div>
                      ) : (
                        <div className="space-y-1.5">
                          {detail.schedule.map((day: any) => (
                            <div key={day.day_of_week} className="flex items-center gap-3 px-3 py-2.5 rounded-[9px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                              <span className="w-10 text-[12px] font-syne font-bold" style={{ color: day.is_available ? 'var(--text-1)' : 'var(--text-4)' }}>{DAY_SHORT[day.day_of_week]}</span>
                              {day.is_available ? <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{day.start_time} – {day.end_time}</span> : <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>Day Off</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Edit Schedule</p>
                        <button onClick={() => setSchEdit(false)} className="text-[11px] font-syne font-bold" style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                      </div>
                      <div className="space-y-2">
                        {sched.map((day, i) => (
                          <div key={day.day_of_week} className="flex items-center gap-3 p-2.5 rounded-[9px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <Toggle checked={day.is_available} onChange={v => setSched(prev => { const n = [...prev]; n[i] = { ...n[i], is_available: v }; return n })} />
                            <span className="w-9 text-[12px] font-syne font-bold flex-shrink-0" style={{ color: day.is_available ? 'var(--text-1)' : 'var(--text-4)' }}>{DAY_SHORT[day.day_of_week]}</span>
                            {day.is_available ? (
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <TimeInput value={day.start_time} onChange={v => setSched(prev => { const n = [...prev]; n[i] = { ...n[i], start_time: v }; return n })} />
                                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>to</span>
                                <TimeInput value={day.end_time} onChange={v => setSched(prev => { const n = [...prev]; n[i] = { ...n[i], end_time: v }; return n })} />
                              </div>
                            ) : <span className="flex-1 text-[11px]" style={{ color: 'var(--text-4)' }}>Day off</span>}
                          </div>
                        ))}
                      </div>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => saveSchMut.mutate()} disabled={saveSchMut.isPending}
                        className="w-full h-10 rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold disabled:opacity-60"
                        style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        {saveSchMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Save Schedule
                      </motion.button>
                    </>
                  )}
                </>
              )}

              {view === 'reviews' && (
                <>
                  <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Reviews ({detail.total_reviews ?? 0})</p>
                  {reviews.length === 0 && !reviewsFetching && (
                    <div className="text-center py-8"><MessageSquare size={24} style={{ color: 'var(--text-4)', margin: '0 auto 8px' }} /><p className="text-[13px]" style={{ color: 'var(--text-3)' }}>No reviews yet</p></div>
                  )}
                  <div className="space-y-3">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="p-3 rounded-[10px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar name={r.customer_name} src={r.customer_avatar} size="xs" />
                          <div className="flex-1 min-w-0">
                            <p className="font-syne font-bold text-[12px]" style={{ color: 'var(--text-1)' }}>{r.customer_name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{formatDate(r.service_date)}</p>
                          </div>
                          <span className="text-[12px]" style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                        </div>
                        {r.comment && <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>{r.comment}</p>}
                      </div>
                    ))}
                    {reviewsFetching && <div className="text-center py-3"><Loader2 size={16} className="animate-spin mx-auto" style={{ color: 'var(--violet-light)' }} /></div>}
                    <div ref={loaderRef} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </ModalWrap>
  )
}

/* ─── Add Staff Modal ────────────────────────────────────────── */
function AddStaffModal({ businesses, onClose }: { businesses: any[]; onClose: () => void }) {
  const ql = useQueryClient()
  const [form, setForm] = useState({ name:'',email:'',phone:'',spelialization:'',experience_years:'',bio:'' })
  const [bizId, setBizId] = useState(businesses[0]?.id ?? '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const createMut = useMutation({
    mutationFn: async () => {
      if (!bizId) throw new Error('Select a business')
      if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) throw new Error('Name, email, and phone are required')
      const fd = new FormData()
      fd.append('name', form.name); fd.append('email', form.email); fd.append('phone', form.phone)
      if (form.spelialization) fd.append('spelialization', form.spelialization)
      if (form.experience_years) fd.append('experience_years', form.experience_years)
      if (form.bio) fd.append('bio', form.bio)
      if (avatar) fd.append('image', avatar)
      await api.post(`/owner/businesses/${bizId}/staff`, fd)
    },
    onSuccess: () => {
      toast.success('Staff created! Invitation email sent.')
      ql.invalidateQueries({ queryKey: ['owner-staff'] })
      ql.invalidateQueries({ queryKey: ['owner-staff-setup'] })
      ql.invalidateQueries({ queryKey: ['owner-dashboard'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'),
  })

  return (
    <ModalWrap onClose={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md z-10 overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, maxHeight: '90vh' }}>
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-syne font-black text-[16px]" style={{ color: 'var(--text-1)' }}>Add New Staff</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative cursor-pointer flex-shrink-0">
              <Avatar name={form.name || 'S'} src={avatar ? URL.createObjectURL(avatar) : null} size="lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--violet)' }}>
                <Upload size={10} color="#fff" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => setAvatar(e.target.files?.[0] ?? null)} />
            </label>
            <div><p className="text-[12px] font-syne font-bold" style={{ color: 'var(--text-1)' }}>Profile Photo</p><p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Optional</p></div>
          </div>
          <div>
            <label className="block text-[11px] font-syne font-bold mb-1" style={{ color: 'var(--text-2)' }}>Business *</label>
            <select value={bizId} onChange={e => setBizId(e.target.value)}
              className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { k:'name',label:'Full Name *',type:'text',placeholder:'Staff name' },
              { k:'email',label:'Email *',type:'email',placeholder:'staff@email.com' },
              { k:'phone',label:'Phone *',type:'tel',placeholder:'10-digit number' },
              { k:'spelialization',label:'Specialization',type:'text',placeholder:'e.g. Hair Stylist' },
              { k:'experience_years',label:'Experience (years)',type:'number',placeholder:'0' },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-[11px] font-syne font-bold mb-1" style={{ color: 'var(--text-2)' }}>{f.label}</label>
                <input type={f.type} value={(form as any)[f.k]} onChange={e => u(f.k, e.target.value)} placeholder={f.placeholder}
                  className="w-full h-9 rounded-[8px] px-3 text-[12px] font-syne outline-none"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[11px] font-syne font-bold mb-1" style={{ color: 'var(--text-2)' }}>Bio</label>
            <textarea value={form.bio} onChange={e => u('bio', e.target.value)} rows={2} placeholder="Short bio…"
              className="w-full rounded-[8px] px-3 py-2 text-[12px] font-syne outline-none resize-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.name || !form.email || !form.phone}
            className="w-full h-11 rounded-[10px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold disabled:opacity-60"
            style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {createMut.isPending ? 'Creating…' : 'Create Staff & Send Invite'}
          </motion.button>
        </div>
      </motion.div>
    </ModalWrap>
  )
}

/* ─── Main ────────────────────────────────────────────────────── */
export default function OwnerStaff() {
  usePageTitle('Staff')
  const ql = useQueryClient()
  const [activeTab, setActiveTab] = useState<'active'|'pending'>('active')
  const [search, setSearch] = useState('')
  const [bizFilter, setBizFilter] = useState('')
  const [showBizFilter, setShowBizFilter] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const dSearch = useDebounce(search, 400)

  const { data: bizList } = useQuery({
    
    queryKey: ['owner-businesses-simple'],
    queryFn: async () => {
      const r = await api.get('/owner/businesses', { params: { limit: 100 } })
      return (r.data.data?.businesses ?? []) as any[]
    },
    staleTime: 10 * 60_000,
  })

  //console.log(JSON.stringify(bizList, null, 2))

  const { data: staffData, isLoading } = useQuery({
    queryKey: ['owner-staff', dSearch, bizFilter],
    queryFn: async () => {
      const r = await api.get('/owner/staff', { params: { name: dSearch || undefined, business_id: bizFilter || undefined } })
      return r.data.data as any[]
    },
    staleTime: 30_000,
  })

  console.log(
  'OWNER STAFF DATA',
  JSON.stringify(staffData, null, 2)
)

  const { data: pendingRaw, isLoading: pendingLoading } = useQuery({
    queryKey: ['owner-staff-setup'],
    queryFn: async () => { const r = await api.get('/owner/staff/setup-status'); return r.data.data as any[] },
    staleTime: 60_000,
  })

  const pendingIds = new Set((pendingRaw ?? []).filter((s: any) => !s.setup_complete).map((s: any) => s.id))
  const activeStaff = (staffData ?? []).filter(s => !pendingIds.has(s.id)).sort((a, b) => b.average_rating - a.average_rating)
  const pendingStaff = (pendingRaw ?? []).filter((s: any) => !s.setup_complete)

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/owner/staff/${id}`),
    onSuccess: () => {
      toast.success('Staff removed')
      ql.invalidateQueries({ queryKey: ['owner-staff'] })
      ql.invalidateQueries({ queryKey: ['owner-staff-setup'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cannot remove — active bookings exist'),
  })

  const resendMut = useMutation({
    mutationFn: (id: string) => api.post(`/owner/staff/${id}/resend-invitation`),
    onSuccess: () => { toast.success('Invitation resent!') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const selectedBizName = bizList?.find((b: any) => b.id === bizFilter)?.business_name

  useSocketEvent('booking:confirmed', () => ql.invalidateQueries({ queryKey: ['owner-staff'] }))
  useSocketEvent('service:completed', () => ql.invalidateQueries({ queryKey: ['owner-staff'] }))

  return (
    <div className="min-h-screen pb-16 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-3 py-5 sm:px-4 md:px-6 lg:px-8" style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Desktop header: title left, Add Staff right ── */}
        {/* ── Mobile header: title + sub left | Add Staff right, then filter row, search row, tabs ── */}

        {/* Row 1 — Title + Add Staff */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-syne font-black text-[22px] md:text-[26px]" style={{ color: 'var(--text-1)' }}>Staff</h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{activeStaff.length} active · {pendingStaff.length} pending setup</p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 h-10 rounded-[10px] text-[13px] font-syne font-bold flex-shrink-0"
            style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <UserPlus size={15} />
            <span className="hidden sm:inline">Add Staff</span>
            <span className="sm:hidden">Add</span>
          </motion.button>
        </div>

        {/* Row 2 — Business filter (mobile: full row; desktop: inline with search) */}
        {/* Row 3 — Search bar */}
        {/* Desktop: filter + search side by side */}
        <div className="hidden sm:flex gap-3 mb-4">
          <button onClick={() => setShowBizFilter(true)}
            className="flex items-center gap-2 px-4 h-10 rounded-[10px] text-[12px] font-syne font-bold flex-shrink-0"
            style={{
              background: bizFilter ? 'var(--violet-bg)' : 'var(--bg-surface)',
              color: bizFilter ? 'var(--violet-light)' : 'var(--text-2)',
              border: `1px solid ${bizFilter ? 'var(--violet-border)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            <Building2 size={13} />
            {selectedBizName?.slice(0, 16) ?? 'All Businesses'}
            <ChevronDown size={11} />
          </button>
          {bizFilter && (
            <button onClick={() => setBizFilter('')} className="h-10 w-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
              <X size={13} />
            </button>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff by name…"
              className="w-full h-10 pl-10 pr-4 rounded-[10px] text-[13px] font-syne outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </div>
        </div>

        {/* Mobile: filter row then search row */}
        <div className="sm:hidden flex flex-col gap-2 mb-4">
          {/* Filter row */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBizFilter(true)}
              className="flex-1 flex items-center gap-2 px-3 h-10 rounded-[10px] text-[12px] font-syne font-bold"
              style={{
                background: bizFilter ? 'var(--violet-bg)' : 'var(--bg-surface)',
                color: bizFilter ? 'var(--violet-light)' : 'var(--text-2)',
                border: `1px solid ${bizFilter ? 'var(--violet-border)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              <Building2 size={13} />
              <span className="flex-1 text-left truncate">{selectedBizName ?? 'All Businesses'}</span>
              <ChevronDown size={11} style={{ flexShrink: 0 }} />
            </button>
            {bizFilter && (
              <button onClick={() => setBizFilter('')} className="h-10 w-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            )}
          </div>
          {/* Search row */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff by name…"
              className="w-full h-10 pl-10 pr-4 rounded-[10px] text-[13px] font-syne outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
          </div>
        </div>

        {/* ── Tabs: Active | Pending — full width, 2 equal halves ── */}
        <div className="flex mb-5 rounded-[10px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 3, gap: 3 }}>
          {[
            { k: 'active' as const,  label: `Active (${activeStaff.length})` },
            { k: 'pending' as const, label: `Pending (${pendingStaff.length})` },
          ].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)}
              className="relative flex-1 py-2 rounded-[8px] text-[12px] font-syne font-bold transition-all"
              style={{
                background: activeTab === t.k ? 'var(--violet-bg)' : 'transparent',
                color: activeTab === t.k ? 'var(--violet-light)' : 'var(--text-3)',
                border: `1px solid ${activeTab === t.k ? 'var(--violet-border)' : 'transparent'}`,
                cursor: 'pointer',
              }}>
              {t.label}
              {t.k === 'pending' && pendingStaff.length > 0 && activeTab !== 'pending' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'var(--yellow)' }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Active Staff ── */}
        {activeTab === 'active' && (
          isLoading ? (
            /* Desktop 3-col skeleton, mobile 1-col */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} height="200px" className="rounded-[16px]" />)}
            </div>
          ) : activeStaff.length === 0 ? (
            <EmptyState icon={<Users size={32} />} title="No staff found"
              description={search || bizFilter ? 'Try different filters.' : 'Add your first staff member.'} />
          ) : (
            <>
              {/* Desktop: Fixed 3-column grid */}
<div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {activeStaff.map((s, i) => (
    <motion.div
      key={s.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * i }}
      className="rounded-[16px] p-5 hover:border-[var(--violet-border)] transition-all flex flex-col"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        minHeight: 280,
        minWidth: 320,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar
          name={s.name}
          src={s.avatar_url}
          size="lg"
        />

        <div className="flex-1 min-w-0">
          <p
            className="font-syne font-bold text-[14px] truncate"
            style={{ color: 'var(--text-1)' }}
          >
            {s.name}
          </p>

          {s.average_rating > 0 && (
            <div
              className="flex items-center gap-1 mt-1 text-[12px]"
              style={{ color: '#f59e0b' }}
            >
              <Star size={12} fill="#f59e0b" />
              {s.average_rating.toFixed(1)}
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-4)' }}
              >
                ({s.total_reviews})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Business Card */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl mt-4"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        <Avatar
          name={s.business_name}
          src={s.business_logo}
          size="sm"
        />

        <div className="min-w-0">
          <p
            className="font-syne font-bold text-[12px] truncate"
            style={{ color: 'var(--text-1)' }}
          >
            {s.business_name}
          </p>

          <p
            className="text-[10px]"
            style={{ color: 'var(--text-4)' }}
          >
            Salon
          </p>
        </div>
      </div>

      {/* Specialization */}
      {s.specialization && (
        <div className="mt-4">
          <p
            className="text-[10px] mb-2 font-syne font-bold uppercase"
            style={{ color: 'var(--text-4)' }}
          >
            Specialization
          </p>

          <div className="flex flex-wrap gap-1.5">
            {s.specialization.split(',').map((item: string) => (
              <span
                key={item}
                className="px-2 py-1 rounded-full text-[10px]"
                style={{
                  background: 'var(--violet-bg)',
                  color: 'var(--violet-light)',
                  border: '1px solid var(--violet-border)',
                }}
              >
                {item.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Joined Date */}
      {s.joined_date && (
        <div className="flex items-center gap-2 mt-4">
          <Calendar
            size={13}
            style={{ color: 'var(--text-4)' }}
          />

          <div>
            <p
              className="text-[10px]"
              style={{ color: 'var(--text-4)' }}
            >
              Joined
            </p>

            <p
              className="text-[12px] font-syne font-bold"
              style={{ color: 'var(--text-2)' }}
            >
              {formatDate(s.joined_date)}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-2 mt-4 pt-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => setSelectedStaff(s.id)}
          className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold transition-all hover:opacity-80"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            cursor: 'pointer',
          }}
        >
          View
        </button>

        <button
          onClick={() => setDeleteId(s.id)}
          className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold"
          style={{
            background: 'var(--red-bg)',
            color: 'var(--red)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>
    </motion.div>
  ))}
</div>

             {/* Mobile: 1-col list */}
<div className="flex sm:hidden flex-col gap-3">
  {activeStaff.map((s, i) => (
    <motion.div
      key={s.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * i }}
      className="rounded-[14px] p-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar
          name={s.name}
          src={s.avatar_url}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <p
            className="font-syne font-bold text-[13px] truncate"
            style={{ color: 'var(--text-1)' }}
          >
            {s.name}
          </p>

          {s.average_rating > 0 && (
            <div
              className="flex items-center gap-1 mt-1 text-[11px]"
              style={{ color: '#f59e0b' }}
            >
              <Star size={11} fill="#f59e0b" />
              {s.average_rating.toFixed(1)}

              <span
                className="text-[10px]"
                style={{ color: 'var(--text-4)' }}
              >
                ({s.total_reviews})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Business Card */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl mt-3"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        <Avatar
          name={s.business_name}
          src={s.business_logo}
          size="xs"
        />

        <div className="min-w-0">
          <p
            className="font-syne font-bold text-[11px] truncate"
            style={{ color: 'var(--text-1)' }}
          >
            {s.business_name}
          </p>

          <p
            className="text-[9px]"
            style={{ color: 'var(--text-4)' }}
          >
            Salon
          </p>
        </div>
      </div>

      {/* Specialization */}
      {s.specialization && (
        <div className="mt-3">
          <p
            className="text-[10px] mb-2 font-syne font-bold uppercase"
            style={{ color: 'var(--text-4)' }}
          >
            Specialization
          </p>

          <div className="flex flex-wrap gap-1.5">
            {s.specialization.split(',').map((item: string) => (
              <span
                key={item}
                className="px-2 py-1 rounded-full text-[10px]"
                style={{
                  background: 'var(--violet-bg)',
                  color: 'var(--violet-light)',
                  border: '1px solid var(--violet-border)',
                }}
              >
                {item.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Joined Date */}
      {s.joined_date && (
        <div className="flex items-center gap-2 mt-3">
          <Calendar
            size={12}
            style={{ color: 'var(--text-4)' }}
          />

          <div>
            <p
              className="text-[10px]"
              style={{ color: 'var(--text-4)' }}
            >
              Joined
            </p>

            <p
              className="text-[11px] font-syne font-bold"
              style={{ color: 'var(--text-2)' }}
            >
              {formatDate(s.joined_date)}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-2 mt-4 pt-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => setSelectedStaff(s.id)}
          className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            cursor: 'pointer',
          }}
        >
          View
        </button>

        <button
          onClick={() => setDeleteId(s.id)}
          className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold"
          style={{
            background: 'var(--red-bg)',
            color: 'var(--red)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>
    </motion.div>
  ))}
</div>
            </>
          )
        )}

        {/* ── Pending Staff ── */}
        {activeTab === 'pending' && (
          <>
            <div className="flex items-start gap-2.5 p-3 rounded-[10px] mb-4"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle size={14} style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 1 }} />
              <p className="text-[11px]" style={{ color: 'var(--text-2)' }}>
                These staff haven't completed account setup. An invitation email was sent. Resend after 48 hours if needed.
              </p>
            </div>
            {pendingLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} height="72px" className="rounded-[12px]" />)}</div>
            ) : pendingStaff.length === 0 ? (
              <EmptyState icon={<Users size={28} />} title="No pending staff" description="All staff have completed setup." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {pendingStaff.map((s: any, i: number) => {
    const hrs = s.created_at
      ? Math.floor(
          (Date.now() - new Date(s.created_at).getTime()) /
            3_600_000
        )
      : 0

    const canResend = hrs >= 48

    return (
      <motion.div
        key={s.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * i }}
        className="rounded-[16px] p-5 flex flex-col"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          minHeight: 280,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar
            name={s.name}
            src={s.avatar_url}
            size="lg"
          />

          <div className="flex-1 min-w-0">
            <p
              className="font-syne font-bold text-[14px] truncate"
              style={{ color: 'var(--text-1)' }}
            >
              {s.name}
            </p>

            <p
              className="text-[11px] truncate mt-1"
              style={{ color: 'var(--text-3)' }}
            >
              {s.email}
            </p>

            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full mt-2 text-[10px] font-bold"
              style={{
                background:
                  'rgba(245,158,11,0.12)',
                color: 'var(--yellow)',
                border:
                  '1px solid rgba(245,158,11,0.25)',
              }}
            >
              <Clock size={10} />
              Setup Pending
            </span>
          </div>
        </div>

        {/* Business */}
        {s.business_name && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl mt-4"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <Avatar
              name={s.business_name}
              src={s.business_logo}
              size="sm"
            />

            <div className="min-w-0">
              <p
                className="font-syne font-bold text-[12px] truncate"
                style={{ color: 'var(--text-1)' }}
              >
                {s.business_name}
              </p>

              <p
                className="text-[10px]"
                style={{ color: 'var(--text-4)' }}
              >
                Salon
              </p>
            </div>
          </div>
        )}

        {/* Specialization */}
        {s.specialization && (
          <div className="mt-4">
            <p
              className="text-[10px] mb-2 font-syne font-bold uppercase"
              style={{ color: 'var(--text-4)' }}
            >
              Specialization
            </p>

            <div className="flex flex-wrap gap-1.5">
              {s.specialization
                .split(',')
                .map((item: string) => (
                  <span
                    key={item}
                    className="px-2 py-1 rounded-full text-[10px]"
                    style={{
                      background:
                        'var(--violet-bg)',
                      color:
                        'var(--violet-light)',
                      border:
                        '1px solid var(--violet-border)',
                    }}
                  >
                    {item.trim()}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Invited */}
        <div className="flex items-center gap-2 mt-4">
          <Calendar
            size={13}
            style={{ color: 'var(--text-4)' }}
          />

          <div>
            <p
              className="text-[10px]"
              style={{ color: 'var(--text-4)' }}
            >
              Invited
            </p>

            <p
              className="text-[12px] font-syne font-bold"
              style={{ color: 'var(--text-2)' }}
            >
              {formatDate(s.created_at)}
            </p>
          </div>
        </div>

        {!canResend && (
          <p
            className="text-[10px] mt-3 font-syne font-bold"
            style={{ color: 'var(--yellow)' }}
          >
            Resend available in {48 - hrs}h
          </p>
        )}

        {/* Actions */}
        <div
          className="flex gap-2 mt-4 pt-3 border-t"
          style={{
            borderColor: 'var(--border)',
          }}
        >
          <button
            disabled={
              !canResend ||
              resendMut.isPending
            }
            onClick={() =>
              resendMut.mutate(s.id)
            }
            className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold disabled:opacity-40"
            style={{
              background:
                'var(--violet-bg)',
              color:
                'var(--violet-light)',
              border:
                '1px solid var(--violet-border)',
              cursor: canResend
                ? 'pointer'
                : 'not-allowed',
            }}
          >
            Resend
          </button>

          <button
            onClick={() => setDeleteId(s.id)}
            className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold"
            style={{
              background: 'var(--red-bg)',
              color: 'var(--red)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </motion.div>
    )
  })}
</div>
            )}
          </>
        )}

        {/* ── Modals ── */}
        <AnimatePresence>
          {showBizFilter && (
            <ModalWrap onClose={() => setShowBizFilter(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-xs rounded-[14px] overflow-hidden z-10"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '60vh' }}>
                <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Filter by Business</h3>
                </div>
                <div className="overflow-y-auto p-2">
                  {[{ id: '', business_name: 'All Businesses' }, ...(bizList ?? [])].map((b: any) => (
                    <button key={b.id} onClick={() => { setBizFilter(b.id); setShowBizFilter(false) }}
                      className="w-full flex items-center gap-3 p-3 rounded-[9px] text-left mb-1"
                      style={{ background: bizFilter === b.id ? 'var(--violet-bg)' : 'transparent', border: `1px solid ${bizFilter === b.id ? 'var(--violet-border)' : 'transparent'}`, cursor: 'pointer' }}>
                      {b.id === '' ? (
  <Building2
    size={13}
    style={{
      color:
        bizFilter === b.id
          ? 'var(--violet-light)'
          : 'var(--text-3)',
    }}
  />
) : (
  <Avatar
    name={b.business_name}
    src={b.logo_url}
    size="xs"
  />
)}
                      <span className="font-syne font-bold text-[12px]" style={{ color: bizFilter === b.id ? 'var(--violet-light)' : 'var(--text-1)' }}>{b.business_name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </ModalWrap>
          )}
          {selectedStaff && (
            <StaffDetailModal
              staffId={selectedStaff}
              businessId={(staffData ?? []).find((s: any) => s.id === selectedStaff)?.business_id ?? (bizList?.[0]?.id ?? '')}
              onClose={() => setSelectedStaff(null)}
            />
          )}
          {showAdd && <AddStaffModal businesses={bizList ?? []} onClose={() => setShowAdd(false)} />}
        </AnimatePresence>

        <ConfirmDialog open={!!deleteId} danger
          title="Remove Staff Member"
          description="This will remove the staff member from the system. They will lose access. This cannot be undone if they have no active bookings."
          confirmLabel="Remove" loading={deleteMut.isPending}
          onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
          onCancel={() => setDeleteId(null)} />

      </div>
    </div>
  )
}


import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Phone, MapPin, Building2, Star,
  Users, BookOpen, Calendar, Wallet,
  CheckCircle, XCircle, X, Scissors,
  Clock, Activity, ChevronRight, Award, TrendingUp,
} from 'lucide-react'
import { EmptyState, Skeleton, PaginationBar } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useDebounce, usePageTitle } from '@/hooks'
import { INDIA_STATES, getCitiesForState } from '@/data/india'
import api from '@/lib/axios'
import { normalizePagination, formatDate } from '@/lib/utils'
import { PieChart, Pie, Cell } from 'recharts'


interface OwnerListItem {
  id: string; name: string; email: string; phone: string | null
  avatar_url: string | null; city: string; state: string
  total_businesses: number; active_businesses: number
  business_count: number; is_active: boolean; joined_at: string
}
interface OwnerDetail {
  id: string; name: string; email: string; phone: string | null
  avatar_url: string | null; city: string; state: string
  address_line1: string | null; address_line2: string | null
  personal_info: string | null; total_businesses: number
  active_businesses: number; total_staff: number
  is_active: boolean; joined_at: string
  businesses: {
    id: string; business_name: string; city: string; state: string
    is_active: boolean; is_verified: boolean; average_rating: number
    logo_url: string | null; service_for: string | null
  }[]
}

interface CustomerListItem {
  id: string; username: string; name: string; email: string
  phone: string | null; avatar_url: string | null; city: string; state: string
  total_bookings: number; completed_bookings: number
  total_spent_inr: number; booking_count: number; review_count: number
  is_active: boolean; joined_at: string
}
interface CustomerDetail {
  id: string; username: string; name: string; email: string
  phone: string | null; avatar_url: string | null; city: string; state: string
  address_line1: string | null; total_bookings: number
  completed_bookings: number; cancelled_bookings: number
  total_spent_inr: number; review_count: number
  is_active: boolean; joined_at: string; first_login_at: string | null,
  no_show_bookings: number
  refunded_bookings: number
  refunded_amount_inr: number
}

interface StaffListItem {
  id: string; name: string; email: string; phone: string | null
  avatar_url: string | null; specialization: string | null
  average_rating: number; total_reviews: number
  is_active: boolean; is_verified: boolean
  business: {
    id: string
    business_name: string
    city: string
    logo_url?: string | null   // 🔥 ADD THIS
  }
  booking_count: number; review_count: number; joined_at: string
}
interface StaffDetail {
  id: string; name: string; email: string; phone: string | null
  avatar_url: string | null; bio: string | null
  specialization: string | null; experience_years: number | null
  city: string | null; state: string | null
  average_rating: number; total_reviews: number
  is_active: boolean; is_verified: boolean
  business: {
  id: string
  business_name: string
  city: string
  state: string
  logo_url?: string | null // 🔥 ADD THIS
}
  services: {
    name: string; duration_minutes: number; is_available: boolean
    service_offering: {
      price?: number
      platform_service?: {
  name: string
  category: string
  service_for: string
  image_url?: string | null // 🔥 ADD THIS
}
    }
  }[]
  schedules: {
    day_of_week: string; is_available: boolean
    start_time: string | null; end_time: string | null
  }[]
  completed_bookings?: number // 🔥 ADD THIS
  booking_count: number; review_count: number; leave_count: number
  joined_at: string,
  total_earnings_inr?: number
}

function Pill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 rounded-lg font-syne font-bold text-xs whitespace-nowrap transition-all"
      style={{
        background: active ? 'var(--violet)' : 'var(--bg-surface)',
        color: active ? '#fff' : 'var(--text-3)',
        border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
        cursor: 'pointer', flexShrink: 0,
      }}>
      {children}
    </button>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-syne font-bold flex-shrink-0"
      style={{
        background: active ? 'var(--green-bg)' : 'var(--red-bg)',
        color: active ? 'var(--green)' : 'var(--red)',
        border: `1px solid ${active ? 'var(--green-border)' : 'rgba(239,68,68,0.2)'}`,
      }}>
      {active ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14"
        viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="q-input w-full text-sm"
        style={{ paddingLeft: '2.25rem', paddingRight: value ? '2.25rem' : undefined }} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={13} />
        </button>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
      {icon && <span style={{ color }}>{icon}</span>}
      <p className="font-syne font-black text-xl" style={{ color }}>{value}</p>
      <p className="text-xs font-syne font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  )
}

function InfoChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
      {icon}{children}
    </span>
  )
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <p className="text-xs font-syne font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
      {children}
      {count !== undefined && (
        <span className="ml-1.5 font-mono normal-case tracking-normal opacity-60">({count})</span>
      )}
    </p>
  )
}

function Modal({ open, onClose, children, maxWidth = '640px' }: {
  open: boolean; onClose: () => void; children: React.ReactNode; maxWidth?: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full overflow-hidden"
            style={{
              maxWidth,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -12px 48px rgba(0,0,0,0.3)',
            }}>
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden sticky top-0 z-10" style={{ background: 'var(--bg-base)' }}>
              <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            {/* close button */}
            <button type="button" onClick={onClose}
              className="absolute top-4 right-4 z-20 flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ModalSkeleton() {
  return (
    <div className="p-5 space-y-4 pt-8">
      <div className="flex items-center gap-3 pr-8">
        <Skeleton height="56px" className="rounded-full w-14 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton height="20px" className="rounded-lg w-40" />
          <Skeleton height="14px" className="rounded-lg w-60" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[1,2,3].map(i => <Skeleton key={i} height="72px" className="rounded-xl" />)}
      </div>
      <Skeleton height="120px" className="rounded-2xl" />
      <Skeleton height="90px" className="rounded-2xl" />
    </div>
  )
}

function CustomerModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: c, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['admin-customer-detail', customerId],
    queryFn: async () => { const r = await api.get(`/admin/users/customers/${customerId}`); return r.data.data },
    enabled: !!customerId, staleTime: 0,
  })

  const completionPct = c && c.total_bookings > 0
    ? Math.round((c.completed_bookings / c.total_bookings) * 100) : 0

  const pieData = c ? [
  { name: 'Completed', value: c.completed_bookings ?? 0, color: '#34d399' },
  { name: 'No-show',   value: c.no_show_bookings ?? 0, color: '#f59e0b' },
  { name: 'Refunded',  value: c.refunded_bookings ?? 0, color: '#f97316' },
].filter(d => d.value > 0) : []

  return (
    <Modal open onClose={onClose} maxWidth="520px">
      {isLoading ? <ModalSkeleton /> : !c ? (
        <div className="p-6"><EmptyState title="Customer not found" /></div>
      ) : (
        <div>
          {/* Hero */}
          <div className="px-5 pt-2 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start gap-4 pr-8">
              <Avatar name={c.name} src={c.avatar_url} size="xl" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="font-syne font-black text-[17px]" style={{ color: 'var(--text-1)' }}>{c.name}</h2>
                  {c.username && <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>@{c.username}</span>}
                  <StatusBadge active={c.is_active} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <InfoChip icon={<Mail size={11} />}>{c.email}</InfoChip>
                  {c.phone && <InfoChip icon={<Phone size={11} />}>{c.phone}</InfoChip>}
                  {(c.city || c.state) && (
                    <InfoChip icon={<MapPin size={11} />}>{[c.city, c.state].filter(Boolean).join(', ')}</InfoChip>
                  )}
                  {c.joined_at && <InfoChip icon={<Calendar size={11} />}>Joined {formatDate(c.joined_at)}</InfoChip>}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard label="Total Bookings"  value={c.total_bookings ?? 0}     color="var(--violet-light)" icon={<BookOpen size={13} />} />
              <StatCard label="Completed"        value={c.completed_bookings ?? 0} color="var(--green)"        icon={<CheckCircle size={13} />} />
              <StatCard
  label="No-show"
  value={c.no_show_bookings ?? 0}
  color="#f59e0b"
  icon={<Activity size={13} />}
/>

<StatCard
  label="Refunded Count"
  value={c.refunded_bookings ?? 0}
  color="#f97316"
  icon={<TrendingUp size={13} />}
/>
              <StatCard label="Total Spent"
                value={`₹${(c.total_spent_inr ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                color="#34d399" icon={<Wallet size={13} />} />
              <StatCard label="Reviews"  value={c.review_count ?? 0}  color="#f59e0b" icon={<Star size={13} />} />
              <StatCard
  label="Refunded"
  value={`₹${(c.refunded_amount_inr ?? 0).toLocaleString('en-IN')}`}
  color="#f97316"
/>

            </div>

            {/* Pie breakdown */}
            {pieData.length > 0 && (
              <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <SectionLabel>Booking Breakdown</SectionLabel>
                <div className="flex items-center gap-5">
                  <PieChart width={104} height={104}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                    </Pie>
                  </PieChart>
                  <div className="flex-1 space-y-2.5">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-sm font-syne font-bold" style={{ color: 'var(--text-2)' }}>{d.name}</span>
                        </div>
                        <span className="font-syne font-black text-base" style={{ color: d.color }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            
          </div>
        </div>
      )}
      
    </Modal>
  )
}

function OwnerModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const { data: o, isLoading } = useQuery<OwnerDetail>({
    queryKey: ['admin-owner-detail', ownerId],
    queryFn: async () => { const r = await api.get(`/admin/users/owners/${ownerId}`); return r.data.data },
    enabled: !!ownerId, staleTime: 0,
  })

  return (
    <Modal open onClose={onClose} maxWidth="620px">
      {isLoading ? <ModalSkeleton /> : !o ? (
        <div className="p-6"><EmptyState title="Owner not found" /></div>
      ) : (
        <div>
          {/* Hero */}
          <div className="px-5 pt-2 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start gap-4 pr-8">
              <Avatar name={o.name} src={o.avatar_url} size="xl" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="font-syne font-black text-[17px]" style={{ color: 'var(--text-1)' }}>{o.name}</h2>
                  <StatusBadge active={o.is_active} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <InfoChip icon={<Mail size={11} />}>{o.email}</InfoChip>
                  {o.phone && <InfoChip icon={<Phone size={11} />}>{o.phone}</InfoChip>}
                  {o.city && <InfoChip icon={<MapPin size={11} />}>{o.city}{o.state ? `, ${o.state}` : ''}</InfoChip>}
                  {o.joined_at && <InfoChip icon={<Calendar size={11} />}>Joined {formatDate(o.joined_at)}</InfoChip>}
                </div>
                {o.personal_info && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{o.personal_info}</p>
                )}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              <StatCard label="Total Businesses"  value={o.total_businesses ?? o.businesses?.length ?? 0}                                   color="var(--violet-light)" icon={<Building2 size={13} />} />
              <StatCard label="Active Businesses" value={o.active_businesses ?? o.businesses?.filter(b => b.is_active).length ?? 0}          color="var(--green)"        icon={<CheckCircle size={13} />} />
              <StatCard label="Staff Across Businesses" value={o.total_staff ?? 0}                                                             color="#60a5fa"             icon={<BookOpen size={13} />} />
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Businesses list */}
            {o.businesses && o.businesses.length > 0 && (
              <div>
                <SectionLabel count={o.businesses.length}>Businesses</SectionLabel>
                <div className="space-y-2">
                  {o.businesses.map(biz => (
                    <div key={biz.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                      <Avatar name={biz.business_name} src={biz.logo_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-syne font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>
                          {biz.business_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
                          {biz.city && (
                            <span className="flex items-center gap-1">
                              <MapPin size={9} />{biz.city}{biz.state ? `, ${biz.state}` : ''}
                            </span>
                          )}
                          {biz.average_rating > 0 && (
                            <span className="flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
                              <Star size={9} fill="currentColor" />{biz.average_rating.toFixed(1)}
                            </span>
                          )}
                          {biz.service_for && (
                            <span className="px-1.5 py-0.5 rounded font-syne font-bold text-[10px]"
                              style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)' }}>
                              {biz.service_for}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-syne font-bold"
                          style={{
                            background: biz.is_active ? 'var(--green-bg)' : 'var(--red-bg)',
                            color: biz.is_active ? 'var(--green)' : 'var(--red)',
                          }}>
                          {biz.is_active ? 'Active' : 'Inactive'}
                        </span>
                        
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
          </div>
        </div>
      )}
    </Modal>
  )
}

const ORDERED_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'] as const

function StaffModal({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const { data: s, isLoading } = useQuery<StaffDetail>({
    queryKey: ['admin-staff-detail', staffId],
    queryFn: async () => { const r = await api.get(`/admin/users/staff/${staffId}`); return r.data.data },
    enabled: !!staffId, staleTime: 0,
  })
  const [openReviews, setOpenReviews] = useState(false)

  const { data: reviews } = useQuery<any[]>({
    queryKey: ['staff-reviews', staffId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/staff/${staffId}/reviews`)
      return res.data.data
    },
    enabled: openReviews,
  })

  return (
    <Modal open onClose={onClose} maxWidth="600px">
      {isLoading ? <ModalSkeleton /> : !s ? (
        <div className="p-6"><EmptyState title="Staff member not found" /></div>
      ) : (
        <div>
          {/* Hero */}
          <div className="px-5 pt-2 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start gap-4 pr-8">
              <Avatar name={s.name} src={s.avatar_url} size="xl" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="font-syne font-black text-[17px]" style={{ color: 'var(--text-1)' }}>{s.name}</h2>
                  {s.specialization && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-syne font-bold"
                      style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                      {s.specialization}
                    </span>
                  )}
                  <StatusBadge active={s.is_active} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <InfoChip icon={<Mail size={11} />}>{s.email}</InfoChip>
                  {s.phone && <InfoChip icon={<Phone size={11} />}>{s.phone}</InfoChip>}
                  {s.business && (
  <div className="flex items-center gap-2">
    {s.business?.logo_url && (
      <img
        src={s.business.logo_url}
        className="w-5 h-5 rounded object-cover"
      />
    )}
    <InfoChip icon={<Building2 size={11} />}>
      {s.business.business_name}
    </InfoChip>
  </div>
)}
                  {s.business?.city && (
                    <InfoChip icon={<MapPin size={11} />}>
                      {s.business.city}{s.business.state ? `, ${s.business.state}` : ''}
                    </InfoChip>
                  )}
                  {s.experience_years != null && (
                    <InfoChip icon={<Clock size={11} />}>{s.experience_years} yrs exp</InfoChip>
                  )}
                </div>
              </div>
            </div>

            {/* Rating banner */}
            {s.average_rating > 0 && (
              <div className="flex items-center gap-3 mt-4 p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Award size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div className="flex-1">
                  <span className="font-syne font-black text-2xl" style={{ color: '#f59e0b' }}>
                    {s.average_rating.toFixed(1)}
                  </span>
                  <span className="text-sm ml-1" style={{ color: '#f59e0b' }}>★</span>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-3)' }}>from {s.total_reviews} reviews</span>
                </div>

                <button
  className="mt-3 text-xs font-syne font-bold px-3 py-1.5 rounded-lg"
  style={{
    background: 'var(--violet-bg)',
    color: 'var(--violet-light)',
    border: '1px solid var(--violet-border)',
  }}
  onClick={() => setOpenReviews(true)}
>
  View Reviews
</button>
                
              </div>
            )}

            {s.bio && (
              <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.bio}</p>
            )}
          </div>

          <div className="p-5 space-y-5">
            {/* Performance stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard
  label="Completed"
  value={s.completed_bookings ?? s.booking_count ?? 0}
  color="var(--green)"
  icon={<CheckCircle size={13} />}
/>
              <StatCard
  label="Total Earnings"
  value={`₹${(s.total_earnings_inr ?? 0).toLocaleString('en-IN')}`}
  color="#34d399"
  icon={<Wallet size={13} />}
/>
            </div>

            {/* Services */}
            {s.services && s.services.length > 0 && (
              <div>
                <SectionLabel count={s.services.length}>Services Offered</SectionLabel>
                <div className="space-y-2">
                  {s.services.map((sv, i) => {
                    const svcName  = sv.service_offering?.platform_service?.name ?? sv.name ?? 'Service'
                    const svcPrice = sv.service_offering?.price
                    const category = sv.service_offering?.platform_service?.category

                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-2xl"
style={{
  background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(0,0,0,0.2))',
  border: '1px solid var(--border)',
}}>
                        {/* No image_url in API select — use icon */}
                        {sv.service_offering?.platform_service?.image_url ? (
  <img
    src={sv.service_offering.platform_service.image_url}
    className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
  />
) : (
  <div
    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
    style={{ background: 'var(--violet-bg)' }}
  >
    <Scissors size={14} style={{ color: 'var(--violet-light)' }} />
  </div>
)}
                        <div className="flex-1 min-w-0">
                          <p className="font-syne font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>{svcName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-3)' }}>
                              <Clock size={9} />{sv.duration_minutes} min
                            </span>
                            {svcPrice != null && (
                              <span className="text-xs font-syne font-bold" style={{ color: '#34d399' }}>
                                ₹{(svcPrice / 100).toLocaleString('en-IN')}
                              </span>
                            )}
                            
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-syne font-bold flex-shrink-0"
                          style={{
                            background: sv.is_available ? 'var(--green-bg)' : 'var(--red-bg)',
                            color: sv.is_available ? 'var(--green)' : 'var(--red)',
                          }}>
                          {sv.is_available ? 'On' : 'Off'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Schedule */}
            {s.schedules && s.schedules.length > 0 && (
              <div>
                <SectionLabel>Weekly Schedule</SectionLabel>
                <div className="grid grid-cols-7 gap-1">
                  {ORDERED_DAYS.map(day => {
                    const sc = s.schedules.find(x => x.day_of_week === day)
                    const on = sc?.is_available ?? false
                    return (
                      <div key={day} className="p-3 rounded-2xl text-center"
style={{
  background: on
    ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(0,0,0,0.2))'
    : 'var(--bg-surface)',
  border: `1px solid ${on ? 'var(--green-border)' : 'var(--border)'}`,
}}>
                        <p className="font-syne font-black text-[11px]"
                          style={{ color: on ? 'var(--green)' : 'var(--text-3)' }}>
                          {day.slice(0, 3)}
                        </p>
                        {on && sc?.start_time ? (
                          <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'var(--text-2)' }}>
                            {sc.start_time}<br />{sc.end_time}
                          </p>
                        ) : (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)', opacity: 0.5 }}>Off</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            
          </div>
        </div>
      )}

       {/* 🔥 ADD HERE */}
    {openReviews && (
      <Modal open onClose={() => setOpenReviews(false)} maxWidth="500px">
        <div className="p-5">
          <h3 className="font-syne font-bold text-lg mb-4">Reviews</h3>

          {!reviews?.length ? (
            <p className="text-sm text-c3">No reviews yet</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r: any) => (
                <div key={r.id} className="p-3 rounded-xl"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                  }}>
                  
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar
                      name={r.customer?.name}
                      src={r.customer?.avatar_url}
                      size="sm"
                    />
                    <p className="text-sm font-syne font-bold">
                      {r.customer?.name}
                    </p>
                    <span className="text-xs text-yellow-400">
                      ⭐ {r.rating}
                    </span>
                  </div>

                  {r.comment && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                      {r.comment}
                    </p>
                  )}

                  {Array.isArray(r.services) && r.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.services.map((s: any, i: number) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 6,
                          background: 'var(--violet-bg)', border: '1px solid var(--violet-border)',
                        }}>
                          {s.image_url && (
                            <img src={s.image_url} alt="" style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover' }} />
                          )}
                          <span style={{ fontSize: 10, color: 'var(--violet-light)', fontFamily: 'Syne', fontWeight: 700 }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(r.images) && r.images.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {r.images.map((img: string, i: number) => (
                        <img key={i} src={img} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}

                  {r.business_response && (
                    <div style={{ background: 'var(--violet-bg)', borderLeft: '2px solid var(--violet)', borderRadius: '0 8px 8px 0', padding: '6px 10px', marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: 'var(--violet-light)', marginBottom: 2 }}>Business replied</p>
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.business_response}</p>
                    </div>
                  )}

                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-4)' }}>
                    {r.service_date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    )}
    </Modal>
  )
}

export default function AdminOwners() {
  usePageTitle('Owners · Admin')
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)
  const [state,  setState]  = useState('')
  const [city,   setCity]   = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dSearch    = useDebounce(search, 350)
  const cities     = getCitiesForState(state)
  const hasFilters = !!state || !!city

  const { data, isLoading } = useQuery({
    queryKey: ['admin-owners', dSearch, page, state, city],
    queryFn: async () => {
      const res = await api.get('/admin/users/owners', {
        params: { search: dSearch || undefined, state: state || undefined, city: city || undefined, page, limit: 20 },
      })
      return res.data.data as { owners: OwnerListItem[]; pagination: any }
    },
    staleTime: 0, placeholderData: prev => prev,
  })

  const owners     = data?.owners ?? []
  const pagination = data?.pagination ? normalizePagination(data.pagination) : null

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 w-full space-y-4" style={{ background: 'var(--bg-page)' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-syne font-black text-2xl lg:text-3xl" style={{ color: 'var(--text-1)' }}>Business Owners</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{pagination?.total ?? 0} owners registered</p>
      </motion.div>

      <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by name, phone or email…" />

      <div className="q-card space-y-3" style={{ padding: '14px 16px' }}>
        <p className="text-xs font-syne font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Location Filter</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-syne font-bold block mb-1.5" style={{ color: 'var(--text-3)' }}>State</label>
            <select value={state} onChange={e => { setState(e.target.value); setCity(''); setPage(1) }} className="q-input text-sm">
              <option value="">All states</option>
              {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-syne font-bold block mb-1.5" style={{ color: 'var(--text-3)' }}>City</label>
            <select value={city} onChange={e => { setCity(e.target.value); setPage(1) }} className="q-input text-sm" disabled={!state}>
              <option value="">{state ? 'All cities' : 'Select state first'}</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && (
          <button type="button" onClick={() => { setState(''); setCity(''); setPage(1) }}
            className="text-xs font-syne font-bold px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} height="76px" className="rounded-xl" />)}</div>
      ) : !owners.length ? (
        <EmptyState icon={<Users size={26} />} title="No owners found" />
      ) : (
        <div className="space-y-2">
          {owners.map((o, idx) => (
            <motion.div key={o.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.018 }}
              whileHover={{ scale: 1.001 }} whileTap={{ scale: 0.999 }}
              onClick={() => setSelectedId(o.id)}
              className="q-card flex items-center gap-3 cursor-pointer" style={{ padding: '11px 15px' }}>
              <Avatar name={o.name} src={o.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <p className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>{o.name}</p>
                  {!o.is_active && <StatusBadge active={false} />}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
                  <span className="flex items-center gap-1 min-w-0 truncate max-w-[200px]"><Mail size={11} className="flex-shrink-0" />{o.email}</span>
                  {o.phone && <span className="flex items-center gap-1 flex-shrink-0"><Phone size={11} />{o.phone}</span>}
                  {o.city && <span className="flex items-center gap-1 flex-shrink-0"><MapPin size={11} />{o.city}{o.state ? `, ${o.state}` : ''}</span>}
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Building2 size={11} />{o.total_businesses ?? o.business_count ?? 0} businesses
                  </span>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </motion.div>
          ))}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <PaginationBar page={page} totalPages={pagination.total_pages} onPageChange={setPage} />
      )}

      {selectedId && <OwnerModal ownerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

export function AdminCustomers() {
  usePageTitle('Customers · Admin')
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)
  const [state,  setState]  = useState('')
  const [city,   setCity]   = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dSearch    = useDebounce(search, 350)
  const cities     = getCitiesForState(state)
  const hasFilters = !!state || !!city

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', dSearch, page, state, city],
    queryFn: async () => {
      const res = await api.get('/admin/users/customers', {
        params: { search: dSearch || undefined, state: state || undefined, city: city || undefined, page, limit: 20 },
      })
      return res.data.data as { customers: CustomerListItem[]; pagination: any }
    },
    staleTime: 0, placeholderData: prev => prev,
  })

  const customers  = data?.customers ?? []
  const pagination = data?.pagination ? normalizePagination(data.pagination) : null

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 w-full space-y-4" style={{ background: 'var(--bg-page)' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-syne font-black text-2xl lg:text-3xl" style={{ color: 'var(--text-1)' }}>Customers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{pagination?.total ?? 0} customers registered</p>
      </motion.div>

      <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by name, username, email…" />

      <div className="q-card space-y-3" style={{ padding: '14px 16px' }}>
        <p className="text-xs font-syne font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Location Filter</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-syne font-bold block mb-1.5" style={{ color: 'var(--text-3)' }}>State</label>
            <select value={state} onChange={e => { setState(e.target.value); setCity(''); setPage(1) }} className="q-input text-sm">
              <option value="">All states</option>
              {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-syne font-bold block mb-1.5" style={{ color: 'var(--text-3)' }}>City</label>
            <select value={city} onChange={e => { setCity(e.target.value); setPage(1) }} className="q-input text-sm" disabled={!state}>
              <option value="">{state ? 'All cities' : 'Select state first'}</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && (
          <button type="button" onClick={() => { setState(''); setCity(''); setPage(1) }}
            className="text-xs font-syne font-bold px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} height="76px" className="rounded-xl" />)}</div>
      ) : !customers.length ? (
        <EmptyState icon={<Users size={26} />} title="No customers found" description={hasFilters ? 'Try adjusting filters.' : undefined} />
      ) : (
        <div className="space-y-2">
          {customers.map((c, idx) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.018 }}
              whileHover={{ scale: 1.001 }} whileTap={{ scale: 0.999 }}
              onClick={() => setSelectedId(c.id)}
              className="q-card flex items-center gap-3 cursor-pointer" style={{ padding: '11px 15px' }}>
              <Avatar name={c.name} src={c.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-syne font-bold text-[15px] truncate" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                  {c.username && <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>@{c.username}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
                  <span className="flex items-center gap-1 min-w-0 truncate max-w-[200px]"><Mail size={11} className="flex-shrink-0" />{c.email}</span>
                  {(c.city || c.state) && (
                    <span className="flex items-center gap-1 flex-shrink-0"><MapPin size={11} />{[c.city, c.state].filter(Boolean).join(', ')}</span>
                  )}
          
                  {c.total_spent_inr > 0 && (
                    <span className="flex items-center gap-1 flex-shrink-0" style={{ color: '#34d399' }}>
                      <Wallet size={11} />₹{c.total_spent_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </motion.div>
          ))}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <PaginationBar page={page} totalPages={pagination.total_pages} onPageChange={setPage} />
      )}

      {selectedId && <CustomerModal customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

export function AdminStaff() {
  usePageTitle('Staff · Admin')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [bizId,   setBizId]   = useState('')
  const [rating,  setRating]  = useState<'all' | '4plus' | '3plus'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dSearch    = useDebounce(search, 350)
  const hasFilters = !!bizId || rating !== 'all'

  const { data: bizData } = useQuery({
    queryKey: ['admin-biz-simple'],
    queryFn: async () => {
      const r = await api.get('/admin/businesses', { params: { limit: 100 } })
      return (r.data.data?.businesses ?? []) as { id: string; business_name: string }[]
    },
    staleTime: 5 * 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff', dSearch, page, bizId],
    queryFn: async () => {
      const res = await api.get('/admin/users/staff', {
        params: { search: dSearch || undefined, business_id: bizId || undefined, page, limit: 20 },
      })
      return res.data.data as { staff: StaffListItem[]; pagination: any }
    },
    staleTime: 0, placeholderData: prev => prev,
  })

  const allStaff = (data?.staff ?? []).filter(s => {
    if (rating === '4plus' && (s.average_rating ?? 0) < 4) return false
    if (rating === '3plus' && (s.average_rating ?? 0) < 3) return false
    return true
  })
  const pagination = data?.pagination ? normalizePagination(data.pagination) : null

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 w-full space-y-4" style={{ background: 'var(--bg-page)' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-syne font-black text-2xl lg:text-3xl" style={{ color: 'var(--text-1)' }}>Staff</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{pagination?.total ?? 0} staff members</p>
      </motion.div>

      <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search staff by name, email or phone…" />

      <div className="q-card space-y-4" style={{ padding: '14px 16px' }}>
        <div>
          <p className="text-xs font-syne font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Business</p>
          <select value={bizId} onChange={e => { setBizId(e.target.value); setPage(1) }} className="q-input text-sm">
            <option value="">All businesses</option>
            {(bizData ?? []).map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs font-syne font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Rating</p>
          <div className="flex gap-2">
            {([['all','All'],['4plus','4★ & above'],['3plus','3★ & above']] as const).map(([v, l]) => (
              <Pill key={v} active={rating === v} onClick={() => { setRating(v); setPage(1) }}>{l}</Pill>
            ))}
          </div>
        </div>
        {hasFilters && (
          <button type="button" onClick={() => { setBizId(''); setRating('all'); setPage(1) }}
            className="text-xs font-syne font-bold px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} height="76px" className="rounded-xl" />)}</div>
      ) : !allStaff.length ? (
        <EmptyState icon={<Users size={26} />} title="No staff found" description={hasFilters ? 'Try adjusting filters.' : undefined} />
      ) : (
        <div className="space-y-2">
          {allStaff.map((s, idx) => (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.018 }}
              whileHover={{ scale: 1.001 }} whileTap={{ scale: 0.999 }}
              onClick={() => setSelectedId(s.id)}
              className="q-card flex items-center gap-3 cursor-pointer" style={{ padding: '11px 15px' }}>
              <Avatar name={s.name} src={s.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <p className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>{s.name}</p>
                  {s.specialization && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-syne font-bold flex-shrink-0"
                      style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                      {s.specialization}
                    </span>
                  )}
                  {s.average_rating > 0 && (
                    <span className="flex items-center gap-1 text-xs font-syne font-bold flex-shrink-0" style={{ color: '#f59e0b' }}>
                      <Star size={11} fill="currentColor" />{s.average_rating.toFixed(1)} ({s.total_reviews})
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
                  {s.business && (
  <div className="flex items-center gap-2">
    {s.business.logo_url ? (
      <img
        src={s.business.logo_url}
        className="w-5 h-5 rounded object-cover"
      />
    ) : (
      <Building2 size={11} />
    )}

    <span className="truncate">
      {s.business.business_name}
    </span>
  </div>
)}
                  {s.business?.city && (
                    <span className="flex items-center gap-1 flex-shrink-0"><MapPin size={11} />{s.business.city}</span>
                  )}
                  
                </div>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </motion.div>
          ))}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <PaginationBar page={page} totalPages={pagination.total_pages} onPageChange={setPage} />
      )}

      {selectedId && <StaffModal staffId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

export function AdminOwnerDetail() {
  return <AdminOwners />
}

export function AdminCustomerDetail() {
  return <AdminCustomers />
}

export function AdminStaffDetail() {
  return <AdminStaff />
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, Building2, CreditCard,
  CheckCircle, AlertTriangle, RotateCcw,
  Search, X, Phone, Star, ChevronDown, ChevronUp,
  Play, Timer, Scissors, Loader2, User, Users,
} from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { EmptyState } from '@/components/shared'
import { useSocketEvent, usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'

const fmtDate = (d: string) => {
  if (!d) return '—'
  const fixed = (!d.includes('T') && d.length === 10) ? d + 'T00:00:00+05:30' : d
  return new Date(fixed).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

const fmtTime = (d?: string | null): string => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  }).replace('am', 'AM').replace('pm', 'PM')
}

function getArrivalOpen(booking: any): boolean {
  const now = new Date()
  return !!(
    booking?.arrival_window_start &&
    booking?.scan_window_end &&
    now >= new Date(booking.arrival_window_start) &&
    now <= new Date(booking.scan_window_end)
  )
}

function getStatusCfg(status: string, service_started_at?: string | null, arrivalOpen?: boolean) {
  switch (status?.toUpperCase()) {
    case 'CONFIRMED':
      return arrivalOpen
        ? { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)', label: 'Awaiting Check-In' }
        : { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)', label: 'Confirmed' }
    case 'CHECKED_IN':
      return { bg: 'rgba(52,211,153,0.12)', color: 'var(--green)',        border: 'var(--green-border)',   label: 'Checked In'        }
    case 'RUNNING':
      return service_started_at
        ? { bg: 'rgba(52,211,153,0.12)', color: 'var(--green)',  border: 'var(--green-border)',           label: 'In Progress'       }
        : { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa',       border: 'rgba(96,165,250,0.3)',          label: 'Awaiting Check-In' }
    case 'COMPLETED':
      return { bg: 'var(--violet-bg)',      color: 'var(--violet-light)', border: 'var(--violet-border)', label: 'Completed'         }
    case 'CANCELLED':
      return { bg: 'var(--red-bg)',         color: 'var(--red)',          border: 'rgba(239,68,68,0.3)',  label: 'Cancelled'         }
    case 'NO_SHOW':
      return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b',             border: 'rgba(245,158,11,0.3)', label: 'No Show'           }
    case 'REFUND_INITIATED':
      return { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa',             border: 'rgba(96,165,250,0.3)', label: 'Refund Pending'    }
    case 'REFUNDED':
      return { bg: 'var(--green-bg)',       color: 'var(--green)',        border: 'var(--green-border)',  label: 'Refunded'          }
    default:
      return { bg: 'var(--bg-surface)',     color: 'var(--text-3)',       border: 'var(--border)',         label: status              }
  }
}

function StatusBadge({ status, service_started_at, arrivalOpen }: { status: string; service_started_at?: string | null; arrivalOpen?: boolean }) {
  const cfg = getStatusCfg(status, service_started_at, arrivalOpen)
  return (
    <span style={{
      fontSize: 9, padding: '3px 8px', borderRadius: 6,
      fontFamily: 'Syne', fontWeight: 800, flexShrink: 0,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
    }}>
      {cfg.label}
    </span>
  )
}

function ServiceImg({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (src && !err) return (
    <img src={src} alt={name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: 6, flexShrink: 0, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Scissors size={size * 0.45} style={{ color: 'var(--violet-light)', opacity: 0.7 }} />
    </div>
  )
}

type MainTab = 'running' | 'today' | 'upcoming' | 'completed' | 'no_show' | 'refund'

interface TabDef { key: MainTab; label: string; icon: React.ReactNode; color: string }

const MAIN_TABS: TabDef[] = [
  { key: 'running',   label: 'Running',   icon: <Play size={11} />,          color: '#34d399'     },
  { key: 'today',     label: 'Today',     icon: <Clock size={11} />,         color: '#a78bfa'     },
  { key: 'upcoming',  label: 'Upcoming',  icon: <Calendar size={11} />,      color: '#8b5cf6'     },
  { key: 'completed', label: 'Completed', icon: <CheckCircle size={11} />,   color: '#8b5cf6'     },
  { key: 'no_show',   label: 'No Show',   icon: <AlertTriangle size={11} />, color: '#f59e0b'     },
  { key: 'refund',    label: 'Refunds',   icon: <RotateCcw size={11} />,     color: '#60a5fa'     },
]

function DatePicker({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 4 : 6,
        padding: compact ? '7px 10px' : '7px 11px', borderRadius: 10,
        background: value ? 'var(--violet-bg)' : 'var(--bg-surface)',
        border: `1px solid ${value ? 'var(--violet-border)' : 'var(--border)'}`,
        cursor: 'pointer', position: 'relative', flexShrink: 0,
      }}
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <Calendar size={13} style={{ color: value ? 'var(--violet-light)' : 'var(--text-3)', flexShrink: 0 }} />
      {!compact && (
        <span style={{ fontSize: 12, color: value ? 'var(--violet-light)' : 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 130 }}>
          {value
            ? new Date(value + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
            : 'Date'}
        </span>
      )}
      {value && (
        <button
          onClick={e => { e.stopPropagation(); onChange('') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--violet-light)', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
        >
          <X size={11} />
        </button>
      )}
      <input
        ref={inputRef} type="date" value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
      />
    </div>
  )
}

function BookingCard({ booking, onClick }: { booking: any; onClick: () => void }) {
  const cfg    = getStatusCfg(booking.status, booking.service_started_at)
  const svcAmt = booking.service_amount ?? 0
  const services = Array.isArray(booking.services) ? booking.services : []

  const [logoErr, setLogoErr]       = useState(false)
  const [staffAvatarErr, setStaffAvatarErr] = useState(false)

  const isCompleted = booking.status === 'COMPLETED'

  return (
    <motion.div
      layout
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Colored top bar — inner div avoids sharp-corner clipping */}
      <div style={{ height: 3, background: cfg.color }} />

      {/* ── Header: Customer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 10px',
        borderBottom: '1px solid var(--border)',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <Avatar
            name={booking.customer_name ?? booking.customer?.name ?? '?'}
            src={booking.customer_avatar ?? booking.customer?.avatar_url ?? null}
            size="md"
          />
          <p style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {booking.customer_name ?? booking.customer?.name ?? '—'}
          </p>
        </div>
        <StatusBadge status={booking.status} service_started_at={booking.service_started_at} arrivalOpen={getArrivalOpen(booking)} />
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>

        {/* Service chips — image + name + price only */}
        {services.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {services.slice(0, 2).map((s: any, i: number) => {
              const name  = typeof s === 'string' ? s : (s?.name ?? '')
              const img   = typeof s === 'string' ? null : (s?.image_url ?? null)
              const price = typeof s === 'string' ? null : (s?.price ?? null)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', borderRadius: 20, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', flexShrink: 0 }}>
                  <ServiceImg src={img} name={name} size={20} />
                  <span style={{ fontSize: 10.5, color: 'var(--violet-light)', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  {price != null && <span style={{ fontSize: 10, color: 'var(--violet-light)', fontFamily: 'JetBrains Mono, monospace', opacity: 0.8, marginLeft: 2 }}>{formatINR(price)}</span>}
                </div>
              )
            })}
            {services.length > 2 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{services.length - 2}</span>}
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Salon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
            {booking.business_logo && !logoErr
              ? <img src={booking.business_logo} alt={booking.business_name} onError={() => setLogoErr(true)} style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
              : <Building2 size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            }
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Salon</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.business_name ?? '—'}</span>
        </div>

        {/* Staff */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
            {booking.staff_avatar && !staffAvatarErr
              ? <img src={booking.staff_avatar} alt={booking.staff_name} onError={() => setStaffAvatarErr(true)} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <User size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            }
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Staff</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{booking.staff_name ?? booking.staff?.name ?? '—'}</span>
        </div>

        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
            <Calendar size={11} style={{ color: cfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Date</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{fmtDate(booking.service_date)}</span>
        </div>

        {/* Time — actual for completed */}
        {booking.service_start_time && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <Clock size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>{isCompleted ? 'Started' : 'Time'}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {isCompleted
                ? fmtTime(booking.actual_start_time ?? booking.service_started_at ?? booking.service_start_time)
                : fmtTime(booking.service_start_time)
              }
            </span>
          </div>
        )}

        {/* Queue */}
        {booking.queue_number != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <Users size={11} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Queue</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet-light)', fontFamily: 'JetBrains Mono, monospace' }}>#{booking.queue_number}</span>
          </div>
        )}

        {/* Amount */}
        {svcAmt > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <CreditCard size={11} style={{ color: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Paid</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>{formatINR(svcAmt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── View Details button ── */}
      <button
        onClick={onClick}
        style={{
          margin: '0 12px 12px', padding: '9px 0', borderRadius: 9,
          border: `1px solid ${cfg.border}`, background: cfg.bg,
          color: cfg.color, fontSize: 11, fontFamily: 'Syne', fontWeight: 700,
          cursor: 'pointer', width: 'calc(100% - 24px)', letterSpacing: '0.03em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        View Details
      </button>
    </motion.div>
  )
}

function BookingDetailModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState({ timeline: true, payment: true })

  const { data: b, isLoading, refetch } = useQuery<any>({
    queryKey: ['owner-booking-detail', bookingId],
    queryFn: async () => {
      const r = await api.get(`/owner/bookings/${bookingId}`)
      const raw = r.data.data ?? r.data
      if (['PENDING_PAYMENT', 'EXPIRED'].includes(raw?.status)) return null
      return raw
    },
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['owner-booking-detail', bookingId] })
  useSocketEvent('service:checked_in',   invalidate)
  useSocketEvent('service:started',      invalidate)
  useSocketEvent('service:completed',    invalidate)
  useSocketEvent('booking:cancelled',    invalidate)
  useSocketEvent('booking:no_show',      invalidate)
  useSocketEvent('refund:initiated',     invalidate)
  useSocketEvent('refund:completed',     invalidate)
  useSocketEvent('payment:confirmed',    invalidate)
  useSocketEvent('booking:time_updated', invalidate)
  useSocketEvent('queue:updated',        invalidate)

  const isRefund          = b && ['REFUND_INITIATED', 'REFUNDED'].includes(b.status)
  const isNoShow          = b?.status === 'NO_SHOW'
  const isCompleted       = b?.status === 'COMPLETED'
  const isConfirmed       = b?.status === 'CONFIRMED'
  const isCancelled       = b?.status === 'CANCELLED'
  const isAwaitingCheckIn = b?.status === 'RUNNING' && !b?.service_started_at
  const isInProgress      = b?.status === 'RUNNING' && !!b?.service_started_at

  const cfg       = b ? getStatusCfg(b.status, b.service_started_at) : null
  const paidAmt   = b?.payment?.amount       ?? 0
  const refundAmt = b?.payment?.refund_amount ?? 0
  const svcTotal  = b?.service_amount         ?? 0

  const Section = ({ title, k, children }: { title: string; k: 'timeline' | 'payment'; children: React.ReactNode }) => (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
      <button onClick={() => setExpanded(prev => ({ ...prev, [k]: !prev[k] }))}
        style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{title}</span>
        {expanded[k] ? <ChevronUp size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />}
      </button>
      {expanded[k] && <div style={{ padding: '12px 14px', background: 'var(--bg-card)' }}>{children}</div>}
    </div>
  )

  const TRow = ({ label, value, color, sub, mono, accent }: {
    label: string; value?: string | null; color?: string; sub?: string; mono?: boolean; accent?: boolean
  }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, paddingRight: 8 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: value ? (color ?? (accent ? (cfg?.color ?? 'var(--violet-light)') : 'var(--text-1)')) : 'var(--text-3)', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', opacity: value ? 1 : 0.5 }}>
          {value ?? '—'}
        </span>
        {sub && value && <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )

  const SectionLabel = ({ text }: { text: string }) => (
    <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', marginTop: 10, marginBottom: 4, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>{text}</p>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="relative w-full sm:max-w-lg z-10 flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 15, fontFamily: 'Syne', fontWeight: 900, color: 'var(--text-1)', marginBottom: 2 }}>Booking Detail</h3>
            {b && <p style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)' }}>{b.booking_number}</p>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {b && <StatusBadge status={b.status} service_started_at={b.service_started_at} arrivalOpen={getArrivalOpen(b)} />}
            <button onClick={() => refetch()} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 0 1 15-6.7L21 9"/><path d="M3 9l3 3-3 3"/><path d="M21 12a9 9 0 0 1-15 6.7L3 15"/><path d="M21 15l-3-3 3-3"/></svg>
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 120, 200, 120].map((h: number, i: number) => <div key={i} className="skeleton rounded-[10px]" style={{ height: h }} />)}
            </div>
          )}
          {!isLoading && !b && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <AlertTriangle size={28} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Could not load booking details.</p>
              <button onClick={() => refetch()} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, fontSize: 12 }}>Retry</button>
            </div>
          )}

          {!isLoading && b && (
            <>
              {/* Customer + Staff */}
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 10 }}>Customer & Staff</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={b.customer?.name ?? 'Customer'} src={b.customer?.avatar_url ?? null} size="lg" />
                    {b.staff?.avatar_url && (
                      <div style={{ position: 'absolute', bottom: -4, right: -6, border: '2px solid var(--bg-card)', borderRadius: '50%' }}>
                        <Avatar name={b.staff.name ?? 'Staff'} src={b.staff.avatar_url} size="xs" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{b.customer?.name ?? '—'}</p>
                    {b.customer?.phone && (
                      <a href={`tel:${b.customer.phone}`} style={{ fontSize: 12, color: 'var(--violet-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Phone size={11} /> {b.customer.phone}
                      </a>
                    )}
                    {b.staff?.name && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Staff: <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{b.staff.name}</span>
                      </p>
                    )}
                    {b.business_name && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {b.business_logo ? <img src={b.business_logo} alt={b.business_name} style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover' }} /> : <Building2 size={10} />}
                        {b.business_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status banners */}
              {isConfirmed && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.25)' }}>
                  <Timer size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#60a5fa' }}>Start time estimated from queue — may shift{b.arrival_window_start && ` · Customer arrive by ${fmtTime(b.arrival_window_start)}`}</p>
                </div>
              )}
              {isAwaitingCheckIn && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.25)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: '#60a5fa', fontWeight: 600 }}>Customer is in arrival window — waiting for QR scan</p>
                </div>
              )}
              {isInProgress && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,.12)', border: '1px solid var(--green-border)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>Service in progress{b.service_started_at ? ` · started ${fmtTime(b.service_started_at)}` : ''}</p>
                </div>
              )}
              {isCompleted && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                  <CheckCircle size={13} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: 'var(--violet-light)', fontWeight: 600 }}>
                    Completed{b.actual_end_time ? ` at ${fmtTime(b.actual_end_time)}` : ''}{b.actual_duration ? ` · ${b.actual_duration} min` : ''}
                  </p>
                </div>
              )}
              {isNoShow && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.25)' }}>
                  <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: '#f59e0b' }}>No Show — Payment Retained by Business</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Customer did not arrive within the check-in window.</p>
                  </div>
                </div>
              )}
              {isCancelled && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.2)' }}>
                  <AlertTriangle size={13} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>Booking Cancelled</p>
                    {b.cancellation_reason && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, opacity: 0.85 }}>"{b.cancellation_reason}"</p>}
                    {b.cancelled_at && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, opacity: 0.7 }}>{fmtTime(b.cancelled_at)}</p>}
                  </div>
                </div>
              )}
              {isRefund && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8, background: b.status === 'REFUNDED' ? 'var(--green-bg)' : 'rgba(96,165,250,.10)', border: `1px solid ${b.status === 'REFUNDED' ? 'var(--green-border)' : 'rgba(96,165,250,.25)'}` }}>
                  <RotateCcw size={13} style={{ color: b.status === 'REFUNDED' ? 'var(--green)' : '#60a5fa', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: b.status === 'REFUNDED' ? 'var(--green)' : '#60a5fa' }}>
                      {b.status === 'REFUNDED' ? `Refund completed${refundAmt > 0 ? ` — ${formatINR(refundAmt)} returned` : ''}` : 'Refund in progress — 5–7 business days'}
                    </p>
                    {b.cancellation_reason && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Reason: {b.cancellation_reason}</p>}
                  </div>
                </div>
              )}

              {/* Schedule & Timeline */}
              <Section title="Schedule & Timeline" k="timeline">
                <TRow label="Date"            value={b.service_date ? new Date(b.service_date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null} accent />
                <TRow label="Scheduled start" value={fmtTime(b.service_start_time)} accent />
                <TRow label="Arrival window"  value={b.arrival_window_start && b.arrival_window_end ? `${fmtTime(b.arrival_window_start)} – ${fmtTime(b.arrival_window_end)}` : null} />
                <TRow label="QR scan window"  value={fmtTime(b.scan_window_end)} />
                <TRow label="Expected end"    value={fmtTime(b.service_end_time)} />
                <TRow label="Queue"           value={b.queue_number != null ? `#${b.queue_number}` : null} accent />
                <TRow label="Est. duration"   value={b.estimated_duration != null ? `${b.estimated_duration} min` : null} />
                {isConfirmed && b.cancellable_until && <TRow label="Cancel window" value={`Until ${fmtTime(b.cancellable_until)}`} color="#f59e0b" />}
                <SectionLabel text="What Happened" />
                <TRow label="Checked in"      value={fmtTime(b.checked_in_at)}     color="#60a5fa" />
                <TRow label="Service started" value={fmtTime(b.actual_start_time ?? b.service_started_at)} color="var(--green)" />
                <TRow label="Service ended"   value={fmtTime(b.actual_end_time)}   color="var(--violet-light)" />
                {isCancelled && <TRow label="Cancelled at" value={fmtTime(b.cancelled_at)} color="var(--red)" sub={b.cancellation_reason ?? undefined} />}
                <TRow label="Actual duration" value={b.actual_duration != null ? `${b.actual_duration} min` : null}
                  color={b.actual_duration != null ? (b.actual_duration <= (b.estimated_duration ?? 9999) ? 'var(--green)' : '#f59e0b') : undefined}
                  sub={b.actual_duration != null && b.estimated_duration != null ? `Est. ${b.estimated_duration} min` : undefined} />
                {(() => {
                  const s = b.actual_start_time ?? b.service_started_at
                  if (!s || !b.service_start_time) return null
                  const diff = Math.round((new Date(s).getTime() - new Date(b.service_start_time).getTime()) / 60_000)
                  if (diff === 0) return null
                  return <TRow label="Punctuality" value={diff > 0 ? `${diff} min late` : `${Math.abs(diff)} min early`} color={diff > 0 ? '#f59e0b' : 'var(--green)'} />
                })()}
                {b.notes && <TRow label="Customer notes" value={b.notes} />}
              </Section>

              {/* Services — with image + name + price */}
              {b.services?.length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', marginBottom: 8 }}>
                  <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 12 }}>Services</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {b.services.map((s: any, i: number) => {
                      const name  = typeof s === 'string' ? s : (s?.name ?? '')
                      const dur   = typeof s === 'string' ? null : (s?.duration_minutes ?? null)
                      const price = typeof s === 'string' ? null : (s?.price ?? null)
                      const img   = typeof s === 'string' ? null : (s?.image_url ?? null)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ServiceImg src={img} name={name} size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{name}</p>
                            {dur != null && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{dur} min</p>}
                          </div>
                          {price != null && <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-1)', fontWeight: 700, flexShrink: 0 }}>{formatINR(price)}</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 8, borderTop: '2px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 900, color: 'var(--text-1)' }}>Total</span>
                    <span style={{ fontSize: 20, fontFamily: 'Syne', fontWeight: 900, color: 'var(--violet-light)' }}>{formatINR(svcTotal)}</span>
                  </div>
                </div>
              )}

              {/* Payment */}
              <Section title="Payment" k="payment">
                {b.payment ? (
                  <>
                    <TRow label="Status"     value={b.payment.status} />
                    <TRow label="Amount"     value={formatINR(paidAmt)} accent />
                    <TRow label="Paid at"    value={fmtTime(b.payment.paid_at)} />
                    <TRow label="Settled at" value={fmtTime(b.payment.settled_at)} />
                    <TRow label="Payment ID" value={b.payment.razorpay_payment_id ?? null} mono />
                    {isNoShow && (
                      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                        <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>💰 Payment retained — customer did not arrive</p>
                      </div>
                    )}
                    {b.payment.refund_status && b.payment.refund_status !== 'NONE' && (
                      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: b.payment.refund_status === 'DONE' ? 'var(--green-bg)' : 'rgba(96,165,250,.10)', border: `1px solid ${b.payment.refund_status === 'DONE' ? 'var(--green-border)' : 'rgba(96,165,250,.25)'}` }}>
                        <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: b.payment.refund_status === 'DONE' ? 'var(--green)' : '#60a5fa', marginBottom: 6 }}>
                          Refund: {b.payment.refund_status === 'DONE' ? '✅ Completed' : b.payment.refund_status === 'PROCESSING' ? '⏳ Processing (5–7 business days)' : b.payment.refund_status === 'FAILED' ? '❌ Failed' : b.payment.refund_status}
                        </p>
                        {refundAmt > 0 && <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{formatINR(refundAmt)} refunded to customer</p>}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No payment data.</p>
                )}
              </Section>

              {/* Review */}
              {b.review && (
                <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>Customer Review</p>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                    {Array(5).fill(0).map((_, i) => (
                      <Star key={i} size={15} style={{ color: i < b.review.rating ? '#f59e0b' : 'var(--border)', fill: i < b.review.rating ? '#f59e0b' : 'transparent' }} />
                    ))}
                    <span style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 700, color: '#f59e0b', marginLeft: 4 }}>{b.review.rating}</span>
                  </div>
                  {b.review.comment && <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>"{b.review.comment}"</p>}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function OwnerBookings() {
  usePageTitle('Bookings')
  const qc = useQueryClient()

  const [tab,         setTab]         = useState<MainTab>('today')
  const [date,        setDate]        = useState('')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [hasMore,     setHasMore]     = useState(true)
  const [allBookings, setAllBookings] = useState<any[]>([])
  const observerTarget = useRef<HTMLDivElement>(null)

  const queryParams: any = { tab, page, limit: 30 }
  if (date) queryParams.date = date

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['owner-bookings', tab, date, page],
    queryFn: async () => {
      const r = await api.get('/owner/bookings', { params: queryParams })
      return r.data.data ?? r.data
    },
    staleTime: 0,
    gcTime: 60_000,
    refetchInterval: tab === 'running' ? 15_000 : tab === 'today' ? 30_000 : false,
  })

  const pagination = data?.pagination
  const totalPages  = pagination?.total_pages ?? pagination?.totalPages ?? 1

  // Accumulate bookings across pages
  useEffect(() => {
    if (!data?.bookings) return
    if (page === 1) {
      setAllBookings(data.bookings)
    } else {
      setAllBookings(prev => {
        const existingIds = new Set(prev.map((b: any) => b.id))
        const newBookings = data.bookings.filter((b: any) => !existingIds.has(b.id))
        return [...prev, ...newBookings]
      })
    }
  }, [data, page])

  // Update hasMore
  useEffect(() => {
    if (pagination) setHasMore(page < totalPages)
  }, [pagination, page, totalPages])

  // Infinite scroll sentinel observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetching && page < totalPages) {
          setPage(p => p + 1)
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )
    const current = observerTarget.current
    if (current) observer.observe(current)
    return () => { if (current) observer.unobserve(current) }
  }, [hasMore, totalPages, page, isFetching])

  const bookings = search.trim()
    ? allBookings.filter((b: any) =>
        (b.customer_name ?? b.customer?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (b.booking_number ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allBookings

  const invalidate    = useCallback(() => qc.invalidateQueries({ queryKey: ['owner-bookings'] }), [qc])
  const invalidateAll = useCallback(() => { invalidate(); qc.invalidateQueries({ queryKey: ['owner-dashboard'] }); qc.invalidateQueries({ queryKey: ['owner-analytics'] }) }, [invalidate, qc])

  useSocketEvent('booking:updated',      invalidate)
  useSocketEvent('booking:new',          (d: any) => { invalidate(); if (d?.customerName) toast.info(`${d.customerName} booked`) })
  useSocketEvent('booking:confirmed',    invalidate)
  useSocketEvent('booking:cancelled',    (d: any) => { invalidate(); toast.info(`${d?.customerName} cancelled`) })
  useSocketEvent('booking:no_show',      (d: any) => { invalidate(); toast.warning(`${d?.customerName} did not show`) })
  useSocketEvent('service:checked_in',   invalidate)
  useSocketEvent('service:started',      invalidate)
  useSocketEvent('service:completed',    invalidateAll)
  useSocketEvent('payment:settled',      (d: any) => { invalidate(); if (d?.amount) toast.success(`${formatINR(d.amount)} received`) })
  useSocketEvent('queue:updated',        () => { invalidate(); toast.info('Queue updated') })
  useSocketEvent('booking:time_updated', invalidate)
  useSocketEvent('refund:initiated',     (d: any) => { invalidate(); toast.info(`Refund initiated for ${d?.customerName}`) })
  useSocketEvent('refund:completed',     (d: any) => { invalidate(); toast.success(`Refund completed for ${d?.customerName}`) })

  const handleTabChange = (t: MainTab) => {
    setAllBookings([])
    setHasMore(true)
    setTab(t)
    setPage(1)
    setSearch('')
    qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  }

  const totalCount = pagination?.total ?? allBookings.length

  const emptyMsg: Record<MainTab, string> = {
    running:   'No bookings currently running.',
    today:     'No bookings for today.',
    upcoming:  'No upcoming confirmed bookings.',
    completed: 'No completed bookings.',
    no_show:   'No no-show bookings.',
    refund:    'No refunds found.',
  }

  const emptyIcon: Record<MainTab, React.ReactNode> = {
    running:   <Play size={28} />,
    today:     <Clock size={28} />,
    upcoming:  <Calendar size={28} />,
    completed: <CheckCircle size={28} />,
    no_show:   <AlertTriangle size={28} />,
    refund:    <RotateCcw size={28} />,
  }

  const showSkeleton = isLoading && page === 1 && allBookings.length === 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8">

        {/* ── Header ── */}
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 900, color: 'var(--text-1)', marginBottom: 2 }}>Bookings</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {isFetching && !showSkeleton
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Loader2 size={11} className="animate-spin" /> Refreshing…</span>
                : <>{totalCount} booking{totalCount !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
          {/* Date picker in header top-right (desktop + mobile) */}
          <DatePicker value={date} onChange={v => { setAllBookings([]); setHasMore(true); setDate(v); setPage(1) }} />
        </div>

        {/* ── Tabs — horizontal scrollable ── */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 12, padding: 4, gap: 2, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 12 }}>
          {MAIN_TABS.map(t => (
            <motion.button key={t.key} whileTap={{ scale: 0.96 }} onClick={() => handleTabChange(t.key)}
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '7px 10px', borderRadius: 9,
                fontFamily: 'Syne', fontWeight: 700, fontSize: 10.5, cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
                background: tab === t.key ? t.color + '22' : 'transparent',
                color:      tab === t.key ? t.color : 'var(--text-3)',
                border:     `1px solid ${tab === t.key ? t.color + '55' : 'transparent'}`,
                whiteSpace: 'nowrap' as const,
              }}>
              {t.icon}
              <span>{t.label}</span>
            </motion.button>
          ))}
        </div>

        {/* ── Search bar ── */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            placeholder="Search customer name or booking #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: 38, paddingLeft: 36, paddingRight: search ? 36 : 12, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', outline: 'none', fontSize: 12, color: 'var(--text-1)', boxSizing: 'border-box' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* ── Content ── */}
        {showSkeleton ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton rounded-[14px]" style={{ height: 240 }} />)}
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={emptyIcon[tab]}
            title={search ? `No results for "${search}"` : 'No bookings found'}
            description={search ? 'Try a different name or booking number.' : emptyMsg[tab]}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 12, alignItems: 'start' }}>
              <AnimatePresence mode="popLayout">
                {bookings.map((b: any, i: number) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    style={{ height: '100%' }}
                  >
                    <BookingCard booking={b} onClick={() => setSelectedId(b.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Infinite scroll sentinel — only rendered when more pages exist */}
            {hasMore && page < totalPages && (
              <div ref={observerTarget} style={{ marginTop: 16, display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
                <Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-3)' }} />
              </div>
            )}
          </>
        )}

        <AnimatePresence>
          {selectedId && <BookingDetailModal key={selectedId} bookingId={selectedId} onClose={() => setSelectedId(null)} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, CheckCircle, Play, Search, X,
  AlertCircle, Phone, RotateCcw, Timer, AlertTriangle,
  Scissors, QrCode, Users, Star, CreditCard,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { usePageTitle, useSocketEvent } from '@/hooks'
import { Avatar } from '@/components/shared/Avatar'
import { EmptyState } from '@/components/shared'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils'

const fmtTime = (iso?: string | null | Date): string => {
  if (!iso) return '—'
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  }).replace('am', 'AM').replace('pm', 'PM')
}

const fmtDate = (iso: string): string => {
  if (!iso) return '—'
  const fixed = (!iso.includes('T') && iso.length === 10) ? iso + 'T00:00:00+05:30' : iso
  const d = new Date(fixed)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

const fmtDateFull = (iso: string): string => {
  if (!iso) return '—'
  const fixed = (!iso.includes('T') && iso.length === 10) ? iso + 'T00:00:00+05:30' : iso
  const d = new Date(fixed)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

const fmtDateTime = (iso?: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
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
    case 'REFUND_INITIATED':
      return { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa',             border: 'rgba(96,165,250,0.3)', label: 'Refund Pending'    }
    case 'REFUNDED':
      return { bg: 'var(--green-bg)',       color: 'var(--green)',        border: 'var(--green-border)',  label: 'Refunded'          }
    case 'NO_SHOW':
      return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b',             border: 'rgba(245,158,11,0.3)', label: 'No Show'           }
    default:
      return { bg: 'var(--bg-surface)',     color: 'var(--text-3)',       border: 'var(--border)',         label: status              }
  }
}

function StatusBadge({ status, service_started_at, arrivalOpen }: { status: string; service_started_at?: string | null; arrivalOpen?: boolean }) {
  const cfg = getStatusCfg(status, service_started_at, arrivalOpen)
  return (
    <span style={{
      fontSize: 10, padding: '2px 9px', borderRadius: 7,
      fontFamily: 'Syne', fontWeight: 700, flexShrink: 0,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  )
}


function ServiceImg({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (src && !err) return (
    <img src={src} alt={name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 7, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: 7, flexShrink: 0, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Scissors size={size * 0.4} style={{ color: 'var(--violet-light)', opacity: 0.7 }} />
    </div>
  )
}


function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 11px', borderRadius: 10,
        background: value ? 'var(--violet-bg)' : 'var(--bg-surface)',
        border: `1px solid ${value ? 'var(--violet-border)' : 'var(--border)'}`,
        cursor: 'pointer', position: 'relative', flexShrink: 0,
      }}
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <Calendar size={13} style={{ color: value ? 'var(--violet-light)' : 'var(--text-3)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: value ? 'var(--violet-light)' : 'var(--text-3)', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden' }}>
        {value
          ? new Date(value + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
          : 'Date'}
      </span>
      {value && (
        <button onClick={e => { e.stopPropagation(); onChange('') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--violet-light)', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}>
          <X size={11} />
        </button>
      )}
      <input ref={inputRef} type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
    </div>
  )
}

function TimelineRow({ label, value, accent, mono, sub, dimmed }: {
  label: string; value: string; accent?: boolean; mono?: boolean; sub?: string; dimmed?: boolean
}) {
  const isEmpty = value === '—'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', paddingTop: 1, flexShrink: 0, marginRight: 12 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{
          fontSize: 13, fontWeight: isEmpty ? 400 : 700, display: 'block',
          fontFamily: mono ? 'JetBrains Mono, monospace' : accent ? 'Syne' : 'DM Sans',
          color: isEmpty ? 'var(--text-3)' : accent ? 'var(--violet-light)' : dimmed ? 'var(--text-3)' : 'var(--text-1)',
          opacity: isEmpty ? 0.45 : 1,
        }}>
          {value}
        </span>
        {sub && !isEmpty && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{sub}</span>}
      </div>
    </div>
  )
}

const STATUS_TABS = [
  { val: '',          label: 'All',       icon: Users       },
  { val: 'upcoming',  label: 'Upcoming',  icon: Clock       },
  { val: 'running',   label: 'Running',   icon: Play        },
  { val: 'completed', label: 'Completed', icon: CheckCircle },
  { val: 'cancelled', label: 'Refunds',   icon: RotateCcw   },
  { val: 'no_show',   label: 'No Show',   icon: AlertCircle },
]

function getInitialStatusFromUrl() {
  if (typeof window === 'undefined') return ''
  const raw = new URLSearchParams(window.location.search).get('status') ?? ''
  return STATUS_TABS.some(tab => tab.val === raw) ? raw : ''
}

function BookingCard({ booking, index, onClick }: { booking: any; index: number; onClick: () => void }) {
  const cfg = getStatusCfg(booking.status, booking.service_started_at)

  const isInProgress      = booking.status === 'RUNNING' && !!booking.service_started_at
  const isAwaitingCheckIn = booking.status === 'RUNNING' && !booking.service_started_at

  const services       = Array.isArray(booking.services) ? booking.services : []
  const customerName   = booking.customer?.name       ?? booking.customer_name   ?? '—'
  const customerAvatar = booking.customer?.avatar_url ?? booking.customer_avatar ?? null
  const isCompleted = booking.status === 'COMPLETED'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
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

      {/* Header: customer avatar + name + badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 10px', borderBottom: '1px solid var(--border)', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <Avatar name={customerName} src={customerAvatar} size="md" />
          <p style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {customerName}
          </p>
        </div>
        <StatusBadge status={booking.status} service_started_at={booking.service_started_at} arrivalOpen={getArrivalOpen(booking)} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>

        {/* Service chips: image + name + price */}
        {services.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {services.slice(0, 2).map((s: any, i: number) => {
              const name  = typeof s === 'string' ? s : (s?.name ?? '')
              const img   = typeof s === 'string' ? null : (s?.image_url ?? s?.image ?? null)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
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
            {isInProgress && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--green)', padding: '1px 6px', borderRadius: 5, background: 'rgba(52,211,153,.10)', border: '1px solid var(--green-border)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s ease-in-out infinite' }} />
                In service
              </span>
            )}
            {isAwaitingCheckIn && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', padding: '1px 6px', borderRadius: 5, background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.3)' }}>QR pending</span>
            )}
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
        {booking.service_amount != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <CreditCard size={11} style={{ color: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Paid</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>{formatINR(booking.service_amount)}</span>
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
  const [expanded, setExpanded] = useState({ timeline: true, services: true, payment: true })

  const { data: b, isLoading, refetch } = useQuery<any>({
    queryKey: ['staff-booking-detail', bookingId],
    queryFn: async () => {
      const r = await api.get(`/staff/bookings/${bookingId}`)
      const raw = r.data.data ?? r.data
      if (['PENDING_PAYMENT', 'EXPIRED'].includes(raw?.status)) return null
      return raw
    },
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff-booking-detail', bookingId] })

  useSocketEvent('service:checked_in', ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.info('Customer checked in!') } })
  useSocketEvent('service:started',    ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })
  useSocketEvent('service:completed',  ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.success('Service complete!') } })
  useSocketEvent('booking:cancelled',  ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })
  useSocketEvent('booking:no_show',    ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })
  useSocketEvent('refund:initiated',   ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.info('Refund initiated.') } })
  useSocketEvent('refund:completed',   ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.success('Refund completed!') } })
  useSocketEvent('queue:updated',      () => invalidate())
  useSocketEvent('booking:time_updated', ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })

  if (!bookingId) return null

  const isAwaitingCheckIn = b?.status === 'RUNNING' && !b?.service_started_at
  const isInProgress      = b?.status === 'RUNNING' && !!b?.service_started_at
  const isCompleted       = b?.status === 'COMPLETED'
  const isCancelled       = b?.status === 'CANCELLED'
  const isNoShow          = b?.status === 'NO_SHOW'
  const isRefund          = b && (b.status === 'REFUND_INITIATED' || b.status === 'REFUNDED')
  const cfg               = b ? getStatusCfg(b.status, b.service_started_at) : null
  const isPaid            = b?.payment?.status === 'PAID' || b?.payment?.status === 'SETTLED'

  function buildTimeline(b: any) {
    const s = b.status as string
    const isCancelledStatus = s === 'CANCELLED'
    const isRefundStatus    = s === 'REFUND_INITIATED' || s === 'REFUNDED'
    return {
      date:          fmtDateFull(b.service_date),
      queueNumber:   b.queue_number != null ? `#${b.queue_number}` : '—',
      startTime:     b.service_start_time ? fmtTime(b.service_start_time) : '—',
      arrivalWindow: b.arrival_window_start && b.arrival_window_end
        ? `${fmtTime(b.arrival_window_start)} – ${fmtTime(b.arrival_window_end)}` : '—',
      scanWindow:    b.scan_window_end ? fmtTime(b.scan_window_end) : '—',
      expectedEnd:   b.service_end_time ? fmtTime(b.service_end_time) : '—',
      actualStart:   b.service_started_at ?? b.actual_start_time
        ? fmtTime(b.service_started_at ?? b.actual_start_time) : '—',
      actualEnd:     b.completed_at ?? b.actual_end_time
        ? fmtTime(b.completed_at ?? b.actual_end_time) : '—',
      timeTaken:     b.actual_duration != null ? `${b.actual_duration} min` : '—',
      cancelledAt:   isCancelledStatus && b.cancelled_at ? fmtDateTime(b.cancelled_at) : '—',
      refundedAt:    isRefundStatus && s === 'REFUNDED' && b.cancelled_at ? fmtDateTime(b.cancelled_at) : '—',
    }
  }

  const Section = ({ title, children, k }: { title: string; children: React.ReactNode; k: 'timeline' | 'services' | 'payment' }) => (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setExpanded(prev => ({ ...prev, [k]: !prev[k] }))}
        style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{title}</span>
        {expanded[k] ? <ChevronUp size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />}
      </button>
      {expanded[k] && <div style={{ padding: '12px 14px', background: 'var(--bg-card)' }}>{children}</div>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="relative w-full sm:max-w-lg z-10 flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px 20px 0 0', maxHeight: '94vh' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h3 className="font-syne font-black" style={{ fontSize: 15, color: 'var(--text-1)', marginBottom: 2 }}>Booking Detail</h3>
            {b && <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{b.booking_number}</p>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {b && <StatusBadge status={b.status} service_started_at={b.service_started_at} arrivalOpen={getArrivalOpen(b)} />}
            <button onClick={() => refetch()} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 0 1 15-6.7L21 9"/><path d="M3 9l3 3-3 3"/><path d="M21 12a9 9 0 0 1-15 6.7L3 15"/><path d="M21 15l-3-3 3-3"/></svg>
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[80, 64, 64, 64, 64].map((h: number, i: number) => <div key={i} className="skeleton rounded-[12px]" style={{ height: h }} />)}
          </div>
        )}

        {!isLoading && !b && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Could not load booking detail.</p>
            <button onClick={() => refetch()} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, fontSize: 12 }}>Retry</button>
          </div>
        )}

        {!isLoading && b && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>

            {/* Customer block */}
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: `1px solid ${cfg?.border ?? 'var(--border)'}`, borderLeft: `3px solid ${cfg?.color ?? 'var(--border)'}`, marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 10 }}>Customer</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={b.customer?.name ?? 'Customer'} src={b.customer?.avatar_url ?? null} size="lg" />
                <div>
                  <p style={{ fontSize: 15, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>{b.customer?.name ?? '—'}</p>
                  {b.customer?.phone && (
                    <a href={`tel:${b.customer.phone}`} style={{ fontSize: 12, color: 'var(--violet-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={11} /> {b.customer.phone}
                    </a>
                  )}
                  {b.notes && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>Note: {b.notes}</p>}
                </div>
              </div>
            </div>

            {/* Status Banners */}
            {b.status === 'CONFIRMED' && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.25)' }}>
                <Timer size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: '#60a5fa' }}>
                  Estimated start based on queue{b.arrival_window_start && ` — customer arrives by ${fmtTime(b.arrival_window_start)}`}
                </p>
              </div>
            )}
            {isAwaitingCheckIn && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.25)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: '#60a5fa', fontWeight: 600 }}>Customer is in arrival window — waiting for QR scan</p>
              </div>
            )}
            {isInProgress && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,.12)', border: '1px solid var(--green-border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>
                  Service in progress{b.service_started_at ? ` — started at ${fmtTime(b.service_started_at)}` : ''}
                </p>
              </div>
            )}
            {isCompleted && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                <CheckCircle size={13} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: 'var(--violet-light)', fontWeight: 600 }}>
                  Service completed{(b.completed_at ?? b.actual_end_time) ? ` at ${fmtTime(b.completed_at ?? b.actual_end_time)}` : ''}
                  {b.actual_duration ? ` · ${b.actual_duration} min` : ''}
                </p>
              </div>
            )}
            {isCancelled && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.2)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 700 }}>Booking Cancelled</p>
                  {b.cancellation_reason && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, opacity: 0.85 }}>"{b.cancellation_reason}"</p>}
                  {b.cancelled_at && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, opacity: 0.7 }}>{fmtDateTime(b.cancelled_at)}</p>}
                </div>
              </div>
            )}
            {isNoShow && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.25)' }}>
                <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: '#f59e0b' }}>No Show — Payment Retained by Business</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Customer did not arrive within the check-in window.</p>
                </div>
              </div>
            )}
            {isRefund && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8, background: b.status === 'REFUNDED' ? 'var(--green-bg)' : 'rgba(96,165,250,.10)', border: `1px solid ${b.status === 'REFUNDED' ? 'var(--green-border)' : 'rgba(96,165,250,.25)'}` }}>
                <RotateCcw size={13} style={{ color: b.status === 'REFUNDED' ? 'var(--green)' : '#60a5fa', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: b.status === 'REFUNDED' ? 'var(--green)' : '#60a5fa' }}>
                    {b.status === 'REFUNDED'
                      ? `Refund completed${b.payment?.refund_amount ? ` — ${formatINR(b.payment.refund_amount)} returned to customer` : ''}`
                      : 'Refund in progress — customer will receive within 5–7 business days'}
                  </p>
                  {b.cancelled_at && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Cancelled: {fmtDateTime(b.cancelled_at)}</p>}
                </div>
              </div>
            )}

            {/* Timeline */}
            <Section title="Timeline" k="timeline">
              {(() => {
                const tl = buildTimeline(b)
                return (
                  <>
                    <TimelineRow label="Date"           value={tl.date} />
                    <TimelineRow label="Queue #"        value={tl.queueNumber} accent />
                    <TimelineRow label="Start Time"     value={tl.startTime} accent sub={b.status === 'CONFIRMED' ? 'Based on queue — may shift' : undefined} />
                    <TimelineRow label="Arrival Window" value={tl.arrivalWindow} />
                    <TimelineRow label="QR Scan Window" value={tl.scanWindow} />
                    <TimelineRow label="Expected End"   value={tl.expectedEnd} />
                    <TimelineRow label="Actual Start"   value={tl.actualStart} />
                    <TimelineRow label="Actual End"     value={tl.actualEnd} />
                    <TimelineRow label="Time Taken"     value={tl.timeTaken} />
                    <TimelineRow label="Cancelled at"   value={tl.cancelledAt} dimmed={tl.cancelledAt === '—'} />
                    <TimelineRow label="Refunded at"    value={tl.refundedAt}  dimmed={tl.refundedAt === '—'} />
                  </>
                )
              })()}
            </Section>

            {/* Services — image + name + price in modal */}
            {Array.isArray(b.services) && b.services.length > 0 && (
              <Section title="Services" k="services">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {b.services.map((s: any, i: number) => {
                    const name     = typeof s === 'string' ? s : (s?.name ?? '')
                    const dur      = typeof s === 'string' ? null : (s?.duration_minutes ?? s?.duration ?? null)
                    const price    = typeof s === 'string' ? null : (s?.price ?? null)
                    const imageUrl = typeof s === 'string' ? null : (s?.image_url ?? s?.image ?? null)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ServiceImg src={imageUrl} name={name} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{name}</p>
                          {dur != null && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{dur} min</p>}
                        </div>
                        {price != null && <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-1)', fontWeight: 700, flexShrink: 0 }}>{formatINR(price)}</span>}
                      </div>
                    )
                  })}
                </div>
                {b.service_amount != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 10, borderTop: '2px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 900, color: 'var(--text-1)' }}>Total</span>
                    <span style={{ fontSize: 20, fontFamily: 'Syne', fontWeight: 900, color: isPaid ? 'var(--green)' : 'var(--violet-light)' }}>{formatINR(b.service_amount)}</span>
                  </div>
                )}
              </Section>
            )}

            {/* Payment */}
            <Section title="Payment" k="payment">
              {b.payment ? (
                <>
                  <div style={{ padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: isPaid ? 'var(--green-bg)' : 'var(--bg-surface)', border: `1px solid ${isPaid ? 'var(--green-border)' : 'var(--border)'}` }}>
                    {isPaid ? <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} /> : <CreditCard size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
                    <div>
                      <span style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 700, display: 'block', color: isPaid ? 'var(--green)' : 'var(--text-2)' }}>
                        {b.payment.status === 'SETTLED' ? 'Settled to business' : b.payment.status === 'PAID' ? 'Payment received ✓' : b.payment.status === 'REFUNDED' ? 'Refunded to customer' : b.payment.status === 'FAILED' ? 'Payment failed' : 'Awaiting payment'}
                      </span>
                      {b.payment.paid_at && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDateTime(b.payment.paid_at)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Amount</span>
                    <span style={{ fontSize: 15, fontFamily: 'Syne', fontWeight: 900, color: isPaid ? 'var(--green)' : 'var(--violet-light)' }}>{formatINR(b.payment.amount)}</span>
                  </div>
                  {b.payment.settled_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Settled At</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 700 }}>{fmtDateTime(b.payment.settled_at)}</span>
                    </div>
                  )}
                  {isNoShow && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                      <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>💰 Payment retained — customer did not arrive</p>
                    </div>
                  )}
                  {b.payment.refund_status && b.payment.refund_status !== 'NONE' && (
                    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: b.payment.refund_status === 'DONE' ? 'var(--green-bg)' : 'rgba(96,165,250,.10)', border: `1px solid ${b.payment.refund_status === 'DONE' ? 'var(--green-border)' : 'rgba(96,165,250,.25)'}` }}>
                      <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: b.payment.refund_status === 'DONE' ? 'var(--green)' : '#60a5fa', marginBottom: 4 }}>
                        Refund: {b.payment.refund_status === 'DONE' ? '✅ Completed' : b.payment.refund_status === 'PROCESSING' ? '⏳ Processing (5–7 business days)' : '❌ Failed'}
                      </p>
                      {b.payment.refund_amount != null && b.payment.refund_amount > 0 && (
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)' }}>{formatINR(b.payment.refund_amount)} refunded to customer</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <CreditCard size={22} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 700 }}>{isCancelled ? 'No payment collected' : 'No payment information yet'}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{isCancelled ? 'Booking was cancelled before payment.' : 'Payment details will appear here once paid.'}</p>
                </div>
              )}
            </Section>

            {/* Review */}
            {b.review && (
              <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', marginBottom: 10 }}>
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
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default function StaffBookings() {
  usePageTitle('Bookings')
  const qc = useQueryClient()

  const [status,      setStatus]      = useState(getInitialStatusFromUrl)
  const [date,        setDate]        = useState('')
  const [page,        setPage]        = useState(1)
  const [search,      setSearch]      = useState('')
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [allBookings, setAllBookings] = useState<any[]>([])
  const [hasMore,     setHasMore]     = useState(true)
  const observerTarget = useRef<HTMLDivElement>(null)

  const { data, isLoading, isFetching } = useQuery<{ bookings: any[]; pagination: any }>({
    queryKey: ['staff-bookings', status, date, page],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (status) params.status = status
      if (date)   params.date   = date
      const r = await api.get('/staff/bookings', { params })
      return r.data.data
    },
    refetchInterval: (status === '' || status === 'running') ? 20_000 : status === 'cancelled' ? 30_000 : 60_000,
  })

  const pagination = data?.pagination
  const totalPages = pagination?.total_pages ?? pagination?.totalPages ?? 1

  // Accumulate bookings
  useEffect(() => {
    if (!data?.bookings) return
    if (page === 1) {
      setAllBookings(data.bookings)
    } else {
      setAllBookings(prev => {
        const ids = new Set(prev.map((b: any) => b.id))
        return [...prev, ...data.bookings.filter((b: any) => !ids.has(b.id))]
      })
    }
  }, [data, page])

  // Update hasMore
  useEffect(() => {
    if (pagination) setHasMore(page < totalPages)
  }, [pagination, page, totalPages])

  // Infinite scroll sentinel
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

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['staff-bookings'] })
    qc.invalidateQueries({ queryKey: ['staff-queue'] })
    qc.invalidateQueries({ queryKey: ['staff-booking-detail'] })
  }, [qc])

  useSocketEvent('booking:new',          (d: any) => { invalidate(); if (d?.customerName) toast.info(`New booking: ${d.customerName}`) })
  useSocketEvent('booking:confirmed',     invalidate)
  useSocketEvent('booking:cancelled',    (d: any) => { invalidate(); toast.info(`${d?.customerName ?? 'Customer'} cancelled`) })
  useSocketEvent('booking:no_show',      (d: any) => { invalidate(); toast.info(`${d?.customerName ?? 'Customer'} did not show`) })
  useSocketEvent('service:checked_in',   (d: any) => { invalidate(); toast.success(`${d?.customerName ?? 'Customer'} checked in`) })
  useSocketEvent('service:started',       invalidate)
  useSocketEvent('service:completed',     () => { invalidate(); qc.invalidateQueries({ queryKey: ['staff-dashboard'] }) })
  useSocketEvent('queue:updated',         () => { invalidate(); toast.info('Queue updated — timings adjusted') })
  useSocketEvent('booking:time_updated',  invalidate)
  useSocketEvent('refund:initiated',      invalidate)
  useSocketEvent('refund:completed',      invalidate)
  useSocketEvent('booking:updated',       () => { qc.invalidateQueries({ queryKey: ['staff-bookings'] }); qc.invalidateQueries({ queryKey: ['staff-booking-detail'] }) })

  const handleStatusChange = (val: string) => {
    setAllBookings([])
    setHasMore(true)
    setStatus(val)
    setPage(1)
    const url = new URL(window.location.href)
    if (val) url.searchParams.set('status', val)
    else url.searchParams.delete('status')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  const handleDateChange = (val: string) => {
    setAllBookings([])
    setHasMore(true)
    setDate(val)
    setPage(1)
  }

  const filteredBookings = search.trim()
    ? allBookings.filter((b: any) =>
        (b.customer?.name ?? b.customer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (b.booking_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (b.services ?? []).some((s: any) =>
          (typeof s === 'string' ? s : s?.name ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : allBookings

  const showSkeleton = isLoading && page === 1 && allBookings.length === 0
  const totalCount   = pagination?.total ?? allBookings.length

  return (
    <div className="min-h-screen pb-20 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, fontFamily: 'Syne', fontWeight: 900, color: 'var(--text-1)', marginBottom: 2 }}>Bookings</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {isFetching && !showSkeleton
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Loader2 size={11} className="animate-spin" /> Refreshing…</span>
                : <>{totalCount} booking{totalCount !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
          {/* Date picker in header top-right */}
          <DatePicker value={date} onChange={handleDateChange} />
        </div>

        {/* ── Tabs — horizontal scrollable ── */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 12, padding: 4, gap: 2, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {STATUS_TABS.map(({ val, label, icon: Icon }) => {
            const active = status === val
            const color = val === 'running'
              ? '#34d399'
              : val === 'upcoming'
              ? '#60a5fa'
              : val === 'completed'
              ? '#8b5cf6'
              : val === 'no_show'
              ? '#f59e0b'
              : val === 'cancelled'
              ? '#60a5fa'
              : '#6b7280'
            return (
              <motion.button key={val} whileTap={{ scale: 0.96 }}
                onClick={() => handleStatusChange(val)}
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '7px 10px', borderRadius: 9,
                  fontFamily: 'Syne', fontWeight: 700, fontSize: 10.5,
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                  background: active ? color + '22' : 'transparent',
                  color:      active ? color : 'var(--text-3)',
                  border:     active ? `1px solid ${color}55` : '1px solid transparent',
                  whiteSpace: 'nowrap' as const,
                }}>
                {Icon && <Icon size={11} />}
                <span>{label}</span>
              </motion.button>
            )
          })}
        </div>

        {/* ── Search first → Calendar is already in header top-right ── */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="q-input" placeholder="Search name, booking #, service..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: 38, paddingLeft: 36, paddingRight: search ? 32 : 12, fontSize: 12, boxSizing: 'border-box' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}><X size={12} /></button>}
        </div>

        {/* ── Content ── */}
        {showSkeleton ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton rounded-[14px]" style={{ height: 200 }} />)}
          </div>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            icon={<QrCode size={28} />}
            title={search ? 'No results found' : 'No bookings found'}
            description={search ? `No bookings match "${search}"` : (status || date) ? 'Try adjusting your filters.' : 'No bookings assigned yet.'}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
              <AnimatePresence mode="popLayout">
                {filteredBookings.map((b: any, i: number) => (
                  <BookingCard key={b.id} booking={b} index={i} onClick={() => setSelectedId(b.id)} />
                ))}
              </AnimatePresence>
            </div>

            {/* Infinite scroll sentinel — only when more pages exist */}
            {hasMore && page < totalPages && (
              <div ref={observerTarget} style={{ marginTop: 12, display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
                <Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-3)' }} />
              </div>
            )}
          </>
        )}

        <AnimatePresence>
          {selectedId && (
            <BookingDetailModal key={selectedId} bookingId={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function StaffBookingDetail() {
  return <StaffBookings />
}

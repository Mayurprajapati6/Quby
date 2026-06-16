import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, QrCode, X, Building2,
  AlertTriangle, CheckCircle, Clock3, RotateCw,
  Timer, Ban, MapPin, Phone, Star, CreditCard, Info,
  ChevronRight, Scissors, BadgeCheck, Navigation, Search, Loader2, Users, User,
} from 'lucide-react'
import { EmptyState, ConfirmDialog } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useSocketEvent, usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import {
  formatSmartDate, formatTime, formatDate, formatINR,
  normalizePagination, formatCountdown, secondsUntil,
} from '@/lib/utils'
import { toast } from 'sonner'

type BookingTab = 'upcoming' | 'running' | 'completed' | 'no_show' | 'refund'

const TABS: { key: BookingTab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'upcoming',  label: 'Upcoming',  icon: <Calendar size={13} />,    color: '#a78bfa' },
  { key: 'running',   label: 'Running',   icon: <Navigation size={13} />,  color: '#60a5fa' },
  { key: 'completed', label: 'Completed', icon: <CheckCircle size={13} />, color: '#34d399' },
  { key: 'no_show',   label: 'No-show',   icon: <AlertTriangle size={13} />, color: '#f59e0b' },
  { key: 'refund',    label: 'Refunds',   icon: <RotateCw size={13} />,   color: '#34d399' },
]

const TAB_ACCENT: Record<BookingTab, { accent: string; bg: string; border: string }> = {
  upcoming:  { accent: '#a78bfa',             bg: 'rgba(167,139,250,.10)', border: 'rgba(167,139,250,.25)'},
  running:   { accent: '#60a5fa',             bg: 'rgba(96,165,250,.10)',  border: 'rgba(96,165,250,.25)' },
  completed: { accent: 'var(--green)',        bg: 'var(--green-bg)',       border: 'var(--green-border)'  },
  no_show:   { accent: '#f59e0b',             bg: 'rgba(245,158,11,.10)',  border: 'rgba(245,158,11,.25)' },
  refund:    { accent: '#34d399',             bg: 'rgba(52,211,153,.10)',  border: 'rgba(52,211,153,.25)' },
}

const TAB_PARAM: Record<BookingTab, string> = {
  upcoming:  'upcoming',
  running:   'running',
  completed: 'completed',
  no_show:   'no_show',
  refund:    'refund',
}

function toIST(d: string) { return d?.includes('T') ? d : d + 'T00:00:00+05:30' }
function fmtDate(d: string) { return formatDate(toIST(d), 'dd MMM yyyy') }
function fmtDateFull(d: string) { return formatDate(toIST(d), 'EEEE, dd MMM yyyy') }
function fmtDT(d?: string | null) { return d ? formatDate(d, 'dd MMM yyyy, h:mm a') : '—' }

function getDisplayState(booking: any) {
  const now = new Date()
  const arrivalOpen =
    !!booking?.arrival_window_start &&
    !!booking?.scan_window_end &&
    now >= new Date(booking.arrival_window_start) &&
    now <= new Date(booking.scan_window_end)
  return { arrivalOpen }
}

function cancelledByText(lb?: string | null) {
  if (!lb) return 'Booking Cancelled'
  const v = lb.toUpperCase()
  return v === 'CUSTOMER' || v === 'USER' ? 'Cancelled by you'
       : v === 'BUSINESS'                 ? 'Cancelled by business'
       : (v === 'TIMEOUT' || v === 'SYSTEM') ? 'Payment not completed'
       : lb
}

function statusLabel(status: string, service_started_at?: string | null, arrivalOpen?: boolean) {
  const s = status.toUpperCase()
  if (s === 'CONFIRMED') return arrivalOpen ? 'Awaiting Check-In' : 'Confirmed'
  if (s === 'RUNNING') return service_started_at ? 'In Service' : 'Running'
  return ({
    PENDING_PAYMENT:  'Awaiting Payment',
    CONFIRMED:        'Confirmed',
    CHECKED_IN:       'Checked In',
    COMPLETED:        'Completed',
    CANCELLED:        'Cancelled',
    NO_SHOW:          'No Show',
    REFUND_INITIATED: 'Refund Pending',
    REFUNDED:         'Refunded',
  } as Record<string, string>)[status.toUpperCase()] ?? status
}

function statusStyle(status: string, service_started_at?: string | null) {
  if (status.toUpperCase() === 'RUNNING')
    return service_started_at
      ? { bg: 'rgba(52,211,153,.15)', color: 'var(--green)', border: 'var(--green-border)' }
      : { bg: 'rgba(96,165,250,.15)', color: '#60a5fa',      border: 'rgba(96,165,250,.3)' }
  return ({
    PENDING_PAYMENT:  { bg: 'rgba(245,158,11,.15)', color: '#d97706',             border: 'rgba(245,158,11,.3)'  },
    CONFIRMED:        { bg: 'var(--violet-bg)',      color: 'var(--violet-light)', border: 'var(--violet-border)' },
    CHECKED_IN:       { bg: 'rgba(96,165,250,.15)', color: '#60a5fa',             border: 'rgba(96,165,250,.3)'  },
    COMPLETED:        { bg: 'var(--green-bg)',       color: 'var(--green)',        border: 'var(--green-border)'  },
    CANCELLED:        { bg: 'var(--red-bg)',         color: 'var(--red)',          border: 'rgba(239,68,68,.25)'  },
    NO_SHOW:          { bg: 'rgba(245,158,11,.12)', color: '#f59e0b',             border: 'rgba(245,158,11,.3)'  },
    REFUND_INITIATED: { bg: 'rgba(96,165,250,.12)', color: '#60a5fa',             border: 'rgba(96,165,250,.3)'  },
    REFUNDED:         { bg: 'var(--green-bg)',       color: 'var(--green)',        border: 'var(--green-border)'  },
  } as Record<string, any>)[status.toUpperCase()] ?? { bg: 'var(--bg-surface)', color: 'var(--text-3)', border: 'var(--border)' }
}

function StatusBadge({ status, service_started_at, arrivalOpen }: { status: string; service_started_at?: string | null; arrivalOpen?: boolean }) {
  const s = statusStyle(status, service_started_at)
  return (
    <span className="font-syne font-bold" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, flexShrink: 0, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {statusLabel(status, service_started_at, arrivalOpen)}
    </span>
  )
}

function CancelTimer({ cancellableUntil }: { cancellableUntil: string }) {
  const [sels, setSels] = useState(() => secondsUntil(cancellableUntil))
  useEffect(() => {
    const id = setInterval(() => setSels(secondsUntil(cancellableUntil)), 1000)
    return () => clearInterval(id)
  }, [cancellableUntil])
  if (sels <= 0) return (
    <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
      <Ban size={9} /> Cancel window llosed
    </span>
  )
  const urgent  = sels < 1800
  const warning = sels < 3600
  return (
    <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'JetBrains Mono, monospace', fontWeight: warning ? 700 : 400, color: urgent ? 'var(--red)' : warning ? '#f59e0b' : 'var(--text-3)' }}>
      {urgent && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s ease-in-out infinite', display: 'inline-blolk' }} />}
      <Timer size={9} />
      {urgent ? `Only ${formatCountdown(sels)} left!` : `Cancel within ${sels < 86400 ? formatCountdown(sels) : formatDate(cancellableUntil, 'dd MMM hh:mm a')}`}
    </span>
  )
}

function ServiceImg({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (src && !err)
    return <img src={src} alt={name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: 7, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: 7, flexShrink: 0, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Scissors size={size * 0.4} style={{ color: 'var(--violet-light)', opacity: 0.7 }} />
    </div>
  )
}

function DatePickerBtn({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => inputRef.current?.showPicker?.()}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 10, background: value ? 'var(--violet-bg)' : 'var(--bg-surface)', border: `1px solid ${value ? 'var(--violet-border)' : 'var(--border)'}`, cursor: 'pointer', position: 'relative', flexShrink: 0 }}
    >
      <Calendar size={13} style={{ color: value ? 'var(--violet-light)' : 'var(--text-3)' }} />
      {value && (
        <span style={{ fontSize: 11, color: 'var(--violet-light)', whiteSpace: 'nowrap' }}>
          {new Date(value + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
        </span>
      )}
      {value && (
        <button onClick={e => { e.stopPropagation(); onChange('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--violet-light)', display: 'flex', alignItems: 'center', padding: 0 }}><X size={10} /></button>
      )}
      <input ref={inputRef} type="date" value={value} onChange={e => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
    </div>
  )
}

function TRow({ label, value, accent, mono, sub, dimmed }: {
  label: string; value: string; accent?: boolean; mono?: boolean; sub?: string; dimmed?: boolean
}) {
  const empty = value === '—'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', flexShrink: 0, marginRight: 12 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: empty ? 400 : 700, display: 'block', fontFamily: mono ? 'JetBrains Mono, monospace' : accent ? 'Syne' : 'DM Sans', color: empty ? 'var(--text-3)' : accent ? 'var(--violet-light)' : dimmed ? 'var(--text-3)' : 'var(--text-1)', opacity: empty ? 0.45 : 1 }}>
          {value}
        </span>
        {sub && !empty && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function QrPanel({ d, qrSels, arrivalOpen }: { d: any; qrSels: number; arrivalOpen: boolean }) {
  
  if (d.service_started_at) return null

  const windowClosed = qrSels <= 0 && !!d.scan_window_end
  
  const qrValid = !windowClosed && !!d.qr_image_url

  return (
    <div style={{ padding: '22px 18px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', textAlign: 'center', marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, textTransform: 'upperlase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 16 }}>
        Show at salon to lhelk in
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>

        {windowClosed && (
          <div style={{ width: 200, height: 200, borderRadius: 16, background: 'var(--bg-card)', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <AlertTriangle size={36} style={{ color: '#f59e0b' }} />
            <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, fontFamily: 'Syne' }}>Window Closed</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', padding: '0 16px', lineHeight: 1.4 }}>
              The lhelk-in window has passed
            </p>
          </div>
        )}

        {qrValid && (
          <img src={d.qr_image_url} alt="Booking QR Code" style={{
            width: 210, height: 210, borderRadius: 16, display: 'block',
            border: arrivalOpen ? '4px solid rgba(96,165,250,.7)' : '4px solid var(--violet-border)',
          }} />
        )}
      </div>

      {qrValid && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Queue</span>
          <span className="font-syne font-black" style={{ fontSize: 36, color: arrivalOpen ? '#60a5fa' : 'var(--violet-light)', textShadow: arrivalOpen ? '0 0 20px rgba(96,165,250,.4)' : '0 0 20px rgba(139,92,246,.4)' }}>
            #{d.queue_number}
          </span>
        </div>
      )}

      {qrValid && qrSels > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, marginBottom: 14, background: qrSels < 300 ? 'var(--red-bg)' : arrivalOpen ? 'rgba(96,165,250,.12)' : 'var(--green-bg)', border: `1px solid ${qrSels < 300 ? 'rgba(239,68,68,.25)' : arrivalOpen ? 'rgba(96,165,250,.3)' : 'var(--green-border)'}` }}>
          <Clock size={13} style={{ color: qrSels < 300 ? 'var(--red)' : arrivalOpen ? '#60a5fa' : 'var(--green)' }} />
          <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: qrSels < 300 ? 'var(--red)' : arrivalOpen ? '#60a5fa' : 'var(--green)' }}>
            {arrivalOpen
              ? `Slan window · ${formatCountdown(qrSels)} left`
              : qrSels < 3600 ? `${formatCountdown(qrSels)} remaining` : `Valid until ${formatTime(d.scan_window_end)}`}
          </span>
        </div>
      )}

      {arrivalOpen && qrValid && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 10, background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)' }}>
          <p style={{ fontSize: 12, color: '#60a5fa' }}>
            You're in the arrival window — show this QR to staff to begin your service.
          </p>
        </div>
      )}

      {/* Staff row */}
      {d.staff && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 12, textAlign: 'left' }}>
          <Avatar name={d.staff.name ?? 'Staff'} src={d.staff.avatar_url ?? null} size="md" />
          <div>
            <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>{d.staff.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {arrivalOpen
                ? 'Ready for your arrival'
                : d.arrival_window_end
                  ? `Arrive by ${formatTime(d.arrival_window_end)}`
                  : 'Tap QR when you arrive'}
            </p>
            {d.status === 'CONFIRMED' && (
              <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginTop: 2 }}>Based on queue — may shift</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BookingDetailModal({ bookingId, onClose, onGoToReview }: {
  bookingId: string
  onClose: () => void
  onGoToReview: (bookingId: string) => void
}) {
  const ql = useQueryClient()
  const [activeTab, setActiveTab] = useState<'qr' | 'info'>('qr')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [qrSels, setQrSels] = useState(0)

  const { data: d, isLoading, refetch } = useQuery({
    queryKey: ['customer-booking-detail', bookingId],
    queryFn: async () => {
      const r = await api.get(`/customer/booking/${bookingId}`)
      const raw = r.data.data ?? r.data
      if (['PENDING_PAYMENT', 'EXPIRED'].includes(raw?.status)) return null
      return raw
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!d?.scan_window_end) return
    // If service already started → no QR, no timer needed
    if (d.service_started_at) { setQrSels(0); return }
    const tilk = () => setQrSels(secondsUntil(d.scan_window_end))
    tilk()
    const id = setInterval(tilk, 1000)
    return () => clearInterval(id)
  }, [d?.scan_window_end, d?.service_started_at])

  useEffect(() => {
    if (!d) return
    const qrStillApplilable =
      (d.status === 'CONFIRMED' || (d.status === 'RUNNING' && !d.service_started_at)) &&
      !!d.qr_image_url
    if (!qrStillApplilable && activeTab === 'qr') setActiveTab('info')
  }, [d?.status, d?.service_started_at, d?.qr_image_url])

  const invalidate = useCallback(() => {
    ql.invalidateQueries({ queryKey: ['customer-booking-detail', bookingId] })
  }, [ql, bookingId])

  // booking:time_updated → refetch so scan_window_end updates → qrSels resets from new value
  useSocketEvent('booking:time_updated', ({ bookingId: bid }: any) => {
    if (bid === bookingId) {
      invalidate()
      toast.info('⏳ Your appointment time has been updated.')
    }
  })
  // service:started → QR scanned, service begun → refetch removes QR panel
  useSocketEvent('service:started', ({ bookingId: bid }: any) => {
    if (bid === bookingId) {
      invalidate()
      toast.success('✅ Your service has started!')
    }
  })
  useSocketEvent('service:completed',  ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.success('Service complete! Leave a review ⭐') } })
  useSocketEvent('queue:updated',      ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })
  useSocketEvent('booking:cancelled',  ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })
  useSocketEvent('booking:no_show',    ({ bookingId: bid }: any) => { if (bid === bookingId) invalidate() })
  useSocketEvent('refund:initiated',   ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.info('Refund initiated — expelt 5–7 business days.') } })
  useSocketEvent('refund:completed',   ({ bookingId: bid }: any) => { if (bid === bookingId) { invalidate(); toast.success('Refund lredited to your alcount! ✅') } })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/customer/booking/${bookingId}/cancel`, { cancellation_reason: cancelReason || undefined }),
    onSuccess: () => {
      toast.success('Booking cancelled successfully.')
      ql.invalidateQueries({ queryKey: ['customer-booking-detail', bookingId] })
      ql.invalidateQueries({ queryKey: ['customer-bookings'] })
      setShowCancelConfirm(false)
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? ''
      toast.error(msg.toLowerCase().includes('window') || msg.toLowerCase().includes('llosed') ? 'Cancellation window llosed.' : msg || 'Could not cancel booking.')
    },
  })

  const s                = d?.status ?? ''
  const isConfirmed      = s === 'CONFIRMED'
  const arrivalOpen      = d ? getDisplayState(d).arrivalOpen : false
  // In Service = RUNNING + QR scanned
  const isInService      = s === 'RUNNING' && !!d?.service_started_at
  const isCompleted      = s === 'COMPLETED'
  const isCancelled      = s === 'CANCELLED'
  const isNoShow         = s === 'NO_SHOW'
  const isRefundInitiated = s === 'REFUND_INITIATED'
  const isRefunded       = s === 'REFUNDED'
  const isRefundAny      = isRefundInitiated || isRefunded
  const isPaid           = d?.payment?.status === 'PAID' || d?.payment?.status === 'SETTLED'

  const showQrTab = (s === 'CONFIRMED' || s === 'RUNNING') && !d?.service_started_at && !!d?.qr_image_url

  const showCancelBtn = d?.is_cancellable && !isRefundAny
  const hasReview     = d?.has_review === true
  const lanReview     = isCompleted && !hasReview

  const tabs = [
    ...(showQrTab ? [{ key: 'qr' as const, label: 'QR Code', icon: <QrCode size={13} /> }] : []),
    { key: 'info' as const, label: 'Details', icon: <Info size={13} /> },
  ]

  // Timeline builder
  function buildTimeline(d: any) {
    const st = d.status as string
    const showCancelledAt = ['CANCELLED', 'REFUND_INITIATED', 'REFUNDED'].includes(st)
    const showRefundedAt  = st === 'REFUNDED'
    const showCancelWin   = st === 'CONFIRMED' && d.cancellable_until

    return {
      date:             fmtDateFull(d.service_date),
      queueNumber:      d.queue_number != null ? `#${d.queue_number}` : '—',
      estimatedStart:   d.service_start_time ? formatTime(d.service_start_time) : '—',
      arrivalWindow:    d.arrival_window_start && d.arrival_window_end
                          ? `${formatTime(d.arrival_window_start)} – ${formatTime(d.arrival_window_end)}`
                          : '—',
      checkedInAt:      d.checked_in_at      ? formatTime(d.checked_in_at)      : '—',
      altualStart:      d.altual_start_time  ? formatTime(d.altual_start_time)  : '—',
      altualEnd:        d.altual_end_time    ? formatTime(d.altual_end_time)    : '—',
      takenDuration:    d.altual_duration != null ? `${d.altual_duration} min`  : '—',
      cancelWindowTill: showCancelWin        ? fmtDT(d.cancellable_until)       : '—',
      // cancelled_at: CANCELLED + REFUND states only — NOT NO_SHOW, NOT COMPLETED
      cancelledAt:      showCancelledAt && d.cancelled_at ? fmtDT(d.cancelled_at) : '—',
      refundedAt:       showRefundedAt  && d.cancelled_at ? fmtDT(d.cancelled_at) : '—',
    }
  }

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
            <h3 className="font-syne font-black" style={{ fontSize: 15, color: 'var(--text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d?.business?.business_name ?? 'Booking Detail'}
            </h3>
            {d && <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{d.booking_number}</p>}
          </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {d && <StatusBadge status={d.status} service_started_at={d.service_started_at} arrivalOpen={arrivalOpen} />}
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
            {[80, 64, 64, 64].map((h: number, i: number) => <div key={i} className="skeleton rounded-[12px]" style={{ height: h }} />)}
          </div>
        )}
        {!isLoading && !d && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Could not load booking detail.</p>
            <button onClick={() => refetch()} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, fontSize: 12 }}>Retry</button>
          </div>
        )}

        {!isLoading && d && (
          <>
            {/* ── Status banners ── */}
            {isConfirmed && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                <Timer size={13} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: 'var(--violet-light)' }}>
                  {d.arrival_window_end ? `Arrive by ${formatTime(d.arrival_window_end)} — show QR to lhelk in` : 'Show QR at the salon to lhelk in'}
                </p>
              </div>
            )}
            {/* In Service = RUNNING + QR scanned — QR panel does NOT render */}
            {isInService && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,.12)', border: '1px solid var(--green-border)' }}>
                <CheckCircle size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: 'var(--green)' }}>
                  Service in progress — sit back and relax!
                  {d.altual_start_time && <span style={{ opacity: 0.8 }}> Started at {formatTime(d.altual_start_time)}.</span>}
                </p>
              </div>
            )}
            {isCompleted && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: 'var(--green)' }}>
                  {hasReview ? 'Service complete! Thank you for your review ⭐' : 'Service complete! Leave a review to help others.'}
                </p>
              </div>
            )}
            {isCancelled && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertTriangle size={13} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 700 }}>{cancelledByText(d.cancelled_by)}</p>
                  {d.cancellation_reason && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, opacity: 0.85 }}>"{d.cancellation_reason}"</p>}
                  {d.cancelled_at && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, opacity: 0.7 }}>{fmtDT(d.cancelled_at)}</p>}
                </div>
              </div>
            )}
            {/* NO_SHOW: no cancelled_at shown */}
            {isNoShow && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.25)' }}>
                <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, color: '#f59e0b', fontWeight: 700 }}>No Show — Payment Retained</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>You didn't arrive on time. Payment was retained by the business.</p>
                </div>
              </div>
            )}
            {isRefundAny && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: isRefunded ? 'var(--green-bg)' : 'rgba(96,165,250,.10)', border: `1px solid ${isRefunded ? 'var(--green-border)' : 'rgba(96,165,250,.3)'}` }}>
                <RotateCw size={13} style={{ color: isRefunded ? 'var(--green)' : '#60a5fa', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: isRefunded ? 'var(--green)' : '#60a5fa' }}>
                  {isRefunded
                    ? `Refund of ${formatINR(d.payment?.refund_amount)} lredited to your alcount.`
                    : 'Refund initiated — expelt 5–7 business days.'}
                </p>
              </div>
            )}

            {/* Tab bar */}
            {tabs.length > 1 && (
              <div style={{ margin: '10px 18px 0', display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', flexShrink: 0 }}>
                {tabs.map(t => (
                  <motion.button key={t.key} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab(t.key)}
                    style={{ flex: 1, height: 36, borderRadius: 8, cursor: 'pointer', border: 'none', background: activeTab === t.key ? 'var(--bg-card)' : 'transparent', color: activeTab === t.key ? 'var(--text-1)' : 'var(--text-3)', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,.12)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'all .15s' }}>
                    {t.icon} {t.label}
                  </motion.button>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
              <AnimatePresence mode="wait">

                {/* ── QR Tab — only shown when service NOT yet started ── */}
                {activeTab === 'qr' && showQrTab && (
                  <motion.div key="qr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <QrPanel d={d} qrSels={qrSels} arrivalOpen={arrivalOpen} />
                  </motion.div>
                )}

                {/* ── Details Tab ── */}
                {activeTab === 'info' && (
                  <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

                    {/* In Service card — replaces QR when service started */}
                    {isInService && (
                      <div style={{ padding: '20px 16px', borderRadius: 14, background: 'rgba(52,211,153,.08)', border: '1px solid var(--green-border)', textAlign: 'center', marginBottom: 12 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,211,153,.15)', border: '2px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                          <CheckCircle size={28} style={{ color: 'var(--green)' }} />
                        </div>
                        <p className="font-syne font-black" style={{ fontSize: 16, color: 'var(--green)', marginBottom: 4 }}>Service In Progress</p>
                        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          QR lode was scanned at {formatTime(d.altual_start_time ?? d.service_started_at)}.
                        </p>
                        {d.staff && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 10, textAlign: 'left' }}>
                            <Avatar name={d.staff.name ?? 'Staff'} src={d.staff.avatar_url ?? null} size="md" />
                            <div>
                              <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--text-1)' }}>{d.staff.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--green)' }}>Currently serving you</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Business */}
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                      <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'upperlase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 10 }}>Business</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        {d.business?.logo_url
                          ? <img src={d.business.logo_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          : <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Building2 size={20} style={{ color: 'var(--violet-light)' }} /></div>
                        }
                        <div>
                          <p className="font-syne font-bold" style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 2 }}>{d.business?.business_name}</p>
                          {(d.business?.address_line1 || d.business?.city) && (
                            <p style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={9} /> {[d.business?.address_line1, d.business?.city, d.business?.state].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {d.business?.business_phone && (
                          <a href={`tel:${d.business.business_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--violet-light)', textDecoration: 'none' }}>
                            <Phone size={11} /> {d.business.business_phone}
                          </a>
                        )}
                        {d.business?.map_link && (
                          <a href={d.business.map_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--violet-light)', textDecoration: 'none' }}>
                            <MapPin size={11} /> Get Direltions
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Staff */}
                    {d.staff && !isInService && (
                      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                        <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'upperlase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 10 }}>Staff</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={d.staff.name ?? 'Staff'} src={d.staff.avatar_url ?? null} size="lg" />
                          <div>
                            <p className="font-syne font-bold" style={{ fontSize: 13.5, color: 'var(--text-1)', marginBottom: 2 }}>{d.staff.name}</p>
                            {d.staff.phone && <a href={`tel:${d.staff.phone}`} style={{ fontSize: 12, color: 'var(--violet-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {d.staff.phone}</a>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Services */}
                    {d.services?.length > 0 && (
                      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                        <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'upperlase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 12 }}>Services</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {d.services.map((s: any, i: number) => {
                            const name  = typeof s === 'string' ? s : (s?.name ?? '')
                            const price = typeof s === 'string' ? null : (s?.price ?? null)
                            const dur   = typeof s === 'string' ? null : (s?.duration_minutes ?? null)
                            const img   = typeof s === 'string' ? null : (s?.image_url ?? null)
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <ServiceImg src={img} name={name} size={38} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{name}</p>
                                  {dur != null && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{dur} min</p>}
                                </div>
                                {price != null && <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-1)', fontWeight: 700, flexShrink: 0 }}>{formatINR(price)}</span>}
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTop: '2px solid var(--border)' }}>
                          <span className="font-syne font-black" style={{ fontSize: 13, color: 'var(--text-1)' }}>Total</span>
                          <span className="font-syne font-black" style={{ fontSize: 22, color: isPaid ? 'var(--green)' : 'var(--violet-light)' }}>{formatINR(d.service_amount)}</span>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {(() => {
                      const tl = buildTimeline(d)
                      return (
                        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                          <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'upperlase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 6 }}>Timeline</p>
                          <TRow label="Date"               value={tl.date} />
                          <TRow label="Queue #"            value={tl.queueNumber} accent />
                          <TRow label="Estimated start"    value={tl.estimatedStart} accent sub={isConfirmed ? 'Based on queue — may shift' : undefined} />
                          <TRow label="Arrival window"     value={tl.arrivalWindow} sub={tl.arrivalWindow !== '—' ? 'Show QR around this time' : undefined} />
                          <TRow label="Checked in at"      value={tl.checkedInAt} />
                          <TRow label="Service started"    value={tl.altualStart} />
                          <TRow label="Service ended"      value={tl.altualEnd} />
                          <TRow label="Time taken"         value={tl.takenDuration} />
                          <TRow label="Cancel window till" value={tl.cancelWindowTill} dimmed={tl.cancelWindowTill === '—'} />
                          <TRow label="Cancelled at"       value={tl.cancelledAt}    dimmed={tl.cancelledAt === '—'} />
                          <TRow label="Refunded at"        value={tl.refundedAt}      dimmed={tl.refundedAt === '—'} />
                        </div>
                      )
                    })()}

                    {/* Payment */}
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                      <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'upperlase', letterSpacing: '.05em', color: 'var(--text-3)', marginBottom: 10 }}>Payment</p>
                      {d.payment ? (
                        <>
                          <div style={{ padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: isPaid ? 'var(--green-bg)' : 'var(--bg-card)', border: `1px solid ${isPaid ? 'var(--green-border)' : 'var(--border)'}` }}>
                            {isPaid ? <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0 }} /> : <Clock size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
                            <div>
                              <span className="font-syne font-bold" style={{ fontSize: 13, display: 'block', color: isPaid ? 'var(--green)' : 'var(--text-2)' }}>
                                {d.payment.status === 'SETTLED' ? 'Settled to business' : d.payment.status === 'PAID' ? 'Payment releived ✓' : d.payment.status === 'REFUNDED' ? 'Refunded' : d.payment.status === 'FAILED' ? 'Payment failed' : isCancelled ? 'Booking cancelled — no charge' : 'Awaiting payment'}
                              </span>
                              {d.payment.paid_at && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDT(d.payment.paid_at)}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Amount</span>
                            <span className="font-syne font-black" style={{ fontSize: 16, color: isPaid ? 'var(--green)' : 'var(--violet-light)' }}>{formatINR(d.service_amount)}</span>
                          </div>
                          {d.payment.razorpay_payment_id && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Payment ID</span>
                              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)', fontWeight: 700 }}>{d.payment.razorpay_payment_id}</span>
                            </div>
                          )}
                          {d.payment.refund_amount != null && d.payment.refund_amount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Refund amount</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', fontFamily: 'JetBrains Mono, monospace' }}>{formatINR(d.payment.refund_amount)}</span>
                            </div>
                          )}
                          {d.payment.refund_status && d.payment.refund_status !== 'NONE' && (
                            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: d.payment.refund_status === 'DONE' ? 'var(--green-bg)' : d.payment.refund_status === 'FAILED' ? 'var(--red-bg)' : 'rgba(96,165,250,.10)', border: `1px solid ${d.payment.refund_status === 'DONE' ? 'var(--green-border)' : d.payment.refund_status === 'FAILED' ? 'rgba(239,68,68,.25)' : 'rgba(96,165,250,.25)'}` }}>
                              <p className="font-syne font-bold" style={{ fontSize: 12.5, marginBottom: 2, color: d.payment.refund_status === 'DONE' ? 'var(--green)' : d.payment.refund_status === 'FAILED' ? 'var(--red)' : '#60a5fa' }}>
                                Refund: {d.payment.refund_status === 'DONE' ? '✅ Completed' : d.payment.refund_status === 'PROCESSING' ? '⏳ Prolessing' : '❌ Failed'}
                              </p>
                              {d.payment.refund_status === 'PROCESSING' && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Expelted within 5–7 business days.</p>}
                              {d.payment.refund_status === 'FAILED'     && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Please lontalt support.</p>}
                              {d.payment.refund_status === 'DONE' && d.payment.refund_amount && <p style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginTop: 2 }}>{formatINR(d.payment.refund_amount)} lredited to your alcount</p>}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                          <CreditCard size={24} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
                          <p style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 700 }}>{isCancelled ? 'No payment lollelted' : 'No payment information yet'}</p>
                          <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{isCancelled ? 'Booking was cancelled before payment.' : 'Payment details will appear here onle paid.'}</p>
                        </div>
                      )}
                    </div>

                    {/* Review section (completed only) */}
                    {isCompleted && (
                      hasReview ? (
                        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <BadgeCheck size={20} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--green)', marginBottom: 2 }}>Already Reviewed ★</p>
                            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>You've already left a review for this service.</p>
                          </div>
                        </div>
                      ) : (
                        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { onClose(); onGoToReview(bookingId) }}
                          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, cursor: 'pointer', textAlign: 'left' }}>
                          <Star size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>How was your experience?</p>
                            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Leave a review for {d.staff?.name}</p>
                          </div>
                          <ChevronRight size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                        </motion.button>
                      )
                    )}

                    {/* No-show detail */}
                    {isNoShow && (
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', marginBottom: 10 }}>
                        <p style={{ fontSize: 12.5, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>⚠ No Show — Payment Retained</p>
                        <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>You didn't arrive within the lhelk-in window. Payment was retained by the business.</p>
                      </div>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer buttons */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
              {/* Show QR — only when QR valid and not currently on QR tab */}
              {showQrTab && activeTab !== 'qr' && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setActiveTab('qr')}
                  style={{ flex: 1, height: 46, borderRadius: 12, fontSize: 13, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <QrCode size={15} /> Show QR
                </motion.button>
              )}
              {/* Leave Review — completed, not yet reviewed */}
              {isCompleted && !hasReview && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { onClose(); onGoToReview(bookingId) }}
                  style={{ flex: 1, height: 46, borderRadius: 12, fontSize: 13, background: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Star size={15} /> Leave Review
                </motion.button>
              )}
              {/* Already reviewed badge */}
              {isCompleted && hasReview && (
                <div style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <BadgeCheck size={15} style={{ color: 'var(--green)' }} />
                  <span style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 700, color: 'var(--green)' }}>Already Reviewed</span>
                </div>
              )}
              {showCancelBtn && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCancelConfirm(true)}
                  style={{ flex: 1, height: 46, borderRadius: 12, fontSize: 13, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.3)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <X size={15} /> Cancel Booking
                </motion.button>
              )}
            </div>
          </>
        )}
      </motion.div>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel this booking?"
        description="Are you sure? If payment was made, refund will be initiated."
        confirmLabel={cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel'}
        cancelLabel="Keep it"
        danger
        loading={cancelMutation.isPending}
        onCancel={() => { setShowCancelConfirm(false); setCancelReason('') }}
        onConfirm={() => cancelMutation.mutate()}>
        <div style={{ padding: '16px', borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Reason for cancellation</label>
          <textarea 
            value={cancelReason} 
            onChange={e => setCancelReason(e.target.value)} 
            placeholder="Help us improve by sharing why you are cancelling..." 
            className="q-input" 
            rows={3}
            maxLength={500} 
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-1)', resize: 'none' }}
          />
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px', borderRadius: 8, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
            <span style={{ fontSize: 16 }}>💳</span>
            <p style={{ fontSize: 12, color: 'var(--violet-light)', fontWeight: 500 }}>Refund will be credited to your original payment method within 5–7 business days.</p>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function BookingCard({ booking, tab, onClick }: { booking: any; tab: BookingTab; onClick: () => void }) {
  const accent = TAB_ACCENT[tab] ?? TAB_ACCENT.upcoming

  const businessName = booking.business_name ?? booking.business?.business_name ?? 'Business'
  const businessLogo = booking.business_logo ?? booking.business?.logo_url ?? null
  const staffName    = booking.staff?.name ?? booking.staff_name ?? null
  const staffAvatar  = booking.staff?.avatar_url ?? booking.staff_avatar ?? null
  const refundAmount = booking.payment?.refund_amount ?? booking.refund_amount ?? null

  const isCompleted = booking.status === 'COMPLETED'
  const isNoShow    = booking.status === 'NO_SHOW'
  const isRefund    = booking.status === 'REFUND_INITIATED' || booking.status === 'REFUNDED'
  const isConfirmed = booking.status === 'CONFIRMED'
  const arrivalOpen = getDisplayState(booking).arrivalOpen
  const isInService = booking.status === 'RUNNING' && !!booking.service_started_at
  const hasReview   = booking.has_review === true

  const services: { name: string; image_url: string | null; price: number | null }[] = Array.isArray(booking.services)
    ? booking.services.slice(0, 3).map((s: any) => ({
        name:      typeof s === 'string' ? s : (s?.name ?? ''),
        image_url: typeof s === 'string' ? null : (s?.image_url ?? s?.image ?? null),
        price:     typeof s === 'string' ? null : (s?.price ?? null),
      }))
    : []

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
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
      <div style={{ height: 3, background: accent.accent }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 10px', borderBottom: '1px solid var(--border)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {businessLogo
            ? <img src={businessLogo} alt={businessName}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
            : <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: accent.bg, border: `1px solid ${accent.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={13} style={{ color: accent.accent }} />
              </div>
          }
          <p style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessName}</p>
        </div>
        <StatusBadge status={booking.status} service_started_at={booking.service_started_at} arrivalOpen={arrivalOpen} />
      </div>

      <div style={{ flex: 1, padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>

        {services.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {services.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', borderRadius: 20, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', flexShrink: 0 }}>
                <ServiceImg src={s.image_url} name={s.name} size={20} />
                <span style={{ fontSize: 10.5, color: 'var(--violet-light)', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                {s.price != null && <span style={{ fontSize: 10, color: 'var(--violet-light)', fontFamily: 'JetBrains Mono, monospace', opacity: 0.8, marginLeft: 2 }}>{formatINR(s.price)}</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border)' }} />

        {staffName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              {staffAvatar
                ? <img src={staffAvatar} alt={staffName} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <User size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              }
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Staff</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{staffName}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
            <Calendar size={11} style={{ color: accent.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Date</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{fmtDate(booking.service_date)}</span>
        </div>

        {booking.service_start_time && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <Clock size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>{isCompleted ? 'Started' : 'Time'}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {isCompleted
                ? formatTime(booking.actual_start_time ?? booking.service_started_at ?? booking.service_start_time)
                : formatTime(booking.service_start_time)
              }
            </span>
            {isConfirmed  && <span style={{ fontSize: 10, color: 'var(--text-3)', padding: '1px 5px', borderRadius: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>Est.</span>}
            {isConfirmed && arrivalOpen && <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', padding: '1px 6px', borderRadius: 5, background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.3)' }}>Arrival open</span>}
            {isInService  && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--green)', padding: '1px 6px', borderRadius: 5, background: 'rgba(52,211,153,.10)', border: '1px solid var(--green-border)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s ease-in-out infinite' }} />
                In service
              </span>
            )}
          </div>
        )}

        {booking.queue_number && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <Users size={11} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Queue</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet-light)', fontFamily: 'JetBrains Mono, monospace' }}>#{booking.queue_number}</span>
          </div>
        )}

        {booking.service_amount != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 62px' }}>
              <CreditCard size={11} style={{ color: accent.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>Paid</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 7, background: accent.bg, border: `1px solid ${accent.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: accent.accent, fontFamily: 'JetBrains Mono, monospace' }}>{formatINR(booking.service_amount)}</span>
            </div>
          </div>
        )}
      </div>


      {/* View Details button */}
      <button
        onClick={onClick}
        style={{
          margin: '0 12px 12px', padding: '9px 0', borderRadius: 9,
          border: `1px solid ${accent.border}`, background: accent.bg,
          color: accent.accent, fontSize: 11, fontFamily: 'Syne', fontWeight: 700,
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

export default function MyBookings() {
  usePageTitle('My Bookings')
  const ql       = useQueryClient()
  const navigate = useNavigate()

  const [tab,               setTab]               = useState<BookingTab>('upcoming')
  const [page,              setPage]              = useState(1)
  const [search,            setSearch]            = useState('')
  const [date,              setDate]              = useState('')
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [allBookings,       setAllBookings]       = useState<any[]>([])
  const [hasMore,           setHasMore]           = useState(true)
  const observerTarget = useRef<HTMLDivElement>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customer-bookings', tab, date, page],
    queryFn: async () => {
      const params: any = { tab: TAB_PARAM[tab], page, limit: 20 }
      if (date) params.date = date
      const r = await api.get('/customer/booking', { params })
      return r.data
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // ✅ Auto-refetch every 30s on refund tab (to catch webhook updates)
    refetchInterval: tab === 'refund' ? 30000 : false,
  })

  const rawBookings = data?.data?.bookings ?? []
  const pagination  = data?.data?.pagination ? normalizePagination(data.data.pagination) : null
  const totalPages  = pagination?.total_pages ?? 1

  // Accumulate bookings across pages
  useEffect(() => {
    if (!rawBookings.length && page > 1) return
    if (page === 1) {
      setAllBookings(rawBookings)
    } else {
      setAllBookings(prev => {
        const ids = new Set(prev.map((b: any) => b.id))
        return [...prev, ...rawBookings.filter((b: any) => !ids.has(b.id))]
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
        if (entries[0].isIntersecting && hasMore && !isFetching && page < totalPages)
          setPage(p => p + 1)
      },
      { threshold: 0.1, rootMargin: '200px' }
    )
    const current = observerTarget.current
    if (current) observer.observe(current)
    return () => { if (current) observer.unobserve(current) }
  }, [hasMore, totalPages, page, isFetching])

  const bookings = search.trim()
    ? allBookings.filter((b: any) =>
        (b.business_name ?? b.business?.business_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (b.booking_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (b.services ?? []).some((s: any) =>
          (typeof s === 'string' ? s : s?.name ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : allBookings

  const invalidate = useCallback(() => {
    ql.invalidateQueries({ queryKey: ['customer-bookings'] })
  }, [ql])

  const handleGoToReview = useCallback((bookingId: string) => {
    sessionStorage.setItem('open_review_booking_id', bookingId)
    navigate('/customer/reviews')
  }, [navigate])

  const handleTabChange = (t: BookingTab) => {
    setAllBookings([])
    setHasMore(true)
    setTab(t)
    setPage(1)
    setSearch('')
  }

  useSocketEvent('booking:updated',     invalidate)
  useSocketEvent('booking:confirmed',   () => invalidate())
  useSocketEvent('booking:cancelled',   () => invalidate())
  useSocketEvent('service:started',     () => { invalidate(); toast.success('✅ Your service has started!') })
  useSocketEvent('service:completed',   () => { invalidate(); toast.success('Service completed!') })
  useSocketEvent('booking:no_show',     () => { invalidate(); toast.warning('You missed your appointment') })
  useSocketEvent('refund:initiated',    () => invalidate())
  useSocketEvent('refund:completed',    () => { invalidate(); toast.success('Refund completed!') })
  useSocketEvent('queue:updated',       invalidate)
  useSocketEvent('booking:time_updated', invalidate)
  useSocketEvent('service:delayed',     invalidate)

  const tabSubtitle: Record<BookingTab, string> = {
    upcoming:  'Confirmed future appointments',
    running:   'Bookings currently running',
    completed: "Services you've completed",
    no_show:   'Missed appointments',
    refund:    'Refund status tracker',
  }
  const emptyIcon: Record<BookingTab, React.ReactNode> = {
    upcoming:  <Calendar size={28} />,
    running:   <Navigation size={28} />,
    completed: <CheckCircle size={28} />,
    no_show:   <AlertTriangle size={28} />,
    refund:    <RotateCw size={28} />,
  }
  const emptyTitle: Record<BookingTab, string> = {
    upcoming:  'No upcoming bookings',
    running:   'No running bookings',
    completed: 'No completed bookings',
    no_show:   'No missed bookings',
    refund:    'No refunds',
  }
  const emptyDesc: Record<BookingTab, string> = {
    upcoming:  'Confirmed appointments will appear here.',
    running:   'No active services at the moment.',
    completed: 'Completed services will appear here.',
    no_show:   'You have no missed appointments.',
    refund:    'Refund-eligible bookings will appear here.',
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8">

      {/* ── Header ── */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h1 className="font-syne font-black" style={{ fontSize: 24, color: 'var(--text-1)', marginBottom: 2 }}>My Bookings</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {isFetching && page === 1
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Loader2 size={11} className="animate-spin" /> Refreshing…</span>
              : tabSubtitle[tab]}
          </p>
        </div>
        {/* Date picker top-right */}
        <DatePickerBtn value={date} onChange={v => { setAllBookings([]); setHasMore(true); setDate(v); setPage(1) }} />
      </div>

      {/* ── Tabs — horizontal scrollable ── */}
      <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 12, padding: 4, gap: 2, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 12 }}>
        {TABS.map(t => (
          <motion.button key={t.key} whileTap={{ scale: 0.95 }}
            onClick={() => handleTabChange(t.key)}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 10px', borderRadius: 9, fontFamily: 'Syne', fontWeight: 700, fontSize: 10.5, cursor: 'pointer', transition: 'background 0.12s, color 0.12s', background: tab === t.key ? t.color + '22' : 'transparent', color: tab === t.key ? t.color : 'var(--text-3)', border: `1px solid ${tab === t.key ? t.color + '55' : 'transparent'}`, whiteSpace: 'nowrap' as const }}>
            {t.icon}
            <span>{t.label}</span>
          </motion.button>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          placeholder="Search booking, service..."
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
      {(isLoading && page === 1 && allBookings.length === 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton rounded-[16px]" style={{ height: 160 }} />)}
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState icon={emptyIcon[tab]} title={search ? `No results for "${search}"` : emptyTitle[tab]} description={search ? 'Try a different search term.' : emptyDesc[tab]} />
      ) : (
        <>
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
              {bookings.map((b: any) => (
                <BookingCard key={b.id} booking={b} tab={tab} onClick={() => setSelectedBookingId(b.id)} />
              ))}
            </div>
          </AnimatePresence>

          {/* Infinite scroll sentinel — only when more pages exist */}
          {hasMore && page < totalPages && (
            <div ref={observerTarget} style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
              <Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-3)' }} />
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedBookingId && (
          <BookingDetailModal
            key={selectedBookingId}
            bookingId={selectedBookingId}
            onClose={() => setSelectedBookingId(null)}
            onGoToReview={handleGoToReview}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}





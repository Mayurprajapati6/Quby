import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Phone, Clock, QrCode, Info, X,
  ExternalLink, ChevronLeft, AlertTriangle, CheckCircle,
  Star, Calendar, CreditCard, RefreshCw,
  Timer, Scissors,
} from 'lucide-react'
import { ConfirmDialog, Skeleton } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useSocketEvent, usePageTitle, useCountdown } from '@/hooks'
import api from '@/lib/axios'
import { MapModal } from '@/components/shared/MapModal'
import { formatDate, formatTime, formatCountdown, formatINR, secondsUntil } from '@/lib/utils'
import { toast } from 'sonner'
import type { BookingDetailDTO } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const cfg =
    s === 'PENDING_PAYMENT' ? { bg: 'rgba(245,158,11,0.15)', color: '#d97706', border: 'rgba(245,158,11,0.3)', label: 'Pending Payment' } :
    s === 'CONFIRMED'       ? { bg: 'var(--violet-bg)', color: 'var(--violet-light)', border: 'var(--violet-border)', label: 'Confirmed' } :
    s === 'CHECKED_IN'      ? { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)', label: 'Checked In' } :
    s === 'RUNNING'         ? { bg: 'rgba(52,211,153,0.15)', color: 'var(--green)', border: 'var(--green-border)', label: 'In Progress' } :
    s === 'COMPLETED'       ? { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)', label: 'Completed' } :
    s.startsWith('CANCEL')  ? { bg: 'var(--red-bg)', color: 'var(--red)', border: 'rgba(239,68,68,0.25)', label: 'Cancelled' } :
    s === 'NO_SHOW'         ? { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'No-show' } :
    { bg: 'var(--bg-surface)', color: 'var(--text-3)', border: 'var(--border)', label: status }
  return (
    <span className="font-syne font-bold" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

function InfoRow({ label, value, accent, mono, sub }: { label: string; value: string; accent?: boolean; mono?: boolean; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', paddingTop: 1 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: mono ? 'JetBrains Mono, monospace' : accent ? 'Syne' : 'DM Sans', color: accent ? 'var(--violet-light)' : 'var(--text-1)', display: 'block' }}>{value}</span>
        {sub && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function ServiceImg({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (src && !err) return <img src={src} alt={name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: 8, flexShrink: 0, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Scissors size={size * 0.4} style={{ color: 'var(--violet-light)', opacity: 0.7 }} />
    </div>
  )
}

export default function BookingDetail() {
  const [mapOpen, setMapOpen] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [activeTab, setActiveTab] = useState<'qr' | 'info' | 'payment'>('qr')

  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  usePageTitle('Booking Details')

  const { data: booking, isLoading, refetch } = useQuery({
    queryKey: ['customer-booking', id],
    queryFn: async () => {
      const res = await api.get(`/customer/booking/${id}`)
      return res.data.data as BookingDetailDTO
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const booking = query.state.data as BookingDetailDTO | undefined
      if (['CONFIRMED', 'CHECKED_IN', 'RUNNING'].includes(booking?.status ?? '')) {
        return 30_000
      }
      return false
    },
  })

  // ─── Derived time logic (queue-driven, no backend fields) ─────────────────
  const start        = booking ? new Date(booking.service_start_time) : new Date()
  const duration     = booking?.estimated_duration ?? 0
  const arrivalStart = new Date(start.getTime() - 15 * 60 * 1000).toISOString()
  const arrivalEnd   = start.toISOString()
  const expectedEnd  = new Date(start.getTime() + duration * 60 * 1000)
  const now          = new Date()
  const isLate       = !!booking && now > expectedEnd
  const delayMin     = isLate ? Math.floor((now.getTime() - expectedEnd.getTime()) / 60000) : 0

  // ─── Smart status message ─────────────────────────────────────────────────
  const getStatusMessage = (): string => {
    if (!booking) return ''
    if (booking.status === 'RUNNING') return 'Service in progress'
    if (booking.status === 'CHECKED_IN') return "You're checked in. Starting soon"
    if (booking.status === 'CONFIRMED') {
      const diff = Math.floor((start.getTime() - now.getTime()) / 60000)
      if (diff <= 0) return '🚶 Please arrive now'
      if (diff <= 10) return "🔥 You're next"
      if (diff <= 20) return '⏳ Your turn is near'
      return `Estimated arrival ${formatTime(arrivalStart)}`
    }
    return ''
  }

  const qrSecs   = useCountdown(booking?.qr_expires_at ? secondsUntil(booking.qr_expires_at) : 0)
  const qrExpired = !!booking?.qr_expires_at && qrSecs <= 0

  // ─── Socket live updates ──────────────────────────────────────────────────
  useSocketEvent('service:checked_in', ({ bookingId }: any) => {
    if (bookingId === id) { qc.invalidateQueries({ queryKey: ['customer-booking', id] }); toast.info("Service started! You've been checked in.") }
  })
  useSocketEvent('service:completed', ({ bookingId }: any) => {
    if (bookingId === id) { qc.invalidateQueries({ queryKey: ['customer-booking', id] }); toast.success('Service completed! Please leave a review ⭐') }
  })
  useSocketEvent('booking:cancelled', ({ bookingId }: any) => {
    if (bookingId === id) { qc.invalidateQueries({ queryKey: ['customer-booking', id] }); toast.info('Booking was cancelled.') }
  })
  useSocketEvent('booking:no_show', ({ bookingId }: any) => {
    if (bookingId === id) { qc.invalidateQueries({ queryKey: ['customer-booking', id] }) }
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/customer/booking/${id}/cancel`, { cancellation_reason: cancelReason || undefined }),
    onSuccess: () => {
      toast.success('Booking cancelled. Refund will be processed within 5–7 business days.')
      qc.invalidateQueries({ queryKey: ['customer-booking', id] })
      qc.invalidateQueries({ queryKey: ['customer-bookings'] })
      setShowCancel(false)
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message ?? ''
      if (msg.toLowerCase().includes('window') || msg.toLowerCase().includes('closed')) {
        toast.error('Cancellation window closed. Cannot cancel at this time.')
      } else {
        toast.error(msg || 'Could not cancel booking.')
      }
    },
  })

  // ─── Loading / empty states ───────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
      {[260, 180, 140].map((h, i) => <div key={i} className="skeleton rounded-2xl" style={{ height: h, marginBottom: 14 }} />)}
    </div>
  )

  if (!booking) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <AlertTriangle size={36} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
      <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Booking not found.</p>
      <button onClick={() => navigate('/customer/bookings')} className="q-btn-primary" style={{ marginTop: 16 }}>Back to bookings</button>
    </div>
  )

  const isPaid      = booking.payment?.status === 'PAID' || booking.payment?.status === 'SETTLED'
  const hasQr       = !!booking.qr_image_url
  const isActive    = ['CONFIRMED', 'CHECKED_IN', 'RUNNING'].includes(booking.status)
  const isCompleted = booking.status === 'COMPLETED'
  const isCancelled = booking.status.startsWith('CANCEL') || booking.status === 'NO_SHOW'

  const statusMessage = getStatusMessage()

  const tabs = [
    ...(hasQr ? [{ key: 'qr' as const, label: 'QR Code', icon: <QrCode size={13} /> }] : []),
    { key: 'info' as const, label: 'Details', icon: <Info size={13} /> },
    { key: 'payment' as const, label: 'Payment', icon: <CreditCard size={13} /> },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 80px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="font-syne font-black" style={{ fontSize: 19, color: 'var(--text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {booking.business.business_name}
          </h1>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)' }}>{booking.booking_number}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <StatusBadge status={booking.status} />
          <button onClick={() => refetch()} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-3)' }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Active status banner ────────────────────────────────────────────── */}
      {isActive && statusMessage && (
        <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 14, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Timer size={13} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: 'var(--violet-light)' }}>{statusMessage}</p>
        </div>
      )}

      {/* ── Completed banner ────────────────────────────────────────────────── */}
      {isCompleted && (
        <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 14, background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: 'var(--green)' }}>Service completed! Leave a review to help others find great stylists.</p>
        </div>
      )}

      {/* ── Cancellation reason banner ──────────────────────────────────────── */}
      {isCancelled && booking.cancellation_reason && (
        <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 14, background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', gap: 8 }}>
          <AlertTriangle size={13} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--red)' }}>Cancelled: {booking.cancellation_reason}</p>
        </div>
      )}

      {/* ── Tab switcher ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, marginBottom: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <motion.button key={t.key} whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, height: 38, borderRadius: 10,
              background: activeTab === t.key ? 'var(--bg-card)' : 'transparent',
              color: activeTab === t.key ? 'var(--text-1)' : 'var(--text-3)',
              border: 'none', cursor: 'pointer',
              boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'all .15s',
            }}>
            {t.icon} {t.label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── QR Tab ───────────────────────────────────────────────────────── */}
        {activeTab === 'qr' && hasQr && (
          <motion.div key="qr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="q-card" style={{ padding: '24px 20px', textAlign: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Syne', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 16 }}>
                Show at salon to check in
              </p>

              {/* Late / behind-schedule indicator */}
              {isLate && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 14, color: 'var(--red)', fontSize: 12.5, fontWeight: 700, fontFamily: 'Syne' }}>
                  ⏳ May be running a little late (~{delayMin} min based on queue)
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                {qrExpired ? (
                  <div style={{ width: 200, height: 200, borderRadius: 16, background: 'var(--bg-surface)', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <AlertTriangle size={32} style={{ color: 'var(--red)' }} />
                    <p style={{ fontSize: 14, color: 'var(--red)', fontWeight: 700 }}>QR Expired</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Check-in window closed</p>
                  </div>
                ) : (
                  <img src={booking.qr_image_url!} alt="Booking QR Code" style={{ width: 210, height: 210, borderRadius: 16, border: '4px solid var(--violet-border)', display: 'block' }} />
                )}
              </div>

              {/* Queue number + intelligence */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Queue</span>
                  <span className="font-syne font-black" style={{ fontSize: 34, color: 'var(--violet-light)', textShadow: '0 0 20px var(--violet-glow)' }}>#{booking.queue_number}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {booking.queue_number === 1 ? "You're next in line" : `${booking.queue_number - 1} ${booking.queue_number - 1 === 1 ? 'person' : 'people'} ahead`}
                </p>
              </div>

              {/* QR expiry countdown */}
              {!qrExpired && booking.qr_expires_at && qrSecs > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: qrSecs < 300 ? 'var(--red-bg)' : 'var(--green-bg)', border: `1px solid ${qrSecs < 300 ? 'rgba(239,68,68,0.25)' : 'var(--green-border)'}`, marginBottom: 14 }}>
                  <Clock size={13} style={{ color: qrSecs < 300 ? 'var(--red)' : 'var(--green)' }} />
                  <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: qrSecs < 300 ? 'var(--red)' : 'var(--green)' }}>
                    {formatCountdown(qrSecs)} remaining
                  </span>
                </div>
              )}

              {/* Staff + derived arrival window */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 12, textAlign: 'left' }}>
                <Avatar name={booking.staff.name} src={booking.staff.avatar_url} size="md" />
                <div>
                  <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>{booking.staff.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Slot: {formatTime(booking.service_start_time)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                    Arrive: {formatTime(arrivalStart)} – {formatTime(arrivalEnd)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Info Tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'info' && (
          <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

            {/* Staff + business */}
            <div className="q-card" style={{ padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <Avatar name={booking.staff.name} src={booking.staff.avatar_url} size="lg" />
                <div style={{ flex: 1 }}>
                  <p className="font-syne font-black" style={{ fontSize: 16, color: 'var(--text-1)', marginBottom: 2 }}>{booking.staff.name}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{booking.business.business_name}</p>
                  {booking.staff.phone && (
                    <a href={`tel:${booking.staff.phone}`} style={{ fontSize: 12, color: 'var(--violet-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={11} /> {booking.staff.phone}
                    </a>
                  )}
                </div>
              </div>

              <InfoRow label="Date" value={formatDate(booking.service_date, 'EEEE, dd MMM yyyy')} />

              {/* Time block — derived, no removed backend fields */}
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Arrive by</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                    {formatTime(arrivalStart)} – {formatTime(arrivalEnd)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Scheduled</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{formatTime(booking.service_start_time)}</span>
                </div>
                {booking.actual_start_time && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Started</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{formatTime(booking.actual_start_time)}</span>
                  </div>
                )}
                {booking.actual_end_time && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Completed</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{formatTime(booking.actual_end_time)}</span>
                  </div>
                )}
                {isLate && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>
                    ⏳ May be ~{delayMin} min behind schedule (queue-based estimate)
                  </p>
                )}
              </div>

              <InfoRow label="Est. duration" value={`~${booking.estimated_duration} min`} />
              <InfoRow label="Queue number" value={`#${booking.queue_number}`} accent sub={booking.queue_number === 1 ? "You're next in line" : `${booking.queue_number - 1} ${booking.queue_number - 1 === 1 ? 'person' : 'people'} ahead`} />
              {booking.notes && <InfoRow label="Notes" value={booking.notes} />}
              {booking.cancellation_reason && <InfoRow label="Cancel reason" value={booking.cancellation_reason} />}
            </div>

            {/* Services */}
            <div className="q-card" style={{ padding: '16px 18px', marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Services</p>
              {booking.services.map(s => (
                <div key={s.service_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <ServiceImg name={s.name} size={34} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{s.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.duration_minutes} min</p>
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-1)', fontWeight: 700 }}>{formatINR(s.price)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: '2px solid var(--border)' }}>
                <span className="font-syne font-black" style={{ fontSize: 14, color: 'var(--text-1)' }}>Total</span>
                <span className="font-syne font-black" style={{ fontSize: 22, color: isPaid ? 'var(--green)' : 'var(--violet-light)' }}>{formatINR(booking.service_amount)}</span>
              </div>
            </div>

            {/* Business contact */}
            <div className="q-card" style={{ padding: '14px 18px', marginBottom: 12 }}>
              <p className="font-syne font-black" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 12 }}>Salon Contact</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <MapPin size={14} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{booking.business.address_line1}, {booking.business.city}, {booking.business.state}</span>
                </div>
                {booking.business.business_phone && (
                  <a href={`tel:${booking.business.business_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                    <Phone size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--violet-light)' }}>{booking.business.business_phone}</span>
                  </a>
                )}
                {booking.business.map_link && (
                  <button onClick={() => setMapOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <ExternalLink size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--violet-light)' }}>Get directions</span>
                  </button>
                )}
              </div>
            </div>

            {/* Review prompt for completed */}
            {isCompleted && (
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Star size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>How was your experience?</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Help others by leaving a review for {booking.staff.name}</p>
                </div>
                <button onClick={() => navigate('/customer/reviews')} className="q-btn-primary" style={{ fontSize: 12, padding: '6px 14px', flexShrink: 0 }}>Review</button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Payment Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'payment' && (
          <motion.div key="payment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {booking.payment ? (
              <div className="q-card" style={{ padding: '18px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Payment Details</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: isPaid ? 'var(--green-bg)' : 'var(--bg-surface)', border: `1px solid ${isPaid ? 'var(--green-border)' : 'var(--border)'}`, marginBottom: 14 }}>
                  {isPaid ? <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0 }} /> : <Clock size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
                  <div>
                    <span className="font-syne font-bold" style={{ fontSize: 14, color: isPaid ? 'var(--green)' : 'var(--text-2)', display: 'block' }}>
                      {booking.payment.status === 'SETTLED' ? 'Settled' : isPaid ? 'Payment Received' : booking.payment.status}
                    </span>
                    {booking.payment.paid_at && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDate(booking.payment.paid_at, 'dd MMM yyyy, hh:mm a')}</span>}
                  </div>
                </div>
                <InfoRow label="Amount" value={formatINR(booking.service_amount)} accent />
                {booking.payment.razorpay_payment_id && <InfoRow label="Payment ID" value={booking.payment.razorpay_payment_id} mono />}
                {booking.payment.refund_status && booking.payment.refund_status !== 'NONE' && (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--blue-bg)', border: '1px solid rgba(96,165,250,0.25)', marginTop: 12 }}>
                    <p className="font-syne font-bold" style={{ fontSize: 13, color: '#60a5fa', marginBottom: 4 }}>
                      Refund:{' '}
                      {booking.payment.refund_status === 'DONE'       ? '✅ Completed'  :
                       booking.payment.refund_status === 'PROCESSING' ? '⏳ Processing' :
                       '❌ Failed'}
                    </p>
                    {booking.payment.refund_amount != null && (
                      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Amount: {formatINR(booking.payment.refund_amount)}</p>
                    )}
                    {booking.payment.refund_status === 'PROCESSING' && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Expected within 5–7 business days to your original payment method.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '32px 20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 14 }}>
                <CreditCard size={28} style={{ color: 'var(--text-4)', margin: '0 auto 10px' }} />
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No payment information yet.</p>
                {booking.status === 'PENDING_PAYMENT' && (
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 6 }}>Complete payment to confirm your booking.</p>
                )}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Action buttons ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {booking.is_cancellable && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCancel(true)}
            style={{ flex: 1, height: 48, borderRadius: 14, fontSize: 14, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <X size={15} /> Cancel Booking
          </motion.button>
        )}
        {hasQr && activeTab !== 'qr' && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setActiveTab('qr')}
            style={{ flex: 1, height: 48, borderRadius: 14, fontSize: 14, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <QrCode size={15} /> Show QR
          </motion.button>
        )}
        {isCompleted && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/customer/reviews')}
            style={{ flex: 1, height: 48, borderRadius: 14, fontSize: 14, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Star size={15} /> Leave Review
          </motion.button>
        )}
      </div>

      {/* ── Cancel dialog ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showCancel}
        title="Cancel this booking?"
        description="Are you sure? If you've paid, a full refund will be processed within 5–7 business days."
        confirmLabel={cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel'}
        cancelLabel="Keep it"
        danger
        loading={cancelMutation.isPending}
        onCancel={() => { setShowCancel(false); setCancelReason('') }}
        onConfirm={() => cancelMutation.mutate()}>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Reason (optional)</label>
          <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Why are you cancelling?" className="q-input" maxLength={500} />
        </div>
      </ConfirmDialog>

      {/* ── Map modal ────────────────────────────────────────────────────────── */}
      <MapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        businessName={booking.business.business_name}
        address={booking.business.address_line1 ?? ''}
        city={booking.business.city}
        state={booking.business.state}
        mapLink={booking.business.map_link ?? undefined}
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Info,
  Loader2,
  MapPin,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  XCircle,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar } from '@/components/shared/Avatar'
import { usePageTitle, useSocketEvent } from '@/hooks'
import api from '@/lib/axios'
import { formatDate, formatTime, toApiDate } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  AvailabilityErrorDTO,
  AvailabilityErrorReason,
  CheckAvailabilityResponseDTO,
  CreateBookingResponseDTO,
  BookingDetailDTO,
  PublicBusinessProfileDTO,
  SlotDTO,
  StaffSuggestionResponseDTO,
  SuggestedStaffItemDTO,
} from '@/types'

const CSS = `
  .bf-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at 18% 0%, rgba(124,58,237,0.16), transparent 34%),
      linear-gradient(180deg, rgba(255,255,255,0.02), transparent 280px),
      var(--bg-page);
  }
  .bf-shell {
    max-width: 1400px;
    margin: 0 auto;
    padding: 28px 24px 120px;
  }
  .bf-booking-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 40px;
    align-items: start;
  }
  .bf-step-card {
    min-width: 0;
  }
  .bf-sidebar {
    position: sticky;
    top: 90px;
    align-self: start;
  }
  .bf-services-grid,
  .bf-staff-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .bf-service-card {
    min-height: 118px;
    height: 118px;
  }
  .bf-staff-card {
    min-height: 220px;
  }
  .bf-staff-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .bf-calendar-wrap {
    max-width: 650px;
    margin: 0 auto;
  }
  .bf-mobile-summary {
    display: none;
  }
  .bf-payment-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
    gap: 28px;
    align-items: start;
  }
  .bf-confirmed-grid {
    display: grid;
    grid-template-columns: minmax(0, 980px);
    justify-content: center;
    gap: 16px;
  }
  .bf-card {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.035);
    border-radius: 8px;
    box-shadow: 0 18px 44px rgba(0,0,0,0.18);
  }
  .bf-soft {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.025);
    border-radius: 8px;
  }
  .bf-text-action {
    color: var(--violet-light);
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .bf-day-open:not(.rdp-day_selected):not([disabled]) { color: var(--green) !important; font-weight: 700 !important; }
  .bf-day-holiday { color: var(--red) !important; opacity: 0.8 !important; }
  .bf-day-closed:not(.rdp-day_selected) { color: var(--text-3) !important; opacity: 0.55 !important; }
  .rdp-root { --rdp-accent-color: var(--violet); --rdp-day_button-border-radius: 8px; }
  .rdp-day_selected .rdp-day_button,
  .rdp-day_selected button {
    background: var(--violet) !important;
    color: #fff !important;
  }
  .rdp-day_today:not(.rdp-day_selected) .rdp-day_button,
  .rdp-day_today:not(.rdp-day_selected) button {
    border: 2px solid var(--violet) !important;
    color: var(--violet-light) !important;
  }
  .bf-calendar-wrap .rdp-week:hover,
  .bf-calendar-wrap .rdp-week:hover > *,
  .bf-calendar-wrap .rdp-month_grid tr:hover,
  .bf-calendar-wrap .rdp-month_grid tr:hover > * {
    background: transparent !important;
  }
  .bf-calendar-wrap .rdp-day_button:hover {
    background: rgba(124,58,237,0.12) !important;
  }
  @media (max-width: 1180px) {
    .bf-services-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .bf-staff-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 1023px) {
    .bf-shell { padding: 18px 16px 112px; }
    .bf-booking-grid,
    .bf-payment-grid,
    .bf-confirmed-grid { grid-template-columns: 1fr; gap: 20px; }
    .bf-sidebar { display: none; }
    .bf-mobile-summary { display: block; }
    .bf-staff-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .bf-services-grid,
    .bf-staff-grid { grid-template-columns: 1fr; }
    .bf-service-card { height: 118px; }
  }
`

const STEPS = [
  { label: 'Services', icon: Scissors },
  { label: 'Date', icon: Calendar },
  { label: 'Staff', icon: User },
  { label: 'Review', icon: BookOpen },
  { label: 'Pay', icon: CreditCard },
  { label: 'Done', icon: CheckCircle2 },
]

const DAY_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

type ApiErrorData = {
  message?: string
  code?: string
  reason?: AvailabilityErrorReason
}

type HolidayRange = {
  start_date: string
  end_date: string
}

type RazorpayPaymentResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayFailedResponse = {
  error?: { description?: string }
}

type RazorpayInstance = {
  on: (event: 'payment.failed', callback: (response: RazorpayFailedResponse) => void) => void
  open: () => void
  close: () => void
}

type RazorpayOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  theme: { color: string }
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>
  modal: { ondismiss: () => void }
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance

type PaymentConfirmedEvent = {
  bookingId?: string
  qrImageUrl?: string | null
}

type PaymentFailedEvent = {
  bookingId?: string
  errorDescription?: string
}

type BookingExpiredEvent = {
  bookingId?: string
  message?: string
}

function getApiErrorData(error: unknown): ApiErrorData {
  if (!error || typeof error !== 'object') return {}
  const response = (error as { response?: { data?: unknown } }).response
  const data = response?.data
  if (!data || typeof data !== 'object') return {}
  const record = data as Record<string, unknown>
  return {
    message: typeof record.message === 'string' ? record.message : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
    reason: typeof record.reason === 'string' ? record.reason as AvailabilityErrorReason : undefined,
  }
}

function deriveArrivalStart(time: string): Date {
  return new Date(new Date(time).getTime() - 15 * 60_000)
}

function Money({ paise, size = 16, tone = 'default' }: { paise: number; size?: number; tone?: 'default' | 'accent' }) {
  const amount = (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const color = tone === 'accent' ? 'var(--violet-light)' : 'var(--text-1)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, color, lineHeight: 1, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: Math.max(12, Math.round(size * 0.72)), fontWeight: 900 }}>{'\u20b9'}</span>
      <span className="font-syne font-black" style={{ fontSize: size }}>{amount}</span>
    </span>
  )
}

function SectionHeader({ title, eyebrow, subtitle }: { title: string; eyebrow: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 11, color: 'var(--violet-light)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }}>{eyebrow}</p>
      <h2 className="font-syne font-black" style={{ fontSize: 'clamp(25px, 3vw, 40px)', lineHeight: 1.05, color: 'var(--text-1)', marginBottom: 8 }}>{title}</h2>
      {subtitle && <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 620, lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  )
}

function StepProgress({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 4, marginBottom: 26, scrollbarWidth: 'none' }}>
      {STEPS.slice(0, 5).map((item, index) => {
        const Icon = item.icon
        const active = index === step
        const done = index < step
        return (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: done ? 'var(--green)' : active ? 'var(--violet)' : 'rgba(255,255,255,0.04)',
              border: done || active ? '1px solid transparent' : '1px solid var(--border)',
              color: done || active ? '#fff' : 'var(--text-3)',
            }}>
              {done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: active ? 'var(--text-1)' : done ? 'var(--green)' : 'var(--text-3)' }}>{item.label}</span>
            {index < 4 && <div style={{ width: 28, height: 1, background: done ? 'var(--green)' : 'var(--border)' }} />}
          </div>
        )
      })}
    </div>
  )
}

function ServiceImage({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return <img src={src} alt={name} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.24)', flexShrink: 0 }}>
      <Scissors size={Math.round(size * 0.38)} style={{ color: 'var(--violet-light)' }} />
    </div>
  )
}

function StaffAvatar({ name, src, size = 'lg' }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return <Avatar name={name} src={src} size={size} />
}

function Row({ label, value, strong, sub }: { label: string; value: React.ReactNode; strong?: boolean; sub?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{label}</span>
      <span style={{ color: strong ? 'var(--text-1)' : 'var(--text-2)', fontSize: 13, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>
        {value}
        {sub && <span style={{ display: 'block', color: 'var(--text-3)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>{sub}</span>}
      </span>
    </div>
  )
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'success'; children: React.ReactNode }) {
  const map = {
    info: ['rgba(124,58,237,0.08)', 'rgba(124,58,237,0.22)', 'var(--violet-light)', Info],
    warn: ['rgba(245,158,11,0.08)', 'rgba(245,158,11,0.22)', '#f59e0b', AlertCircle],
    success: ['var(--green-bg)', 'var(--green-border)', 'var(--green)', ShieldCheck],
  } as const
  const [bg, border, color, Icon] = map[tone]
  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: bg, border: `1px solid ${border}`, color, fontSize: 13, lineHeight: 1.55 }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  )
}

function PaymentSuccessOverlay({ onDone, ready }: { onDone: () => void; ready: boolean }) {
  const [minimumShown, setMinimumShown] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumShown(true), 2000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (minimumShown && ready) onDone()
  }, [minimumShown, onDone, ready])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', background: 'rgba(8,10,24,0.88)', backdropFilter: 'blur(14px)', padding: 20 }}>
      <motion.div initial={{ scale: 0.86, y: 18, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 24 }} className="bf-card" style={{ width: 'min(420px, 100%)', padding: 34, textAlign: 'center', background: 'var(--bg-card)' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 18, delay: 0.05 }} style={{ width: 86, height: 86, borderRadius: 999, margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: 'var(--green-bg)', border: '2px solid var(--green-border)' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--green)' }} />
        </motion.div>
        <h2 className="font-syne font-black" style={{ fontSize: 28, color: 'var(--text-1)', marginBottom: 6 }}>Payment successful</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.55 }}>
          {ready ? 'Your QR code is ready.' : 'Your appointment is confirmed. Getting your QR code ready.'}
        </p>
        <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 24 }}>
          <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2, ease: 'linear' }} style={{ height: '100%', background: 'var(--green)' }} />
        </div>
      </motion.div>
    </motion.div>
  )
}

function QrImage({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div style={{ width: 190, height: 190, borderRadius: 8, border: '1px dashed var(--border-2)', background: 'rgba(255,255,255,0.03)', display: 'grid', placeItems: 'center', color: 'var(--text-3)', textAlign: 'center', padding: 18 }}>
        <div>
          <QrCode size={42} style={{ margin: '0 auto 10px', color: 'var(--violet-light)' }} />
          <p style={{ fontSize: 13 }}>QR code will be available in My Bookings.</p>
        </div>
      </div>
    )
  }
  return <img src={url} alt="Appointment QR code" onError={() => setFailed(true)} style={{ width: 190, height: 190, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', padding: 8 }} />
}

function BusinessVisual({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
  }
  return <Building2 size={Math.round(size * 0.78)} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
}

export default function BookingFlow() {
  const { businessId } = useParams<{ businessId: string }>()
  const navigate = useNavigate()
  usePageTitle('Book Appointment')

  const [step, setStep] = useState(0)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>()
  const [useRandom, setUseRandom] = useState(false)
  const [notes, setNotes] = useState('')
  const [reservationToken, setReservationToken] = useState('')
  const [availData, setAvailData] = useState<CheckAvailabilityResponseDTO | null>(null)
  const [availError, setAvailError] = useState<AvailabilityErrorDTO | null>(null)
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(0)
  const [bookingResult, setBookingResult] = useState<CreateBookingResponseDTO | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<BookingDetailDTO | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentExpired, setPaymentExpired] = useState(false)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const [paymentFailedMsg, setPaymentFailedMsg] = useState('')
  const [orderCreating, setOrderCreating] = useState(false)
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false)
  const [successReady, setSuccessReady] = useState(false)
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false)
  const [voidingPending, setVoidingPending] = useState(false)
  const [showSummarySheet, setShowSummarySheet] = useState(false)

  const payLockRef = useRef(false)
  const idemKeyRef = useRef<string | null>(null)
  const successOverlayShownRef = useRef(false)

  const { data: biz, isLoading: bizLoading } = useQuery({
    queryKey: ['booking-biz', businessId],
    queryFn: async () => {
      const response = await api.get(`/customer/business/${businessId}`)
      return response.data.data as PublicBusinessProfileDTO
    },
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  })

  const { data: staffSugg, isFetching: staffFetching } = useQuery({
    queryKey: ['suggest-staff', biz?.id, selectedServices, selectedDate?.toISOString()],
    queryFn: async () => {
      const response = await api.post('/customer/booking/suggest-staff', {
        business_id: biz!.id,
        service_offering_ids: selectedServices,
        service_date: toApiDate(selectedDate!),
      })
      return response.data.data as StaffSuggestionResponseDTO
    },
    enabled: step === 2 && selectedServices.length > 0 && !!selectedDate && !!biz?.id,
    staleTime: 0,
  })

  const staff: SuggestedStaffItemDTO[] = staffSugg?.can_fully_serve ?? []
  const selectedSvcList = useMemo(() => (biz?.services ?? []).filter((service) => selectedServices.includes(service.id)), [biz?.services, selectedServices])
  const totalAmount = selectedSvcList.reduce((sum, service) => sum + (service.discounted_price ?? service.price), 0)
  const totalDuration = staffSugg?.total_duration_min ?? selectedSvcList.reduce((sum, service) => {
    const durations = biz?.staff.flatMap((member) => member.services.filter((s) => s.offering_id === service.id).map((s) => s.duration_minutes)) ?? []
    return sum + (durations[0] ?? 0)
  }, 0)
  const slots: SlotDTO[] = availData?.slots ?? []
  const selectedSlot = slots[selectedSlotIdx] ?? slots[0] ?? null
  const displaySlot = selectedSlot
  const selectedStaffProfile = biz?.staff.find((member) => member.id === (useRandom ? availData?.auto_assigned?.staff_id : selectedStaffId))
  const confirmedStart = confirmedBooking?.service_start_time ?? displaySlot?.service_start_time ?? null
  const confirmedArrivalStart = confirmedStart ? deriveArrivalStart(confirmedStart).toISOString() : null
  const paymentAmount = bookingResult?.service_amount ?? totalAmount
  const businessImage = biz?.logo_url ?? biz?.primary_image ?? biz?.gallery?.find((image) => image.is_primary)?.image_url ?? biz?.gallery?.[0]?.image_url ?? null
  const confirmedServices = confirmedBooking?.services?.length
    ? confirmedBooking.services.map((service) => ({
      id: service.service_id,
      name: service.name,
      image_url: service.image_url,
      category: '',
      price: service.price,
      duration: service.duration_minutes,
    }))
    : selectedSvcList.map((service) => ({
      id: service.id,
      name: service.name,
      image_url: service.image_url,
      category: service.service_for,
      price: service.discounted_price ?? service.price,
    }))
  const confirmedBusinessName = confirmedBooking?.business.business_name ?? biz?.business_name ?? ''
  const confirmedBusinessLogo = confirmedBooking?.business.logo_url ?? businessImage
  const confirmedBusinessAddress = confirmedBooking?.business.address_line1
    ? `${confirmedBooking.business.address_line1}, ${confirmedBooking.business.city}`
    : `${biz?.address_line1 ?? ''}, ${biz?.city ?? ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '')
  const confirmedBusinessPhone = confirmedBooking?.business.business_phone ?? biz?.business_phone
  const confirmedStaffName = confirmedBooking?.staff?.name ?? displaySlot?.staff_name ?? selectedStaffProfile?.name ?? 'Assigned staff'
  const confirmedStaffAvatar = confirmedBooking?.staff?.avatar_url ?? displaySlot?.avatar_url ?? selectedStaffProfile?.avatar_url ?? null
  const confirmedDuration = confirmedBooking?.estimated_duration ?? displaySlot?.estimated_duration ?? totalDuration
  const confirmedPayment = confirmedBooking?.payment
  const confirmedPaidAt = confirmedPayment?.paid_at ? formatDate(confirmedPayment.paid_at, 'dd MMM yyyy, hh:mm a') : null
  const confirmedCancellationUntil = confirmedBooking?.cancellable_until ? formatDate(confirmedBooking.cancellable_until, 'dd MMM yyyy, hh:mm a') : null

  useEffect(() => {
    if (step === 0) {
      idemKeyRef.current = null
      successOverlayShownRef.current = false
    }
  }, [step])

  useEffect(() => {
    if (step > 0 && step < 5) {
      const handler = (event: BeforeUnloadEvent) => {
        event.preventDefault()
        event.returnValue = ''
      }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [step])

  const getIdemKey = useCallback(() => {
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID()
    return idemKeyRef.current
  }, [])

  const showPaymentSuccessOnce = useCallback(() => {
    if (successOverlayShownRef.current) return
    successOverlayShownRef.current = true
    setSuccessReady(false)
    setShowSuccessOverlay(true)
  }, [])

  const availMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/customer/booking/availability', {
        business_id: biz!.id,
        service_offering_ids: selectedServices,
        service_date: toApiDate(selectedDate!),
        staff_id: useRandom ? undefined : selectedStaffId,
        mode: useRandom ? 'random' : 'select',
      })
      return response.data.data as CheckAvailabilityResponseDTO
    },
    onSuccess: (data) => {
      setAvailData(data)
      setAvailError(null)
      setReservationToken(data.reservation_token)
      setPaymentExpired(false)
      setPaymentFailed(false)
      setSelectedSlotIdx(0)
      sessionStorage.setItem('reservation_token', data.reservation_token)
      idemKeyRef.current = null
      setAvailabilityModalOpen(true)
    },
    onError: (err: unknown) => {
      const data = getApiErrorData(err)
      const reason = data.reason ?? 'no_slots'
      const message = data.message || 'Something went wrong. Please try again.'
      setAvailData(null)
      setAvailError({ reason, message })
    },
  })

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (bookingResult?.status === 'PENDING_PAYMENT') return bookingResult
      const response = await api.post('/customer/booking/', {
        reservation_token: reservationToken,
        selected_slot_idx: selectedSlotIdx,
        idempotency_key: getIdemKey(),
        notes: notes || undefined,
      })
      return response.data.data as CreateBookingResponseDTO
    },
    onSuccess: (data) => {
      setBookingResult(data)
      setPaymentExpired(false)
      setPaymentFailed(false)
      setStep(4)
    },
    onError: (err: unknown) => {
      const data = getApiErrorData(err)
      const msg = data.message ?? ''
      const errorCode = data.code ?? ''
      const lc = msg.toLowerCase()

      if (lc.includes('expired') || lc.includes('reservation')) {
        toast.error('Reservation expired. Please check availability again.')
        idemKeyRef.current = null
        setStep(1)
        setAvailData(null)
        setAvailError(null)
        setReservationToken('')
      } else if (errorCode === 'SLOT_CONFLICT' || lc.includes('taken') || lc.includes('just taken')) {
        toast.info('That slot changed while you were reviewing. Refreshing availability.')
        idemKeyRef.current = null
        setSelectedSlotIdx(0)
        setStep(2)
        setTimeout(() => availMutation.mutate(), 800)
      } else if (errorCode === 'NO_SLOTS_AVAILABLE' || lc.includes('no slot is available')) {
        toast.error('This stylist is fully booked for this date. Please choose a different date or staff member.', { duration: 6000 })
        idemKeyRef.current = null
        setStep(2)
        setAvailData(null)
        setAvailError(null)
      } else if (lc.includes('being processed') || lc.includes('wait a moment')) {
        toast.info('Slot is being confirmed. Please try again in a few seconds.', { duration: 5000 })
        idemKeyRef.current = null
      } else {
        toast.error(msg || 'Could not create booking. Please try again.')
      }
    },
  })

  const verifyPaymentInBackground = useCallback(async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }, bookingId: string) => {
    try {
      const verifyRes = await api.post('/payment/verify', {
        booking_id: bookingId,
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature,
      })
      const verified = verifyRes.data.data
      if (verified?.qr_image_url) setQrUrl(verified.qr_image_url)
      const bookingRes = await api.get(`/customer/booking/${bookingId}`)
      const booking = bookingRes.data.data as BookingDetailDTO
      setConfirmedBooking(booking)
      if (booking.qr_image_url && !verified?.qr_image_url) setQrUrl(booking.qr_image_url)
      setSuccessReady(true)
      return true
    } catch (verifyErr: unknown) {
      const status = (verifyErr as { response?: { status?: number } })?.response?.status
      const message = (getApiErrorData(verifyErr).message ?? '').toLowerCase()
      if (status === 400 || message.includes('already')) {
        try {
          const bookingRes = await api.get(`/customer/booking/${bookingId}`)
          const booking = bookingRes.data.data as BookingDetailDTO
          setConfirmedBooking(booking)
          setQrUrl(booking.qr_image_url ?? null)
          setSuccessReady(true)
          return true
        } catch {
          /* Webhook/socket confirmation remains the fallback. */
        }
      }
    }
    setSuccessReady(true)
    return false
  }, [])

  const handlePay = useCallback(async () => {
    if (!bookingResult || payLockRef.current || paymentExpired) return
    const Razorpay = (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay
    if (!Razorpay) {
      toast.error('Payment gateway not loaded. Please refresh and try again.')
      return
    }

    const envKey = (import.meta.env?.VITE_RAZORPAY_KEY_ID ?? '').trim()
    payLockRef.current = true
    setPaymentLoading(true)
    setOrderCreating(true)
    setPaymentFailed(false)

    try {
      const orderRes = await api.post('/payment/order', { booking_id: bookingResult.booking_id })
      const orderData = orderRes.data.data as { order_id: string; amount: number; currency: string; razorpay_key_id?: string }
      const rzpKey = (envKey || orderData.razorpay_key_id || '').trim()
      setOrderCreating(false)

      if (!rzpKey) {
        toast.error('Payment is not configured. Contact support.')
        payLockRef.current = false
        setPaymentLoading(false)
        return
      }

      const rzp = new Razorpay({
        key: rzpKey,
        order_id: orderData.order_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: biz?.business_name ?? 'Quby',
        description: 'Appointment booking',
        theme: { color: '#7c3aed' },
        handler: async (resp: RazorpayPaymentResponse) => {
          sessionStorage.removeItem('reservation_token')
          sessionStorage.removeItem('quby_payment_deadline')
          idemKeyRef.current = null
          payLockRef.current = false
          setPaymentLoading(false)
          showPaymentSuccessOnce()
          void verifyPaymentInBackground(resp, bookingResult.booking_id)
        },
        modal: {
          ondismiss: () => {
            toast.info('Payment cancelled. Your slot is still reserved for a short time.')
            payLockRef.current = false
            setPaymentLoading(false)
            setOrderCreating(false)
          },
        },
      })

      rzp.on('payment.failed', (response: RazorpayFailedResponse) => {
        setPaymentFailed(true)
        setPaymentFailedMsg(response?.error?.description || 'Payment failed. Please try with a different payment method.')
        payLockRef.current = false
        setPaymentLoading(false)
        setOrderCreating(false)
        rzp.close()
      })
      rzp.open()
    } catch (orderErr: unknown) {
      const message = getApiErrorData(orderErr).message ?? ''
      const status = (orderErr as { response?: { status?: number } })?.response?.status
      const lower = message.toLowerCase()
      if (status === 429) {
        toast.error('Payment rate limit exceeded. Please wait one minute.')
      } else if (lower.includes('confirmed') || lower.includes('paid')) {
        api.get(`/customer/booking/${bookingResult.booking_id}`)
          .then((response) => {
            const booking = response.data.data
            setConfirmedBooking(booking)
            setQrUrl(booking?.qr_image_url ?? null)
            showPaymentSuccessOnce()
            setSuccessReady(true)
          })
          .catch(() => { showPaymentSuccessOnce(); setSuccessReady(true) })
      } else if (lower.includes('expired') || lower.includes('timeout')) {
        sessionStorage.removeItem('quby_payment_deadline')
        idemKeyRef.current = null
        toast.error('Booking expired due to timeout. Please book again.')
        setStep(1)
        setAvailData(null)
        setAvailError(null)
        setBookingResult(null)
      } else {
        toast.error(message || 'Could not start payment. Please try again.')
      }
      payLockRef.current = false
      setPaymentLoading(false)
      setOrderCreating(false)
    }
  }, [bookingResult, biz?.business_name, paymentExpired, showPaymentSuccessOnce, verifyPaymentInBackground])

  const voidAndGoBack = useCallback(async () => {
    if (!bookingResult?.booking_id) return
    setVoidingPending(true)
    try {
      await api.post(`/customer/booking/${bookingResult.booking_id}/void`)
    } catch (error: unknown) {
      const msg = (getApiErrorData(error).message ?? '').toLowerCase()
      if (msg.includes('confirmed') || msg.includes('paid')) {
        api.get(`/customer/booking/${bookingResult.booking_id}`)
          .then((response) => {
            setConfirmedBooking(response.data.data)
            setQrUrl(response.data.data?.qr_image_url ?? null)
            showPaymentSuccessOnce()
            setSuccessReady(true)
          })
          .catch(() => {
            /* Confirmation fetch is best effort. */
          })
        setVoidingPending(false)
        return
      }
    } finally {
      setVoidingPending(false)
    }
    sessionStorage.removeItem('quby_payment_deadline')
    sessionStorage.removeItem('reservation_token')
    idemKeyRef.current = null
    payLockRef.current = false
    setBookingResult(null)
    setReservationToken('')
    setAvailData(null)
    setAvailError(null)
    setSelectedSlotIdx(0)
    setPaymentFailed(false)
    setPaymentLoading(false)
    setOrderCreating(false)
    setStep(2)
  }, [bookingResult, showPaymentSuccessOnce])

  useEffect(() => {
    if (step !== 4 || !bookingResult?.booking_id) return
    let cancelled = false
    api.get(`/customer/booking/${bookingResult.booking_id}`)
      .then((response) => {
        if (cancelled) return
        const status = response.data?.data?.status ?? response.data?.status
        if (status === 'CONFIRMED') {
          const booking = response.data.data
          setConfirmedBooking(booking)
          setQrUrl(booking?.qr_image_url ?? null)
          showPaymentSuccessOnce()
          setSuccessReady(true)
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          sessionStorage.removeItem('quby_payment_deadline')
          toast.error('Your slot was released. Please start again.')
          setPaymentExpired(true)
          setStep(1)
          setAvailData(null)
          setAvailError(null)
          setBookingResult(null)
          setReservationToken('')
        }
      })
      .catch(() => {
        /* Polling is opportunistic; socket/webhook can still confirm. */
      })
    return () => { cancelled = true }
  }, [step, bookingResult?.booking_id, showPaymentSuccessOnce])

  useSocketEvent('payment:confirmed', ({ bookingId, qrImageUrl }: PaymentConfirmedEvent) => {
    if (bookingId !== bookingResult?.booking_id || step !== 4) return
    if (qrImageUrl) setQrUrl(qrImageUrl)
    api.get(`/customer/booking/${bookingId}`)
      .then((response) => {
        setConfirmedBooking(response.data.data)
        setQrUrl(response.data.data?.qr_image_url ?? qrImageUrl ?? null)
        showPaymentSuccessOnce()
        setSuccessReady(true)
      })
      .catch(() => { showPaymentSuccessOnce(); setSuccessReady(true) })
  })

  useSocketEvent('payment:failed', ({ bookingId, errorDescription }: PaymentFailedEvent) => {
    if (bookingId !== bookingResult?.booking_id) return
    setPaymentFailed(true)
    setPaymentFailedMsg(errorDescription || 'Payment failed. Please try again.')
    setPaymentLoading(false)
    payLockRef.current = false
  })

  useSocketEvent('booking:expired', ({ bookingId, message }: BookingExpiredEvent) => {
    if (bookingId !== bookingResult?.booking_id || step !== 4) return
    sessionStorage.removeItem('reservation_token')
    sessionStorage.removeItem('quby_payment_deadline')
    idemKeyRef.current = null
    payLockRef.current = false
    toast.error(message || 'Your slot was released. Please start again.', { duration: 8000 })
    setPaymentExpired(true)
    setPaymentLoading(false)
    setPaymentFailed(false)
    setBookingResult(null)
    setReservationToken('')
    setAvailData(null)
    setAvailError(null)
    setSelectedSlotIdx(0)
    setStep(1)
  })

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const closedWeekdays = (biz?.schedules ?? []).filter((schedule) => !schedule.is_open).map((schedule) => DAY_MAP[schedule.day_of_week]).filter((day) => day !== undefined) as number[]
  const openWeekdays = (biz?.schedules ?? []).filter((schedule) => schedule.is_open).map((schedule) => DAY_MAP[schedule.day_of_week]).filter((day) => day !== undefined) as number[]
  const holidayDates = (biz?.holidays ?? []).flatMap((holiday: HolidayRange) => {
    const dates: Date[] = []
    const cursor = new Date(holiday.start_date)
    const end = new Date(holiday.end_date)
    cursor.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    while (cursor <= end) {
      dates.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return dates
  })
  const isTodayPastClose = (() => {
    if (!biz?.todays_schedule?.is_open || !biz.todays_schedule.close_time) return false
    const [hours, minutes] = biz.todays_schedule.close_time.split(':').map(Number)
    const closeDate = new Date()
    closeDate.setHours(hours, minutes, 0, 0)
    return new Date() >= closeDate
  })()
  const isHoliday = (date: Date) => holidayDates.some((holiday) => holiday.toDateString() === date.toDateString())
  const isClosed = (date: Date) => closedWeekdays.includes(date.getDay()) || (date.toDateString() === today.toDateString() && isTodayPastClose)
  const disabledMatcher = (date: Date) => date < today || isHoliday(date) || isClosed(date)
  const modifiers = {
    open: (date: Date) => !disabledMatcher(date) && openWeekdays.includes(date.getDay()),
    holiday: (date: Date) => isHoliday(date),
    closed: (date: Date) => !isHoliday(date) && isClosed(date),
  }

  const backTargetLabel = step === 0 ? 'Business Details' : step === 1 ? 'Services' : step === 2 ? 'Date' : step === 3 ? 'Staff' : 'Review'
  const goBack = async () => {
    if (step === 4 && bookingResult?.booking_id) {
      await voidAndGoBack()
      return
    }
    if (step === 0) {
      if (biz?.slug) navigate(`/customer/business/${biz.slug}`)
      else navigate(-1)
    } else if (step === 1) {
      setSelectedDate(undefined)
      setSelectedStaffId(undefined)
      setUseRandom(false)
      setAvailData(null)
      setAvailError(null)
      setStep(0)
    } else if (step === 2) {
      setSelectedStaffId(undefined)
      setUseRandom(false)
      setAvailData(null)
      setAvailError(null)
      setStep(1)
    } else if (step === 3) {
      setStep(2)
    }
  }

  if (bizLoading) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 28 }}>
        <div className="skeleton rounded-xl" style={{ height: 88, marginBottom: 18 }} />
        <div className="skeleton rounded-xl" style={{ height: 420 }} />
      </div>
    )
  }

  if (!biz) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <XCircle size={44} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>Business not found.</p>
          <button className="q-btn-primary" onClick={() => navigate('/customer/explore')}>Explore businesses</button>
        </div>
      </div>
    )
  }

  const SummaryContent = ({ full = false }: { full?: boolean }) => (
    <div className="bf-card" style={{ padding: 20, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <BusinessVisual src={businessImage} name={biz.business_name} />
        <div style={{ minWidth: 0 }}>
          <p className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{biz.business_name}</p>
          <p style={{ color: 'var(--text-3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{biz.city}</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 10 }}>Services</p>
        {selectedSvcList.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No services selected yet.</p>
        ) : selectedSvcList.map((service) => (
          <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <ServiceImage src={service.image_url} name={service.name} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.name}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{service.service_for}</p>
            </div>
            <Money paise={service.discounted_price ?? service.price} size={13} />
          </div>
        ))}
      </div>

      {(selectedDate || full) && <Row label="Date" value={selectedDate ? formatDate(toApiDate(selectedDate), 'EEEE, dd MMM yyyy') : 'Not selected'} strong={!!selectedDate} />}
      {(displaySlot || full) && <Row label="Staff" value={displaySlot?.staff_name ?? selectedStaffProfile?.name ?? 'Not selected'} strong={!!displaySlot || !!selectedStaffProfile} />}
      {full && displaySlot && <Row label="Arrival Window" value={`${formatTime(deriveArrivalStart(displaySlot.service_start_time).toISOString())} - ${formatTime(displaySlot.service_start_time)}`} />}
      {full && displaySlot && <Row label="Estimated Duration" value={`${displaySlot.estimated_duration} min`} />}
      {full && notes && <Row label="Special Notes" value={notes} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginTop: 4 }}>
        <span className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 16 }}>Total</span>
        <Money paise={totalAmount} size={24} tone="accent" />
      </div>
    </div>
  )

  const MobileSummary = () => {
    if (step >= 4 || selectedSvcList.length === 0) return null
    return (
      <div className="bf-mobile-summary">
        <div style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 60 }}>
          <Sheet open={showSummarySheet} onOpenChange={setShowSummarySheet}>
            <SheetTrigger asChild>
              <button style={{ width: '100%', height: 64, borderRadius: 8, border: '1px solid var(--violet-border)', background: 'var(--bg-card)', boxShadow: '0 18px 44px rgba(0,0,0,0.34)', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <p style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedSvcList[0]?.name}{selectedSvcList.length > 1 ? ` +${selectedSvcList.length - 1}` : ''}</p>
                  <Money paise={totalAmount} size={18} tone="accent" />
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--violet-light)', fontWeight: 800 }}>View Summary <ChevronRight size={16} /></span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl border-[var(--border)] bg-[var(--bg-card)] p-0 text-[var(--text-1)]" showCloseButton>
              <SheetHeader>
                <SheetTitle className="text-[var(--text-1)]">Booking Summary</SheetTitle>
                <SheetDescription className="text-[var(--text-3)]">Review your selected services, date, staff, and total.</SheetDescription>
              </SheetHeader>
              <div style={{ padding: '0 16px 18px' }}><SummaryContent full /></div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    )
  }

  const AvailabilityModal = () => {
    if (!availabilityModalOpen || !availData || !displaySlot) return null
    const assignedStaffId = availData.mode === 'random' ? availData.auto_assigned?.staff_id : selectedStaffId
    const assignedStaffName = availData.mode === 'random' ? availData.auto_assigned?.staff_name : displaySlot.staff_name
    const profile = biz.staff.find((member) => member.id === assignedStaffId)
    const arrivalStart = deriveArrivalStart(displaySlot.service_start_time).toISOString()

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'grid', placeItems: 'center', background: 'rgba(5,7,18,0.72)', backdropFilter: 'blur(10px)', padding: 20 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="bf-card"
          style={{ width: 'min(460px, 100%)', background: 'var(--bg-card)', overflow: 'hidden' }}
        >
          <div style={{ padding: 22, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--green-bg)', textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: 999, display: 'grid', placeItems: 'center', margin: '0 auto 12px', background: 'var(--green)', color: '#fff' }}>
              <Check size={28} strokeWidth={3} />
            </div>
            <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 22 }}>Slot available</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
              {availData.mode === 'random' ? availData.auto_assigned?.reason ?? 'Best available staff selected.' : 'This staff member can serve your appointment.'}
            </p>
          </div>
          <div style={{ padding: 22 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
              <StaffAvatar name={assignedStaffName ?? 'Staff'} src={profile?.avatar_url ?? displaySlot.avatar_url} size="xl" />
              <div style={{ minWidth: 0 }}>
                <p className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20 }}>{assignedStaffName}</p>
                <p style={{ color: 'var(--violet-light)', fontSize: 13 }}>{profile?.specialization ?? 'Stylist'}</p>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{profile?.experience_years ?? 0}+ yrs experience</p>
              </div>
            </div>
            <div className="bf-soft" style={{ padding: 16, marginBottom: 18 }}>
              <Row label="Date" value={formatDate(availData.service_date, 'EEEE, dd MMM yyyy')} strong />
              <Row label="Estimated Start" value={formatTime(displaySlot.service_start_time)} strong />
              <Row label="Arrival Window" value={`${formatTime(arrivalStart)} - ${formatTime(displaySlot.service_start_time)}`} />
              <Row label="Estimated Duration" value={`${displaySlot.estimated_duration} min`} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <Notice tone="info">Start times are queue estimates. Your final arrival window is confirmed after payment.</Notice>
            </div>
            <button className="q-btn-primary" onClick={() => { setAvailabilityModalOpen(false); setStep(3) }} style={{ width: '100%', height: 50, borderRadius: 8, fontSize: 15 }}>
              Proceed with {assignedStaffName} <ArrowRight size={18} />
            </button>
            <button
              onClick={() => { setAvailabilityModalOpen(false); setAvailData(null); setAvailError(null); setUseRandom(false); setSelectedStaffId(undefined) }}
              style={{ width: '100%', height: 44, borderRadius: 8, marginTop: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 800 }}
            >
              Choose a different staff
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const ReviewSummary = () => (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="bf-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
          <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 18 }}>Services</h3>
          <button className="bf-text-action" onClick={() => setStep(0)}>Change Service</button>
        </div>
        {selectedSvcList.map((service) => (
          <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <ServiceImage src={service.image_url} name={service.name} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-1)', fontWeight: 800 }}>{service.name}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{service.service_for}</p>
            </div>
            <Money paise={service.discounted_price ?? service.price} size={14} />
          </div>
        ))}
      </div>
      <div className="bf-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 6 }}>
          <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 18 }}>Appointment</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="bf-text-action" onClick={() => setStep(1)}>Change Date</button>
            <button className="bf-text-action" onClick={() => setStep(2)}>Change Staff</button>
          </div>
        </div>
        <Row label="Date" value={availData ? formatDate(availData.service_date, 'EEEE, dd MMM yyyy') : ''} strong />
        <Row label="Staff" value={displaySlot?.staff_name ?? availData?.auto_assigned?.staff_name ?? 'Auto assigned'} strong />
        {displaySlot && <Row label="Arrival Window" value={`${formatTime(deriveArrivalStart(displaySlot.service_start_time).toISOString())} - ${formatTime(displaySlot.service_start_time)}`} sub="Show your QR code during this window" />}
        {displaySlot && <Row label="Estimated Duration" value={`${displaySlot.estimated_duration} min`} />}
        {displaySlot && <Row label="Queue Position" value={`#${displaySlot.queue_number}`} />}
      </div>
      <div className="bf-card" style={{ padding: 20 }}>
        <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 18, marginBottom: 8 }}>Special Notes</h3>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Allergies, preferences, or anything the staff should know" maxLength={500} rows={4} className="q-input" style={{ width: '100%', resize: 'none', borderRadius: 8 }} />
        <p style={{ color: 'var(--text-4)', textAlign: 'right', fontSize: 11, marginTop: 4 }}>{notes.length}/500</p>
      </div>
      <div className="bf-card" style={{ padding: 20 }}>
        <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 18, marginBottom: 8 }}>Price Breakdown</h3>
        {selectedSvcList.map((service) => (
          <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <ServiceImage src={service.image_url} name={service.name} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-1)', fontWeight: 800 }}>{service.name}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{service.service_for}</p>
            </div>
            <Money paise={service.discounted_price ?? service.price} size={14} />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 }}>
          <span className="font-syne font-black" style={{ fontSize: 18 }}>Total</span>
          <Money paise={totalAmount} size={30} tone="accent" />
        </div>
      </div>

      
      {/* <Notice tone="warn">Free cancellation is available until {biz.cancellation_window_hours} hours before your appointment. After that, cancellation may be treated as a no-show.</Notice> */}
    </div>
  )

  return (
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {showSuccessOverlay && <PaymentSuccessOverlay ready={successReady} onDone={() => { setShowSuccessOverlay(false); setStep(5) }} />}
      </AnimatePresence>
      <AnimatePresence>
        <AvailabilityModal />
      </AnimatePresence>

      <div className="bf-page">
        <div className="bf-shell">
          {step < 5 && (
            <button onClick={goBack} disabled={voidingPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 44, padding: '0 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: voidingPending ? 'wait' : 'pointer', fontWeight: 800, marginBottom: 22 }}>
              {voidingPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={18} />}
              Back to {backTargetLabel}
            </button>
          )}

          {step < 4 && <StepProgress step={step} />}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="services" className="bf-booking-grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }}>
                <main className="bf-step-card">
                  <SectionHeader eyebrow="Step 1" title="Choose your services" subtitle="Select everything you want in this visit. Your summary updates automatically." />
                  <div className="bf-services-grid">
                    {biz.services.map((service) => {
                      const selected = selectedServices.includes(service.id)
                      return (
                        <motion.button key={service.id} whileTap={{ scale: 0.985 }} onClick={() => setSelectedServices((prev) => prev.includes(service.id) ? prev.filter((id) => id !== service.id) : [...prev, service.id])} className="bf-service-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: selected ? 'rgba(124,58,237,0.10)' : 'rgba(255,255,255,0.035)', border: selected ? '1.5px solid var(--violet)' : '1px solid rgba(255,255,255,0.08)' }}>
                          <ServiceImage src={service.image_url} name={service.name} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ color: 'var(--text-1)', fontWeight: 900, fontSize: 15, lineHeight: 1.2, marginBottom: 6 }}>{service.name}</p>
                            <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>{service.service_for}</p>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Money paise={service.discounted_price ?? service.price} size={16} tone={selected ? 'accent' : 'default'} />
                            </div>
                          </div>
                          <div style={{ width: 24, height: 24, borderRadius: 999, border: selected ? '1px solid var(--violet)' : '1px solid var(--border)', background: selected ? 'var(--violet)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {selected && <Check size={14} color="#fff" />}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                  <button className="q-btn-primary" disabled={selectedServices.length === 0} onClick={() => setStep(1)} style={{ width: '100%', height: 54, borderRadius: 8, marginTop: 24, fontSize: 15 }}>
                    Continue to date <ArrowRight size={18} />
                  </button>
                </main>
                <aside className="bf-sidebar"><SummaryContent /></aside>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="date" className="bf-booking-grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }}>
                <main>
                  <SectionHeader eyebrow="Step 2" title="Pick a date" subtitle="Open dates are highlighted in green. Holidays and closed days are not selectable." />
                  <div className="bf-calendar-wrap">
                    <div className="bf-card" style={{ padding: 18, display: 'flex', justifyContent: 'center' }}>
                      <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date)
                          setSelectedStaffId(undefined)
                          setUseRandom(false)
                          setAvailData(null)
                          setAvailError(null)
                        }}
                        disabled={disabledMatcher}
                        modifiers={modifiers}
                        modifiersClassNames={{ open: 'bf-day-open', holiday: 'bf-day-holiday', closed: 'bf-day-closed' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14, color: 'var(--text-3)', fontSize: 12 }}>
                      <span><span style={{ color: 'var(--green)' }}>●</span> Open</span>
                      <span><span style={{ color: 'var(--red)' }}>●</span> Holiday</span>
                      <span><span style={{ color: 'var(--violet-light)' }}>○</span> Today</span>
                      <span><span style={{ color: 'var(--text-3)' }}>●</span> Closed</span>
                    </div>
                    <p style={{ textAlign: 'center', marginTop: 18, color: 'var(--text-2)', fontWeight: 800 }}>
                      Selected: {selectedDate ? formatDate(toApiDate(selectedDate), 'EEEE, dd MMM yyyy') : 'Choose a date'}
                    </p>
                  
                  </div>
                  <button className="q-btn-primary" disabled={!selectedDate} onClick={() => setStep(2)} style={{ width: '100%', height: 54, borderRadius: 8, marginTop: 24, fontSize: 15 }}>
                    Continue to staff <ArrowRight size={18} />
                  </button>
                </main>
                <aside className="bf-sidebar"><SummaryContent /></aside>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="staff" className="bf-booking-grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }}>
                <main>
                  <SectionHeader eyebrow="Step 3" title="Choose your staff" subtitle={`For ${selectedDate ? formatDate(toApiDate(selectedDate), 'EEEE, dd MMM yyyy') : 'your selected date'}.`} />
                  {staffFetching ? (
                    <div className="bf-staff-grid">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton rounded-xl" style={{ height: 220 }} />)}</div>
                  ) : (
                    <div className="bf-staff-grid">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        disabled={staff.length === 0 || availMutation.isPending}
                        onClick={() => { if (!staff.length) return; setUseRandom(true); setSelectedStaffId(undefined); setAvailError(null); setAvailData(null); availMutation.mutate() }}
                        className="bf-staff-card bf-card"
                        style={{ padding: 18, border: useRandom ? '1.5px solid var(--violet)' : '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: staff.length === 0 || availMutation.isPending ? 'wait' : 'pointer', color: 'inherit' }}
                      >
                        <div style={{ width: 62, height: 62, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(124,58,237,0.13)', color: 'var(--violet-light)', marginBottom: 14 }}><Sparkles size={28} /></div>
                        <p className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 18, marginBottom: 6 }}>Auto Assign</p>
                        <p style={{ color: 'var(--violet-light)', fontSize: 13, lineHeight: 1.35, minHeight: 36 }}>Best available staff</p>
                        <p style={{ color: 'var(--text-3)', fontSize: 12, lineHeight: 1.45, marginTop: 10, flex: 1 }}>Earliest match for all selected services.</p>
                        <div style={{ minHeight: 24, marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 12, fontWeight: 800 }}>
                          {availMutation.isPending && useRandom ? <><Loader2 className="animate-spin" size={15} /> Checking availability</> : <><Sparkles size={15} /> Select auto assign</>}
                        </div>
                      </motion.button>
                      {staff.map((member) => {
                        const selected = selectedStaffId === member.staff_id && !useRandom
                        return (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.985 }}
                            disabled={availMutation.isPending}
                            onClick={() => { setSelectedStaffId(member.staff_id); setUseRandom(false); setAvailError(null); setAvailData(null); availMutation.mutate() }}
                            key={member.staff_id}
                            className="bf-staff-card"
                            style={{ padding: 18, borderRadius: 8, textAlign: 'center', background: selected ? 'rgba(124,58,237,0.10)' : 'rgba(255,255,255,0.035)', border: selected ? '1.5px solid var(--violet)' : '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: availMutation.isPending ? 'wait' : 'pointer', color: 'inherit' }}
                          >
                            <StaffAvatar name={member.staff_name} src={member.avatar_url} size="xl" />
                            <p className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 17, margin: '14px 0 4px' }}>{member.staff_name}</p>
                            <p style={{ color: 'var(--violet-light)', fontSize: 13, lineHeight: 1.35, minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{member.specialization || 'Stylist'}</p>
                            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 12 }}>{member.experience_years ?? 0}+ yrs experience</p>
                            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-2)', fontSize: 12 }}>
                              <Star size={13} fill="#f59e0b" color="#f59e0b" />
                              {member.average_rating ? member.average_rating.toFixed(1) : 'New'}
                            </div>
                            <div style={{ minHeight: 24, marginTop: 'auto', paddingTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, color: selected ? 'var(--violet-light)' : 'var(--text-3)', fontSize: 12, fontWeight: 800 }}>
                              {availMutation.isPending && selected ? <><Loader2 className="animate-spin" size={15} /> Checking availability</> : selected ? <><Check size={15} /> Selected</> : 'Select staff'}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                  {availError && <div style={{ marginTop: 16 }}><Notice tone="warn">{availError.message}</Notice></div>}
                </main>
                <aside className="bf-sidebar"><SummaryContent /></aside>
              </motion.div>
            )}

            {step === 3 && availData && (
              <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }} style={{ maxWidth: 980 }}>
                <main>
                  <SectionHeader eyebrow="Step 4" title="Review and confirm" subtitle="This is the full booking summary. Check the details before we reserve your payment slot." />
                  <ReviewSummary />
                  <button className="q-btn-primary" disabled={bookMutation.isPending || !reservationToken} onClick={() => bookMutation.mutate()} style={{ width: '100%', height: 56, borderRadius: 8, marginTop: 22, fontSize: 15 }}>
                    {bookMutation.isPending ? <><Loader2 className="animate-spin" size={18} /> Reserving slot</> : <>Proceed to payment <ArrowRight size={18} /></>}
                  </button>
                </main>
              </motion.div>
            )}

            {step === 4 && bookingResult && (
              <motion.div key="payment" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }}>
                <SectionHeader eyebrow="Payment" title="Complete your payment" subtitle="Your appointment is reserved for a limited time. Pay securely to confirm it." />
                <div className="bf-payment-grid">
                  <div className="bf-card" style={{ padding: 22 }}>
                    <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20, marginBottom: 14 }}>Booking Summary</h3>
                    <SummaryContent full />
                    <div style={{ marginTop: 14 }}><Notice tone="warn">Payment confirms the final queue position and arrival window. If payment is not completed in time, the slot is released.</Notice></div>
                  </div>
                  <div className="bf-card" style={{ padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--green)', marginBottom: 18, fontWeight: 800 }}><ShieldCheck size={18} /> Secure payment</div>
                    {paymentFailed && <div style={{ marginBottom: 14 }}><Notice tone="warn">{paymentFailedMsg}</Notice></div>}
                    <div className="bf-soft" style={{ padding: 16, marginBottom: 16 }}>
                      <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 4 }}>Total payable</p>
                      <Money paise={paymentAmount} size={40} />
                    </div>
                    <div className="bf-soft" style={{ padding: 16, marginBottom: 18 }}>
                      <p style={{ color: 'var(--text-1)', fontWeight: 900, marginBottom: 6 }}>Razorpay checkout</p>
                      <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.55 }}>
                        Select UPI, cards, net banking, wallets, or other enabled methods inside Razorpay's secure payment window.
                      </p>
                    </div>
                    <button className="q-btn-primary" disabled={paymentLoading || paymentExpired} onClick={handlePay} style={{ width: '100%', height: 56, borderRadius: 8, fontSize: 16 }}>
                      {paymentLoading ? <><Loader2 className="animate-spin" size={19} /> {orderCreating ? 'Opening payment' : 'Processing'}</> : <>Pay <Money paise={paymentAmount} size={17} /> <ArrowRight size={18} /></>}
                    </button>
                    <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, marginTop: 14 }}>Secured by Razorpay. Cancellation policy applies after confirmation.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="done" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} style={{ maxWidth: 980, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', margin: '4px auto 28px' }}>
                  <div style={{ width: 58, height: 58, borderRadius: 999, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'var(--green-bg)', border: '2px solid var(--green-border)' }}>
                    <CheckCircle2 size={34} style={{ color: 'var(--green)' }} />
                  </div>
                  <h1 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 'clamp(26px, 4vw, 42px)', lineHeight: 1 }}>Appointment Confirmed</h1>
                  <p style={{ color: 'var(--text-2)', fontSize: 15, marginTop: 8 }}>Your QR code is ready for check-in at {confirmedBusinessName}.</p>
                </div>

                <div className="bf-confirmed-grid">
                  <main style={{ display: 'grid', gap: 16 }}>
                    <div className="bf-card" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap', textAlign: 'center' }}>
                      <QrImage url={qrUrl ?? confirmedBooking?.qr_image_url} />
                      <div style={{ maxWidth: 420 }}>
                        <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 24, marginBottom: 8 }}>Scan this at the salon</h3>
                        <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>Show this QR code when you arrive. Staff will scan it to check you in and start your queue flow.</p>
                      </div>
                    </div>

                    <div className="bf-card" style={{ padding: 22 }}>
                      <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20, marginBottom: 10 }}>Appointment Information</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <StaffAvatar name={confirmedStaffName} src={confirmedStaffAvatar} size="xl" />
                        <div>
                          <p style={{ color: 'var(--text-1)', fontWeight: 900 }}>{confirmedStaffName}</p>
                          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Staff</p>
                        </div>
                      </div>
                      <Row label="Date" value={formatDate(confirmedBooking?.service_date ?? availData?.service_date ?? '', 'EEEE, dd MMM yyyy')} strong />
                      <Row label="Time" value={confirmedStart ? formatTime(confirmedStart) : 'Confirmed'} strong />
                      {confirmedArrivalStart && confirmedStart && <Row label="Arrival Window" value={`${formatTime(confirmedArrivalStart)} - ${formatTime(confirmedStart)}`} />}
                      <Row label="Estimated Duration" value={`${confirmedDuration} min`} />
                    </div>

                    <div className="bf-card" style={{ padding: 22 }}>
                      <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20, marginBottom: 10 }}>Business Information</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <BusinessVisual src={confirmedBusinessLogo} name={confirmedBusinessName} />
                        <div>
                          <p style={{ color: 'var(--text-1)', fontWeight: 900 }}>{confirmedBusinessName}</p>
                          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{confirmedBooking?.business.city ?? biz.city}</p>
                        </div>
                      </div>
                      <Row label="Address" value={confirmedBusinessAddress} />
                      {confirmedBusinessPhone && <Row label="Phone" value={confirmedBusinessPhone} />}
                    </div>

                    <div className="bf-card" style={{ padding: 22 }}>
                      <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20, marginBottom: 12 }}>Services</h3>
                      {confirmedServices.map((service) => (
                        <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <ServiceImage src={service.image_url} name={service.name} size={42} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: 'var(--text-1)', fontWeight: 800 }}>{service.name}</p>
                            {service.category && <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{service.category}</p>}
                          </div>
                          <Money paise={service.price} size={14} />
                        </div>
                      ))}
                    </div>

                    <div className="bf-card" style={{ padding: 22 }}>
                      <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20, marginBottom: 10 }}>Payment Details</h3>
                      <Row label="Status" value={confirmedPayment?.status ?? 'Paid'} strong />
                      <Row label="Amount Paid" value={<Money paise={confirmedBooking?.service_amount ?? paymentAmount} size={14} />} />
                      {confirmedPaidAt && <Row label="Paid At" value={confirmedPaidAt} />}
                      {confirmedPayment?.razorpay_payment_id && <Row label="Razorpay Payment" value={confirmedPayment.razorpay_payment_id} />}
                      {confirmedPayment?.refund_status && <Row label="Refund Status" value={confirmedPayment.refund_status} />}
                    </div>

                    <div className="bf-card" style={{ padding: 22 }}>
                      <h3 className="font-syne font-black" style={{ color: 'var(--text-1)', fontSize: 20, marginBottom: 10 }}>Cancellation</h3>
                      {confirmedCancellationUntil ? (
                        <Row label="Free Cancellation Until" value={confirmedCancellationUntil} strong={confirmedBooking?.is_cancellable} />
                      ) : (
                        <Row label="Free Cancellation Window" value={`${biz.cancellation_window_hours} hours before appointment`} />
                      )}
                      <p style={{ color: confirmedBooking?.is_cancellable === false ? 'var(--text-3)' : 'var(--green)', fontSize: 13, marginTop: 8 }}>
                        {confirmedBooking?.is_cancellable === false ? 'The free cancellation window is closed.' : 'You can manage cancellation from My Bookings.'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      <button className="q-btn-primary" onClick={() => navigate('/customer/bookings?tab=upcoming')} style={{ width: '100%', height: 54, borderRadius: 8, fontSize: 15 }}><BookOpen size={18} /> My Bookings</button>
                      <button onClick={() => navigate('/customer/explore')} style={{ width: '100%', height: 54, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontWeight: 800 }}>Explore Businesses</button>
                    </div>
                  </main>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <MobileSummary />
      </div>
    </>
  )
}

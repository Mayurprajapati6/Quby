/**
 * CustomerDashboard.tsx
 * - Uses CustomerDashboardRepository.getBookingStats() for LIVE accurate counts
 * - total = all terminal bookings (completed + cancelled + no_show + running + upcoming)
 * - completed = COMPLETED only
 * - cancelled = CANCELLED only (NOT including NO_SHOW)
 * - no_show = NO_SHOW only
 * - Separate charts: Monthly Spend (Area) | Booking Breakdown (Pie)
 * - Responsive: mobile / tablet / desktop
 * - Real-time socket updates for all booking events
 */

import { memo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Calendar as CalendarIcon, Clock, MapPin, QrCode, ArrowRight, BookOpen,
  Star, TrendingUp, Zap, CheckCircle, XCircle, AlertTriangle,
  IndianRupee, Heart, Scissors, ChevronRight, Bell,
  Building2, X,
} from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore } from '@/stores'
import { useSocketEvent, usePageTitle } from '@/hooks'
import { toast } from 'sonner'
import api from '@/lib/axios'
import { formatDate, formatTime, formatSmartDate, formatINR, formatINRDirect } from '@/lib/utils'
import type { CustomerDashboardDTO } from '@/types'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// ─── Tooltips ─────────────────────────────────────────────────────
function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="q-card" style={{ padding: '9px 13px', minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Syne', fontWeight: 700, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 800, color: 'var(--violet-light)' }}>
        ₹{payload[0]?.value?.toLocaleString('en-IN') ?? 0}
      </p>
      {payload[1] && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{payload[1].value} bookings</p>}
    </div>
  )
}

/* ─── Summary Card ──────────────────────────────────────────── */
const SummaryCard = memo(function SummaryCard({
  label, value, sub, icon, color, delay = 0,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 280, damping: 22 }}
      className="q-card"
      style={{ padding: '14px 14px 12px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, width: 70, height: 70, borderRadius: '50%', background: color, opacity: 0.1, filter: 'blur(20px)', transform: 'translate(30%,-30%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}20`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
        <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', lineHeight: 1.3 }}>{label}</p>
      </div>
      <p className="font-syne font-black" style={{ fontSize: 20, color: 'var(--text-1)', lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{sub}</p>}
    </motion.div>
  )
})

function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="q-card" style={{ padding: '8px 12px' }}>
      <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 800, color: 'var(--text-1)' }}>{payload[0].value}</p>
    </div>
  )
}

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color
    }} />
    {label}
  </div>
)


// ─── Stat Card ────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; onClick?: () => void
}) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="q-card" style={{ padding: '14px 16px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)' }}>{label}</p>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      </div>
      <p className="font-syne font-black" style={{ fontSize: 24, color: 'var(--text-1)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{sub}</p>}
    </motion.div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────
function DashSkeleton() {
  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      <div className="skeleton rounded-2xl" style={{ height: 80, marginBottom: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton rounded-2xl" style={{ height: 96 }} />)}
      </div>
      <div className="skeleton rounded-2xl" style={{ height: 200, marginBottom: 16 }} />
      <div className="skeleton rounded-2xl" style={{ height: 200 }} />
    </div>
  )
}

type CalendarEvent = {
  booking_id: string
  booking_number: string
  service_date: string
  service_start_time: string

  business_name: string
  business_logo: string | null
  business_city: string
  business_state: string

  staff_name: string
  staff_avatar: string | null

  services: string[]
  amount: number
  payment_status: string

  status: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'REFUNDED'
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6
  }}>
    <span style={{
      fontSize: 11,
      color: 'var(--text-3)'
    }}>
      {label}
    </span>

    <span style={{
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-1)',
      textAlign: 'right'
    }}>
      {value}
    </span>
  </div>
)



// ─── Main ─────────────────────────────────────────────────────────
export default function CustomerDashboard() {
  usePageTitle('Dashboard')
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc       = useQueryClient()

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [selectedBooking, setSelectedBooking] = useState<CalendarEvent[] | null>(null)

  // ── Dashboard data ──────────────────────────────────────────────
  const { data, isLoading } = useQuery<CustomerDashboardDTO>({
    queryKey: ['customer-dashboard', month, year],
    queryFn: async () => {
      console.log("📡 API CALL 👉", { month, year }) // ✅ ADD THIS
      const res = await api.get('/customer/dashboard', { params: { month, year } })
      return res.data.data
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  // Stats come directly from data.stats (backend computes live from DB each request)

  // ── Socket updates ──────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['customer-dashboard'], exact: false, refetchType: 'active' })
    qc.invalidateQueries({ queryKey: ['customer-bookings'] })
    qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
  }
  useSocketEvent('booking:confirmed',  () => invalidate())
  useSocketEvent('payment:confirmed',  () => invalidate())
  useSocketEvent('service:completed',  () => { invalidate(); toast.success('Service complete! Leave a review ⭐') })
  useSocketEvent('booking:cancelled',  () => invalidate())
  useSocketEvent('service:checked_in', () => { invalidate(); toast.info('You\'ve been checked in! Service is starting.') })
  useSocketEvent('service:delayed',    (d: any) => { invalidate(); if (d?.delayMinutes) toast.info(`⏳ Appointment shifted by ${d.delayMinutes} min.`) })
  useSocketEvent('booking:no_show',    () => { invalidate(); toast.error('Marked as no-show. Payment retained.') })
  useSocketEvent('booking:reminder',   (d: any) => toast.info(`⏰ Reminder: Appointment in ${d?.type === 'reminder-1hr' ? '1 hour' : '15 minutes'}!`))

    const violet = '#a78bfa'; const blue = '#60a5fa'; const green = '#34d399'
  const red = '#ef4444';    const yellow = '#f59e0b'; const pink = '#f472b6'

  const accent = '#a78bfa'
  // const green  = '#34d399'
  // const red    = '#ef4444'
  // const yellow = '#f59e0b'
  const grid   = '#2a2b45'

  if (isLoading) return <DashSkeleton />
  if (!data) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--text-3)' }}>Could not load dashboard. Please refresh.</p>
    </div>
  )

  const d   = data
  console.log("🔥 FULL CALENDAR DATA 👉", d.calendar_events)
  const eventsByDate: Record<string, CalendarEvent[]> =
  d.calendar_events.reduce((acc, e) => {

  console.log("➡️ EVENT:", e.service_date, e.status)

  const rawStatus = e.status as string

  let safeStatus: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'REFUNDED' | null = null

  const today = new Date()
  today.setHours(0,0,0,0)

  const serviceDate = new Date(e.service_date)
  serviceDate.setHours(0,0,0,0)

  if (rawStatus === 'COMPLETED') safeStatus = 'COMPLETED'
  else if (rawStatus === 'NO_SHOW') safeStatus = 'NO_SHOW'
  else if (rawStatus === 'REFUNDED') safeStatus = 'REFUNDED'

  else if (rawStatus === 'CONFIRMED') {
    if (serviceDate >= today) {
      safeStatus = 'CONFIRMED'
    } else {
      safeStatus = null
    }
  }

  if (!safeStatus) return acc

  const key = e.service_date.split('T')[0]

  const event: CalendarEvent = {
    ...e,
    status: safeStatus,
  }

  if (!acc[key]) acc[key] = []
  acc[key].push(event)

  return acc
}, {} as Record<string, CalendarEvent[]>)
  const StaffTick = (props: any) => {
  const { x, y, payload } = props

  const staff = d.analytics.staff_frequency.find(
    (s) => s.name === payload.value
  )

  // Truncate long names
  const displayName = payload.value.length > 10 ? payload.value.slice(0, 10) + '...' : payload.value

  return (
    <g transform={`translate(${x},${y + 15})`}>
      <foreignObject x={-30} y={0} width={60} height={50}>
        <div style={{ textAlign: 'center' }}>
          <img
            src={staff?.avatar ?? '/placeholder.png'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: 4,
              border: '1px solid var(--border)'
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--text-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 60
            }}
          >
            {displayName}
          </div>
        </div>
      </foreignObject>
    </g>
  )
}
  console.log("SERVICE USAGE 👉", d.analytics.service_usage)
console.log("STAFF FREQUENCY 👉", d.analytics.staff_frequency)
console.log("BUSINESS 👉", d.analytics.business_frequency)
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Use dashboard stats directly — backend computes live counts per request
  const totalBookings    = d.stats.total_bookings ?? 0
  const completedCount   = d.stats.completed_bookings ?? 0
  const noShowCount      = d.stats.no_show_bookings ?? 0
  const upcomingCount = d.stats.upcoming_bookings ?? 0

  const completionRate = totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0

  const chartData = d.monthly_spend.map(m => ({
    name: m.label.split(' ')[0], // Just month name
    amount: m.amount_inr,
    bookings: m.bookings,
  }))

  // Pie breakdown (only show non-zero)
  const pieData = [
  { name: 'Completed', value: completedCount, fill: green },
  { name: 'No-show', value: noShowCount, fill: yellow },
  { name: 'Upcoming', value: upcomingCount, fill: accent },
  { name: 'Refunded', value: d.stats.refunded_bookings, fill: '#f97316' },
]

  return (
    <div className="min-h-screen pb-16 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-3 py-5 sm:px-4 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>


      {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="font-syne font-black" style={{ fontSize: 22, color: 'var(--text-1)', marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Overview of all your businesses</p>
        </div>


        {/* ── Row 1: Summary cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
          <SummaryCard label="Total Bookings"  value={totalBookings}                          icon={<BookOpen size={14} />}    color={blue}   delay={0.04} />
          <SummaryCard label="Total Spent"   value={formatINRDirect(d.stats.total_spent_inr)}    icon={<IndianRupee size={14} />} color={violet} delay={0}    />
          <SummaryCard label="Total Refunded"           value={formatINRDirect(d.stats.refunded_inr)}                                   icon={<XCircle size={14} />}       color={red}    delay={0.16} />
        </div>

        {/* ── Row 2: Secondary cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 16 }}>
          <SummaryCard label="Completed Bookings"       value={completedCount}                    sub=""             icon={<CheckCircle size={14} />} color={green}  delay={0.08} />
          <SummaryCard label="Upcoming Bookings"        value={upcomingCount}                     sub=""             icon={<CalendarIcon size={14} />}    color={violet} delay={0.12} />
          <SummaryCard label="Refunded Bookings"           value={d.stats.refunded_bookings}                          sub=""                                 icon={<XCircle size={14} />}       color={red}    delay={0.16} />
          <SummaryCard label="No Show Bookings"   value={noShowCount}     icon={<AlertTriangle size={14} />} color={yellow} delay={0.2}  />
        </div>

        

      {/* ── Monthly Spend Chart ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
        className="q-card" style={{ marginBottom: 16, padding: '18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)', marginBottom: 2 }}>Monthly Spend</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>₹ spent per month (completed services)</p>
          </div>
          <select value={year} onChange={e => setYear(+e.target.value)} className="q-input"
            style={{ width: 80, height: 32, fontSize: 12, padding: '0 8px' }}>
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        {chartData.some(c => c.amount > 0) ? (
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="spendG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.38} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
              <Tooltip content={<SpendTooltip />} cursor={false} />
              <Area type="monotone" dataKey="amount" stroke={accent} strokeWidth={2.5}
                fill="url(#spendG)" dot={false}
                activeDot={{ r: 5, fill: accent, stroke: 'var(--bg-card)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 175, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <TrendingUp size={28} style={{ color: 'var(--text-4)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No spend data for {year}</p>
          </div>
        )}
      </motion.div>

      {/* ══ ROW 3 — CALENDAR | SALON BOOKED MOST ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ marginBottom: 16 }}>

        {/* Calendar (50%) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="q-card lg:col-span-2"
          style={{ padding: 16 }}
        >
  <p className="font-syne font-black" style={{ fontSize: 18, marginBottom: 12 }}>
    Booking Calendar
  </p>

    {/* HEADER */}
  <div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 14
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    
    <button
  onClick={() => {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else setMonth(m => m - 1)
  }}
  className="q-btn"
  style={{
  width: 32,
  height: 32,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  color: 'var(--text-1)',
  transition: 'all 0.2s'
}}
onMouseEnter={(e) => {
  e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
}}
onMouseLeave={(e) => {
  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
  e.currentTarget.style.borderColor = 'var(--border)'
}}
>
  ‹
</button>

    <p style={{
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '.02em',
  minWidth: 100,
  textAlign: 'center',
  color: 'var(--text-1)'
}}>
      {new Date(year, month - 1).toLocaleString('default', {
        month: 'long',
        year: 'numeric'
      })}
    </p>

    <button
  onClick={() => {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else setMonth(m => m + 1)
  }}
  className="q-btn"
  style={{
  width: 32,
  height: 32,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  color: 'var(--text-1)',
  transition: 'all 0.2s'
}}
onMouseEnter={(e) => {
  e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
}}
onMouseLeave={(e) => {
  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
  e.currentTarget.style.borderColor = 'var(--border)'
}}
>
  ›
</button>

  </div>

  <button
    className="q-btn"
    onClick={() => {
      const now = new Date()
      setMonth(now.getMonth() + 1)
      setYear(now.getFullYear())
    }}
    style={{
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(139,92,246,0.12)',
    border: '1px solid rgba(139,92,246,0.25)',
    color: '#a78bfa',
    transition: 'all 0.2s'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = 'rgba(139,92,246,0.2)'
    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'
  }}
  >
    Today
  </button>
  </div>

  <div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(7,1fr)',
  marginBottom: 8,
  fontSize: 11,
  color: 'var(--text-3)'
}}>
  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
    <div key={d} style={{ textAlign: 'center' }}>{d}</div>
  ))}
</div>

{/* CALENDAR GRID LOGIC */}
{(() => {
  const firstDay = new Date(year, month - 1, 1)
  const startDay = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells: (number | null)[] = []

  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7,1fr)',
        gap: 4
      }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />

          const key = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const events = eventsByDate[key]
          console.log("🧠 CHECK:", key, eventsByDate[key])
          
          const hasConfirmed = events?.some(e => e.status === 'CONFIRMED')
const hasNoShow    = events?.some(e => e.status === 'NO_SHOW')
const hasCompleted = events?.some(e => e.status === 'COMPLETED')
const hasRefunded  = events?.some(e => e.status === 'REFUNDED')

          let color = null

          if (hasNoShow) color = '#f59e0b'
else if (hasCompleted) color = '#3b82f6'
else if (hasRefunded) color = '#34d399'
else if (hasConfirmed) color = '#a78bfa'

          const isToday = formatLocalDate(new Date()) === key

          return (
            <div
              key={i}
              onClick={() => events && setSelectedBooking(events)}
              style={{
                height: 56,
                borderRadius: 10,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: events ? 'pointer' : 'default',
                transition: 'all 0.2s',
                background: isToday
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(99,102,241,0.9))'
                  : events
                  ? 'rgba(139,92,246,0.08)'
                  : 'rgba(255,255,255,0.02)',
                color: isToday ? '#fff' : 'var(--text-1)',
                border: isToday
                  ? '1px solid rgba(139,92,246,0.5)'
                  : events
                  ? '1px solid rgba(139,92,246,0.2)'
                  : '1px solid var(--border)',
                boxShadow: isToday
                  ? '0 0 0 2px rgba(139,92,246,0.3), 0 4px 12px rgba(139,92,246,0.15)'
                  : events
                  ? '0 0 0 1px rgba(139,92,246,0.1)'
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isToday && events) {
                  e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
                  e.currentTarget.style.border = '1px solid rgba(139,92,246,0.35)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isToday) {
                  e.currentTarget.style.background = events ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)'
                  e.currentTarget.style.border = events ? '1px solid rgba(139,92,246,0.2)' : '1px solid var(--border)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = events ? '0 0 0 1px rgba(139,92,246,0.1)' : 'none'
                }
              }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500 }}>{day}</div>

              {color && (
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  alignSelf: 'center',
                  marginTop: 'auto',
                  boxShadow: `0 0 8px ${color}40`
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* LEGEND */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 14,
        fontSize: 11,
        color: 'var(--text-3)',
        flexWrap: 'wrap'
      }}>
        <LegendDot color="#a78bfa" label="Upcoming" />
        <LegendDot color="#60a5fa" label="Completed" />
        <LegendDot color="#f59e0b" label="No-show" />
        <LegendDot color="#34d399" label="Refunded" />
      </div>
    </>
  )
})()}

</motion.div>

        {/* Salon Booked Most (50%) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="q-card lg:col-span-3"
          style={{ padding: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="font-syne font-black" style={{ fontSize: 18 }}>
              Salons You Booked Most
            </p>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {d.analytics.business_frequency.map((b, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 8px',
                  borderBottom: i < d.analytics.business_frequency.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                    border: i === 0 ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: i === 0 ? '#fbbf24' : 'var(--text-3)'
                  }}>
                    {i + 1}
                  </div>

                  <img
                    src={b.logo ?? '/placeholder.png'}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      objectFit: 'cover',
                      border: '1px solid var(--border)'
                    }}
                  />

                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{b.name}</p>
                  </div>
                </div>

                <div style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#a78bfa'
                }}>
                  {b.count} bookings
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* ══ ROW 4 — STAFF FREQUENCY | SERVICES TABLE ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ marginBottom: 16 }}>

        {/* Staff Booking Frequency (60%) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="q-card lg:col-span-3"
          style={{ padding: 16 }}
        >
          <p className="font-syne font-black" style={{ fontSize: 18, marginBottom: 12 }}>
            Staff Booking Frequency
          </p>

  <div style={{ overflow: 'visible' }}>
    <ResponsiveContainer width="100%" height={320}>
    <BarChart
  data={d.analytics.staff_frequency}
  margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
>
  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
  
  <XAxis
    dataKey="name"
    tick={<StaffTick />}
    interval={0}
    minTickGap={20}
  />

  <YAxis />
  <Tooltip
    cursor={{
      fill: 'transparent'
    }}
    contentStyle={{
      background: 'rgba(30,30,50,0.95)',
      border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: 8,
      color: 'var(--text-1)',
      fontSize: 12
    }}
  />

  <Bar
    dataKey="count"
    fill={accent}
    radius={[8, 8, 0, 0]}
  />
</BarChart>
  </ResponsiveContainer>
</div>
        </motion.div>

        {/* Services You Use Most (40%) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="q-card lg:col-span-2"
          style={{ padding: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="font-syne font-black" style={{ fontSize: 18 }}>
              Services You Use Most
            </p>
          </div>

          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px', padding: '8px 4px', marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-2)' }}>No.</span>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-2)' }}>Service</span>
            <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-2)' }}>Total Bookings</span>
          </div>

          {/* Table Rows */}
          <div className="space-y-2">
            {d.analytics.service_usage.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 100px',
                  alignItems: 'center',
                  padding: '8px 4px',
                  borderBottom: i < d.analytics.service_usage.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{i + 1}</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={s.image ?? '/placeholder.png'}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      objectFit: 'cover',
                      border: '1px solid var(--border)'
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{s.name}</span>
                </div>

                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', textAlign: 'center' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* ══ ROW 5 — BOOKING BREAKDOWN | PENDING REVIEWS ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ marginBottom: 16 }}>

        {/* Booking Breakdown (60%) */}
        {totalBookings > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .13 }}
            className="q-card lg:col-span-3" style={{ padding: '18px 16px' }}>
            <p className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)', marginBottom: 2 }}>Booking Breakdown</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 16 }}>Distribution of all your bookings</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 200 }}>
                {pieData.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.fill, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{p.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <span className="font-syne font-bold" style={{ fontSize: 14, color: 'var(--text-1)', width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-3)', width: 50, textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>({Math.round((p.value/totalBookings)*100)}%)</span>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Total</span>
                  <span className="font-syne font-black" style={{ fontSize: 14, color: 'var(--text-1)', width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totalBookings}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pending Reviews (40%) */}
        {d.pending_reviews.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
            className="q-card lg:col-span-2" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={16} style={{ color: '#f59e0b' }} />
              <p className="font-syne font-bold" style={{ fontSize: 18, color: 'var(--text-1)' }}>Pending Reviews ({d.pending_reviews.length})</p>
            </div>
            <button onClick={() => navigate('/customer/reviews')}
              style={{ fontSize: 11, color: 'var(--violet-light)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              Write reviews <ArrowRight size={11} />
            </button>
          </div>
          {d.pending_reviews.slice(0, 3).map(pr => (
            <div key={pr.booking_id} onClick={() => navigate('/customer/reviews')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '12px',
                marginBottom: 8,
                borderRadius: 10,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: 'rgba(255,255,255,0.02)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139,92,246,0.08)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Star size={18} style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-syne font-bold" style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>{pr.business_name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{pr.services?.length ? pr.services.join(', ') : 'Service'} · {formatSmartDate(pr.service_date)}</p>
              </div>
              <button
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(139,92,246,0.9)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139,92,246,1)'
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139,92,246,0.9)'
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Write Review
              </button>
            </div>
          ))}
        </motion.div>
        )}

      </div>

      <AnimatePresence>
  {selectedBooking && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={() => setSelectedBooking(null)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: 24,
          width: 'min(500px, 92vw)',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(30,30,50,0.95), rgba(15,15,35,0.98))',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
          backdropFilter: 'blur(20px)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="font-syne font-black" style={{ fontSize: 20, color: 'var(--text-1)' }}>
            Bookings
          </p>
          <button
            onClick={() => setSelectedBooking(null)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text-3)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-3)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {selectedBooking.map((b) => {
  const statusConfig = {
    CONFIRMED: {
  color: '#a78bfa',
  bg: 'rgba(167,139,250,0.1)',
  text: 'Upcoming',
  glow: 'rgba(167,139,250,0.4)'
},
    COMPLETED: {
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.1)',
      text: 'Completed',
      glow: 'rgba(96,165,250,0.4)'
    },
    NO_SHOW: {
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      text: 'No-show',
      glow: 'rgba(245,158,11,0.4)'
    },
    REFUNDED: {
  color: '#34d399',
  bg: 'rgba(52,211,153,0.1)',
  text: 'Refunded',
  glow: 'rgba(52,211,153,0.4)'
},
  }

  const s = statusConfig[b.status]

  return (
    <motion.div
      key={b.booking_id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 16,
        borderRadius: 16,
        marginBottom: 14,
        background: `linear-gradient(135deg, rgba(30,30,50,0.9), rgba(20,20,40,0.95))`,
        border: `1px solid ${s.glow}`,
        boxShadow: `0 10px 30px ${s.glow}22`,
        backdropFilter: 'blur(12px)'
      }}
    >

      {/* STATUS BADGE */}
      <div style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        marginBottom: 10
      }}>
        {s.text}
      </div>

      {/* HEADER */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <img
          src={b.business_logo ?? '/placeholder.png'}
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            objectFit: 'cover'
          }}
        />

        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>
            {b.business_name}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {b.business_city}, {b.business_state}
          </p>
        </div>
      </div>

      {/* DETAILS GRID */}
      <div style={{ marginTop: 8 }}>

  <Row
    label="Services"
    value={b.services.join(', ') || 'Service'}
  />

  <Row
    label="Staff"
    value={
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <img
          src={b.staff_avatar ?? `https://api.dicebear.com/8.x/adventurer/svg?seed=${b.staff_name}`}
          style={{ width: 18, height: 18, borderRadius: '50%' }}
        />
        {b.staff_name}
      </span>
    }
  />

  <Row
    label="Date & Time"
    value={
  `${new Date(b.service_date)
    .toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    .replace(/^(\d+)/, '$1,')} · ${new Date(b.service_start_time).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`
}
  />

  <Row label="Booking ID" value={`#${b.booking_number}`} />

  <Row
    label="Amount"
    value={`₹${Math.round(b.amount)}`}
  />

  <Row
  label="Payment Status"
  value={
    b.status === 'REFUNDED'
  ? 'Refunded'
  : b.status === 'COMPLETED'
  ? 'Paid'
  : b.status === 'NO_SHOW'
  ? 'Paid (No-show)'
  : b.status === 'CONFIRMED'
  ? 'Paid'
  : 'Cancelled'
  }
/>

</div>

      {/* BOTTOM STATUS BOX */}
      <div style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 600
      }}>
        {b.status === 'CONFIRMED' && 'We look forward to seeing you.'}
        {b.status === 'COMPLETED' && 'Completed successfully. Hope you loved the service ✨'}
        {b.status === 'NO_SHOW' && 'You missed this appointment.'}
        {b.status === 'REFUNDED' && 'Amount has been refunded successfully.'}
      </div>

    </motion.div>
  )
})}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
      </div>
    </div>
  )
}

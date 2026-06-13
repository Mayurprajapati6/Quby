import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area,
} from 'recharts'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import {
  IndianRupee, CheckCircle, Calendar, XCircle, Users, BookOpen,
  ArrowRight, Info, TrendingUp, TrendingDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'year'

interface DashData {
  period: string
  staff: {
    id: string; name: string; avatar_url: string | null
    specialization: string | null; experience_years: number | null
    average_rating: number; total_reviews: number; business_name: string
  }
  today: { date: string; total: number; completed: number; running: number; upcoming: number }
  summary: { period_bookings: number; completed: number; refunded: number; no_show: number; revenue_inr: number }
  service_wise_stats: Array<{
  name: string
  count: number
  revenue: number
  image?: string | null
}>
  day_wise_bookings: Array<{ date: string; count: number }>
  month_performance: {
    on_time_count: number; delayed_count: number
    on_time_percentage: number; avg_delay_minutes: number; average_efficiency: number
  }
  monthly_revenue: Array<{ month: string; year: number; revenue_inr: number; count: number }>
  top_services: Array<{
  name: string
  count: number
  revenue_inr: number
  image?: string | null
}>
  pending: { leave_requests: number; unread_notifications: number }
  day_wise_revenue: Array<{ date: string; revenue: number }>
  day_range: {
  start: string
  end: string
}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n?: number | null) {
  return (n ?? 0).toLocaleString("en-IN");
}

function formatRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)

  const startDay = s.getDate()
  const endDay = e.getDate()

  const month = s.toLocaleString('en-IN', { month: 'short' })

  return `${startDay}–${endDay} ${month}`
}

const SVC_COLORS = ['#a78bfa', '#f472b6', '#60a5fa', '#fbbf24', '#34d399']
const YEAR_OPTIONS = [2022, 2023, 2024, 2025, 2026]
const PERIOD_OPTS: Array<{ label: string; value: Period }> = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
]
const YEAR_OPTS = YEAR_OPTIONS.map(y => ({ label: String(y), value: y }))

// Analytics grid layout - shared across all service analytics tables
const ANALYTICS_GRID = 'minmax(0, 1fr) 110px 80px'

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ─── Dropdown ────────────────────────────────────────────────────────────────

function YearPill({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const years = [2023, 2024, 2025, 2026]
  return (
    <select
      value={year}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        padding: '4px 8px', borderRadius: 7, fontSize: 11,
        fontFamily: 'Syne', fontWeight: 700,
        background: 'var(--bg-surface)', color: 'var(--text-2)',
        border: '1px solid var(--border)', cursor: 'pointer',
        maxWidth: 80,
      }}
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

// ─── Section Title ────────────────────────────────────────────────────────────

function SectionHeader({ num, title, right }: { num: number; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(139,92,246,.2)', border: '1px solid rgba(139,92,246,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'Syne', fontWeight: 800, color: '#a78bfa', flexShrink: 0 }}>{num}</span>
        <p className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)' }}>{title}</p>
        <Info size={12} style={{ color: 'var(--text-3)', opacity: .6 }} />
      </div>
      {right}
    </div>
  )
}

// ─── GCard ────────────────────────────────────────────────────────────────────

function GCard({ children, className = '', accent = '#a78bfa' }: {
  children: React.ReactNode; className?: string; accent?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(167,139,250,0.12)',
        boxShadow: '0 2px 28px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(255,255,255,0.03) inset',
      }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top right, ${accent}12, transparent 60%)` }} />
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)` }} />
      <div className="relative z-10 flex flex-col h-full">{children}</div>
    </div>
  )
}

// ─── Shimmer ─────────────────────────────────────────────────────────────────

function Shimmer({ h, className = '' }: { h: number; className?: string }) {
  return <div className={`skeleton rounded-2xl w-full ${className}`} style={{ height: h }} />
}

// ─── KPI Sparkline ────────────────────────────────────────────────────────────

function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100
    const y = 28 - (v / max) * 24
    return `${x},${y}`
  }).join(' ')
  const uid = `sp_${color.replace('#', '')}`
  return (
    <svg viewBox="0 0 100 32" className="w-full" style={{ height: 36 }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,32 ${pts} 100,32`} fill={`url(#${uid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, delay = 0 }: {
  label: string; value: string; icon: React.ReactNode; color: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 280, damping: 22 }}
      className="q-card"
      style={{ padding: '14px 14px 12px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 120 }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, width: 70, height: 70, borderRadius: '50%', background: color, opacity: 0.1, filter: 'blur(20px)', transform: 'translate(30%,-30%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}20`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
        <p style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', lineHeight: 1.3 }}>{label}</p>
      </div>
      <p className="font-syne font-black" style={{ fontSize: 32, color: 'var(--text-1)', lineHeight: 1.1 }}>{value}</p>
    </motion.div>
  )
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-[11px] shadow-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--violet-border)' }}>
      <p className="font-syne font-bold mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.stroke ?? 'var(--text-1)' }}>
          {p.name}: {fmt ? fmt(p.value, p.name) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Empty Chart Message ──────────────────────────────────────────────────────

function EmptyChart({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 py-4">
      <span className="text-3xl">{icon}</span>
      <p className="text-[12px] text-center font-medium" style={{ color: 'var(--text-4)' }}>{message}</p>
    </div>
  )
}

// ─── Highest/Lowest badge row ─────────────────────────────────────────────────

function HighLowRow({ high, low, fmtVal }: {
  high: { label: string; val: number } | null
  low: { label: string; val: number } | null
  fmtVal: (v: number) => string
}) {
  if (!high && !low) return null
  return (
    <div className="flex items-center gap-4 mt-2">
      {high && (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.15)' }}>
            <TrendingUp size={11} color="#34d399" />
          </div>
          <div>
            <p className="text-[9px]" style={{ color: 'var(--text-4)' }}>Highest Day</p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-1)' }}>{high.label} &nbsp;
              <span style={{ color: '#34d399' }}>{fmtVal(high.val)}</span>
            </p>
          </div>
        </div>
      )}
      {low && (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(248,113,113,0.15)' }}>
            <TrendingDown size={11} color="#f87171" />
          </div>
          <div>
            <p className="text-[9px]" style={{ color: 'var(--text-4)' }}>Lowest Day</p>
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-1)' }}>{low.label} &nbsp;
              <span style={{ color: '#f87171' }}>{fmtVal(low.val)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tiny Sparkline for service cards ────────────────────────────────────────

function TinySparkline({ color }: { color: string }) {
  // decorative only — a smooth curve
  const pts = "0,14 8,10 16,12 24,6 32,9 40,4 48,8 56,3 64,7 72,2 80,5 88,1 96,4"
  return (
    <svg viewBox="0 0 96 16" style={{ width: 80, height: 16 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function StaffDashboard() {
  usePageTitle('Dashboard')

  // Global KPI period
  const [period, setPeriod] = useState<Period>('month')
  const [openServiceModal, setOpenServiceModal] = useState(false)
const [mode, setMode] = useState<'revenue' | 'booking'>('revenue')
const [modalSource, setModalSource] = useState<'earning' | 'booking'>('earning')

  // Per-chart controls (isolated — no page-level refetch)

  const [monthEarnYear, setMonthEarnYear] = useState<number>(2026)
  const [monthBkgYear,  setMonthBkgYear]  = useState<number>(2026)
  const [svcPeriod,     setSvcPeriod]     = useState<Period>('month')
  const [msbYear,       setMsbYear]       = useState<number>(2026)

  const { data, isLoading } = useQuery<DashData>({
    queryKey: ['staff-dashboard', period],
    queryFn: async () => {
      const r = await api.get('/staff/dashboard', { params: { period, svcPeriod  } })
      return r.data.data
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  // ── Day-wise earnings — CURRENT WEEK (Mon → Sun with real dates) ──
const dayEarnData = useMemo(() => {
  if (!data?.day_range) return []

  const start = new Date(data.day_range.start)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    d.setHours(0, 0, 0, 0)

    const isFuture = d > today
    const isToday = d.toDateString() === today.toDateString()

    const day = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const date = d.getDate()

    const found = data.day_wise_revenue?.find(
      (x) => new Date(x.date).toDateString() === d.toDateString()
    )

    days.push({
      label: `${day} ${date}`,
      revenue: isFuture ? 0 : (found?.revenue ?? 0),
      fullDate: d,
      isFuture,
      isToday
    })
  }

  return days
}, [data])

  // ── Month-wise earnings — always all 12 months for chosen year ──
  const monthEarnData = useMemo(() => {
    const base = MONTHS_SHORT.map(m => ({ name: m, revenue: 0 }))
    if (!data) return base
    const yearData = (data.monthly_revenue ?? []).filter(m => m.year === monthEarnYear)
    for (const m of yearData) {
      const idx = MONTHS_SHORT.indexOf(m.month)
      if (idx !== -1) base[idx].revenue = m.revenue_inr
    }
    return base
  }, [data, monthEarnYear])

  // ── Day-wise bookings — CURRENT WEEK (Mon → Sun with real dates) ──
const dayBkgData = useMemo(() => {
  if (!data?.day_range) return []

  const start = new Date(data.day_range.start)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    d.setHours(0, 0, 0, 0)

    const isFuture = d > today
    const isToday = d.toDateString() === today.toDateString()

    const day = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const date = d.getDate()

    const found = data.day_wise_bookings?.find(
      (x) => new Date(x.date).toDateString() === d.toDateString()
    )

    days.push({
      label: `${day} ${date}`,
      count: isFuture ? 0 : (found?.count ?? 0),
      fullDate: d,
      isFuture,
      isToday
    })
  }

  return days
}, [data])
  // ── Month-wise bookings — always all 12 months for chosen year ──
  const monthBkgData = useMemo(() => {
    const base = MONTHS_SHORT.map(m => ({ name: m, count: 0 }))
    if (!data) return base
    const yearData = (data.monthly_revenue ?? []).filter(m => m.year === monthBkgYear)
    for (const m of yearData) {
      const idx = MONTHS_SHORT.indexOf(m.month)
      if (idx !== -1) base[idx].count = m.count
    }
    return base
  }, [data, monthBkgYear])

  // ── Service wise stats (from backend service_wise_stats) ──
  const svcStats = useMemo(() => data?.service_wise_stats ?? [], [data])
  const totalSvcRevenue = useMemo(() => svcStats.reduce((s, x) => s + x.revenue, 0), [svcStats])

  // ── Top services for "Most Booked" ──
  const topServices = useMemo(
  () => Array.isArray(data?.top_services) ? data.top_services : [],
  [data]
)
  // Filter by selected year using monthly_revenue count as a proxy — top_services comes from period data
  // Since backend returns top_services based on period, we use it directly; msbYear filter is visual only
  // for month-by-year we'd need a separate endpoint — use existing data

  // ── KPI sparklines ──
  const dayRevSpark = dayEarnData.slice(-14).map(d => d.revenue)
  const dayBkgSpark = dayBkgData.slice(-14).map(d => d.count)

  // ── Highest/lowest day for day-wise earnings ──
  const earnHighLow = useMemo(() => {
    if (!dayEarnData.length) return { high: null, low: null }
    const sorted = [...dayEarnData].sort((a, b) => b.revenue - a.revenue)
    return {
      high: { label: sorted[0].label, val: sorted[0].revenue },
      low:  { label: sorted[sorted.length - 1].label, val: sorted[sorted.length - 1].revenue },
    }
  }, [dayEarnData])

  // ── Highest/lowest day for day-wise bookings ──
  const bkgHighLow = useMemo(() => {
    if (!dayBkgData.length) return { high: null, low: null }
    const sorted = [...dayBkgData].sort((a, b) => b.count - a.count)
    return {
      high: { label: sorted[0].label, val: sorted[0].count },
      low:  { label: sorted[sorted.length - 1].label, val: sorted[sorted.length - 1].count },
    }
  }, [dayBkgData])

  // ── Total labels ──
  const totalDayEarnings = dayEarnData.reduce((s, d) => s + d.revenue, 0)
  const totalMonthlyEarnings = monthEarnData.reduce((s, m) => s + m.revenue, 0)
  const totalDayBookings = dayBkgData.reduce((s, d) => s + d.count, 0)
  const totalMonthBookings = monthBkgData.reduce((s, m) => s + m.count, 0)

  // ── Month Wise Earnings: latest bar label ──
  const latestMonthEarn = monthEarnData[monthEarnData.length - 1]
  const latestMonthBkg  = monthBkgData[monthBkgData.length - 1]

  if (isLoading || !data) {
    return (
      <div className="min-h-screen pb-20 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
        <div className="px-3 py-5 sm:px-4 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ marginBottom: 16 }}>
            {[1,2,3,4,5,6].map(i => <Shimmer key={i} h={120} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
            <Shimmer h={320} /><Shimmer h={320} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
            <Shimmer h={320} /><Shimmer h={320} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Shimmer h={320} /><Shimmer h={320} />
          </div>
        </div>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen pb-16 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-3 py-5 sm:px-4 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="font-syne font-black" style={{ fontSize: 32, color: 'var(--text-1)', marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Overview of your performance</p>
        </div>

        {/* ══ ROW 1 — KPI CARDS ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ marginBottom: 16 }}>
          <KpiCard label="Total Revenue" value={fmtINR(summary.revenue_inr)} icon={<IndianRupee size={14}/>} color="#a78bfa" delay={0} />
          <KpiCard label="Total Bookings" value={String(summary.period_bookings)} icon={<Users size={14}/>} color="#34d399" delay={0.04} />
          <KpiCard label="Completed" value={String(summary.completed)} icon={<CheckCircle size={14}/>} color="#34d399" delay={0.08} />
          <KpiCard label="Upcoming" value={String(data.today.upcoming)} icon={<Calendar size={14}/>} color="#fb923c" delay={0.12} />
          <KpiCard label="No Show" value={String(summary.no_show)} icon={<XCircle size={14}/>} color="#f59e0b" delay={0.16} />
          <KpiCard label="Refunded" value={String(summary.refunded)} icon={<XCircle size={14}/>} color="#ef4444" delay={0.2} />
        </div>

      {/* ══ ROW 2 — DAILY REVENUE | MONTHLY REVENUE ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ gridAutoRows: '1fr', marginBottom: 16 }}>

        {/* Day Wise Earnings */}
        <GCard accent="#a78bfa">
          <SectionHeader
            num={1}
            title="Daily Completed Revenue"
            right={<span className="text-[10px]" style={{ color: 'var(--text-4)' }}>{formatRange(data.day_range.start, data.day_range.end)}</span>}
          />
          <div className="mb-1">
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Total Earnings</p>
            <div className="flex items-center gap-2">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>
                {fmtINR(totalDayEarnings)}
              </p>
            </div>
          </div>

          <div className="relative">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={dayEarnData} margin={{ top: 5, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="dayEarnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                <Tooltip
  cursor={false}
  content={<ChartTip fmt={(v: number) => fmtINR(v)} />}
/>
                <Bar dataKey="revenue" name="Earnings" radius={[4,4,0,0]} maxBarSize={28}>
                  {dayEarnData.map((d, i) => {
                    const isHigh = d.revenue > 0 && d.label === earnHighLow.high?.label
                    const isLow  = d.revenue > 0 && d.label === earnHighLow.low?.label
                    return <Cell
  key={i}
  fill={
    d.isFuture
      ? 'rgba(167,139,250,0.15)'   // future → faded
      : d.isToday
      ? '#22c55e'                  // today → green highlight
      : isHigh
      ? '#a78bfa'
      : isLow
      ? 'rgba(167,139,250,0.25)'
      : 'rgba(167,139,250,0.5)'
  }
/>
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {dayEarnData.every(d => d.revenue === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none" style={{ top: 10 }}>
                <span className="text-2xl">💸</span>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-4)' }}>No earnings recorded yet</p>
                <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Complete bookings to see daily earnings</p>
              </div>
            )}
          </div>
          
        </GCard>

        {/* Month Wise Earnings */}
        <GCard accent="#a78bfa">
          <SectionHeader
            num={2}
            title="Month Wise Earnings"
            right={<YearPill year={monthEarnYear} onChange={setMonthEarnYear} />}
          />
          <div className="mb-1">
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Total Earnings</p>
            <div className="flex items-center gap-2">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>
                {fmtINR(totalMonthlyEarnings)}
              </p>
              
            </div>
          </div>

          <div className="relative">
            {/* Latest month callout */}
            {latestMonthEarn && latestMonthEarn.revenue > 0 && (
              <div className="flex justify-end mb-1">
                <div className="text-right">
                  <p className="text-[9px]" style={{ color: 'var(--text-4)' }}>{latestMonthEarn.name} {monthEarnYear}</p>
                  <p className="font-syne font-bold text-[12px]" style={{ color: '#a78bfa' }}>
                    {fmtINR(latestMonthEarn.revenue)}
                  </p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={monthEarnData} margin={{ top: 5, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="monthEarnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                <Tooltip content={<ChartTip fmt={(v: number) => fmtINR(v)} />} />
                <Area type="monotone" dataKey="revenue" name="Revenue"
                  stroke="#a78bfa" strokeWidth={2.5} fill="url(#monthEarnGrad)" dot={false}
                  activeDot={{ r: 5, fill: '#a78bfa', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
            {monthEarnData.every(m => m.revenue === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none" style={{ top: 10 }}>
                <span className="text-2xl">📊</span>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-4)' }}>No earnings for {monthEarnYear}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Earnings appear as bookings settle</p>
              </div>
            )}
          </div>
        </GCard>
      </div>

      {/* ══ ROW 3 — DAILY BOOKINGS | MONTHLY BOOKINGS ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ gridAutoRows: '1fr', marginBottom: 16 }}>

        {/* Day Wise Bookings */}
        <GCard accent="#60a5fa">
          <SectionHeader
            num={3}
            title="Daily Completed Bookings"
            right={<span className="text-[10px]" style={{ color: 'var(--text-4)' }}>This Week (Mon–Sun)</span>}
          />
          <div className="mb-1">
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Total Bookings</p>
            <div className="flex items-center gap-2">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>
                {totalDayBookings}
              </p>
              
            </div>
          </div>

          <div className="relative">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={dayBkgData} margin={{ top: 5, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="dayBkgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <Tooltip
  cursor={false}
  content={<ChartTip />}
/>
                <Bar dataKey="count" name="Bookings" radius={[4,4,0,0]} maxBarSize={28}>
                  {dayBkgData.map((d, i) => {
                    const isHigh = d.count > 0 && d.label === bkgHighLow.high?.label
                    const isLow  = d.count > 0 && d.label === bkgHighLow.low?.label
                    return <Cell key={i}
                      fill={isHigh ? '#60a5fa' : isLow ? 'rgba(96,165,250,0.2)' : 'rgba(96,165,250,0.5)'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {dayBkgData.every(d => d.count === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none" style={{ top: 10 }}>
                <span className="text-2xl">📅</span>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-4)' }}>No bookings this period</p>
                <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Daily booking data will show up here</p>
              </div>
            )}
          </div>
          
        </GCard>

        {/* Month Wise Bookings */}
        <GCard accent="#34d399">
          <SectionHeader
            num={4}
            title="Month Wise Bookings"
            right={<YearPill year={monthBkgYear} onChange={setMonthBkgYear} />}
          />
          <div className="mb-1">
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Total Bookings</p>
            <div className="flex items-center gap-2">
              <p className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>
                {totalMonthBookings}
              </p>
              
            </div>
          </div>

          <div className="relative">
            {latestMonthBkg && latestMonthBkg.count > 0 && (
              <div className="flex justify-end mb-1">
                <div className="text-right">
                  <p className="text-[9px]" style={{ color: 'var(--text-4)' }}>{latestMonthBkg.name} {monthBkgYear}</p>
                  <p className="font-syne font-bold text-[12px]" style={{ color: '#34d399' }}>{latestMonthBkg.count}</p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={monthBkgData} margin={{ top: 5, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="monthBkgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="count" name="Bookings"
                  stroke="#34d399" strokeWidth={2.5} fill="url(#monthBkgGrad)" dot={false}
                  activeDot={{ r: 5, fill: '#34d399', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
            {monthBkgData.every(m => m.count === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none" style={{ top: 10 }}>
                <span className="text-2xl">🗓️</span>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-4)' }}>No bookings for {monthBkgYear}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Monthly trends roll in with each booking</p>
              </div>
            )}
          </div>
        </GCard>
      </div>

      {/* ══ ROW 4 — SERVICE REVENUE | TOP SERVICES ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ gridAutoRows: '1fr' }}>

        {/* Service Wise Earnings */}
        <GCard accent="#f472b6" className="flex flex-col">
          <SectionHeader
            num={5}
            title="Service Wise Earnings"
          />

          {svcStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl">✂️</span>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-3)' }}>No service earnings yet</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Completed services will break down here</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              {/* Content section */}
              <div className="flex-1">
              <div style={{ display: 'grid', gridTemplateColumns: ANALYTICS_GRID, padding: '0 4px', marginBottom: 8 }}>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-2)' }}>Service</span>
                <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-2)' }}>Revenue</span>
                <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-2)' }}>Share</span>
              </div>

              <div className="space-y-3">
                {[...svcStats]
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 5)
                  .map((s, i) => {

                    // 🔥 CALCULATIONS (CORRECT WAY)
                    const maxRevenue = Math.max(...svcStats.map(x => x.revenue), 1)
                    const totalRevenue = svcStats.reduce((sum, x) => sum + x.revenue, 0)

                    // for bar (visual scaling)
                    const barPct = Math.round((s.revenue / maxRevenue) * 100)

                    // for actual share
                    const sharePct =
                      totalRevenue > 0
                        ? Math.round((s.revenue / totalRevenue) * 100)
                        : 0

                    const col = SVC_COLORS[i % SVC_COLORS.length]

                    return (
                      <div key={s.name} className="flex items-center gap-3">

                        {/* IMAGE */}
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                          {s.image ? (
                            <img
                              src={s.image}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{(s.name ?? "U")[0]}</span>
                          )}
                        </div>

                        {/* MAIN ROW */}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: ANALYTICS_GRID, alignItems: 'center' }}>

                          {/* LEFT — SERVICE */}
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-[12px] font-medium truncate">
                              {s.name}
                            </p>

                            {i === 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                Top
                              </span>
                            )}
                          </div>

                          {/* CENTER — REVENUE */}
                          <p className="text-[12px] font-bold text-center">
                            {fmtINR(s.revenue)}
                          </p>

                          {/* RIGHT — CIRCLE */}
                          <div className="flex justify-center">
                            <div className="relative w-8 h-8 flex items-center justify-center">

                              <svg className="w-full h-full -rotate-90">
                                <circle
                                  cx="16"
                                  cy="16"
                                  r="14"
                                  stroke="var(--border)"
                                  strokeWidth="3"
                                  fill="none"
                                />

                                <circle
                                  cx="16"
                                  cy="16"
                                  r="14"
                                  stroke={col}
                                  strokeWidth="3"
                                  fill="none"
                                  strokeDasharray={88}
                                  strokeDashoffset={88 - (sharePct / 100) * 88}
                                  strokeLinecap="round"
                                />
                              </svg>

                              <span className="absolute text-[9px] font-bold">
                                {sharePct}%
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    )
                  })}
              </div>
              </div>

              {/* Footer - aligned with Most Booked Services */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <button
                  onClick={() => { setModalSource('earning'); setMode('revenue'); setOpenServiceModal(true) }}
                  className="flex items-center gap-1 text-[11px] font-bold hover:opacity-70 transition-opacity ml-auto"
                  style={{ color: 'var(--violet-light)' }}
                >
                  View All Services <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )}
        </GCard>

        {/* Most Booked Services */}
        <GCard accent="#fbbf24" className="flex flex-col">
          <SectionHeader
            num={6}
            title="Most Booked Services"
          />

          {topServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl">🏆</span>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-3)' }}>No booking data yet</p>
              <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Your top services will rank up here</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              {/* Content section */}
              <div className="flex-1">
              {/* Top 3 as cards */}
              {topServices.length >= 1 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {topServices.slice(0, 3).map((svc, i) => {
                    const col = SVC_COLORS[i % SVC_COLORS.length]

                    return (
                      <motion.div
                        key={svc.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-xl p-3 flex flex-col items-center justify-center text-center"
                        style={{
                          background: `${col}10`,
                          border: `1px solid ${col}30`,
                        }}
                      >
                        {/* Rank */}
                        <p className="text-[9px] text-c3 mb-1">
                          #{i + 1}
                        </p>

                        {/* Service Image */}
                        <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center mb-1">
                          {svc.image ? (
                            <img src={svc.image} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[12px] font-bold">
                              {svc.name?.[0] ?? "U"}
                            </span>
                          )}
                        </div>

                        {/* Service Name */}
                        <p
                          className="text-[11px] font-bold leading-tight mb-1"
                          style={{ color: 'var(--text-1)' }}
                        >
                          {svc.name}
                        </p>

                        {/* BIG Booking Count */}
                        <p
                          className="font-syne font-black text-[18px]"
                          style={{ color: col }}
                        >
                          {svc.count}
                        </p>

                        {/* Label */}
                        <p className="text-[9px] text-c3">
                          bookings
                        </p>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* 4th and 5th as rows */}
              {topServices.slice(3, 5).map((svc, i) => {
                const idx = i + 3
                const col = SVC_COLORS[idx % SVC_COLORS.length]

                // 🔥   for percentage
                const totalBookings = topServices.reduce((sum, x) => sum + x.count, 0)

                const sharePct =
                  totalBookings > 0
                    ? Math.round((svc.count / totalBookings) * 100)
                    : 0

                return (
                  <div
                    key={svc.name}
                    className="flex items-center gap-2.5 py-2 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {/* Rank */}
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-4)' }}
                    >
                      {idx + 1}
                    </div>

                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                      style={{ background: `${col}22`, color: col }}
                    >
                      {(svc.name ?? "U").slice(0, 1)}
                    </div>

                    {/* LAYOUT */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: ANALYTICS_GRID, alignItems: 'center' }}>

                      {/* LEFT */}
                      <p
                        className="text-[12px] font-medium truncate"
                        style={{ color: 'var(--text-1)' }}
                      >
                        {svc.name}
                      </p>

                      {/* CENTER — COUNT */}
                      <p
                        className="text-[12px] font-bold text-center"
                        style={{ color: 'var(--text-1)' }}
                      >
                        {svc.count}
                      </p>

                      {/* RIGHT — CIRCLE */}
                      <div className="flex justify-center">
                        <div className="relative w-8 h-8 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90">
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="var(--border)"
                              strokeWidth="3"
                              fill="none"
                            />
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke={col}
                              strokeWidth="3"
                              fill="none"
                              strokeDasharray={88}
                              strokeDashoffset={88 - (sharePct / 100) * 88}
                              strokeLinecap="round"
                            />
                          </svg>

                          <span className="absolute text-[9px] font-bold">
                            {sharePct}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}

              </div>

              {/* Footer - aligned with Service Wise Earnings */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <button
                  onClick={() => { setModalSource('booking'); setMode('booking'); setOpenServiceModal(true) }}
                  className="flex items-center gap-1 text-[11px] font-bold hover:opacity-70 transition-opacity ml-auto"
                  style={{ color: 'var(--violet-light)' }}
                >
                  View All Services <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )}
        </GCard>
      </div>

      {/* Modal */}
      {openServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpenServiceModal(false)}
          />
          <div className="relative w-[95vw] md:w-[900px] rounded-2xl max-h-[90vh] md:max-h-[80vh] flex flex-col"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: 'inherit' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
              <p className="font-syne font-bold text-[14px]">All Services Analytics</p>
              <div className="flex justify-center">
                {modalSource === 'earning' ? (
                  <button className="px-2 py-1 text-[10px] rounded bg-violet-500 text-white">
                    Earnings
                  </button>
                ) : (
                  <button className="px-2 py-1 text-[10px] rounded bg-violet-500 text-white">
                    Bookings
                  </button>
                )}
              </div>
              <button
                onClick={() => setOpenServiceModal(false)}
                className="text-[12px]"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const modalData = modalSource === 'earning' ? svcStats : topServices
                const totalValue = modalSource === 'earning'
                  ? svcStats.reduce((sum, x) => sum + x.revenue, 0)
                  : topServices.reduce((sum, x) => sum + x.count, 0)

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: ANALYTICS_GRID, padding: '0 4px', marginBottom: 8 }}>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-2)' }}>Service</span>
                      <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-2)' }}>Value</span>
                      <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-2)' }}>Share</span>
                    </div>

                    <div className="space-y-3">
                      {[...modalData]
                        .sort((a: any, b: any) =>
                          modalSource === 'earning' ? b.revenue - a.revenue : b.count - a.count
                        )
                        .map((s: any, i: number) => {
                          const sharePct = totalValue > 0
                            ? modalSource === 'earning'
                              ? Math.round((s.revenue / totalValue) * 100)
                              : Math.round((s.count / totalValue) * 100)
                            : 0
                          const col = SVC_COLORS[i % SVC_COLORS.length]

                          return (
                            <div key={s.name} className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center">
                                {s.image ? (
                                  <img src={s.image} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(s.name ?? "U")[0]}</span>
                                )}
                              </div>
                              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: ANALYTICS_GRID, alignItems: 'center' }}>
                                <p className="text-[12px] font-medium truncate">{s.name}</p>
                                <p className="text-[12px] font-bold text-center">
                                  {modalSource === 'earning' ? fmtINR(s.revenue) : `${s.count}`}
                                </p>
                                <div className="flex justify-center">
                                  <div className="relative w-8 h-8">
                                    <svg className="w-full h-full -rotate-90">
                                      <circle cx="16" cy="16" r="14" stroke="var(--border)" strokeWidth="3" fill="none" />
                                      <circle cx="16" cy="16" r="14" stroke={col} strokeWidth="3" fill="none"
                                        strokeDasharray={88} strokeDashoffset={88 - (sharePct / 100) * 88} strokeLinecap="round"
                                      />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">{sharePct}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}






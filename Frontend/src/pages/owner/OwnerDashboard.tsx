import { memo, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  IndianRupee, CheckCircle, Calendar, AlertTriangle,
  XCircle, Building2, Users, BookOpen, TrendingUp, Info,
} from 'lucide-react'
import { Skeleton } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useSocketEvent, usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { formatINRDirect } from '@/lib/utils'
import type { OwnerDashboardDTO } from '@/types'

function fINR(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}K`
  return `₹${v}`
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ v, i }))
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={pts} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
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

/* ─── Chart Tooltip ─────────────────────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="q-card" style={{ padding: '8px 12px', minWidth: 130, fontSize: 11 }}>
      <p className="font-syne font-bold" style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-syne font-bold" style={{ color: p.color ?? p.fill }}>
          {p.dataKey === 'earning_inr' || p.dataKey === 'revenue'
            ? `₹${(p.value as number).toLocaleString('en-IN')}`
            : `${p.value} bookings`}
        </p>
      ))}
    </div>
  )
}

/* ─── Section Header ────────────────────────────────────────── */
function SectionHeader({ num, title, right }: { num: number; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(139,92,246,.2)', border: '1px solid rgba(139,92,246,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'Syne', fontWeight: 800, color: '#a78bfa', flexShrink: 0 }}>{num}</span>
        <p className="font-syne font-black" style={{ fontSize: 14, color: 'var(--text-1)' }}>{title}</p>
        <Info size={12} style={{ color: 'var(--text-3)', opacity: .6 }} />
      </div>
      {right}
    </div>
  )
}

/* ─── Year Pill — anchored so it never overflows mobile ─────── */
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
        // Prevents it from escaping viewport on mobile
        maxWidth: 80,
      }}
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

/* ─── Empty helpers ─────────────────────────────────────────── */
function EmptyMessage({ message }: { message: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <p className="font-syne font-bold" style={{ fontSize: 12, color: 'var(--text-3)' }}>{message}</p>
    </div>
  )
}
function EmptyListMessage({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 8px', textAlign: 'center' }}>
      <p className="font-syne font-bold" style={{ fontSize: 12, color: 'var(--text-3)' }}>{message}</p>
    </div>
  )
}

/* ─── Business Section ──────────────────────────────────────── */
const BusinessSection = memo(function BusinessSection() {
  const violet = '#a78bfa'; const blue = '#60a5fa'; const green = '#34d399'
  const yellow = '#f59e0b'; const pink = '#f472b6'

  const { data } = useQuery<OwnerDashboardDTO>({
    queryKey: ['owner-business'],
    queryFn: async () => { const res = await api.get('/owner/dashboard'); return res.data.data },
    staleTime: 60_000,
  })
  const businessChart = data?.business_chart ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 22 }}
      className="q-card" style={{ padding: 16 }}
    >
      <SectionHeader num={3} title="Business Revenue" />

      {/* Header row — desktop: 1fr 90px 140px | mobile: 1fr 70px 90px */}
      <div className="biz-header-row" style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Business</p>
        <p style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center' }}>% Share</p>
        <p style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right' }}>Revenue</p>
      </div>

      {businessChart.length === 0 ? <EmptyListMessage message="No business revenue data" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {businessChart.map((b, i) => {
            const share = b.percentage ?? 0
            const barColors = [violet, blue, green, yellow, pink, '#fb923c']
            const barColor = barColors[i % barColors.length]
            const circumference = 2 * Math.PI * 18
            return (
              <div key={b.business_id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px', gap: 8, alignItems: 'center' }}>
                {/* Business name + logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {b.logo
                    ? <img src={b.logo} style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, objectFit: 'cover' }} alt="" />
                    : <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `${barColor}25`, border: `1px solid ${barColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'Syne', fontWeight: 800, color: barColor }}>
                        {(b.business_name ?? '?').substring(0, 2).toUpperCase()}
                      </div>
                  }
                  <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.business_name}</p>
                </div>

                {/* % Share: ring centered above % text — perfectly aligns with "% Share" header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <svg width="36" height="36" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke={barColor}
                      strokeWidth="4"
                      strokeDasharray={`${(share / 100) * circumference} ${circumference}`}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"
                    />
                  </svg>
                  <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{share}%</p>
                </div>

                {/* Revenue */}
                <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>
                  {formatINRDirect(b.earning_inr ?? 0)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
})

/* ─── Staff Section ─────────────────────────────────────────── */
const StaffSection = memo(function StaffSection({ year, onYearChange }: { year: number; onYearChange: (y: number) => void }) {
  const { data } = useQuery<OwnerDashboardDTO>({
    queryKey: ['owner-staff', year],
    queryFn: async () => { const res = await api.get('/owner/dashboard', { params: { year } }); return res.data.data },
    staleTime: 60_000,
  })
  const staffChart = (data?.staff_chart ?? []).sort((a, b) => b.earning_inr - a.earning_inr).slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 22 }}
      className="q-card" style={{ padding: 16 }}
    >
      <SectionHeader num={4} title="Staff Performance" right={<YearPill year={year} onChange={onYearChange} />} />

      {staffChart.length === 0 ? <EmptyListMessage message="No staff data for this year" /> : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
            {['Staff', 'Bookings', 'Revenue'].map((h, idx) => (
              <p key={h} style={{ fontSize: 9, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: idx === 0 ? 'left' : 'right' }}>{h}</p>
            ))}
          </div>
          {/* Rows */}
          {staffChart.map(st => (
            <div key={st.staff_id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px', gap: 6, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Avatar name={st.staff_name} src={st.avatar} size="sm" />
                <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.staff_name}</p>
              </div>
              <p style={{ fontSize: 12, fontFamily: 'Syne', color: 'var(--text-1)', textAlign: 'right' }}>{st.bookings}</p>
              <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>{formatINRDirect(st.earning_inr ?? 0)}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
})

/* ─── Service Section ───────────────────────────────────────── */
const ServiceSection = memo(function ServiceSection({ year, onYearChange }: { year: number; onYearChange: (y: number) => void }) {
  const violet = '#a78bfa'

  const { data } = useQuery<OwnerDashboardDTO>({
    queryKey: ['owner-service', year],
    queryFn: async () => { const res = await api.get('/owner/dashboard', { params: { year } }); return res.data.data },
    staleTime: 60_000,
  })
  const topServices = data?.top_services ?? []
  const topService = topServices[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }}
      className="q-card" style={{ padding: 16, marginBottom: 14 }}
    >
      <SectionHeader num={5} title="Service Analytics" right={<YearPill year={year} onChange={onYearChange} />} />

      {/*
        Desktop: side-by-side — analytics table on the left, Top Service card on the right.
        Mobile:  stacked — table first, then Top Service card below.
        We achieve this purely with CSS classes: on md+ we switch to a 2-col grid.
      */}
      <div className="flex flex-col md:flex-row" style={{ gap: 16, alignItems: 'flex-start' }}>

        {/* ── Left: Analytics table ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
            {['Service', 'Bookings', 'Revenue', '% Share'].map((h, idx) => (
              <p key={h} style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: idx === 0 ? 'left' : 'right' }}>{h}</p>
            ))}
          </div>

          {topServices.length === 0 ? <EmptyListMessage message="No service data for this year" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {topServices.map((svc: any, i: number) => (
                <div key={svc.service_id ?? i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  {/* Service icon + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `${violet}18`, border: `1px solid ${violet}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {svc.image
                        ? <img src={svc.image} style={{ width: 28, height: 28, objectFit: 'cover' }} alt="" />
                        : <BookOpen size={12} style={{ color: violet }} />}
                    </div>
                    <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.name}</p>
                  </div>
                  <p style={{ fontSize: 12, fontFamily: 'Syne', color: 'var(--text-1)', textAlign: 'right' }}>{svc.count}</p>
                  <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>{formatINRDirect(svc.revenue ?? 0)}</p>
                  <p style={{ fontSize: 12, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-2)', textAlign: 'right' }}>{svc.percentage ?? 0}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Top Performing Service card ── */}
        {topService && (
          <div style={{
            width: 200, flexShrink: 0,
            borderRadius: 16, background: `${violet}0e`, border: `1px solid ${violet}25`, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
          className="w-full md:w-[200px]"
          >
            <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-3)' }}>⭐ Top Performing Service</p>

            {/* Service image */}
            <div style={{ width: '100%', height: 90, borderRadius: 10, background: `${violet}18`, border: `1px solid ${violet}30`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {topService.image
                ? <img src={topService.image} alt={topService.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <BookOpen size={28} style={{ color: violet, opacity: .6 }} />}
            </div>

            <div>
              <p className="font-syne font-black" style={{ fontSize: 15, color: 'var(--text-1)', marginBottom: 4 }}>{topService.name}</p>
              <p className="font-syne font-black" style={{ fontSize: 20, color: violet }}>{formatINRDirect(topService.revenue ?? 0)}</p>
              <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Revenue</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <p className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)' }}>{topService.count}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Bookings</p>
                </div>
                <div>
                  <p className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)' }}>{topService.percentage ?? 0}%</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Share</p>
                </div>
              </div>
            </div>

            <div style={{ marginLeft: -4, marginRight: -4 }}>
              <Sparkline data={topServices.map((s: any) => s.count)} color={violet} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
})

/* ─── Revenue Section ───────────────────────────────────────── */
const RevenueSection = memo(function RevenueSection({ year, onYearChange }: { year: number; onYearChange: (y: number) => void }) {
  const [revToggle, setRevToggle] = useState<'Revenue' | 'Bookings'>('Revenue')
  const violet = '#a78bfa'; const blue = '#60a5fa'
  const grid = 'rgba(255,255,255,.04)'

  const { data } = useQuery<OwnerDashboardDTO>({
    queryKey: ['owner-revenue', year],
    queryFn: async () => { const res = await api.get('/owner/dashboard', { params: { year } }); return res.data.data },
    staleTime: 60_000,
  })
  const monthlyData = data?.monthly_earnings ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 22 }}
      className="q-card" style={{ padding: 16 }}
    >
      <SectionHeader num={1} title="Revenue Trend" right={<YearPill year={year} onChange={onYearChange} />} />

      {/* Legend + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: violet, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 600, color: 'var(--text-3)' }}>Revenue (₹)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: blue, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 600, color: 'var(--text-3)' }}>Bookings</span>
        </div>
        <div
          onClick={() => setRevToggle(v => v === 'Revenue' ? 'Bookings' : 'Revenue')}
          style={{ marginLeft: 'auto', width: 36, height: 18, borderRadius: 9, background: revToggle === 'Revenue' ? violet : blue, position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
        >
          <div style={{ position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', left: revToggle === 'Revenue' ? 2 : 20, transition: 'left .2s' }} />
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Chart height: 200 on mobile, 260 on desktop via inline but we use a reasonable fixed */}
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={violet} stopOpacity={0.35} />
                <stop offset="100%" stopColor={violet} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bkG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={blue} stopOpacity={0.35} />
                <stop offset="100%" stopColor={blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="month" interval={1} tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'Syne' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'Syne' }} tickFormatter={v => fINR(v)} width={40} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'Syne' }} width={28} />
            <Tooltip content={<ChartTip />} />
            <Area yAxisId="left" type="monotone" dataKey="earning_inr" stroke={violet} strokeWidth={2} fill="url(#revG)" dot={{ r: 2, fill: violet, strokeWidth: 0 }} opacity={revToggle === 'Revenue' ? 1 : 0.25} />
            <Area yAxisId="right" type="monotone" dataKey="booking_count" stroke={blue} strokeWidth={2} fill="url(#bkG)" dot={{ r: 2, fill: blue, strokeWidth: 0 }} opacity={revToggle === 'Bookings' ? 1 : 0.25} />
          </AreaChart>
        </ResponsiveContainer>
        {monthlyData.length === 0 && <EmptyMessage message="No revenue data for this year" />}
      </div>
    </motion.div>
  )
})

/* ─── Booking Section ───────────────────────────────────────── */
const BookingSection = memo(function BookingSection({ year, onYearChange }: { year: number; onYearChange: (y: number) => void }) {
  const violet = '#a78bfa'
  const grid = 'rgba(255,255,255,.04)'

  const { data } = useQuery<OwnerDashboardDTO>({
    queryKey: ['owner-booking', year],
    queryFn: async () => { const res = await api.get('/owner/dashboard', { params: { year } }); return res.data.data },
    staleTime: 60_000,
  })
  const bookingData = data?.monthly_earnings ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 22 }}
      className="q-card" style={{ padding: 16 }}
    >
      <SectionHeader num={2} title="Booking Trend" right={<YearPill year={year} onChange={onYearChange} />} />
      <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>Completed Bookings per Month</p>

      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bookingData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={violet} stopOpacity={1} />
                <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="month" interval={1} tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'Syne' }} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'Syne' }} width={28} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="booking_count" radius={[5, 5, 0, 0]} fill="url(#barG)" />
          </BarChart>
        </ResponsiveContainer>
        {bookingData.length === 0 && <EmptyMessage message="No booking data for this year" />}
      </div>
    </motion.div>
  )
})

/* ─── Main Dashboard ────────────────────────────────────────── */
export default function OwnerDashboard() {
  usePageTitle('Dashboard')
  const qc = useQueryClient()
  const [revenueYear, setRevenueYear] = useState(new Date().getFullYear())
  const [bookingYear, setBookingYear] = useState(new Date().getFullYear())
  const [staffYear,   setStaffYear]   = useState(new Date().getFullYear())
  const [serviceYear, setServiceYear] = useState(new Date().getFullYear())

  const summaryQuery = useQuery({
    queryKey: ['owner-summary'],
    queryFn: async () => { const res = await api.get('/owner/dashboard'); return res.data.data.summary },
    staleTime: 60_000,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['owner-revenue'] })
    qc.invalidateQueries({ queryKey: ['owner-booking'] })
    qc.invalidateQueries({ queryKey: ['owner-business'] })
    qc.invalidateQueries({ queryKey: ['owner-staff'] })
    qc.invalidateQueries({ queryKey: ['owner-service'] })
    qc.invalidateQueries({ queryKey: ['owner-summary'] })
  }, [qc])

  useSocketEvent('booking:confirmed', invalidate)
  useSocketEvent('booking:cancelled', invalidate)
  useSocketEvent('service:completed', invalidate)
  useSocketEvent('booking:no_show',   invalidate)
  useSocketEvent('payment:received',  invalidate)
  useSocketEvent('escrow:released',   invalidate)

  const violet = '#a78bfa'; const blue = '#60a5fa'; const green = '#34d399'
  const red = '#ef4444';    const yellow = '#f59e0b'; const pink = '#f472b6'

  /* Loading skeleton */
  if (summaryQuery.isLoading) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" style={{ marginBottom: 16 }}>
        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} height="90px" className="rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 14 }}>
        <Skeleton height="300px" className="rounded-2xl" />
        <Skeleton height="300px" className="rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 14 }}>
        <Skeleton height="200px" className="rounded-2xl" />
        <Skeleton height="200px" className="rounded-2xl" />
      </div>
      <Skeleton height="240px" className="rounded-2xl" />
    </div>
  )

  const s = summaryQuery.data

  /* Empty state */
  if (!s || s.total_bookings === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 16 }}>
      <div className="q-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
        <p className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)', marginBottom: 8 }}>You're just getting started</p>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No data yet. Once bookings begin, insights will appear here.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-16 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-3 py-5 sm:px-4 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 className="font-syne font-black" style={{ fontSize: 22, color: 'var(--text-1)', marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Overview of all your businesses</p>
        </div>

        {/* ── Row 1: Summary cards — 2 cols mobile, 4 lg ── (4 even = no orphan) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 12 }}>
          <SummaryCard label="Total Revenue"   value={formatINRDirect(s.total_earnings_inr)}  sub="All Earnings"  icon={<IndianRupee size={14} />} color={violet} delay={0}    />
          <SummaryCard label="Total Bookings"  value={s.total_bookings}                        sub="All Periods"  icon={<BookOpen size={14} />}    color={blue}   delay={0.04} />
          <SummaryCard label="Completed"       value={s.completed_bookings}                    sub=""             icon={<CheckCircle size={14} />} color={green}  delay={0.08} />
          <SummaryCard label="Upcoming"        value={s.upcoming_bookings}                     sub=""             icon={<Calendar size={14} />}    color={violet} delay={0.12} />
        </div>

        {/* ── Row 2: Secondary cards — 2 cols mobile, 5 lg (incl. Refunded) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" style={{ marginBottom: 16 }}>
          <SummaryCard label="Refunded"           value={s.refunded_bookings}                          sub=""                                 icon={<XCircle size={14} />}       color={red}    delay={0.16} />
          <SummaryCard label="No Show Earnings"   value={formatINRDirect(s.no_show_earnings_inr)}    sub={`${s.no_show_bookings} bookings`} icon={<AlertTriangle size={14} />} color={yellow} delay={0.2}  />
          <SummaryCard label="Completed Earnings" value={formatINRDirect(s.completed_earnings_inr)}  sub=""                                 icon={<TrendingUp size={14} />}    color={green}  delay={0.24} />
          <SummaryCard label="Businesses"         value={s.total_businesses}                          sub="Total Businesses"                 icon={<Building2 size={14} />}     color={pink}   delay={0.28} />
          <SummaryCard label="Staff"              value={s.active_staff}                              sub="Total Staff"                      icon={<Users size={14} />}         color={blue}   delay={0.32} />
        </div>

        {/* ── Row 3: Charts — stacked on mobile, 2-col on lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <RevenueSection year={revenueYear} onYearChange={setRevenueYear} />
          <BookingSection year={bookingYear} onYearChange={setBookingYear} />
        </div>

        {/* ── Row 4: Business + Staff — stacked on mobile, 2-col on lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <BusinessSection />
          <StaffSection year={staffYear} onYearChange={setStaffYear} />
        </div>

        {/* ── Row 5: Service Analytics — full width ── */}
        <ServiceSection year={serviceYear} onYearChange={setServiceYear} />

        

      </div>
    </div>
  )
}

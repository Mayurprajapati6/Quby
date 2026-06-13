import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Building2, BookOpen, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Scissors, TrendingUp,
  MapPin, Star, Crown, UserCheck, BarChart3, Wallet,
} from 'lucide-react'
import { Skeleton } from '@/components/shared'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'

const fmt  = (n: number) => Math.round(n).toLocaleString('en-IN')
const fmtM = (n: number) => {
  if (n < 10000) return `₹${Math.round(n)}`; 
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 10_000)    return `₹${(n / 1_000).toFixed(1)}K`;

  return `₹${Math.round(n)}`;
};

interface DashboardData {
  users: { total_customers: number; total_owners: number; total_staff: number; total_admins: number }
  businesses: { total: number; active: number; inactive: number }
  bookings: {
  period_total: number;
  period_completed: number;
  period_no_show: number;
  period_refunded: number;

}
  revenue: { all_time_inr: number; period_inr: number; today_inr: number }
  today: { total_bookings: number; completed: number; cancelled: number; no_shows: number }
}

interface AnalyticsData {
  lifetime_counts: { customers: number; owners: number; staff: number; businesses: number }
  top_businesses: TopBiz[] | {
  monthly: TopBiz[]
  yearly: TopBiz[]
}
  weekly_services: Array<{ name: string; count: number; service_id?: string }>
  city_distribution: Array<{ city: string; state: string; businesses: number; customers: number; owners: number }>
  salon_type_distribution: { men: number; unisex: number }
}

interface TopBiz {
  business_id: string; business_name: string; city: string; state: string
  average_rating: number; logo_url: string | null; booking_count: number; revenue_inr: number
}

function KpiCard({ label, value, icon, accent, sub, delay = 0 }: {
  label: string; value: string | number; icon: React.ReactNode
  accent: string; sub?: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="q-card relative overflow-hidden flex flex-col gap-2.5"
      style={{ padding: '16px 18px' }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}15` }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <div className="font-syne font-black text-[26px] leading-none tracking-tight" style={{ color: 'var(--text-1)' }}>
          {typeof value === 'number' ? fmt(value) : value}
        </div>
        <div className="text-[11px] font-syne font-bold uppercase tracking-[0.1em] mt-1.5" style={{ color: 'var(--text-3)' }}>
          {label}
        </div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>}
      </div>
    </motion.div>
  )
}

function Section({ title, sub, accent, badge, toggle, children, delay = 0 }: {
  title: string; sub?: string; accent: string; badge?: string
  toggle?: React.ReactNode; children: React.ReactNode; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="q-card" style={{ padding: '20px 22px' }}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: accent }} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-syne font-black text-[15px]" style={{ color: 'var(--text-1)' }}>{title}</h2>
              {badge && (
                <span className="text-[10px] font-syne font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: `${accent}18`, color: accent }}>
                  {badge}
                </span>
              )}
            </div>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
          </div>
        </div>
        {toggle}
      </div>
      {children}
    </motion.div>
  )
}

function TogglePill({ options, value, onChange, accent }: {
  options: string[]; value: string; onChange: (v: string) => void; accent: string
}) {
  return (
    <div className="flex rounded-xl overflow-hidden flex-shrink-0"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className="px-3 py-1.5 text-xs font-syne font-black transition-all"
          style={{
            background: value === opt ? accent : 'transparent',
            color: value === opt ? '#fff' : 'var(--text-3)',
            border: 'none', cursor: 'pointer',
          }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function ChartEmpty({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-2xl"
      style={{ background: 'var(--bg-surface)' }}>
      <BarChart3 size={32} style={{ color: 'var(--text-3)', opacity: 0.25 }} />
      <p className="font-syne font-bold text-sm" style={{ color: 'var(--text-3)' }}>{message}</p>
    </div>
  )
}

function UserBreakdownChart({ counts }: { counts: { customers: number; owners: number; staff: number } }) {
  const total = counts.customers + counts.owners + counts.staff
  if (total === 0) return <ChartEmpty />

  const segments = [
    { label: 'Customers', value: counts.customers, color: '#60a5fa', icon: <Users size={13} /> },
    { label: 'Owners',    value: counts.owners,    color: '#f472b6', icon: <Crown size={13} /> },
    { label: 'Staff',     value: counts.staff,     color: '#a78bfa', icon: <UserCheck size={13} /> },
  ]

  const R = 52, CX = 68, CY = 68, stroke = 18
  const circumference = 2 * Math.PI * R
  let offset = 0
  const arcs = segments.map(s => {
    const pct   = s.value / total
    const dash  = pct * circumference
    const gap   = circumference - dash
    const arc   = { ...s, pct, dash, gap, offset }
    offset += dash
    return arc
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut */}
      <div className="relative flex-shrink-0">
        <svg width="136" height="136" viewBox="0 0 136 136">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg-surface)" strokeWidth={stroke} />
          {arcs.map((a, i) => (
            <motion.circle key={i} cx={CX} cy={CY} r={R} fill="none"
              stroke={a.color} strokeWidth={stroke}
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={circumference / 4 - a.offset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${a.dash} ${a.gap}` }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-syne font-black text-xl leading-none" style={{ color: 'var(--text-1)' }}>
            {fmt(total)}
          </span>
          <span className="text-[10px] font-syne font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-3)' }}>
            total
          </span>
        </div>
      </div>

      {/* Legend + bars */}
      <div className="flex-1 w-full space-y-3.5">
        {segments.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0
          return (
            <motion.div key={s.label}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span className="text-sm font-syne font-bold" style={{ color: 'var(--text-2)' }}>{s.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{pct.toFixed(1)}%</span>
                  <span className="font-syne font-black text-[15px] w-16 text-right" style={{ color: s.color }}>
                    {fmt(s.value)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <motion.div className="h-full rounded-full" style={{ background: s.color }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.1, ease: 'easeOut' }} />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function TopBusinessChart({ items }: { items: TopBiz[] }) {
  if (!items.length) return <ChartEmpty message="No business data for this period" />

  const top3 = items.slice(0, 3)
  const rest  = items.slice(3, 5)

  const podiumOrder  = [1, 0, 2] // 2nd, 1st, 3rd visually
  const podiumHeight = [64, 96, 48]
  const podiumColor  = ['#94a3b8', '#f59e0b', '#cd7f32']
  const crownSizes   = [16, 22, 14]

  return (
    <div className="space-y-5">
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 pt-2 pb-1">
        {podiumOrder.map(idx => {
          const b = top3[idx]
          if (!b) return <div key={idx} className="w-[88px]" />
          const rank = idx + 1
          const color = podiumColor[idx]

          return (
            <motion.div key={b.business_id} className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 + 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              {/* Avatar */}
              <div className="relative">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.business_name}
                    className="rounded-2xl object-cover border-2"
                    style={{ width: rank === 1 ? 52 : 40, height: rank === 1 ? 52 : 40, borderColor: color }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="rounded-2xl flex items-center justify-center font-syne font-black border-2"
                    style={{ width: rank === 1 ? 52 : 40, height: rank === 1 ? 52 : 40, borderColor: color, background: `${color}15`, color, fontSize: rank === 1 ? 18 : 14 }}>
                    {b.business_name[0]}
                  </div>
                )}
                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center font-syne font-black text-[10px]"
                  style={{ background: color, color: '#fff' }}>
                  {rank}
                </div>
              </div>

              {/* Name */}
              <div className="text-center max-w-[90px]">
                <p className="font-syne font-black text-xs leading-tight truncate" style={{ color: 'var(--text-1)' }}>
                  {b.business_name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {b.city}
                </p>
              </div>

              {/* Podium block */}
              <div className="w-[88px] rounded-t-xl flex flex-col items-center justify-start pt-2 gap-1"
                style={{ height: podiumHeight[idx], background: `${color}18`, border: `1px solid ${color}30` }}>
                <p className="font-syne font-black text-xs" style={{ color }}>
                  {fmtM(b.revenue_inr)}
                </p>
                {b.average_rating > 0 && (
                  <p className="text-[10px] flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
                    <Star size={8} fill="currentColor" /> {b.average_rating.toFixed(1)}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 4th & 5th as compact rows */}
      {rest.length > 0 && (
        <div className="space-y-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          {rest.map((b, i) => (
            <motion.div key={b.business_id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
              <span className="w-5 font-syne font-black text-xs text-center flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                {i + 4}
              </span>
              {b.logo_url ? (
                <img src={b.logo_url} alt={b.business_name} className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-syne font-black text-sm"
                  style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)' }}>
                  {b.business_name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-syne font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>{b.business_name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{b.city}, {b.state}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-syne font-black text-sm" style={{ color: '#34d399' }}>{fmtM(b.revenue_inr)}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(b.booking_count)} bkgs</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════ CHART 3 — Top Services (horizontal bars with images) ═══════════════════════ */
function TopServicesChart({ items }: {
  items: Array<{ name: string; count: number; image_url?: string | null; service_id?: string }>
}) {
  if (!items.length) return <ChartEmpty />

  const max = Math.max(...items.map(s => s.count), 1)
  const palette = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6']
  const medals  = ['🥇', '🥈', '🥉', '4', '5']

  return (
    <div className="space-y-2">
      {items.map((s, i) => {
        const color = palette[i]
        const pct   = (s.count / max) * 100

        return (
          <motion.div key={s.service_id ?? s.name}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.09 }}
            className="flex items-center gap-3 p-3 rounded-2xl group"
            style={{ background: 'var(--bg-surface)' }}>

            {/* Service image / icon */}
            {s.image_url ? (
              <img src={s.image_url} alt={s.name}
                className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
                style={{ outline: `2px solid ${color}40`, outlineOffset: '2px' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}>
                <Scissors size={16} style={{ color }} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Name + count */}
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="font-syne font-black text-sm truncate" style={{ color: 'var(--text-1)' }}>
                  {s.name}
                </span>
                <span className="font-syne font-black text-lg flex-shrink-0 leading-none" style={{ color }}>
                  {fmt(s.count)}
                </span>
              </div>
              {/* Bar with glow */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.75, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                {pct.toFixed(0)}% of top service bookings
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════ CHART 4 — City Customers (bubble / dot grid) ═══════════════════════ */
function CityCustomerChart({ items }: {
  items: Array<{ city: string; state: string; customers: number }>
}) {
  if (!items.length || items.every(c => c.customers === 0)) return <ChartEmpty />

  const max = Math.max(...items.map(c => c.customers), 1)
  const hues = [211, 240, 160, 45, 320]

  return (
    <div className="space-y-3">
      {items.map((c, i) => {
        const pct  = (c.customers / max) * 100
        const hue  = hues[i % hues.length]
        const col  = `hsl(${hue},75%,60%)`
        // Dot count capped at 20 for visual
        const dots = Math.max(1, Math.round((c.customers / max) * 20))

        return (
          <motion.div key={c.city}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                <span className="font-syne font-black text-[13px]" style={{ color: 'var(--text-1)' }}>
                  {c.city}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{c.state}</span>
              </div>
              <span className="font-syne font-black text-[15px]" style={{ color: col }}>
                {fmt(c.customers)}
              </span>
            </div>
            {/* Dot grid */}
            <div className="flex flex-wrap gap-[3px] mb-1">
              {Array.from({ length: 20 }).map((_, j) => (
                <motion.div key={j}
                  className="w-[10px] h-[10px] rounded-full"
                  style={{ background: j < dots ? col : 'var(--bg-surface)' }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 + j * 0.015, duration: 0.2 }}
                />
              ))}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
              {pct.toFixed(0)}% of top-city registrations
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════ CHART 5 — Saloons by City (stacked card list) ═══════════════════════ */
function CityBizChart({ items }: { items: TopBiz[] }) {
  if (!items.length) return <ChartEmpty message="No data for this period" />

  const max = Math.max(...items.map(b => b.booking_count), 1)

  return (
    <div className="space-y-2.5">
      {items.map((b, i) => {
        const pct   = (b.booking_count / max) * 100
        const hue   = 250 + i * 22
        const color = `hsl(${hue},70%,65%)`

        return (
          <motion.div key={b.business_id}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="p-3.5 rounded-2xl relative overflow-hidden"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

            {/* Faded background fill bar */}
            <motion.div className="absolute inset-y-0 left-0 rounded-2xl"
              style={{ background: `${color}08` }}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.08 }} />

            <div className="relative flex items-center gap-3">
              {b.logo_url ? (
                <img src={b.logo_url} alt={b.business_name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-syne font-black text-sm"
                  style={{ background: `${color}20`, color }}>
                  {b.business_name[0]}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-syne font-black text-sm truncate" style={{ color: 'var(--text-1)' }}>
                  {b.business_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] flex items-center gap-0.5" style={{ color: 'var(--text-3)' }}>
                    <MapPin size={9} className="flex-shrink-0" />{b.city}, {b.state}
                  </span>
                  {b.average_rating > 0 && (
                    <span className="text-[11px] flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
                      <Star size={9} fill="currentColor" />{b.average_rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Booking pill */}
              <div className="flex-shrink-0 text-right">
                <div className="inline-flex flex-col items-center px-3 py-1.5 rounded-xl"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <span className="font-syne font-black text-base leading-none" style={{ color }}>
                    {fmt(b.booking_count)}
                  </span>
                  <span className="text-[9px] font-syne font-bold uppercase tracking-wider mt-0.5" style={{ color }}>
                    bookings
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════ Skeleton ═══════════════════════ */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto space-y-4" style={{ background: 'var(--bg-page)' }}>
      <div className="space-y-1.5">
        <Skeleton height="32px" width="200px" />
        <Skeleton height="14px" width="140px" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="110px" className="rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="110px" className="rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Skeleton height="300px" className="rounded-2xl" />
        <Skeleton height="300px" className="rounded-2xl" />
      </div>
      <Skeleton height="280px" className="rounded-2xl" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Skeleton height="280px" className="rounded-2xl" />
        <Skeleton height="280px" className="rounded-2xl" />
      </div>
    </div>
  )
}

/* ═══════════════════════ MAIN ═══════════════════════ */
export default function AdminDashboard() {
  usePageTitle('Admin Dashboard')

  // top-businesses toggle: "monthly" vs "yearly" — the only REAL year distinction the backend provides
  

  /* ── Fetch dashboard (year period = full current year for all-time booking counts) ── */
  const { data: dashData, isLoading: dashLoading, isError: dashError, isFetching, refetch } = useQuery({
    queryKey: ['admin-dash-v4'],
    queryFn: async () => {
      const r = await api.get('/admin/dashboard', { params: { period: 'year' } })
      return r.data.data as DashboardData
    },
    staleTime: 60_000,
  })

  /* ── Fetch analytics (all-time, single call) ── */
  const { data: anaData, isLoading: anaLoading } = useQuery({
    queryKey: ['admin-analytics-v4'],
    queryFn: async () => {
      const r = await api.get('/admin/dashboard/analytics', { params: { period: 'monthly' } })
      return r.data.data as AnalyticsData
    },
    staleTime: 60_000,
  })

  /* ── Fetch platform services for images ── */
  const { data: psData } = useQuery({
    queryKey: ['admin-ps-v4'],
    queryFn: async () => {
      const r = await api.get('/admin/platform-services', { params: { limit: 200 } })
      const list: Array<{ id: string; name: string; image_url: string | null }> =
        r.data.data?.services ?? r.data.data ?? []
      return new Map(list.map(ps => [ps.name.toLowerCase().trim(), ps.image_url]))
    },
    staleTime: 10 * 60_000,
  })

  const isLoading = dashLoading || anaLoading

  if (isLoading) return <DashboardSkeleton />

  if (dashError || !dashData || !anaData) {
    return (
      <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto" style={{ background: 'var(--bg-page)' }}>
        <div className="q-card p-6 text-center">
          <p className="font-syne font-black text-base" style={{ color: 'var(--text-1)' }}>Dashboard unavailable</p>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-3)' }}>Could not load platform data</p>
          <button type="button" onClick={() => refetch()} className="q-btn-primary text-sm px-4 py-2">
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Lifetime user counts come from analytics.lifetime_counts (true all-time, not period-filtered)
  const lc = anaData.lifetime_counts
  const sd = anaData.salon_type_distribution

  // Bookings: dashboard?period=year gives current-year totals
  const bk       = dashData.bookings
  // No-show from today (only real source in current API without a custom endpoint)
  const noShow   = dashData.today?.no_shows ?? 0
  // Refunded: not available from any current endpoint directly — show 0 honestly
  const refunded = 0

  /* ─── Enrich services with images ─── */
  const enrichedServices = (anaData.weekly_services ?? []).slice(0, 5).map(s => ({
    ...s,
    image_url: psData?.get(s.name.toLowerCase().trim()) ?? null,
  }))

  /* ─── City distribution for customers chart ─── */
  const topCitiesCustomers = [...(anaData.city_distribution ?? [])]
    .filter(c => c.customers > 0)
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 5)

  /* ─── Top businesses for saloon-by-city ─── */
  const rawTopBiz = anaData?.top_businesses;

let topBizList: TopBiz[] = [];

if (Array.isArray(rawTopBiz)) {
  topBizList = rawTopBiz;
} else if (rawTopBiz && Array.isArray(rawTopBiz.yearly)) {
  topBizList = rawTopBiz.yearly;
} else {
  topBizList = [];
}

const topBizForCity: TopBiz[] = Array.isArray(topBizList)
  ? topBizList.slice(0, 5)
  : [];

  return (
    <div className="min-h-screen pb-20 lg:pb-8 px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto space-y-4" style={{ background: 'var(--bg-page)' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-syne font-black text-2xl lg:text-3xl" style={{ color: 'var(--text-1)' }}>
            Platform Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            All-time snapshot · current year bookings
          </p>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => refetch()}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', flexShrink: 0 }}>
          <RefreshCw size={14} style={{ color: 'var(--text-2)', animation: isFetching ? 'spin 1s linear infinite' : undefined }} />
        </motion.button>
      </motion.div>

      {/* ── KPI ROW 1: Users & Businesses (all-time from lifetime_counts) ── */}
      <div>
        <p className="text-[10px] font-syne font-bold uppercase tracking-[0.12em] mb-3 pl-0.5" style={{ color: 'var(--text-3)' }}>
          All-time · Users &amp; Businesses
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Customers"      value={lc.customers}    icon={<Users size={16} />}     accent="#60a5fa" delay={0.00} />
          <KpiCard label="Owners"         value={lc.owners}       icon={<Crown size={16} />}     accent="#f472b6" delay={0.04} />
          <KpiCard label="Active Staff"   value={lc.staff}        icon={<UserCheck size={16} />} accent="#a78bfa" delay={0.08} />
          <KpiCard label="Businesses"     value={lc.businesses}   icon={<Building2 size={16} />} accent="#34d399" delay={0.12} />
          <KpiCard label="Men's Saloons"  value={sd.men}          icon={<Scissors size={16} />}  accent="#fbbf24" delay={0.16} />
          <KpiCard label="Unisex Saloons" value={sd.unisex}       icon={<Scissors size={16} />}  accent="#f472b6" delay={0.20} />
        </div>
      </div>

      {/* ── KPI ROW 2: Bookings (current year from dashboard?period=year) ── */}
      <div>
        <p className="text-[10px] font-syne font-bold uppercase tracking-[0.12em] mb-3 pl-0.5" style={{ color: 'var(--text-3)' }}>
          Current Year · Bookings
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total Bookings"  value={bk.period_total}     icon={<BookOpen size={16} />}      accent="#60a5fa" delay={0.24} />
          <KpiCard label="Completed"       value={bk.period_completed} icon={<CheckCircle2 size={16} />}  accent="#34d399" delay={0.28} />
           
          <KpiCard
  label="Refunded"
  value={bk.period_refunded}
  icon={<Wallet size={16} />}
  accent="#f97316"
/>
          <KpiCard
  label="No Shows"
  value={bk.period_no_show}
  icon={<AlertTriangle size={16} />}
  accent="#fbbf24"
/>
        </div>
      </div>

      {/* ── ROW 1: User Breakdown + Top Businesses ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Chart 1 — User Breakdown */}
        <Section title="User Breakdown" sub="All-time registration split"
          accent="#60a5fa" badge="All time" delay={0.38}>
          <UserBreakdownChart counts={{
            customers: lc.customers,
            owners:    lc.owners,
            staff:     lc.staff,
          }} />
        </Section>

        {/* Chart 2 — Top Businesses */}
        <Section
          title="Top Businesses"
          sub="Ranked by earnings · top 5"
          accent="#f59e0b"
          delay={0.42}
          
        >
          <TopBusinessChart items={topBizList} />
        </Section>
      </div>

      {/* Chart 3 — Top 5 Services (full width) */}
      <Section title="Top 5 Most Booked Services" sub="Based on last 7 days booking activity"
        accent="#a78bfa" badge="Live" delay={0.46}>
        {enrichedServices.length === 0 ? (
          <ChartEmpty message="No booking activity in last 7 days" />
        ) : (
          <TopServicesChart items={enrichedServices} />
        )}
      </Section>

      {/* ── ROW 2: City Customers + City Businesses ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Chart 4 — City-wise customers */}
        <Section title="Top Cities by Customers" sub="All-time registrations by city · top 5"
          accent="#fbbf24" badge="All time" delay={0.50}>
          <CityCustomerChart items={topCitiesCustomers} />
        </Section>

        {/* Chart 5 — Saloons by city */}
        <Section title="Top Saloons by Bookings" sub="This year · sorted by booking count"
          accent="#f472b6" badge="This year" delay={0.54}>
          <CityBizChart items={topBizForCity} />
        </Section>
      </div>

    </div>
  )
}

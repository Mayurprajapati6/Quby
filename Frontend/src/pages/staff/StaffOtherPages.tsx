import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, X,
  CheckCircle, Clock, Bell, QrCode, Search, RotateCcw,
  Download, ChevronDown, Copy, AlertTriangle, Check, Shield,
  TrendingUp, Filter, Settings, BellOff, MoreHorizontal, Star, User, Scissors, Building2,
} from 'lucide-react'
import { usePageTitle, useSocketEvent, useIntersectionObserver } from '@/hooks'
import { NotificationsPage } from '@/components/shared/NotificationsPage'
import { Avatar } from '@/components/shared/Avatar'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} days ago`
  return fmtShort(iso)
}
function Sk({ h = 20, className = '' }: { h?: number; className?: string }) {
  return <div className={`animate-pulse rounded-[10px] ${className}`} style={{ height: h, background: 'var(--bg-surface)' }} />
}

// ════════════════════════════════════════════════════════════════════════════
//  LEAVE PAGE
// ════════════════════════════════════════════════════════════════════════════
interface LeaveItem {
  id: string; leave_type: string; start_date: string; end_date: string
  reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null; approved_at: string | null
  rejection_reason: string | null; created_at: string
}

const LEAVE_TYPE_CFG: Record<string, { icon: string; color: string; label: string }> = {
  SICK:      { icon: '❤️', color: 'var(--red)',          label: 'Sick' },
  EMERGENCY: { icon: '⚡', color: 'var(--yellow)',       label: 'Emergency' },
  VACATION:  { icon: '✈️', color: 'var(--violet-light)', label: 'Vacation' },
  OTHER:     { icon: '📋', color: 'var(--text-3)',       label: 'Other' },
}
const STATUS_BORDER: Record<string, string> = {
  PENDING: 'var(--yellow)', APPROVED: 'var(--green)', REJECTED: 'var(--red)',
}
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  PENDING:  { bg: 'rgba(245,158,11,0.15)', color: 'var(--yellow)' },
  APPROVED: { bg: 'var(--green-bg)',        color: 'var(--green)' },
  REJECTED: { bg: 'var(--red-bg)',          color: 'var(--red)' },
}

// ════════════════════════════════════════════════════════════════════════════
//  LEAVE DATE PICKER — custom calendar with blocked/approved date highlighting
// ════════════════════════════════════════════════════════════════════════════
function toLocalDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

interface BlockedRange { start: string; end: string; status: string }

function LeaveDatePicker({
  startDate, endDate, blockedRanges, onChange,
}: {
  startDate: string
  endDate: string
  blockedRanges: BlockedRange[]
  onChange: (start: string, end: string) => void
}) {
  const todayStr = toLocalDateStr(new Date())
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  // picking = 'start' | 'end'
  const [picking, setPicking] = useState<'start' | 'end'>('start')

  const monthStart = startOfMonth(viewDate)
  const monthEnd   = endOfMonth(viewDate)
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingBlanks = getDay(monthStart) // 0=Sun

  const isBlocked = (dateStr: string) =>
    blockedRanges.some(r => dateStr >= r.start && dateStr <= r.end)

  const getBlockedStatus = (dateStr: string) => {
    const r = blockedRanges.find(r => dateStr >= r.start && dateStr <= r.end)
    return r?.status ?? null
  }

  const isPast = (dateStr: string) => dateStr <= todayStr

  const isInRange = (dateStr: string) =>
    startDate && endDate && dateStr > startDate && dateStr < endDate

  const handleDayClick = (dateStr: string) => {
    if (isPast(dateStr) || isBlocked(dateStr)) return
    if (picking === 'start') {
      onChange(dateStr, '')
      setPicking('end')
    } else {
      if (dateStr < startDate) {
        onChange(dateStr, '')
        setPicking('end')
        return
      }
      // Check if any blocked date exists in the range
      const rangeBlocked = blockedRanges.some(r => startDate <= r.end && dateStr >= r.start)
      if (rangeBlocked) {
        // Reset — can't span across a blocked range
        onChange(dateStr, '')
        setPicking('end')
        return
      }
      onChange(startDate, dateStr)
      setPicking('start')
    }
  }

  const prevMonth = () => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })
  const nextMonth = () => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })

  const DAYS_HEADER = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="mb-4">
      {/* Selected range display */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(['start', 'end'] as const).map(which => {
          const val = which === 'start' ? startDate : endDate
          const active = picking === which
          return (
            <button key={which} onClick={() => setPicking(which)}
              className="text-left px-3 py-2 rounded-[10px] transition-all"
              style={{
                background: active ? 'var(--violet-bg)' : 'var(--bg-surface)',
                border: `1px solid ${active ? 'var(--violet-border)' : 'var(--border)'}`,
              }}>
              <p className="q-label mb-0.5">{which === 'start' ? 'START DATE' : 'END DATE'}</p>
              <p className="text-[13px] font-syne font-semibold" style={{ color: val ? 'var(--text-1)' : 'var(--text-3)' }}>
                {val ? format(new Date(val + 'T00:00:00'), 'd MMM yyyy') : 'Select date'}
              </p>
            </button>
          )
        })}
      </div>

      {/* Calendar */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={prevMonth} className="p-1 rounded-lg hover:opacity-70 transition-opacity">
            <ChevronLeft size={16} style={{ color: 'var(--text-2)' }} />
          </button>
          <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>
            {format(viewDate, 'MMMM yyyy')}
          </p>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:opacity-70 transition-opacity">
            <ChevronRight size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-2 pt-2">
          {DAYS_HEADER.map(d => (
            <div key={d} className="text-center text-[10px] font-bold pb-1" style={{ color: 'var(--text-3)' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1 px-2 pb-3">
          {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b-${i}`} />)}
          {days.map(day => {
            const ds = toLocalDateStr(day)
            const blocked     = isBlocked(ds)
            const blockedSt   = getBlockedStatus(ds)
            const past        = isPast(ds)
            const isStart     = ds === startDate
            const isEnd       = ds === endDate
            const inRange     = isInRange(ds)
            const isSelected  = isStart || isEnd
            const isToday     = ds === todayStr

            let bg = 'transparent'
            let color = 'var(--text-1)'
            let opacity = 1
            let cursor = 'pointer'
            let borderRadius = '8px'
            let title = ''

            if (past) {
              opacity = 0.3; cursor = 'not-allowed'; color = 'var(--text-3)'
            } else if (blocked) {
              bg = blockedSt === 'APPROVED' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.15)'
              color = blockedSt === 'APPROVED' ? 'var(--red)' : 'var(--yellow)'
              cursor = 'not-allowed'
              title = blockedSt === 'APPROVED' ? 'Leave approved' : 'Leave pending'
            } else if (isSelected) {
              bg = 'var(--violet)'; color = '#fff'
            } else if (inRange) {
              bg = 'var(--violet-bg)'; color = 'var(--violet-light)'
              borderRadius = '0px'
            }

            if (isStart && endDate) borderRadius = '8px 0 0 8px'
            if (isEnd && startDate) borderRadius = '0 8px 8px 0'

            return (
              <div key={ds} title={title}
                onClick={() => handleDayClick(ds)}
                style={{ cursor, opacity, borderRadius, background: bg, color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 34, fontSize: 12, fontWeight: isSelected ? 700 : isToday ? 700 : 400,
                  position: 'relative',
                  outline: isToday && !isSelected ? '1.5px solid var(--violet-border)' : 'none',
                  outlineOffset: '-1px',
                }}>
                {blocked && (
                  <span style={{ position: 'absolute', top: 2, right: 3, fontSize: 7, lineHeight: 1 }}>
                    {blockedSt === 'APPROVED' ? '✓' : '…'}
                  </span>
                )}
                {ds.slice(-2).replace(/^0/, '')}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 pb-3 flex-wrap">
          {[
            { color: 'var(--violet)', label: 'Selected' },
            { color: 'rgba(239,68,68,0.18)', textColor: 'var(--red)', label: 'Approved leave' },
            { color: 'rgba(245,158,11,0.15)', textColor: 'var(--yellow)', label: 'Pending leave' },
          ].map(({ color, textColor, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
              <span style={{ fontSize: 10, color: textColor ?? 'var(--text-3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Picking hint */}
      <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--text-3)' }}>
        {picking === 'start' ? '👆 Tap a date to set start' : '👆 Tap a date to set end'}
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  APPLY LEAVE MODAL
// ════════════════════════════════════════════════════════════════════════════
function ApplyLeaveModal({
  form, setForm, blockedRanges, numDays, formOverlapsExisting, applyMutation, onClose,
}: {
  form: { leave_type: string; start_date: string; end_date: string; reason: string }
  setForm: (f: any) => void
  blockedRanges: BlockedRange[]
  numDays: number
  formOverlapsExisting: boolean
  applyMutation: any
  onClose: () => void
}) {
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null)

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="relative w-full sm:max-w-2xl q-card pointer-events-auto flex flex-col"
          style={{ height: 'min(850px, 90vh)', borderTop: '3px solid var(--violet-light)', borderRadius: '24px 24px 0 0' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-5 pb-4"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                  <Calendar size={18} style={{ color: 'var(--violet-light)' }} />
                </div>
                <div>
                  <h3 className="font-syne font-black text-[18px]" style={{ color: 'var(--text-1)' }}>Apply for Leave</h3>
                  <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Submit a new leave request</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Leave Type */}
            <div>
              <label className="q-label mb-3">LEAVE TYPE</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(LEAVE_TYPE_CFG).map(([key, cfg]) => (
                  <motion.button key={key} whileTap={{ scale: 0.96 }}
                    onClick={() => setForm((p: any) => ({ ...p, leave_type: key }))}
                    className="flex items-center justify-center gap-1.5 py-4 rounded-[12px] text-[12px] font-syne font-bold transition-all"
                    style={{
                      background: form.leave_type === key ? 'var(--violet-bg)' : 'var(--bg-surface)',
                      color: form.leave_type === key ? 'var(--violet-light)' : 'var(--text-3)',
                      border: `1px solid ${form.leave_type === key ? 'var(--violet-border)' : 'var(--border)'}`,
                      boxShadow: form.leave_type === key ? '0 0 16px rgba(124,58,237,0.3)' : 'none',
                    }}>
                    <span style={{ color: form.leave_type === key ? cfg.color : 'var(--text-3)' }}>{cfg.icon}</span>
                    {cfg.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Date Pickers */}
            <div>
              <label className="q-label mb-3">SELECT DATES</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowDatePicker('start')}
                  className="p-4 rounded-[12px] text-left transition-all"
                  style={{ background: 'var(--bg-surface)', border: `1px solid ${form.start_date ? 'var(--violet-border)' : 'var(--border)'}`, cursor: 'pointer' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-3)' }}>
                    <Calendar size={14} /> Start Date
                  </div>
                  <p className="font-syne font-bold text-[13px]" style={{ color: form.start_date ? 'var(--text-1)' : 'var(--text-4)' }}>
                    {form.start_date ? fmtDate(form.start_date) : 'Select date'}
                  </p>
                </button>
                <button
                  onClick={() => {
                    if (!form.start_date) {
                      toast.info('Please select a start date first')
                      return
                    }
                    setShowDatePicker('end')
                  }}
                  className="p-4 rounded-[12px] text-left transition-all"
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${form.end_date ? 'var(--violet-border)' : 'var(--border)'}`,
                    cursor: form.start_date ? 'pointer' : 'not-allowed',
                    opacity: form.start_date ? 1 : 0.5,
                  }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-3)' }}>
                    <Calendar size={14} /> End Date
                  </div>
                  <p className="font-syne font-bold text-[13px]" style={{ color: form.end_date ? 'var(--text-1)' : 'var(--text-4)' }}>
                    {form.end_date ? fmtDate(form.end_date) : 'Select date'}
                  </p>
                </button>
              </div>
            </div>

            {/* Overlap Warning */}
            <AnimatePresence>
              {formOverlapsExisting && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-start gap-2 p-3 rounded-[10px]"
                    style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                    <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
                    <p className="text-[12px]" style={{ color: 'var(--red)' }}>
                      These dates overlap an existing approved or pending leave request. Please choose different dates.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Duration Summary */}
            <AnimatePresence>
              {numDays > 0 && !formOverlapsExisting && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-4 rounded-[12px] text-center"
                    style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                    <p className="font-syne font-black text-[24px]" style={{ color: 'var(--violet-light)' }}>{numDays} Day{numDays > 1 ? 's' : ''}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                      {fmtDate(form.start_date)} → {fmtDate(form.end_date)}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reason */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="q-label">LEAVE REASON</label>
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{form.reason.length}/300</span>
              </div>
              <textarea className="q-input resize-none" rows={4} value={form.reason} maxLength={300}
                onChange={e => setForm((p: any) => ({ ...p, reason: e.target.value }))}
                placeholder="Tell us the reason for your leave..." />
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 p-5"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
            <motion.button whileTap={{ scale: 0.97 }}
              disabled={!form.start_date || !form.end_date || !form.reason.trim() || applyMutation.isPending || formOverlapsExisting}
              onClick={() => applyMutation.mutate()}
              className="q-btn-primary w-full h-12 flex items-center justify-center gap-2 text-[13px]">
              {applyMutation.isPending
                ? <><div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> Submitting...</>
                : <><Plus size={14} /> Submit Leave Request</>}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDatePicker && (
          <DatePickerModal
            type={showDatePicker}
            startDate={form.start_date}
            endDate={form.end_date}
            blockedRanges={blockedRanges}
            onSelect={(date) => {
              if (showDatePicker === 'start') {
                setForm((p: any) => ({ ...p, start_date: date }))
                if (form.end_date && new Date(date) > new Date(form.end_date)) {
                  setForm((p: any) => ({ ...p, end_date: '' }))
                }
              } else {
                setForm((p: any) => ({ ...p, end_date: date }))
              }
              setShowDatePicker(null)
            }}
            onClose={() => setShowDatePicker(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  DATE PICKER MODAL
// ════════════════════════════════════════════════════════════════════════════
function DatePickerModal({
  type, startDate, endDate, blockedRanges, onSelect, onClose,
}: {
  type: 'start' | 'end'
  startDate: string
  endDate: string
  blockedRanges: BlockedRange[]
  onSelect: (date: string) => void
  onClose: () => void
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingBlanks = getDay(monthStart)

  const todayStr = toLocalDateStr(new Date())
  const isBlocked = (dateStr: string) =>
    blockedRanges.some(r => dateStr >= r.start && dateStr <= r.end)

  const getBlockedStatus = (dateStr: string) => {
    const r = blockedRanges.find(r => dateStr >= r.start && dateStr <= r.end)
    return r?.status
  }

  const handleDayClick = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date(todayStr)
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    if (date < today) return
    if (isBlocked(dateStr)) return
    if (type === 'end' && startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      if (date < start) return
    }
    onSelect(dateStr)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="relative w-full sm:max-w-[500px] q-card pointer-events-auto flex flex-col"
          style={{ height: 'min(85vh, 600px)', borderTop: '3px solid var(--violet-light)', borderRadius: '28px 28px 0 0' }}
          onClick={e => e.stopPropagation()}>

          {/* Drag handle for mobile */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-syne font-bold text-[18px]" style={{ color: 'var(--text-1)' }}>
                  Select {type === 'start' ? 'Start' : 'End'} Date
                </h3>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
                  {type === 'start' ? 'Choose the first day of your leave' : 'Choose the last day of your leave'}
                </p>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
              <ChevronLeft size={20} />
            </button>
            <p className="font-syne font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>
              {format(viewDate, 'MMMM yyyy')}
            </p>
            <button onClick={() => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-7 gap-2 mb-3">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <p key={d} className="text-[11px] font-bold text-center" style={{ color: 'var(--text-4)' }}>{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`blank-${i}`} />)}
              {days.map(d => {
                const ds = toLocalDateStr(d)
                const today = new Date(todayStr)
                today.setHours(0, 0, 0, 0)
                const currentDate = new Date(d)
                currentDate.setHours(0, 0, 0, 0)
                const past = currentDate < today
                const blocked = isBlocked(ds)
                const blockedSt = getBlockedStatus(ds)
                const isSelected = type === 'start' ? ds === startDate : ds === endDate
                const isToday = ds === todayStr
                const beforeStartDate = type === 'end' && startDate && (() => {
                  const start = new Date(startDate)
                  start.setHours(0, 0, 0, 0)
                  return currentDate < start
                })()

                let bg = 'transparent'
                let color = 'var(--text-1)'
                let opacity = 1
                let cursor = 'pointer'
                let borderRadius = '12px'

                if (past || beforeStartDate) {
                  opacity = 0.25; cursor = 'not-allowed'; color = 'var(--text-3)'
                } else if (blocked) {
                  bg = blockedSt === 'APPROVED' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.15)'
                  color = blockedSt === 'APPROVED' ? 'var(--red)' : 'var(--yellow)'
                  cursor = 'not-allowed'
                } else if (isSelected) {
                  bg = 'var(--violet)'; color = '#fff'
                }

                return (
                  <div key={ds}
                    onClick={() => handleDayClick(ds)}
                    style={{ cursor, opacity, borderRadius, background: bg, color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 48, fontSize: 14, fontWeight: isSelected ? 700 : isToday ? 700 : 400,
                      outline: isToday && !isSelected ? '2px solid var(--violet-border)' : 'none',
                      outlineOffset: '-2px', position: 'relative',
                    }}>
                    {blocked && (
                      <span style={{ position: 'absolute', bottom: 4, fontSize: 6, lineHeight: 1, color: blockedSt === 'APPROVED' ? 'var(--red)' : 'var(--yellow)' }}>
                        ●
                      </span>
                    )}
                    {ds.slice(-2).replace(/^0/, '')}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 pb-3 flex-wrap mt-3">
              {[
                { color: 'var(--violet)', label: 'Selected' },
                { color: 'rgba(239,68,68,0.18)', textColor: 'var(--red)', label: 'Approved leave' },
                { color: 'rgba(245,158,11,0.15)', textColor: 'var(--yellow)', label: 'Pending leave' },
              ].map(({ color, textColor, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: 10, color: textColor ?? 'var(--text-3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export function StaffLeave() {
  usePageTitle('Leave')
  const qc = useQueryClient()
  const [form, setForm] = useState({ leave_type: 'SICK', start_date: '', end_date: '', reason: '' })
  const [filter, setFilter] = useState<string>('ALL')
  const [showApplyModal, setShowApplyModal] = useState(false)

  const { data: leaves = [], isLoading } = useQuery<LeaveItem[]>({
    queryKey: ['staff-leave'],
    queryFn: async () => { const r = await api.get('/staff/leave'); return r.data.data },
  })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/staff/leave', form),
    onSuccess: () => {
      toast.success('Leave request submitted!')
      qc.invalidateQueries({ queryKey: ['staff-leave'] })
      qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
      setForm({ leave_type: 'SICK', start_date: '', end_date: '', reason: '' })
      setShowApplyModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Submit failed'),
  })

  const handleModalClose = () => {
    setForm({ leave_type: 'SICK', start_date: '', end_date: '', reason: '' })
    setShowApplyModal(false)
  }

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/leave/${id}`),
    onSuccess: () => { toast.success('Leave cancelled'); qc.invalidateQueries({ queryKey: ['staff-leave'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cancel failed'),
  })

  const counts = { ALL: leaves.length, APPROVED: 0, PENDING: 0, REJECTED: 0 }
  leaves.forEach(l => { if (l.status in counts) (counts as any)[l.status]++ })
  const filtered = filter === 'ALL' ? leaves : leaves.filter(l => l.status === filter)

  const numDays = form.start_date && form.end_date && new Date(form.end_date) >= new Date(form.start_date)
    ? daysBetween(form.start_date, form.end_date) : 0

  // Dates already covered by approved/pending leaves — these cannot be re-requested
  const blockedRanges = leaves
    .filter(l => l.status !== 'REJECTED')
    .map(l => ({ start: l.start_date, end: l.end_date, status: l.status }))

  const isDateBlocked = (dateStr: string) =>
    blockedRanges.some(r => dateStr >= r.start && dateStr <= r.end)

  // Check if the current form date range overlaps any blocked range
  const formOverlapsExisting = !!(form.start_date && form.end_date &&
    blockedRanges.some(r => form.start_date <= r.end && form.end_date >= r.start))

  const FILTER_TABS = [
    { key: 'ALL',      label: 'ALL',      count: counts.ALL,      color: 'var(--text-1)' },
    { key: 'PENDING',  label: 'PENDING',  count: counts.PENDING,  color: 'var(--yellow)' },
    { key: 'APPROVED', label: 'APPROVED', count: counts.APPROVED, color: 'var(--green)' },
    { key: 'REJECTED', label: 'REJECTED', count: counts.REJECTED, color: 'var(--red)' },
  ]

  return (
    <div className="p-4 sm:p-5 pb-10 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="font-syne font-bold text-[22px] sm:text-[24px]" style={{ color: 'var(--text-1)' }}>Leave</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-3)' }}>Manage your leave requests and track their status</p>
      </div>

      {/* Filter chips - horizontal on desktop, 2x2 grid on mobile */}
      <div className="sm:overflow-x-auto scrollbar-none -mx-1 px-1">
        <div className="grid grid-cols-2 sm:flex gap-2 sm:min-w-max">
          {FILTER_TABS.map(tab => (
            <motion.button key={tab.key} whileTap={{ scale: 0.96 }} onClick={() => setFilter(tab.key)}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full font-syne font-bold text-[12px] transition-all flex-shrink-0 min-h-[44px]"
              style={{
                background: filter === tab.key ? 'var(--violet-bg)' : 'var(--bg-surface)',
                color: filter === tab.key ? 'var(--violet-light)' : 'var(--text-3)',
                border: `1px solid ${filter === tab.key ? 'var(--violet-border)' : 'var(--border)'}`,
                boxShadow: filter === tab.key ? '0 0 14px rgba(124,58,237,0.3)' : 'none',
              }}>
              <span style={{ color: filter === tab.key ? 'var(--violet-light)' : tab.color }}>{tab.label}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: filter === tab.key ? 'var(--violet)' : 'var(--border)', color: filter === tab.key ? '#fff' : 'var(--text-3)' }}>
                {tab.count}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Apply Leave button - full-width on mobile, top-right on desktop */}
      <div className="flex sm:hidden">
        <button className="q-btn-primary w-full h-12 flex items-center justify-center gap-2 text-[13px] rounded-[12px]"
          onClick={() => setShowApplyModal(true)}>
          <Plus size={14} /> Apply Leave
        </button>
      </div>

      {/* Desktop Apply Leave button - top-right */}
      <div className="hidden sm:flex justify-end">
        <button className="q-btn-primary h-10 px-5 items-center gap-2 text-[13px]"
          onClick={() => setShowApplyModal(true)}>
          <Plus size={14} /> Apply Leave
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Leave Requests */}
        <p className="font-syne font-bold text-[15px] mb-4" style={{ color: 'var(--text-1)' }}>Leave Requests</p>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Sk key={i} h={96} />)}</div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="q-card py-14 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--violet-bg)' }}>
                <Calendar size={28} style={{ color: 'var(--violet-light)' }} />
              </div>
              <p className="font-syne font-bold text-[15px] mb-1" style={{ color: 'var(--text-1)' }}>
                No {filter === 'ALL' ? '' : filter.toLowerCase()} requests
              </p>
              <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                {filter === 'ALL' ? 'Apply for leave using the form' : `No ${filter.toLowerCase()} requests found`}
              </p>
            </motion.div>
          ) : (
            <div className="relative">
              {/* Timeline connector */}
              <div className="absolute left-5 top-6 bottom-6 w-px" style={{ background: 'var(--border)' }} />
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((l, i) => {
                    const sc   = STATUS_PILL[l.status] ?? STATUS_PILL.PENDING
                    const lt   = LEAVE_TYPE_CFG[l.leave_type] ?? { icon: '📋', color: 'var(--text-3)', label: l.leave_type }
                    const days = daysBetween(l.start_date, l.end_date)
                    return (
                      <motion.div key={l.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -14 }} transition={{ delay: i * 0.04 }} className="flex gap-3">
                        {/* Status dot */}
                        <div className="relative flex-shrink-0 z-10">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: sc.bg, border: `2px solid ${sc.color}`, color: sc.color }}>
                            {l.status === 'APPROVED' ? <Check size={14} /> : l.status === 'REJECTED' ? <X size={14} /> : <Clock size={14} />}
                          </div>
                        </div>
                        {/* Card */}
                        <motion.div
                          whileHover={{
                            y: -2,
                            boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
                          }}
                          className="flex-1 q-card p-4 transition-all"
                          style={{
                            borderLeftWidth: 3,
                            borderLeftColor: STATUS_BORDER[l.status] ?? 'var(--border)',
                          }}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                                style={{
                                  background: sc.bg,
                                  color: sc.color,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: sc.color }}
                                />
                                {l.status}
                              </span>

                              <span
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                                style={{
                                  background: 'var(--bg-surface)',
                                  color: lt.color,
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {lt.icon} {lt.label}
                              </span>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p
                                className="text-[9px] uppercase tracking-wider font-bold"
                                style={{ color: 'var(--text-4)' }}
                              >
                                {l.status === 'PENDING'
                                  ? 'Submitted On'
                                  : l.status === 'APPROVED'
                                  ? 'Approved On'
                                  : 'Reviewed On'}
                              </p>

                              <p
                                className="text-[11px] font-semibold mt-0.5"
                                style={{ color: 'var(--text-2)' }}
                              >
                                {fmtDate(l.approved_at ?? l.created_at)}
                              </p>
                            </div>
                          </div>

                          {/* Date Row */}
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar
                              size={12}
                              style={{
                                color: 'var(--text-3)',
                                flexShrink: 0,
                              }}
                            />

                            <p
                              className="font-syne font-bold text-[13px]"
                              style={{ color: 'var(--text-1)' }}
                            >
                              {fmtDate(l.start_date)}
                              {l.start_date !== l.end_date &&
                                ` – ${fmtDate(l.end_date)}`}
                            </p>

                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{
                                background: 'var(--bg-surface)',
                                color: 'var(--text-3)',
                              }}
                            >
                              {days} day{days > 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Leave Reason */}
                          <div
                            className="mb-3 p-3 rounded-[10px]"
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <p
                              className="text-[9px] uppercase tracking-wider font-bold mb-1"
                              style={{ color: 'var(--text-4)' }}
                            >
                              Leave Reason
                            </p>

                            <p
                              className="text-[12px] leading-relaxed"
                              style={{ color: 'var(--text-2)' }}
                            >
                              {l.reason}
                            </p>
                          </div>

                          {/* Owner Response */}
                          {l.status === 'REJECTED' && l.rejection_reason && (
                            <div
                              className="p-3 rounded-[10px]"
                              style={{
                                background: 'var(--red-bg)',
                                border: '1px solid rgba(239,68,68,0.15)',
                              }}
                            >
                              <p
                                className="text-[9px] uppercase tracking-wider font-bold mb-1"
                                style={{ color: 'var(--red)' }}
                              >
                                Owner Response
                              </p>

                              <p
                                className="text-[12px]"
                                style={{ color: 'var(--red)' }}
                              >
                                {l.rejection_reason}
                              </p>
                            </div>
                          )}

                          {l.status === 'APPROVED' && (
                            <div
                              className="p-3 rounded-[10px]"
                              style={{
                                background: 'var(--green-bg)',
                                border: '1px solid rgba(16,185,129,0.15)',
                              }}
                            >
                              <p
                                className="text-[9px] uppercase tracking-wider font-bold mb-1"
                                style={{ color: 'var(--green)' }}
                              >
                                Owner Response
                              </p>

                              <p
                                className="text-[12px]"
                                style={{ color: 'var(--green)' }}
                              >
                                Your leave request has been approved.
                              </p>
                            </div>
                          )}

                          {/* Pending Action */}
                          {l.status === 'PENDING' && (
                            <div className="flex justify-end mt-3">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => cancelMutation.mutate(l.id)}
                                disabled={cancelMutation.isPending}
                                className="h-8 px-3 rounded-[8px] text-[11px] font-bold"
                                style={{
                                  background: 'var(--red-bg)',
                                  color: 'var(--red)',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel Request
                              </motion.button>
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
              {filtered.length >= 5 && (
                <button className="w-full q-btn-ghost h-9 flex items-center justify-center gap-2 text-[12px] mt-3">
                  Load more <ChevronDown size={13} />
                </button>
              )}
            </div>
          )}
      </div>

      <AnimatePresence>
        {showApplyModal && (
          <ApplyLeaveModal
            form={form}
            setForm={setForm}
            blockedRanges={blockedRanges}
            numDays={numDays}
            formOverlapsExisting={formOverlapsExisting}
            applyMutation={applyMutation}
            onClose={handleModalClose}
          />
        )}
      </AnimatePresence>

      {/* Mobile FAB */}
      {/* <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowApplyModal(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center z-40 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, var(--violet), #6366f1)',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
        }}
      >
        <Plus size={24} />
      </motion.button> */}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  HOLIDAYS PAGE
// ════════════════════════════════════════════════════════════════════════════
interface HolidayItem {
  id: string; holiday_name: string; description: string | null
  start_date: string; end_date: string; applies_to_all_staff: boolean; created_at: string
}

const HOLIDAY_EMOJIS: Record<string, string> = {
  republic: '🇮🇳', independence: '🇮🇳', gandhi: '🕊️', diwali: '🪔',
  christmas: '🎄', 'new year': '🎉', holi: '🎨', eid: '🌙',
  labour: '⭐', mahavir: '🪷', raksha: '🎁', dussehra: '⚔️', makar: '🌞',
}
function getHolidayEmoji(name: string) {
  const l = name.toLowerCase()
  const match = Object.entries(HOLIDAY_EMOJIS).find(([k]) => l.includes(k))
  return match ? match[1] : '🗓️'
}
function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff} Days Left`
}

export function StaffHolidays() {
  usePageTitle('Holidays')
  const [selectedPastDate, setSelectedPastDate] = useState<string | null>(null)
  const [showCalendarModal, setShowCalendarModal] = useState(false)

  const { data: holidays = [], isLoading } = useQuery<HolidayItem[]>({
    queryKey: ['staff-holidays'],
    queryFn: async () => { const r = await api.get('/staff/holiday'); return r.data.data },
  })

  const now = new Date()
  const upcoming = holidays.filter(h => new Date(h.end_date) >= now).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  const past = holidays.filter(h => new Date(h.end_date) < now).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

  const filteredPast = selectedPastDate
    ? past.filter(h => {
        const hDate = new Date(h.start_date)
        const selDate = new Date(selectedPastDate)
        return hDate.toDateString() === selDate.toDateString()
      })
    : past

  if (isLoading) {
    return (
      <div className="p-4 sm:p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">{[1,2,3].map(i => <Sk key={i} h={80} />)}</div>
          <div className="space-y-3">{[1,2,3].map(i => <Sk key={i} h={80} />)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-5 pb-10">
      {/* Header */}
      <h1 className="font-syne font-black text-[24px] sm:text-[28px] mb-6" style={{ color: 'var(--text-1)' }}>
        Holidays
      </h1>

      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6" style={{ minHeight: '600px' }}>
        {/* Left: Upcoming Holidays */}
        <div className="flex flex-col" style={{ height: '600px' }}>
          <h2 className="font-syne font-bold text-[16px] mb-4" style={{ color: 'var(--text-1)' }}>
            Next Upcoming Holiday
          </h2>
          {upcoming.length === 0 ? (
            <div className="flex-1 q-card flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl mb-2 block">🎉</span>
                <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>No upcoming holidays</p>
                <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Enjoy your work schedule</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {upcoming.map((h, i) => {
                const sd = new Date(h.start_date)
                const dLeft = daysUntil(h.start_date)
                const emoji = getHolidayEmoji(h.holiday_name)
                return (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }} whileHover={{ y: -2 }}
                    className="q-card p-4 transition-all" style={{ borderColor: 'var(--violet-border)' }}>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{emoji}</span>
                      <div className="flex-1">
                        <p className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>{h.holiday_name}</p>
                        {h.description && <p className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>{h.description}</p>}
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                            <Calendar size={12} />
                            {sd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{
                              background: dLeft === 'Today' || dLeft === 'Tomorrow' ? 'var(--green-bg)' : 'rgba(245,158,11,0.15)',
                              color: dLeft === 'Today' || dLeft === 'Tomorrow' ? 'var(--green)' : 'var(--yellow)',
                            }}>{dLeft}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Past Holidays with Calendar */}
        <div className="flex flex-col" style={{ height: '600px' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>
              Past Bookings
            </h2>
            <button 
              onClick={() => setShowCalendarModal(true)}
              className="q-btn-ghost h-8 px-3 flex items-center gap-2 text-[12px]"
              style={{ color: 'var(--text-2)' }}
            >
              <Calendar size={16} />
              <span>Filter by Date</span>
            </button>
          </div>

          {selectedPastDate && (
            <div className="mb-4 px-4 py-2.5 rounded-lg flex items-center justify-between" style={{ background: 'var(--violet-bg)' }}>
              <p className="text-[12px]" style={{ color: 'var(--violet-light)' }}>
                Filtered: {new Date(selectedPastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <button 
                onClick={() => setSelectedPastDate(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--violet-light)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {filteredPast.length === 0 ? (
            <div className="flex-1 q-card flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl mb-2 block">🎉</span>
                <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>
                  {selectedPastDate ? 'No holidays on selected date' : 'No past holidays'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {filteredPast.map((h, i) => {
                const emoji = getHolidayEmoji(h.holiday_name)
                return (
                  <motion.div key={h.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3 q-card"
                    style={{ borderColor: 'var(--green-border)' }}>
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-syne font-bold text-[13px]" style={{ color: 'var(--text-1)' }}>{h.holiday_name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {new Date(h.start_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--green)' }}>
                      <Check size={11} /> Observed
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden space-y-6">
        {/* Upcoming Holidays - Mobile */}
        <div>
          <h2 className="font-syne font-bold text-[16px] mb-4" style={{ color: 'var(--text-1)' }}>
            Next Upcoming Holiday
          </h2>
          {upcoming.length === 0 ? (
            <div className="q-card py-10 text-center">
              <span className="text-4xl mb-2 block">🎉</span>
              <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>No upcoming holidays</p>
              <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Enjoy your work schedule</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((h, i) => {
                const sd = new Date(h.start_date)
                const dLeft = daysUntil(h.start_date)
                const emoji = getHolidayEmoji(h.holiday_name)
                return (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="q-card p-3 transition-all" style={{ borderColor: 'var(--violet-border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{emoji}</span>
                      <div className="flex-1">
                        <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>{h.holiday_name}</p>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                            <Calendar size={10} />
                            {sd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{
                              background: dLeft === 'Today' || dLeft === 'Tomorrow' ? 'var(--green-bg)' : 'rgba(245,158,11,0.15)',
                              color: dLeft === 'Today' || dLeft === 'Tomorrow' ? 'var(--green)' : 'var(--yellow)',
                            }}>{dLeft}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Past Holidays - Mobile */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>
              Past Bookings
            </h2>
            <button 
              onClick={() => setShowCalendarModal(true)}
              className="q-btn-ghost h-8 px-3 flex items-center gap-2 text-[12px]"
              style={{ color: 'var(--text-2)' }}
            >
              <Calendar size={16} />
              <span>Filter by Date</span>
            </button>
          </div>

          {selectedPastDate && (
            <div className="mb-4 px-4 py-2.5 rounded-lg flex items-center justify-between" style={{ background: 'var(--violet-bg)' }}>
              <p className="text-[12px]" style={{ color: 'var(--violet-light)' }}>
                Filtered: {new Date(selectedPastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <button 
                onClick={() => setSelectedPastDate(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--violet-light)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {filteredPast.length === 0 ? (
            <div className="q-card py-10 text-center">
              <span className="text-4xl mb-2 block">🎉</span>
              <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>
                {selectedPastDate ? 'No holidays on selected date' : 'No past holidays'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPast.map((h, i) => {
                const emoji = getHolidayEmoji(h.holiday_name)
                return (
                  <motion.div key={h.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3 q-card"
                    style={{ borderColor: 'var(--green-border)' }}>
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-syne font-bold text-[13px]" style={{ color: 'var(--text-1)' }}>{h.holiday_name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {new Date(h.start_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--green)' }}>
                      <Check size={11} /> Observed
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Modal */}
      <AnimatePresence>
        {showCalendarModal && (
          <HolidayCalendarModal
            holidays={holidays}
            onSelectDate={(date) => {
              setSelectedPastDate(date)
              setShowCalendarModal(false)
            }}
            onClose={() => setShowCalendarModal(false)}
            maxDate={new Date()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Holiday Calendar Modal Component
function HolidayCalendarModal({ holidays, onSelectDate, onClose, maxDate }: {
  holidays: HolidayItem[]
  onSelectDate: (date: string) => void
  onClose: () => void
  maxDate: Date
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const mStart = startOfMonth(viewDate)
  const mEnd = endOfMonth(viewDate)
  const mDays = eachDayOfInterval({ start: mStart, end: mEnd })
  const fDow = getDay(mStart)

  function getHolidayForDay(ds: string) {
    return holidays.find(h => ds >= h.start_date.slice(0, 10) && ds <= h.end_date.slice(0, 10))
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-[400px] q-card pointer-events-auto p-6"
          style={{ background: 'var(--bg-card)', borderRadius: '20px' }}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(d) }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
              <ChevronLeft size={20} />
            </button>
            <p className="font-syne font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>
              {format(viewDate, 'MMMM yyyy')}
            </p>
            <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()+1); setViewDate(d) }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-3">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-[11px] font-bold py-2" style={{ color: 'var(--text-3)' }}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array(fDow).fill(null).map((_,i) => <div key={`e${i}`} />)}
            {mDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd')
              const hol = getHolidayForDay(ds)
              const isPast = day < new Date(todayStr)
              const isFuture = day > maxDate

              return (
                <button
                  key={ds}
                  onClick={() => {
                    if (isPast && !isFuture) {
                      onSelectDate(ds)
                    }
                  }}
                  disabled={isFuture}
                  className="aspect-square flex flex-col items-center justify-center relative rounded-lg"
                  title={hol ? hol.holiday_name : undefined}
                  style={{
                    background: hol ? 'var(--violet-bg)' : 'var(--bg-surface)',
                    color: hol ? 'var(--violet-light)' : isFuture ? 'var(--text-4)' : 'var(--text-2)',
                    cursor: isPast && !isFuture ? 'pointer' : 'not-allowed',
                    opacity: isFuture ? 0.3 : 1,
                    border: hol ? '1px solid var(--violet-border)' : '1px solid var(--border)',
                  }}>
                  <span className="text-[14px] font-bold">{format(day, 'd')}</span>
                  {hol && (
                    <span className="w-1.5 h-1.5 rounded-full mt-1" style={{ background: 'var(--violet-light)' }} />
                  )}
                </button>
              )
            })}
          </div>

          <button onClick={onClose}
            className="w-full mt-6 py-3 rounded-xl font-bold text-[13px]"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            Close
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  REVIEWS PAGE  — matches reference image 1
// ════════════════════════════════════════════════════════════════════════════
export function StaffReviews() {
  usePageTitle('Reviews')
  const [ratingFilter, setRatingFilter] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const { data, isLoading, isFetching } = useQuery<any>({
    queryKey: ['staff-reviews', ratingFilter, page],
    queryFn: async () => {
      const params: any = { page, limit: 10 }
      if (ratingFilter) params.rating = ratingFilter
      const r = await api.get('/staff/reviews', { params })
      return r.data.data
    },
    staleTime: 0,
    placeholderData: (prev: any) => prev,
  })

  // Infinite scroll
  const loaderRef = useIntersectionObserver(useCallback(() => {
    const totalPages = data?.pagination?.total_pages ?? 1
    if (totalPages > page && !isFetching && !isLoading) {
      setPage(p => p + 1)
    }
  }, [data, page, isFetching, isLoading]))

  // Reset page when filter changes
  const prevRatingFilterRef = useRef(ratingFilter)
  if (prevRatingFilterRef.current !== ratingFilter) {
    setPage(1)
    prevRatingFilterRef.current = ratingFilter
  }

  const reviews: any[] = data?.reviews ?? []
  const summary        = data?.summary
  const totalPages     = data?.pagination?.total_pages ?? 1

  const toggleComment = (id: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const FILTER_TABS = [
    { val: undefined, label: 'All',    count: summary?.total_reviews },
    { val: 5,         label: '5★',     count: summary?.rating_5 },
    { val: 4,         label: '4★',     count: summary?.rating_4 },
    { val: 3,         label: '3★',     count: summary?.rating_3 },
    { val: 2,         label: '2★',     count: summary?.rating_2 },
    { val: 1,         label: '1★',     count: summary?.rating_1 },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6">
          <h1 className="font-syne font-black text-[28px]" style={{ color: 'var(--text-1)' }}>Reviews</h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
            See what your customers are saying about your services
          </p>
        </motion.div>

        {/* Rating Summary */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[24px] font-black" style={{ color: '#f59e0b' }}>
            {summary?.average_rating?.toFixed(1)}
          </span>
          <div className="flex">
            {Array(5).fill(0).map((_, i) => (
              <span key={i} style={{ color: i < Math.round(summary?.average_rating || 0) ? '#f59e0b' : 'var(--border-2)', fontSize: 20 }}>★</span>
            ))}
          </div>
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
            ({summary?.total_reviews} reviews)
          </span>
        </div>

        {/* Rating Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
          {FILTER_TABS.map(tab => (
            <motion.button key={tab.val ?? 'all'} whileTap={{ scale: 0.96 }}
              onClick={() => { setRatingFilter(tab.val); setPage(1) }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-syne font-bold flex-shrink-0"
              style={{
                background: ratingFilter === tab.val ? 'var(--violet)' : 'var(--bg-surface)',
                color: ratingFilter === tab.val ? '#fff' : 'var(--text-2)',
                border: `1px solid ${ratingFilter === tab.val ? 'var(--violet)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Reviews */}
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => <Sk key={i} h={200} />)}
          </div>
        ) : reviews.length === 0 ? (
          <div className="q-card py-16 text-center">
            <div className="text-[52px] mb-4">⭐</div>
            <p className="font-syne font-bold text-[16px] mb-1" style={{ color: 'var(--text-1)' }}>No reviews yet</p>
            <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Reviews from customers will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r: any, i: number) => (
              <motion.div key={r.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-[14px] overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="p-3 space-y-2.5">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.customer.name} src={r.customer.avatar_url} size="md" />
                      <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>{r.customer.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1">
                        {Array(5).fill(0).map((_: any, i: number) => (
                          <span key={i} style={{ color: i < r.rating ? '#f59e0b' : 'var(--border-2)', fontSize: 14 }}>★</span>
                        ))}
                        <span className="text-[13px] font-syne font-bold" style={{ color: '#f59e0b' }}>
                          {r.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{fmtDate(r.created_at)}</p>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="space-y-1.5">
                    {/* Services Row */}
                    {r.booking?.services?.length > 0 && (
                      <div className="flex items-start gap-2">
                        <div className="flex items-center gap-1.5" style={{ width: 75 }}>
                          <Scissors size={13} style={{ color: 'var(--text-3)', marginTop: 1.5 }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-3)', marginTop: 1.5 }}>Services:-</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {r.booking.services.map((s: any, i: number) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-syne font-bold"
                              style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                              {s.image && (
                                <img src={s.image} alt="" className="w-3 h-3 rounded object-cover" />
                              )}
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  {r.comment && (
                    <div>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                        {expandedComments.has(r.id) ? r.comment : r.comment.slice(0, 200) + (r.comment.length > 200 ? '...' : '')}
                      </p>
                      {r.comment.length > 200 && (
                        <button onClick={() => toggleComment(r.id)} className="text-[11px] font-syne font-bold mt-1"
                          style={{ color: 'var(--violet-light)', cursor: 'pointer' }}>
                          {expandedComments.has(r.id) ? 'Read Less' : 'Read More'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Review Images */}
                  {r.images?.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {r.images.map((img: string, i: number) => (
                        <img key={i} src={img} alt="" onClick={() => setLightboxImage(img)}
                          className="w-16 h-16 rounded-[6px] object-cover flex-shrink-0 cursor-pointer"
                          style={{ border: '1px solid var(--border)' }} />
                      ))}
                    </div>
                  )}

                  {/* Business Response */}
                  {r.business_response && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="p-2.5 rounded-[8px]" style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                        <p className="text-[11px] font-syne font-bold mb-1" style={{ color: 'var(--violet-light)' }}>Business Replied</p>
                        <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>{r.business_response}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.9)' }} />
            <img src={lightboxImage} alt="" className="relative max-w-full max-h-full object-contain rounded-lg" />
            <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        )}

        {/* Infinite scroll loader */}
        <div ref={loaderRef} className="py-4" />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS PAGE
// ════════════════════════════════════════════════════════════════════════════
export function StaffNotifications() {
  usePageTitle('Notifications')
  return (
    <NotificationsPage
      role="staff"
      title="Notifications"
      description="Queue updates, leave decisions & booking alerts"
    />
  )
}

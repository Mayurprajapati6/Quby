import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, CalendarDays, Clock, Loader2, Building2, ChevronDown } from 'lucide-react'
import { EmptyState, Skeleton, StatusBadge } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { useSocketEvent, usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

const TABS: { key: FilterStatus; label: string; color: string }[] = [
  { key: 'PENDING',  label: 'Pending',  color: 'var(--yellow)' },
  { key: 'APPROVED', label: 'Approved', color: 'var(--green)' },
  { key: 'REJECTED', label: 'Rejected', color: 'var(--red)' },
]

const LEAVE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  SICK:      { bg: 'var(--red-bg)',   color: 'var(--red)' },
  CASUAL:    { bg: 'var(--blue-bg)',  color: 'var(--blue)' },
  EMERGENCY: { bg: 'rgba(245,158,11,0.12)', color: 'var(--yellow)' },
  OTHER:     { bg: 'var(--bg-surface)', color: 'var(--text-3)' },
}

// ── Reject Modal ──────────────────────────────────────────────────
function RejectModal({ leaveId, onClose, onDone }: { leaveId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')

  const rejectMut = useMutation({
    mutationFn: () => api.patch(`/owner/leave/${leaveId}`, { action: 'REJECTED', rejection_reason: reason }),
    onSuccess: () => { toast.success('Leave request rejected.'); onDone(); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm q-card z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: 'var(--red-bg)' }}>
              <X size={15} style={{ color: 'var(--red)' }} />
            </div>
            <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Reject Leave</h3>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-[7px] flex items-center justify-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>

        <div>
          <label className="q-label">Reason for rejection *</label>
          <textarea className="q-input" rows={3} placeholder="Provide a reason for the staff…"
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="q-btn-ghost flex-1 h-9 text-[12px]">Cancel</button>
          <motion.button whileTap={{ scale: 0.97 }} type="button"
            onClick={() => rejectMut.mutate()}
            disabled={rejectMut.isPending || !reason.trim()}
            className="flex-1 h-9 rounded-[9px] flex items-center justify-center gap-2 text-[12px] font-syne font-bold disabled:opacity-50"
            style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {rejectMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            Reject
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Leave Card ────────────────────────────────────────────────────
function LeaveCard({ leave, onApprove, onReject }: { leave: any; onApprove: () => void; onReject: () => void }) {
  const typeConfig = LEAVE_TYPE_COLORS[leave.leave_type] ?? LEAVE_TYPE_COLORS.OTHER
  const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / 86_400_000) + 1

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="q-card" style={{ border: '1px solid var(--border)' }}>
      {/* Header with staff info and date */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar name={leave.staff_name} src={leave.staff_avatar} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-syne font-bold text-[14px] truncate" style={{ color: 'var(--text-1)' }}>{leave.staff_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>from:</span>
              <Avatar name={leave.business_name} src={leave.business_logo} size="xs" />
              <span className="text-[11px] truncate" style={{ color: 'var(--text-2)' }}>{leave.business_name}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
          <span className="px-2 py-1 rounded-[7px] text-[9px] font-syne font-bold"
            style={{ background: typeConfig.bg, color: typeConfig.color }}>
            {leave.leave_type}
          </span>
          {leave.approved_at && (
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
              {formatDate(leave.approved_at)}
            </span>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-[8px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-[9px] font-syne uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>From</p>
          <p className="font-syne font-bold text-[11px] mt-0.5" style={{ color: 'var(--text-1)' }}>{formatDate(leave.start_date, 'dd MMM')}</p>
        </div>
        <div className="p-2 rounded-[8px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-[9px] font-syne uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>To</p>
          <p className="font-syne font-bold text-[11px] mt-0.5" style={{ color: 'var(--text-1)' }}>{formatDate(leave.end_date, 'dd MMM')}</p>
        </div>
        <div className="p-2 rounded-[8px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-[9px] font-syne uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Days</p>
          <p className="font-syne font-bold text-[11px] mt-0.5" style={{ color: 'var(--text-1)' }}>{days}</p>
        </div>
      </div>

      {/* Reason */}
      {leave.reason && (
        <div
          className="mb-3 p-3 rounded-[10px]"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <p
            className="text-[9px] uppercase font-syne font-bold mb-1"
            style={{ color: 'var(--text-4)' }}
          >
            Leave Reason
          </p>

          <p
            className="text-[12px]"
            style={{ color: 'var(--text-2)' }}
          >
            {leave.reason}
          </p>
        </div>
      )}

      {/* Rejection reason */}
      {leave.rejection_reason && (
        <p className="text-[11px] mb-3 p-2.5 rounded-[8px]"
          style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
          Rejected: {leave.rejection_reason}
        </p>
      )}

      {/* Actions */}
      {leave.status === 'PENDING' && (
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onApprove}
            className="flex-1 h-9 rounded-[9px] flex items-center justify-center gap-2 text-[12px] font-syne font-bold"
            style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)', cursor: 'pointer' }}>
            <Check size={13} /> Approve
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onReject}
            className="flex-1 h-9 rounded-[9px] flex items-center justify-center gap-2 text-[12px] font-syne font-bold"
            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
            <X size={13} /> Reject
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function OwnerLeave() {
  usePageTitle('Leave Requests')
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterStatus>('PENDING')
  const [bizFilter, setBizFilter] = useState('')
  const [showBizModal, setShowBizModal] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['owner-leaves', filter, bizFilter],
    queryFn: async () => {
      const res = await api.get('/owner/leave', { params: { status: filter, business_id: bizFilter || undefined } })
      return res.data.data as any[]
    },
    staleTime: 30_000,
  })

  const { data: bizList } = useQuery({
    queryKey: ['owner-businesses-simple'],
    queryFn: async () => {
      const r = await api.get('/owner/businesses', { params: { limit: 100 } })
      return (r.data.data?.businesses ?? []) as {
  id: string
  business_name: string
  logo_url?: string | null
}[]
    },
    staleTime: 10 * 60_000,
  })

  useSocketEvent('staff:leave_requested', () => {
    qc.invalidateQueries({ queryKey: ['owner-leaves'] })
    toast.info('New leave request received.', { icon: '📋' })
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/owner/leave/${id}`, { action: 'APPROVED' }),
    onSuccess: () => { toast.success('Leave approved!'); qc.invalidateQueries({ queryKey: ['owner-leaves'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const selectedBizName = bizList?.find(b => b.id === bizFilter)?.business_name
  const pendingCount = filter === 'PENDING' ? (leaves?.length ?? 0) : undefined

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8 space-y-4">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <h1 className="font-syne font-black text-[22px]" style={{ color: 'var(--text-1)' }}>Leave Requests</h1>
          {pendingCount !== undefined && pendingCount > 0 && (
            <p className="text-[11px]" style={{ color: 'var(--yellow)' }}>{pendingCount} pending approval</p>
          )}
        </div>
        {/* Business filter */}
        <button type="button" onClick={() => setShowBizModal(true)}
          className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[11px] font-syne font-bold self-start sm:self-auto"
          style={{
            background: bizFilter ? 'var(--violet-bg)' : 'var(--bg-surface)',
            color: bizFilter ? 'var(--violet-light)' : 'var(--text-2)',
            border: `1px solid ${bizFilter ? 'var(--violet-border)' : 'var(--border)'}`,
            cursor: 'pointer',
          }}>
          <Building2 size={12} />
          {selectedBizName ? selectedBizName.slice(0, 14) : 'All Businesses'}
          <ChevronDown size={10} />
        </button>
      </motion.div>

      {/* Tabs */}
      <div className="flex p-0.5 rounded-[9px] w-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setFilter(t.key)}
            className="flex-1 py-1.5 rounded-[8px] text-[11px] font-syne font-bold"
            style={{
              background: filter === t.key ? 'var(--violet-bg)' : 'transparent',
              color: filter === t.key ? 'var(--violet-light)' : 'var(--text-2)',
              border: `1px solid ${filter === t.key ? 'var(--violet-border)' : 'transparent'}`,
              cursor: 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} height="200px" className="rounded-[14px]" />)}
        </div>
      ) : (leaves ?? []).length === 0 ? (
        <EmptyState icon={<CalendarDays size={28} />}
          title={`No ${filter.toLowerCase()} leaves`}
          description={filter === 'PENDING' ? 'No pending leave requests. ✓' : 'No leave requests in this category.'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(leaves ?? []).map((l: any, i: number) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}>
              <LeaveCard leave={l}
                onApprove={() => approveMut.mutate(l.id)}
                onReject={() => setRejectId(l.id)} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showBizModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowBizModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-sm q-card z-10 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Filter by Business</h3>
                <button type="button" onClick={() => setShowBizModal(false)}
                  className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
              {[{ id: '', business_name: 'All Businesses' }, ...(bizList ?? [])].map(b => (
                <button key={b.id} type="button"
                  onClick={() => { setBizFilter(b.id); setShowBizModal(false) }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-[9px] text-left mb-1"
                  style={{
                    background: bizFilter === b.id ? 'var(--violet-bg)' : 'transparent',
                    border: `1px solid ${bizFilter === b.id ? 'var(--violet-border)' : 'transparent'}`,
                    cursor: 'pointer',
                  }}>
                  <div className="flex items-center gap-2">
  {b.id === '' ? (
    <Building2 size={13} />
  ) : (
    <Avatar
  name={b.business_name}
  src={b.logo_url || undefined}
  size="xs"
/>
  )}

  <span
    className="font-syne font-bold text-[12px]"
    style={{
      color:
        bizFilter === b.id
          ? 'var(--violet-light)'
          : 'var(--text-1)',
    }}
  >
    {b.business_name}
  </span>
</div>
                </button>
              ))}
            </motion.div>
          </div>
        )}
        {rejectId && (
          <RejectModal leaveId={rejectId} onClose={() => setRejectId(null)}
            onDone={() => qc.invalidateQueries({ queryKey: ['owner-leaves'] })} />
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

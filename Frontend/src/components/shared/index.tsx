import { cn, getStatusConfig, formatINRDirect } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'

// ── StatusBadge ───────────────────────────────────────────────────
interface StatusBadgeProps {
  status: string
  className?: string
}
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status)
  return (
    <span className={cn('q-badge', config.className, className)}>
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: config.dot }} />
      {config.label}
    </span>
  )
}

// ── StatCard ──────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  currency?: boolean
  className?: string
}
export function StatCard({ label, value, sub, icon, currency, className }: StatCardProps) {
  return (
    <div className={cn('q-surface rounded-[9px] p-3', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-syne font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            {label}
          </p>
          <p className="mt-1 text-xl font-syne font-bold leading-none" style={{ color: 'var(--text-1)' }}>
            {currency ? formatINRDirect(typeof value === 'number' ? value : parseFloat(String(value))) : value}
          </p>
          {sub && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-2 rounded-[8px]" style={{ background: 'var(--violet-bg)' }}>
            <span style={{ color: 'var(--violet-light)' }}>{icon}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}
export function Skeleton({ className, height = '14px', width = '100%' }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ height, width, borderRadius: 8 }}
    />
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('q-card space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton width="40px" height="40px" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="12px" width="60%" />
          <Skeleton height="10px" width="40%" />
        </div>
      </div>
      <Skeleton height="10px" />
      <Skeleton height="10px" width="80%" />
    </div>
  )
}

export function ListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="space-y-2">
        <Skeleton height="20px" width="200px" />
        <Skeleton height="12px" width="120px" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="q-surface rounded-[9px] p-3 space-y-2">
            <Skeleton height="10px" width="60%" />
            <Skeleton height="20px" width="80%" />
          </div>
        ))}
      </div>
      <ListSkeleton count={3} />
    </div>
  )
}

// ── PaginationBar ─────────────────────────────────────────────────
interface PaginationBarProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}
export function PaginationBar({ page, totalPages, onPageChange, className }: PaginationBarProps) {
  if (totalPages <= 1) return null

  return (
    <div className={cn('flex items-center justify-center gap-2 mt-4', className)}>
      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="w-8 h-8 flex items-center justify-center rounded-[7px] transition-all disabled:opacity-30"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
      >
        <ChevronLeft size={14} />
      </motion.button>

      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
          let pageNum: number
          if (totalPages <= 5) {
            pageNum = i + 1
          } else if (page <= 3) {
            pageNum = i + 1
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i
          } else {
            pageNum = page - 2 + i
          }

          return (
            <motion.button
              key={pageNum}
              whileTap={{ scale: 0.92 }}
              onClick={() => onPageChange(pageNum)}
              className="w-8 h-8 flex items-center justify-center rounded-[7px] text-[12px] font-syne font-bold transition-all"
              style={{
                background: pageNum === page ? 'var(--violet-bg)' : 'var(--bg-surface)',
                border: `1px solid ${pageNum === page ? 'var(--violet-border)' : 'var(--border)'}`,
                color: pageNum === page ? 'var(--violet-light)' : 'var(--text-2)',
              }}
            >
              {pageNum}
            </motion.button>
          )
        })}
      </div>

      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="w-8 h-8 flex items-center justify-center rounded-[7px] transition-all disabled:opacity-30"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
      >
        <ChevronRight size={14} />
      </motion.button>
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}
export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, loading, onConfirm, onCancel, children,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-sm q-card p-5 z-10"
          >
            <div className="flex items-start gap-3 mb-4">
              {danger && (
                <div className="p-2 rounded-[8px]" style={{ background: 'var(--red-bg)' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
                </div>
              )}
              <div>
                <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>
                  {title}
                </h3>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-2)' }}>
                  {description}
                </p>
              </div>
            </div>

            {children && <div className="mb-4">{children}</div>}

            <div className="flex gap-3 mt-4">
              <button type="button"
                onClick={onCancel}
                className="flex-1 q-btn-ghost text-[12px] py-2"
                disabled={loading}
              >
                {cancelLabel}
              </button>
              <button type="button"
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'flex-1 font-syne font-bold text-[12px] py-2 rounded-[9px] border-none cursor-pointer flex items-center justify-center gap-2',
                  danger
                    ? 'q-btn-danger'
                    : 'q-btn-primary',
                )}
              >
                {loading && <Loader2 size={12} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── EmptyState ────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center px-4', className)}>
      {icon && (
        <div className="mb-4 p-4 rounded-full" style={{ background: 'var(--violet-bg)' }}>
          <span style={{ color: 'var(--violet-light)' }}>{icon}</span>
        </div>
      )}
      <h3 className="font-syne font-bold text-[15px] mb-2" style={{ color: 'var(--text-1)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-[12px] max-w-xs mb-4" style={{ color: 'var(--text-3)' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

// ── LoadingSpinner ─────────────────────────────────────────────────
export function LoadingSpinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <Loader2
      size={size}
      className={cn('animate-spin', className)}
      style={{ color: 'var(--violet-light)' }}
    />
  )
}

// ── SearchInput ────────────────────────────────────────────────────
import { Search, X } from 'lucide-react'
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}
export function SearchInput({ value, onChange, placeholder = 'Search…', className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-3)' }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="q-input pl-9 pr-8"
      />
      {value && (
        <button type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)' }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ── StarRating ─────────────────────────────────────────────────────
interface StarRatingProps {
  value: number
  onChange?: (v: number) => void
  size?: number
  readonly?: boolean
}
export function StarRating({ value, onChange, size = 18, readonly }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          style={{ fontSize: size, color: (hovered || value) >= star ? '#f59e0b' : 'var(--border-2)', cursor: readonly ? 'default' : 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── RatingDisplay ──────────────────────────────────────────────────
export function RatingDisplay({ rating, count, size = 12 }: { rating: number; count?: number; size?: number }) {
  return (
    <span className="flex items-center gap-1" style={{ fontSize: size }}>
      <span style={{ color: '#f59e0b' }}>★</span>
      <span className="font-syne font-bold" style={{ color: 'var(--text-1)' }}>
        {rating.toFixed(1)}
      </span>
      {count !== undefined && (
        <span style={{ color: 'var(--text-3)' }}>({count})</span>
      )}
    </span>
  )
}

// ── StateCitySelect ────────────────────────────────────────────────
import { INDIA_STATES, getCitiesForState } from '@/data/india'
import { useEffect } from 'react'

interface StateCitySelectProps {
  stateValue: string
  cityValue: string
  onStateChange: (v: string) => void
  onCityChange: (v: string) => void
  disabled?: boolean
}
export function StateCitySelect({ stateValue, cityValue, onStateChange, onCityChange, disabled }: StateCitySelectProps) {
  const cities = getCitiesForState(stateValue)

  useEffect(() => {
    if (stateValue) onCityChange('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateValue])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="q-label">State</label>
        <select
          value={stateValue}
          onChange={(e) => onStateChange(e.target.value)}
          disabled={disabled}
          className="q-input"
        >
          <option value="">Select state</option>
          {INDIA_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="q-label">City</label>
        <select
          value={cityValue}
          onChange={(e) => onCityChange(e.target.value)}
          disabled={disabled || !stateValue}
          className="q-input"
        >
          <option value="">{stateValue ? 'Select city' : 'Select state first'}</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── SectionHeader ──────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}
export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div>
        <h2 className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>{title}</h2>
        {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── AmountDisplay ──────────────────────────────────────────────────
export function AmountDisplay({ paise, className }: { paise: number; className?: string }) {
  return (
    <span className={cn('font-mono font-medium', className)}>
      ₹{(paise / 100).toLocaleString('en-IN')}
    </span>
  )
}

export { MapModal } from './MapModal'

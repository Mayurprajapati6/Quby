import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

export function AppLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('q-page', className)}>{children}</div>
}

export function DashboardLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('q-page q-page--dashboard', className)}>{children}</div>
}

export function QueueLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('q-page q-page--queue', className)}>{children}</div>
}

export function AuthLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('auth-shell min-h-screen flex items-center justify-center p-4', className)}>{children}</div>
}

export function PublicLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('q-public-page', className)}>{children}</div>
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('q-page-header', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="q-eyebrow">{eyebrow}</div>}
        <h1 className="q-page-title">{title}</h1>
        {description && <p className="q-page-description">{description}</p>}
      </div>
      {actions && <div className="q-page-actions">{actions}</div>}
    </div>
  )
}

export function SurfaceCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  const Comp = interactive ? motion.div : 'div'
  return (
    <Comp
      whileHover={interactive ? { y: -2 } : undefined}
      className={cn('q-system-card', className)}
    >
      {children}
    </Comp>
  )
}

export function StatCard({
  icon,
  label,
  value,
  meta,
  tone = 'default',
  className,
}: {
  icon?: ReactNode
  label: ReactNode
  value: ReactNode
  meta?: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <SurfaceCard className={cn('q-stat-card', `q-tone-${tone}`, className)} interactive>
      <div className="q-stat-top">
        <span className="q-stat-label">{label}</span>
        {icon && <span className="q-stat-icon">{icon}</span>}
      </div>
      <div className="q-stat-value">{value}</div>
      {meta && <div className="q-stat-meta">{meta}</div>}
    </SurfaceCard>
  )
}

export function StatusChip({
  children,
  tone = 'default',
  pulse = false,
  className,
}: {
  children: ReactNode
  tone?: Tone
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('q-status-chip', `q-tone-${tone}`, className)}>
      {pulse && <span className="q-chip-pulse" />}
      {children}
    </span>
  )
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('q-filter-bar', className)}>{children}</div>
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('q-empty-state', className)}>
      {icon && <div className="q-empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

export function ModalFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('q-modal-frame', className)}>{children}</div>
}


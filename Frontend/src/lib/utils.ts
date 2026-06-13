import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatINRDirect(rupees: number): string {
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function normalizePagination(p: { total?: number; page?: number; limit?: number; total_pages?: number; totalPages?: number }) {
  const totalPages = p.total_pages ?? p.totalPages ?? 1
  return { ...p, total_pages: totalPages, totalPages }
}

export function getTotalPages(pagination: { total_pages?: number; totalPages?: number } | undefined | null): number {
  return pagination?.total_pages ?? pagination?.totalPages ?? 1
}

export function formatDate(isoString: string, fmt = 'dd MMM yyyy'): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    
    if (fmt === 'dd MMM yyyy')     return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    if (fmt === 'dd MMM')          return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    if (fmt === 'EEE, dd MMM')     return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    if (fmt === 'EEEE, dd MMM yyyy') return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    if (fmt === 'dd MMM, h:mm a' || fmt === 'dd MMM yyyy, h:mm a')
      return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: fmt.includes('yyyy') ? 'numeric' : undefined, hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).replace('am','AM').replace('pm','PM')
    
    return format(parseISO(isoString), fmt)
  } catch {
    return isoString
  }
}

export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleTimeString('en-IN', {
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata',
    }).replace('am', 'AM').replace('pm', 'PM')
  } catch {
    return isoString
  }
}

export function formatSmartDate(isoString: string): string {
  try {
    
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const dIST     = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    const tomorrow = new Date(todayIST); tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(todayIST); yesterday.setDate(yesterday.getDate() - 1)
    if (sameDay(dIST, todayIST))   return 'Today'
    if (sameDay(dIST, tomorrow))   return 'Tomorrow'
    if (sameDay(dIST, yesterday))  return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
  } catch {
    return isoString
  }
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata',
    }).replace('am','AM').replace('pm','PM')
  } catch {
    return isoString
  }
}

export function toApiDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`   
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function getStatusConfig(status: string): { label: string; className: string; dot: string } {
  const map: Record<string, { label: string; className: string; dot: string }> = {
    PENDING_PAYMENT:   { label: 'Pending Payment', className: 'badge-warning',   dot: '#f59e0b' },
    CONFIRMED:         { label: 'Confirmed',        className: 'badge-confirmed', dot: '#34d399' },
    CHECKED_IN:        { label: 'Checked In',       className: 'badge-info',     dot: '#60a5fa' },
    IN_PROGRESS:       { label: 'In Progress',      className: 'badge-running',  dot: '#34d399' },
    RUNNING:           { label: 'Running',           className: 'badge-running',  dot: '#34d399' },
    COMPLETED:         { label: 'Completed',         className: 'badge-confirmed',dot: '#34d399' },
    CANCELLED:         { label: 'Cancelled',         className: 'badge-cancelled',dot: '#ef4444' },
    CANCELLED_TIMEOUT: { label: 'Timed Out',         className: 'badge-cancelled',dot: '#ef4444' },
    CANCELLED_NO_SHOW: { label: 'No Show',           className: 'badge-warning',  dot: '#f59e0b' },
    NO_SHOW:           { label: 'No Show',           className: 'badge-warning',  dot: '#f59e0b' },
    HELD:              { label: 'Held',              className: 'badge-pending',  dot: '#a78bfa' },
    RELEASED:          { label: 'Released',          className: 'badge-confirmed',dot: '#34d399' },
    REFUNDED:          { label: 'Refunded',          className: 'badge-info',     dot: '#60a5fa' },
    PENDING:           { label: 'Pending',           className: 'badge-pending',  dot: '#a78bfa' },
    APPROVED:          { label: 'Approved',          className: 'badge-confirmed',dot: '#34d399' },
    REJECTED:          { label: 'Rejected',          className: 'badge-cancelled',dot: '#ef4444' },
    PAID:              { label: 'Paid',              className: 'badge-confirmed',dot: '#34d399' },
    SETTLED:           { label: 'Settled',           className: 'badge-confirmed',dot: '#34d399' },
    DONE:              { label: 'Done',              className: 'badge-confirmed',dot: '#34d399' },
    SICK:              { label: 'Sick Leave',        className: 'badge-warning',  dot: '#f59e0b' },
    CASUAL:            { label: 'Casual Leave',      className: 'badge-info',     dot: '#60a5fa' },
    EMERGENCY:         { label: 'Emergency',         className: 'badge-cancelled',dot: '#ef4444' },
    OTHER:             { label: 'Other',             className: 'badge-pending',  dot: '#a78bfa' },
  }
  return map[status] ?? { label: status, className: 'badge-info', dot: '#60a5fa' }
}

export function getStaffStatusConfig(status: 'FREE' | 'BUSY' | 'OFF') {
  const map = {
    FREE: { label: 'Free',  className: 'badge-confirmed', color: '#34d399' },
    BUSY: { label: 'Busy',  className: 'badge-warning',   color: '#f59e0b' },
    OFF:  { label: 'Off',   className: 'badge-cancelled', color: '#ef4444' },
  }
  return map[status]
}

export function getLeaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    SICK:      'Sick Leave',
    CASUAL:    'Casual Leave',
    EMERGENCY: 'Emergency',
    OTHER:     'Other',
  }
  return map[type] ?? type
}

export function renderStars(rating: number, max = 5): string {
  const filled = Math.round(rating)
  return '★'.repeat(filled) + '☆'.repeat(max - filled)
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export function timeFromNow(isoString: string): string {
  try {
    const diff = Date.now() - parseISO(isoString).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}

export function secondsUntil(isoString: string): number {
  try {
    return Math.max(0, Math.floor((parseISO(isoString).getTime() - Date.now()) / 1000))
  } catch {
    return 0
  }
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function getRoleDashboard(role: string): string {
  switch (role) {
    case 'CUSTOMER':
      return '/customer/explore' 
    case 'STAFF':
      return '/staff/queue' 
    case 'OWNER':
      return '/owner/dashboard'
    case 'ADMIN':
      return '/admin/dashboard'
    default:
      return '/'
  }
}

export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}
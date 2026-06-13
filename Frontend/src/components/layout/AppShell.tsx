import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Outlet, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Search, BookOpen, Wallet, Heart, Bell, User as UserIcon,
  LayoutDashboard, Scan, CalendarDays, UmbrellaOff, Star,
  Building2, Users, ClipboardList, BarChart2, Settings,
  LogOut, ChevronLeft, ChevronRight, Clock,
  Briefcase, QrCode, X, CheckCheck, ChevronDown, ArrowLeft,
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore, useSocketStore, useUiStore } from '@/stores'
import { getSocket } from '@/lib/socket'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/axios'
import { cn, getRoleDashboard, timeFromNow } from '@/lib/utils'
import type { UserRole, NotificationDTO, User } from '@/types'
import { useProfileStore } from '@/pages/staff/StaffProfile'

// ── Business Portal nav items ─────────────────────────────────────
const BIZ_NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',     sub: 'dashboard' },
  { icon: ClipboardList,   label: 'Queue',          sub: 'today' },
  { icon: BookOpen,        label: 'Bookings',       sub: 'bookings' },
  { icon: Users,           label: 'Staff',          sub: 'staff' },
  { icon: CalendarDays,    label: 'Leave',          sub: 'leave' },
  { icon: Star,            label: 'Reviews',        sub: 'reviews' },
]

// Returns true when we are inside the business portal (/owner/business/:id/...)
function useBusinessPortal() {
  const location = useLocation()
  const m = location.pathname.match(/^\/owner\/business\/([^/]+)\/(.*)$/)
  if (!m) return { isPortal: false, businessId: '', sub: '' }
  return { isPortal: true, businessId: m[1], sub: m[2] }
}

// ── Nav config per role ───────────────────────────────────────────
function getNavItems(role: UserRole) {
  switch (role) {
    case 'CUSTOMER':
      return [
        { icon: Search,        label: 'Explore',    path: '/customer/explore' },
        { icon: BookOpen,      label: 'Bookings',   path: '/customer/bookings',  badge: 'bookings' },
        { icon: Star,          label: 'Reviews',    path: '/customer/reviews' },
        { icon: Home,          label: 'Dashboard',  path: '/customer/dashboard' },
      ]
    case 'STAFF':
      return [
        { icon: ClipboardList,   label: 'Queue',       path: '/staff/queue',       badge: 'queue' },
        { icon: BookOpen,        label: 'Bookings',    path: '/staff/bookings' },
        { icon: CalendarDays,    label: 'Leave',       path: '/staff/leave' },
        { icon: UmbrellaOff,     label: 'Holidays',    path: '/staff/holidays' },
        { icon: Star,            label: 'Reviews',     path: '/staff/reviews' },
        { icon: LayoutDashboard, label: 'Dashboard',  path: '/staff/dashboard' },
      ]
    case 'OWNER':
      return [
        { icon: LayoutDashboard, label: 'Dashboard',  path: '/owner/dashboard' },
        { icon: Building2,       label: 'Businesses', path: '/owner/businesses' },
        { icon: Users,           label: 'Staff',      path: '/owner/staff' },
        { icon: CalendarDays,    label: 'Leave',      path: '/owner/leave',       badge: 'leaves' },
        { icon: BookOpen,        label: 'Bookings',   path: '/owner/bookings' },
        { icon: UmbrellaOff,     label: 'Holidays',   path: '/owner/holidays' },
        { icon: Star,            label: 'Reviews',    path: '/owner/reviews' },
      ]
    case 'ADMIN':
      return [
        { icon: LayoutDashboard, label: 'Dashboard',  path: '/admin/dashboard' },
        { icon: Building2,       label: 'Businesses', path: '/admin/businesses' },
        { icon: Briefcase,       label: 'Owners',     path: '/admin/users/owners' },
        { icon: UserIcon,        label: 'Customers',  path: '/admin/users/customers' },
        { icon: Users,           label: 'Staff',      path: '/admin/users/staff' },
        { icon: Settings,        label: 'Services',   path: '/admin/platform-services' },
      ]
    default:
      return []
  }
}

// ── Child pages — sidebar hidden ──────────────────────────────────
const CHILD_ROUTES = [
  '/customer/business/',
  '/customer/bookings/',
  '/customer/reviews/submit',
  '/customer/book/',
  '/staff/bookings/',
  '/owner/businesses/new',
  '/owner/businesses/',
  '/owner/staff-detail/',
  '/owner/bookings/',
  '/business/bookings/',
  '/admin/businesses/',
  '/admin/users/owners/',
  '/admin/users/customers/',
  '/admin/users/staff/',
]

function isChildRoute(pathname: string): boolean {
  return CHILD_ROUTES.some((r) => {
    if (r.endsWith('/')) return pathname.startsWith(r) && pathname !== r.slice(0, -1)
    return pathname === r || pathname.startsWith(r + '/')
  })
}

function getParentRoute(pathname: string, role: UserRole): string {
  if (pathname.startsWith('/customer/business/')) return '/customer/explore'
  if (pathname.startsWith('/customer/bookings/')) return '/customer/bookings'
  if (pathname.startsWith('/customer/reviews/submit')) return '/customer/reviews'
  if (pathname.startsWith('/customer/book/')) return '/customer/explore'
  if (pathname.startsWith('/staff/bookings/')) return '/staff/queue'
  if (pathname.startsWith('/owner/businesses/new')) return '/owner/businesses'
  if (pathname.startsWith('/owner/businesses/')) return '/owner/businesses'
  if (pathname.startsWith('/owner/staff-detail/')) return '/owner/staff'
  if (pathname.startsWith('/owner/bookings/')) return '/owner/bookings'
  if (pathname.startsWith('/owner/business/')) return '/owner/businesses'
  if (pathname.startsWith('/business/bookings/')) return '/business/bookings'
  if (pathname.startsWith('/admin/businesses/')) return '/admin/businesses'
  if (pathname.startsWith('/admin/users/owners/')) return '/admin/users/owners'
  if (pathname.startsWith('/admin/users/customers/')) return '/admin/users/customers'
  if (pathname.startsWith('/admin/users/staff/')) return '/admin/users/staff'
  return getRoleDashboard(role)
}

// ── Notification type icon map ────────────────────────────────────
const NOTIF_ICON: Record<string, string> = {
  BOOKING_CONFIRMED:   '📅',
  BOOKING_CANCELLED:   '❌',
  CUSTOMER_CHECKED_IN: '✅',
  SERVICE_COMPLETED:   '🎉',
  QUEUE_SHIFTED:       '⏱',
  DELAY_REPORTED:      '⚡',
  LEAVE_APPROVED:      '🌿',
  LEAVE_REJECTED:      '🚫',
  CUSTOMER_REVIEW:     '⭐',
  PAYMENT_SETTLED:     '💰',
  REMINDER_1_HOUR:     '⏰',
  REMINDER_15_MIN:     '⏰',
  REVIEW_RECEIVED:     '⭐',
  NO_SHOW:             '👻',
  SYSTEM:              '🛡️',
  ANNOUNCEMENT:        '🎁',
  HOLIDAY:             '🗓️',
}
function getNotifIcon(type?: string): string {
  if (!type) return '🔔'
  return NOTIF_ICON[type] ?? '🔔'
}

// ── formatTime helper (used in socket handlers) ───────────────────
function formatTime(iso: unknown): string {
  if (!iso || typeof iso !== 'string') return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }).replace('am', 'AM').replace('pm', 'PM')
}

// ── Notification Dropdown Panel ───────────────────────────────────
function NotificationDropdown({
  role,
  onClose,
  onViewAll,
}: {
  role: UserRole
  onClose: () => void
  onViewAll: () => void
}) {
  const qc = useQueryClient()
  const { resetBadge, decrementBadge } = useUiStore()
  const ref = useRef<HTMLDivElement>(null)

  const notifUrl: Record<UserRole, string> = {
    CUSTOMER: '/customer/notifications',
    OWNER:    '/owner/notifications',
    STAFF:    '/staff/notifications',
    ADMIN:    '',
  }
  const url = notifUrl[role]

  const { data, isLoading, refetch } = useQuery({
    queryKey: [`${role.toLowerCase()}-notif-preview`],
    queryFn: async () => {
      if (!url) return [] as NotificationDTO[]
      const res = await api.get(url, { params: { page: 1, limit: 8 } })
      return (res.data.data?.notifications ?? []) as NotificationDTO[]
    },
    enabled: !!url,
    staleTime: 15_000,
  })

  // Always fetch fresh data when dropdown opens
  useEffect(() => { refetch() }, [refetch])

  const markAllMutation = useMutation({
    mutationFn: async (): Promise<void> => { if (url) await api.patch(`${url}/read-all`) },
    onSuccess: () => {
      resetBadge()
      qc.invalidateQueries({ queryKey: [`${role.toLowerCase()}-notif-preview`] })
      qc.invalidateQueries({ queryKey: [`${role.toLowerCase()}-notifications`] })
    },
  })

  const markOneMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => { if (url) await api.patch(`${url}/${id}/read`) },
    onSuccess: (_data, id) => {
      decrementBadge()
      qc.setQueryData([`${role.toLowerCase()}-notif-preview`], (old: NotificationDTO[] | undefined) =>
        old?.map(n => n.id === id ? { ...n, is_read: true } : n) ?? []
      )
    },
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const notifications = Array.isArray(data) ? data : []
  const unread = notifications.filter(n => !n.is_read)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="absolute right-0 top-full mt-2 w-80 z-50"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-syne font-bold text-[13px]" style={{ color: 'var(--text-1)' }}>
            Notifications
          </span>
          {unread.length > 0 && (
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'var(--violet)', color: '#fff' }}>
              {unread.length} new
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread.length > 0 && (
            <button type="button" onClick={() => markAllMutation.mutate()}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10px] font-syne font-bold"
              style={{ color: 'var(--violet-light)', background: 'var(--violet-bg)', border: 'none', cursor: 'pointer' }}>
              <CheckCheck size={10} /> All read
            </button>
          )}
          <button type="button" onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-[6px]"
            style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--bg-surface)' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 rounded" style={{ background: 'var(--bg-surface)', width: '60%' }} />
                  <div className="h-2 rounded" style={{ background: 'var(--bg-surface)', width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-[32px] mb-2">🔔</div>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>No notifications yet</p>
          </div>
        ) : (
          notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => !n.is_read && markOneMutation.mutate(n.id)}
              className="flex gap-3 px-4 py-3 cursor-pointer transition-colors"
              style={{
                background: !n.is_read ? 'var(--violet-bg)' : 'transparent',
                borderBottom: '1px solid var(--border)',
                borderLeft: !n.is_read ? '2px solid var(--violet-light)' : '2px solid transparent',
              }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[15px]"
                style={{ background: !n.is_read ? 'rgba(124,58,237,0.2)' : 'var(--bg-surface)' }}>
                {getNotifIcon((n as any).type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[12px] font-syne leading-snug"
                    style={{ fontWeight: n.is_read ? 500 : 700, color: 'var(--text-1)' }}>
                    {n.title}
                  </p>
                  {!n.is_read && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                      style={{ background: 'var(--violet-light)' }} />
                  )}
                </div>
                {n.message && (
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{n.message}</p>
                )}
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{timeFromNow(n.created_at)}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {url && (
        <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
          <button type="button" onClick={onViewAll}
            className="w-full text-center text-[12px] font-syne font-bold py-1.5 rounded-[8px]"
            style={{ color: 'var(--violet-light)', background: 'var(--violet-bg)', border: 'none', cursor: 'pointer' }}>
            View all notifications →
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ── Notification Bell ─────────────────────────────────────────────
function NotificationBell({ role, onNavigate }: { role: UserRole; onNavigate: (path: string) => void }) {
  const count = useUiStore((s) => s.notificationBadgeCount)
  const { resetBadge } = useUiStore()
  const isConnected = useSocketStore((s) => s.isConnected)
  const [open, setOpen] = useState(false)
  const notifPaths: Record<UserRole, string> = {
    CUSTOMER: '/customer/notifications',
    OWNER:    '/owner/notifications',
    STAFF:    '/staff/notifications',
    ADMIN:    '',
  }

  const handleOpen = () => {
  setOpen(o => !o)
}

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-[8px]"
        style={{ background: 'var(--bg-surface)', border: `1px solid ${open ? 'var(--violet-border)' : 'var(--border)'}` }}
      >
        {isConnected && count > 0 && (
          <motion.span
            className="absolute inset-0 rounded-[8px]"
            animate={{ boxShadow: ['0 0 0 0 rgba(124,58,237,0.5)', '0 0 0 5px rgba(124,58,237,0)', '0 0 0 0 rgba(124,58,237,0)'] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 0.5 }}
          />
        )}
        <motion.div
          animate={count > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
          transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 3 }}
        >
          <Bell size={16} style={{ color: count > 0 ? 'var(--violet-light)' : open ? 'var(--violet-light)' : 'var(--text-2)' }} />
        </motion.div>
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="notif-badge"
            >
              {count > 9 ? '9+' : count}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <NotificationDropdown
            role={role}
            onClose={() => setOpen(false)}
            onViewAll={() => {
              setOpen(false)
              const path = notifPaths[role]
              if (path) onNavigate(path)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Profile Dropdown ──────────────────────────────────────────────
function ProfileDropdown({
  user, role, onNavigate, onLogout, onClose,
}: {
  user: User; role: UserRole
  onNavigate: (path: string) => void
  onLogout: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const profilePath: Record<UserRole, string> = {
    CUSTOMER: '/customer/profile',
    OWNER:    '/owner/profile',
    STAFF:    '/staff/profile',
    ADMIN:    '/admin/profile',
  }

  const roleLabel: Record<UserRole, string> = {
    CUSTOMER: 'Customer',
    OWNER:    'Business Owner',
    STAFF:    'Staff',
    ADMIN:    'Administrator',
  }

  const roleBadgeStyle: Record<UserRole, { bg: string; color: string }> = {
    CUSTOMER: { bg: 'var(--violet-bg)',          color: 'var(--violet-light)' },
    OWNER:    { bg: 'rgba(52,211,153,0.1)',       color: '#34d399' },
    STAFF:    { bg: 'rgba(96,165,250,0.1)',       color: '#60a5fa' },
    ADMIN:    { bg: 'rgba(251,146,60,0.1)',       color: '#fb923c' },
  }

  const badge = roleBadgeStyle[role]

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="absolute right-0 top-full mt-2 w-64 z-50"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>
              {user.name}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>
              {user.email}
            </p>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-syne font-bold"
              style={{ background: badge.bg, color: badge.color }}
            >
              {roleLabel[role]}
            </span>
          </div>
        </div>
      </div>

      <div className="py-1">
        <button
          type="button"
          onClick={() => { onClose(); onNavigate(profilePath[role]) }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-syne font-bold text-left transition-colors hover:bg-[var(--bg-surface)]"
          style={{ color: 'var(--text-1)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <UserIcon size={13} style={{ color: 'var(--text-3)' }} />
          My Profile
        </button>

        <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />

        <button
          type="button"
          onClick={() => { onClose(); onLogout() }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-syne font-bold text-left transition-colors hover:bg-[var(--bg-surface)]"
          style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <LogOut size={13} />
          Log out
        </button>
      </div>
    </motion.div>
  )
}

// ── Avatar button with dropdown ───────────────────────────────────
function ProfileButton({
  user, role, onNavigate, onLogout,
}: {
  user: User; role: UserRole
  onNavigate: (path: string) => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <Avatar name={user.name} src={user.avatar_url} size="sm" />
        <ChevronDown
          size={12}
          style={{
            color: 'var(--text-3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <ProfileDropdown
            user={user}
            role={role}
            onNavigate={onNavigate}
            onLogout={onLogout}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────
export function AppShell() {
  const { user, logout, accessToken } = useAuthStore()
  const { connect, isConnected } = useSocketStore()
  const { sidebarCollapsed, toggleSidebar, notificationBadgeCount, incrementBadge, resetBadge } = useUiStore()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()

  if (!user) return null

  const role = user.role

  // ── 1. Connect socket when token arrives ──────────────────────
  useEffect(() => {
    if (accessToken && !isConnected) connect(accessToken)
  }, [accessToken, connect, isConnected])

  // ── 2. Owner: join business room when inside portal ───────────
  useEffect(() => {
    if (role !== 'OWNER') return
    const socket = getSocket()
    if (!socket) return
    const match = location.pathname.match(/\/owner\/business\/([^/]+)/)
    const qpMatch = new URLSearchParams(location.search).get('businessId')
    const businessId = match?.[1] ?? qpMatch ?? null
    if (businessId) {
      socket.emit('join:business', businessId)
      return () => { socket.emit('leave:business', businessId) }
    }
  }, [location.pathname, location.search, role, isConnected])

  // ── 3. Global socket event handlers ──────────────────────────
  // FIX: moved getSocket() INSIDE the effect so it always gets the live
  // socket reference. Depend on `isConnected` so handlers re-register
  // after reconnect.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // ── notification:new — fires for every DB notification ─────
    const onNotification = (payload: { title?: string; message?: string; type?: string }) => {
      incrementBadge()

      const t     = (payload.type ?? '').toUpperCase()
      const title = payload.title ?? 'New notification'
      const desc  = payload.message

      const isBad  = t.includes('CANCEL') || t.includes('FAIL') || t.includes('TIMEOUT') || t.includes('NO_SHOW') || t.includes('REJECT')
      const isGood = t.includes('CONFIRM') || t.includes('COMPLETE') || t.includes('PAID') || t.includes('SETTLED') || t.includes('APPROVED') || t.includes('REFUND')

      if (isBad)        toast.error(title,   { description: desc, position: 'top-right', duration: 6000 })
      else if (isGood)  toast.success(title, { description: desc, position: 'top-right', duration: 5000 })
      else              toast.info(title,    { description: desc, position: 'top-right', duration: 4500 })

      const roleKey = role.toLowerCase()
      // Invalidate both the bell-dropdown preview AND the full notifications page
      qc.invalidateQueries({ queryKey: [`${roleKey}-notif-preview`] })
      qc.invalidateQueries({ queryKey: [`${roleKey}-notifications`] })
      // Customer notifications page uses this key format
      if (role === 'CUSTOMER') {
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
      }
    }
    socket.on('notification:new', onNotification)

    // ── account:suspended — all roles ──────────────────────────
    const onSuspended = (d: { reason?: string }) => {
      toast.error('Your account has been suspended.', {
        description: d?.reason ?? 'Contact support for more information.',
        position: 'top-center', duration: 0,
      })
    }
    socket.on('account:suspended', onSuspended)

    // Collect role-specific handlers for cleanup
    const roleHandlers: [string, (d: any) => void][] = []
    const on = (evt: string, fn: (d: any) => void) => {
      roleHandlers.push([evt, fn])
      socket.on(evt, fn)
    }

    // ════════════════════════════════════════════════════════════
    // CUSTOMER
    // ════════════════════════════════════════════════════════════
    if (role === 'CUSTOMER') {

      on('booking:created', (d: any) => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        if (d?.bookingNumber) {
          toast.info('Slot reserved! Complete payment within 10 minutes.', {
            description: `Booking #${d.bookingNumber}`,
            position: 'top-right', duration: 5000,
          })
        }
      })

      on('booking:confirmed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        toast.success(
          `Booking confirmed!${d?.bookingNumber ? ` #${d.bookingNumber}` : ''}`,
          { description: d?.businessName ? `At ${d.businessName}` : 'Check your email for QR code.', position: 'top-right', icon: '📅', duration: 5000 }
        )
      })

      on('payment:confirmed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        toast.success('Payment confirmed! 💳', {
          description: 'Your QR code is ready. Check My Bookings.',
          position: 'top-right', duration: 5000,
        })
      })

      on('booking:cancelled', (d: any) => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
        qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        const num = d?.bookingNumber ? ` #${d.bookingNumber}` : ''
        const cancelledBy = d?.reason ?? (d?.refunded ? 'Refund will be processed within 5–7 business days.' : undefined)
        toast.error(`Booking${num} was cancelled.`, {
          description: cancelledBy,
          position: 'top-right', duration: 6000,
        })
      })

      on('booking:timeout', () => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        toast.error('Booking expired — payment was not completed in time.', {
          description: 'Your slot has been released. You can book again.',
          position: 'top-right', duration: 6000,
        })
      })

      on('booking:reminder', (d: any) => {
        const label = d?.type === 'reminder-1hr' ? '1 hour' : '15 minutes'
        const at = d?.businessName ? ` at ${d.businessName}` : ''
        const with_ = d?.staffName ? ` with ${d.staffName}` : ''
        const time = d?.scheduledTime ? ` (${formatTime(d.scheduledTime)})` : ''
        toast.info(`⏰ Appointment${at}${with_} in ${label}${time}`, {
          description: "Show your QR code at the salon.",
          position: 'top-right', duration: 10000,
        })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
      })

      on('service:checked_in', () => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        toast.info("You've been checked in! Service is starting. ✅", {
          position: 'top-right', duration: 5000,
        })
      })

      on('service:completed', () => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
        qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        toast.success('Service complete! Please leave a review. ⭐', {
          description: 'Your feedback helps others choose great stylists.',
          position: 'top-right', duration: 6000,
        })
      })

      on('service:delayed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
        
        if (d?.delayMinutes) {
          const newTime = d?.newArrivalWindowStart
            ? ` New arrival: ${formatTime(d.newArrivalWindowStart)}.`
            : d?.newServiceStart
            ? ` New slot: ${formatTime(d.newServiceStart)}.`
            : ''
          toast.info(`⏱ Queue shifted +${d.delayMinutes} min.${newTime}`, {
            description: d?.reason ?? undefined,
            position: 'top-right', duration: 8000,
          })
        }
      })

      on('booking:no_show', () => {
        qc.invalidateQueries({ queryKey: ['customer-bookings'] })
        qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['customer-notifications'] })
        
        toast.error('Booking marked as no-show. Payment retained by business.', {
          position: 'top-right', duration: 6000,
        })
      })

      on('booking:updated', (d: any) => {
  qc.invalidateQueries({ queryKey: ['customer-bookings'] })
  qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
  qc.invalidateQueries({ queryKey: ['customer-booking-counts'] })
  if (d?.status === 'COMPLETED') {
    qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
    qc.invalidateQueries({ queryKey: ['customer-notifications'] })
  }
  if (d?.status === 'NO_SHOW') {
    qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
    qc.invalidateQueries({ queryKey: ['customer-notifications'] })
  }
  if (d?.service_start_time) {
    // Queue shifted — times updated
    qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
    qc.invalidateQueries({ queryKey: ['customer-notifications'] })
    if (d?.service_start_time) {
      const newTime = new Date(d.service_start_time).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
      })
      toast.info(`Your appointment time updated to ${newTime}`, {
        position: 'top-right', duration: 6000,
      })
    }
  }
})

on('booking:time_updated', (d: any) => {
  qc.invalidateQueries({ queryKey: ['customer-bookings'] })
  qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
  if (d?.newServiceStartTime) {
    const newTime = new Date(d.newServiceStartTime).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
    })
    toast.info(`⏱ Your appointment time updated to ${newTime}`, {
      description: d?.message ?? undefined,
      position: 'top-right', duration: 8000,
    })
  }
})

on('notification:new', () => {
  qc.invalidateQueries({ queryKey: ['customer-notif-preview'] })
  qc.invalidateQueries({ queryKey: ['customer-notifications'] })
})
    }

    // ════════════════════════════════════════════════════════════
    // STAFF
    // ════════════════════════════════════════════════════════════
    if (role === 'STAFF') {

      on('booking:new', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-bookings'] })
        qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['staff-notifications'] })
        
        toast.info(`New booking: ${d?.customerName ?? 'customer'}`, {
          position: 'top-right', duration: 4000,
        })
      })

      on('booking:confirmed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
        qc.invalidateQueries({ queryKey: ['staff-bookings'] })
        qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['staff-notifications'] })
        
        toast.info(`New booking${d?.customerName ? ` from ${d.customerName}` : ''} confirmed. 📅`, {
          position: 'top-right', duration: 4500,
        })
      })

      on('booking:cancelled', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-bookings'] })
        qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['staff-notifications'] })
        
        const num = d?.bookingNumber ? ` #${d.bookingNumber}` : ''
        const by  = d?.cancelled_by ? ` (by ${d.cancelled_by})` : ''
        toast.info(`Booking${num} was cancelled${by}. Your slot is now free.`, {
          position: 'top-right', duration: 4500,
        })
      })

      on('booking:no_show', () => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-bookings'] })
        qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['staff-notifications'] })
        
        // toast.info('Customer marked as no-show.', {
        //   position: 'top-right', duration: 4000,
        // })
      })

      on('service:checked_in', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
        toast.success(`Customer${d?.customerName ? ` ${d.customerName}` : ''} checked in! ✅`, {
          position: 'top-right', duration: 4000,
        })
      })

      on('service:completed', () => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
        qc.invalidateQueries({ queryKey: ['staff-bookings'] })
        toast.success('Service marked as complete.', {
          position: 'top-right', duration: 3500,
        })
      })

      on('queue:updated', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        qc.invalidateQueries({ queryKey: ['staff-bookings'] })
        if (d?.delayMinutes || d?.extraMinutes) {
          const mins = d.delayMinutes ?? d.extraMinutes
          toast.info(`Queue shifted +${mins} min.`, {
            position: 'top-right', duration: 5000,
          })
        }
      })

      // Alias
      on('QUEUE_UPDATED', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
      })

      on('service:delayed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-queue'] })
        if (d?.delayMinutes) {
          toast.info(`Schedule shifted +${d.delayMinutes} min.`, {
            position: 'top-right', duration: 5000,
          })
        }
      })

      on('staff:leave_approved', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
        qc.invalidateQueries({ queryKey: ['staff-leave'] })
        qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['staff-notifications'] })
        
        const range = d?.startDate ? ` (${d.startDate} – ${d.endDate})` : ''
        toast.success(`Your leave request was approved!${range} 🎉`, {
          position: 'top-right', duration: 7000,
        })
      })

      on('staff:leave_rejected', (d: any) => {
        qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
        qc.invalidateQueries({ queryKey: ['staff-leave'] })
        qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['staff-notifications'] })
        
        toast.error('Your leave request was rejected.', {
          description: d?.rejection_reason ?? undefined,
          position: 'top-right', duration: 6000,
        })
      })

      on('holiday:update', () => {
        qc.invalidateQueries({ queryKey: ['staff-holidays'] })
        qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
        toast.info('🗓️ Business holiday schedule updated.', {
          position: 'top-right', duration: 5000,
        })
      })

      on('booking:updated', (d: any) => {
  qc.invalidateQueries({ queryKey: ['staff-queue'] })
  qc.invalidateQueries({ queryKey: ['staff-bookings'] })
  if (d?.status === 'COMPLETED') {
    qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
    qc.invalidateQueries({ queryKey: ['staff-notifications'] })
  }
})

on('service:started', (d: any) => {
  qc.invalidateQueries({ queryKey: ['staff-queue'] })
  qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
})

on('service:overdue', (d: any) => {
  qc.invalidateQueries({ queryKey: ['staff-queue'] })
  toast.warning('⚠️ Service is running over time!', {
    position: 'top-right', duration: 8000,
  })
})

on('queue:extended', (d: any) => {
  qc.invalidateQueries({ queryKey: ['staff-queue'] })
  if (d?.extraMinutes) {
    toast.info(`Service extended by ${d.extraMinutes} min.`, {
      position: 'top-right', duration: 4000,
    })
  }
})

on('notification:new', () => {
  qc.invalidateQueries({ queryKey: ['staff-notif-preview'] })
  qc.invalidateQueries({ queryKey: ['staff-notifications'] })
})
    }

    // ════════════════════════════════════════════════════════════
    // OWNER
    // ════════════════════════════════════════════════════════════
    if (role === 'OWNER') {

      on('booking:new', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        qc.invalidateQueries({ queryKey: ['owner-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['owner-notifications'] })
        
      })

      on('booking:confirmed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        qc.invalidateQueries({ queryKey: ['owner-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['owner-notifications'] })
        
        toast.success(
          `New booking confirmed${d?.customerName ? ` from ${d.customerName}` : ''}! 📅`,
          { position: 'top-right', duration: 4500 }
        )
      })

      on('booking:cancelled', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        qc.invalidateQueries({ queryKey: ['owner-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['owner-notifications'] })
        
        const num = d?.bookingNumber ? ` #${d.bookingNumber}` : ''
        toast.info(`Booking${num} cancelled.`, {
          position: 'top-right', duration: 4500,
        })
      })

      on('booking:no_show', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        qc.invalidateQueries({ queryKey: ['owner-booking-counts'] })
        qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['owner-notifications'] })
        
        toast.info(`No-show${d?.customerName ? `: ${d.customerName}` : ''}. Payment settled.`, {
          position: 'top-right', duration: 5000,
        })
      })

      on('service:checked_in', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        toast.info(`Customer${d?.customerName ? ` ${d.customerName}` : ''} checked in! ✅`, {
          position: 'top-right', duration: 4000,
        })
      })

      on('service:completed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        qc.invalidateQueries({ queryKey: ['owner-booking-counts'] })
      })

      on('service:delayed', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        if (d?.delayMinutes || d?.extraMinutes) {
          const mins = d.delayMinutes ?? d.extraMinutes
          toast.info(`Queue shifted +${mins} min${d?.businessName ? ` at ${d.businessName}` : ''}.`, {
            position: 'top-right', duration: 5000,
          })
        }
      })

      on('queue:updated', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        if (d?.extraMinutes || d?.delayMinutes) {
          const mins = d.extraMinutes ?? d.delayMinutes
          toast.info(`Queue shifted +${mins} min${d?.staffName ? ` (${d.staffName})` : ''}.`, {
            position: 'top-right', duration: 4500,
          })
        }
      })

      on('payment:settled', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['owner-notifications'] })
        
        if (d?.amount) {
          toast.success(`Payment settled: ₹${(d.amount / 100).toLocaleString('en-IN')} 💰`, {
            position: 'top-right', duration: 4000,
          })
        }
      })

      on('escrow:released', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        if (d?.amount) {
          const amt  = (d.amount / 100).toLocaleString('en-IN')
          const bal  = d?.newBalance ? ` Balance: ₹${(d.newBalance / 100).toLocaleString('en-IN')}` : ''
          toast.success(`₹${amt} released to balance.${bal}`, {
            position: 'top-right', duration: 5000,
          })
        }
      })

      on('staff:leave_requested', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-leaves'] })
        qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
        qc.invalidateQueries({ queryKey: ['owner-notifications'] })
        
        toast.info(`Leave request from ${d?.staffName ?? 'staff'}.`, {
          description: d?.startDate ? `${d.startDate} to ${d.endDate}` : 'Review in Leave Management',
          position: 'top-right', icon: '📋', duration: 6000,
        })
      })

      on('staff:leave_approved', () => {
        qc.invalidateQueries({ queryKey: ['owner-leaves'] })
      })

      on('staff:leave_rejected', () => {
        qc.invalidateQueries({ queryKey: ['owner-leaves'] })
      })

      on('business:approved', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        qc.invalidateQueries({ queryKey: ['owner-businesses'] })
        toast.success(`${d?.businessName ?? 'Business'} has been approved! 🎉`, {
          position: 'top-right', duration: 6000,
        })
      })

      on('business:rejected', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        toast.error(`${d?.businessName ?? 'Business'} approval rejected.`, {
          description: d?.reason ?? undefined,
          position: 'top-right', duration: 7000,
        })
      })

      on('business:verified', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-businesses'] })
        toast.success(`${d?.businessName ?? 'Business'} is now verified! ✅`, {
          position: 'top-right', duration: 6000,
        })
      })

      on('booking:updated', (d: any) => {
  qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  qc.invalidateQueries({ queryKey: ['owner-booking-counts'] })
})

on('queue:shifted', (d: any) => {
  qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
  qc.invalidateQueries({ queryKey: ['owner-notifications'] })
})

on('service:started', (d: any) => {
  qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
  qc.invalidateQueries({ queryKey: ['owner-notifications'] })
  toast.info(`Service started${d?.customerName ? ` for ${d.customerName}` : ''}`, {
    position: 'top-right', duration: 3000,
  })
})

on('service:overdue', (d: any) => {
  qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
  qc.invalidateQueries({ queryKey: ['owner-notifications'] })
  toast.warning(`⚠️ Service overdue${d?.staffName ? ` (${d.staffName})` : ''}`, {
    position: 'top-right', duration: 6000,
  })
})

on('queue:extended', (d: any) => {
  qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  if (d?.extraMinutes) {
    toast.info(`Service extended by ${d.extraMinutes} min.`, {
      position: 'top-right', duration: 4000,
    })
  }
})

on('notification:new', () => {
  qc.invalidateQueries({ queryKey: ['owner-notif-preview'] })
  qc.invalidateQueries({ queryKey: ['owner-notifications'] })
})
    }

    // ════════════════════════════════════════════════════════════
    // BUSINESS room (owner inside portal — managers/staff of that biz)
    // These fire on the business:{bizId} room which owner auto-joins
    // ════════════════════════════════════════════════════════════
    if (role === 'OWNER') {
      on('payment:received', (d: any) => {
        qc.invalidateQueries({ queryKey: ['owner-bookings'] })
        qc.invalidateQueries({ queryKey: ['owner-dashboard'] })
        if (d?.amount) {
          toast.success(`Payment received: ₹${(d.amount / 100).toLocaleString('en-IN')} 💳`, {
            description: d?.customerName ? `From ${d.customerName}` : undefined,
            position: 'top-right', duration: 4000,
          })
        }
      })
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN
    // ════════════════════════════════════════════════════════════
    if (role === 'ADMIN') {
      on('business:submitted', (d: any) => {
        toast.info(`New business submitted: ${d?.businessName ?? 'Unknown'}`, {
          description: d?.ownerName ? `By ${d.ownerName}` : undefined,
          position: 'top-right', icon: '🏢', duration: 6000,
        })
      })

      on('business:approved', (d: any) => {
        toast.success(`${d?.businessName ?? 'Business'} approved.`, {
          position: 'top-right', duration: 4000,
        })
      })
    }

    return () => {
      socket.off('notification:new', onNotification)
      socket.off('account:suspended', onSuspended)
      roleHandlers.forEach(([evt, fn]) => socket.off(evt, fn))
    }
  // Re-register whenever socket reconnects (isConnected changes) or role changes
  }, [role, qc, accessToken, incrementBadge, isConnected])

  // ── 4. Load initial unread count on mount ────────────────────
  useEffect(() => {
    if (!user) return
    const urls: Record<string, string> = {
      CUSTOMER: '/customer/notifications',
      STAFF:    '/staff/notifications',
      OWNER:    '/owner/notifications',
      ADMIN:    '',
    }
    const url = urls[user.role]
    if (!url) return
    api.get(url, { params: { page: 1, limit: 20 } }).then((res) => {
      const unreadCount =
        res.data.data?.unread_count ??
        (Array.isArray(res.data.data?.notifications)
          ? (res.data.data.notifications as { is_read: boolean }[]).filter(n => !n.is_read).length
          : 0)
      resetBadge(unreadCount)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const navItems = getNavItems(role)
  const pathname = location.pathname
  const isChild  = isChildRoute(pathname)
  const parentRoute = getParentRoute(pathname, role)

  const { isPortal, businessId: portalBizId, sub: portalSub } = useBusinessPortal()

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('quby_refresh_token')
      const logoutUrls: Record<string, string> = {
        CUSTOMER: '/customer/logout',
        OWNER:    '/owner/logout',
        STAFF:    '/staff/logout',
        ADMIN:    '/admin/logout',
      }
      if (refreshToken && logoutUrls[role]) {
        await api.post(logoutUrls[role], { refresh_token: refreshToken }).catch(() => {})
      }
    } catch { /* ignore */ } finally {
      logout()
      toast.success('Logged out successfully')
      navigate('/login')
    }
  }

  const staffProfile = useProfileStore(s => s.profile)
  const ownerCachedAvatar = (() => {
    if (role !== 'OWNER') return null
    try {
      const raw = localStorage.getItem('quby-owner-profile-v1')
      return raw ? (JSON.parse(raw)?.state?.avatar_url ?? null) : null
    } catch { return null }
  })()
  const adminCachedAvatar = (() => {
    if (role !== 'ADMIN') return null
    try {
      const raw = localStorage.getItem('quby-admin-profile-v1')
      return raw ? (JSON.parse(raw)?.state?.avatar_url ?? null) : null
    } catch { return null }
  })()
  const customerCachedAvatar = (() => {
    if (role !== 'CUSTOMER') return null
    try {
      const raw = localStorage.getItem('quby-customer-profile-v1')
      return raw ? (JSON.parse(raw)?.state?.avatar_url ?? null) : null
    } catch { return null }
  })()
  const resolvedAvatarUrl =
    role === 'STAFF'
      ? (user.avatar_url ?? staffProfile?.avatar_url ?? null)
      : role === 'OWNER'
        ? (user.avatar_url ?? ownerCachedAvatar ?? null)
        : role === 'ADMIN'
          ? (user.avatar_url ?? adminCachedAvatar ?? null)
          : role === 'CUSTOMER'
            ? (user.avatar_url ?? customerCachedAvatar ?? null)
            : user.avatar_url ?? null
  const authUser: User = { ...user, avatar_url: resolvedAvatarUrl }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-page)' }}>

      {/* ── TOPBAR ────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center h-12 px-3 gap-3"
        style={{
          background: 'var(--topbar-bg)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Left: back or logo */}
        <div className="flex-shrink-0">
          {isPortal ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/owner/businesses')}
              className="flex items-center gap-1.5 font-syne font-bold text-[13px]"
              style={{ color: 'var(--text-1)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} /> Businesses
            </motion.button>
          ) : isChild ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(parentRoute)}
              className="flex items-center gap-1.5 font-syne font-bold text-[13px]"
              style={{ color: 'var(--text-1)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} /> Back
            </motion.button>
          ) : (
            <Logo variant="compact" />
          )}
        </div>

        {/* Center tabs — tablet only */}
        {isPortal ? (
          <div className="hidden md:flex lg:hidden flex-1 min-w-0">
            <div className="tabs-container">
              <div className="tabs-scroll">
                {BIZ_NAV_ITEMS.map((item) => {
                  const isActive = portalSub === item.sub || portalSub.startsWith(item.sub + '/')
                  return (
                    <motion.button
                      key={item.sub}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(`/owner/business/${portalBizId}/${item.sub}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] font-syne font-bold text-[11px] whitespace-nowrap flex-shrink-0 border"
                      style={{
                        background: isActive ? 'var(--violet-bg)' : 'transparent',
                        borderColor: isActive ? 'var(--violet-border)' : 'transparent',
                        color: isActive ? 'var(--violet-light)' : 'var(--text-2)',
                      }}
                    >
                      <item.icon size={13} />
                      {item.label}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
        {!isChild && !isPortal && (
          <div className="hidden md:flex lg:hidden flex-1 min-w-0">
            <div className="tabs-container">
              <div className="tabs-scroll">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/owner/dashboard' && location.pathname.startsWith(item.path))
                  return (
                    <motion.button
                      key={item.path}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] font-syne font-bold text-[11px] whitespace-nowrap flex-shrink-0 border"
                      style={{
                        background: isActive ? 'var(--violet-bg)' : 'transparent',
                        borderColor: isActive ? 'var(--violet-border)' : 'transparent',
                        color: isActive ? 'var(--violet-light)' : 'var(--text-2)',
                      }}
                    >
                      <item.icon size={13} />
                      {item.label}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Socket indicator */}
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: isConnected ? 'var(--green)' : 'var(--border-2)' }}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />

          {/* Bell */}
          <NotificationBell role={role} onNavigate={navigate} />

          {/* Avatar / profile */}
          <ProfileButton
            user={authUser}
            role={role}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex flex-1 pt-12">

        {/* Business portal sidebar (owner inside /owner/business/:id/*) */}
        {isPortal && (
          <aside
            className="hidden lg:flex flex-col fixed left-0 top-12 bottom-0 z-30 transition-all duration-200"
            style={{
              width: sidebarCollapsed ? '52px' : '200px',
              background: 'var(--sidebar-bg)',
              borderRight: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              {!sidebarCollapsed && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/owner/businesses')}
                  className="flex items-center gap-1 text-[11px] font-syne font-bold"
                  style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <ArrowLeft size={12} /> Businesses
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleSidebar}
                className="w-7 h-7 flex items-center justify-center rounded-[7px] ml-auto"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
              >
                {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </motion.button>
            </div>

            <div className="sidebar-body">
              <div className="sidebar-scroll">
                {BIZ_NAV_ITEMS.map((item) => {
                  const isActive = portalSub === item.sub || portalSub.startsWith(item.sub + '/')
                  return (
                    <motion.button
                      key={item.sub}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(`/owner/business/${portalBizId}/${item.sub}`)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-[9px] font-syne font-bold text-[12px] relative transition-all',
                        sidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2',
                      )}
                      style={{
                        background: isActive ? 'var(--violet-bg)' : 'transparent',
                        color:      isActive ? 'var(--violet-light)' : 'var(--text-2)',
                        border:     isActive ? '1px solid var(--violet-border)' : '1px solid transparent',
                      }}
                    >
                      <item.icon size={15} className="flex-shrink-0" />
                      {!sidebarCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLogout}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-[9px] text-[12px] py-2 font-syne font-bold',
                  sidebarCollapsed ? 'justify-center px-2' : 'px-3',
                )}
                style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}
                title={sidebarCollapsed ? 'Logout' : undefined}
              >
                <LogOut size={14} className="flex-shrink-0" />
                {!sidebarCollapsed && 'Logout'}
              </motion.button>
            </div>
          </aside>
        )}

        {/* Desktop sidebar (normal pages) */}
        {!isChild && !isPortal && (
          <aside
            className="hidden lg:flex flex-col fixed left-0 top-12 bottom-0 z-30 transition-all duration-200"
            style={{
              width: sidebarCollapsed ? '52px' : '180px',
              background: 'var(--sidebar-bg)',
              borderRight: '1px solid var(--border)',
            }}
          >
            <div className="flex justify-end p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleSidebar}
                className="w-7 h-7 flex items-center justify-center rounded-[7px]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
              >
                {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </motion.button>
            </div>

            <div className="sidebar-body">
              <div className="sidebar-scroll">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== `/${role?.toLowerCase()}/dashboard` && location.pathname.startsWith(item.path))
                  return (
                    <motion.button
                      key={item.path}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(item.path)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-[9px] font-syne font-bold text-[12px] relative transition-all',
                        sidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2',
                      )}
                      style={{
                        background: isActive ? 'var(--violet-bg)' : 'transparent',
                        color:      isActive ? 'var(--violet-light)' : 'var(--text-2)',
                        border:     isActive ? '1px solid var(--violet-border)' : '1px solid transparent',
                      }}
                    >
                      <item.icon size={15} className="flex-shrink-0" />
                      {!sidebarCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                      {!sidebarCollapsed && item.badge === 'notif' && notificationBadgeCount > 0 && (
                        <span className="sidebar-badge">{notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}</span>
                      )}
                      {sidebarCollapsed && item.badge === 'notif' && notificationBadgeCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} />
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLogout}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-[9px] text-[12px] py-2 font-syne font-bold',
                  sidebarCollapsed ? 'justify-center px-2' : 'px-3',
                )}
                style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}
                title={sidebarCollapsed ? 'Logout' : undefined}
              >
                <LogOut size={14} className="flex-shrink-0" />
                {!sidebarCollapsed && 'Logout'}
              </motion.button>
            </div>
          </aside>
        )}

        {/* ── MAIN CONTENT ──────────────────────────────────────── */}
        <main className="flex-1 min-h-0 overflow-y-auto w-full transition-all duration-200">
          <div className="w-full transition-all duration-200">
            <style>{`
              @media (min-width: 1024px) {
                .lg-sidebar-offset {
                  padding-left: ${
                    isChild
                      ? 0
                      : isPortal
                        ? (sidebarCollapsed ? 52 : 200)
                        : (sidebarCollapsed ? 52 : 180)
                  }px !important;
                }
              }
            `}</style>
            <div className={(!isChild || isPortal) ? 'lg-sidebar-offset' : ''}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      {/* ── BOTTOM NAV (mobile only) ── */}
      {(!isChild || isPortal) && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center md:hidden"
          style={{
            background: 'var(--topbar-bg)',
            borderTop: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
            height: 56,
            paddingBottom: 'env(safe-area-inset-bottom)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {isPortal
            ? BIZ_NAV_ITEMS.map((item) => {
                const isActive = portalSub === item.sub || portalSub.startsWith(item.sub + '/')
                return (
                  <motion.button
                    key={item.sub}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => navigate(`/owner/business/${portalBizId}/${item.sub}`)}
                    className="flex flex-col items-center justify-center gap-0.5 py-1 relative"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '6px 10px', minWidth: 60 }}
                  >
                    <item.icon size={18} style={{ color: isActive ? 'var(--violet-light)' : 'var(--text-3)' }} />
                    <span className="font-syne font-bold whitespace-nowrap" style={{ fontSize: 9, color: isActive ? 'var(--violet-light)' : 'var(--text-3)' }}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="bottom-nav-indicator"
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                        style={{ background: 'var(--violet-light)' }} />
                    )}
                  </motion.button>
                )
              })
            : navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== `/${role?.toLowerCase()}/dashboard` && location.pathname.startsWith(item.path))
                return (
                  <motion.button
                    key={item.path}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => navigate(item.path)}
                    className="flex flex-col items-center justify-center gap-0.5 py-1 relative"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      flex: navItems.length <= 5 ? '1' : '0 0 auto',
                      minWidth: navItems.length > 5 ? 64 : undefined,
                      padding: '6px 10px',
                    }}
                  >
                    <item.icon size={18} style={{ color: isActive ? 'var(--violet-light)' : 'var(--text-3)' }} />
                    <span className="font-syne font-bold whitespace-nowrap" style={{ fontSize: 9, color: isActive ? 'var(--violet-light)' : 'var(--text-3)' }}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="bottom-nav-indicator"
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                        style={{ background: 'var(--violet-light)' }} />
                    )}
                  </motion.button>
                )
              })
          }
        </nav>
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck } from 'lucide-react'
import { useSocketEvent } from '@/hooks'
import { useUiStore } from '@/stores'
import api from '@/lib/axios'
import { timeFromNow } from '@/lib/utils'
import { toast } from 'sonner'

interface Notif {
  id: string
  type: string
  title: string
  message?: string
  is_read: boolean
  created_at: string
  business_name?: string
  data?: Record<string, any>
}

interface Props {
  role: 'owner' | 'staff' | 'customer'
  title?: string
  description?: string
}

const NOTIF_EMOJI: Record<string, string> = {
  // bookings
  BOOKING_CONFIRMED:        '📅',
  BOOKING_CANCELLED:        '❌',
  NEW_BOOKING:              '📅',
  BOOKING_CANCEL:           '❌',
  // service
  CUSTOMER_CHECKED_IN:      '✅',
  SERVICE_COMPLETED:        '🎉',
  SERVICE_COMPLETE:         '🎉',
  // queue / reminders
  QUEUE_SHIFTED:            '⏱',
  DELAY_REPORTED:           '⚡',
  REMINDER_1_HOUR:          '⏰',
  REMINDER_15_MIN:          '⏰',
  REMINDER:                 '⏰',
  // leaves
  LEAVE_APPROVED:           '🌿',
  LEAVE_REJECTED:           '🚫',
  LEAVE:                    '🌿',
  // reviews / payments
  CUSTOMER_REVIEW:          '⭐',
  REVIEW_RECEIVED:          '⭐',
  REVIEW_REQUEST:           '⭐',
  PAYMENT_SETTLED:          '💰',
  PAYMENT:                  '💰',
  EARN:                     '💰',
  REFUND:                   '💸',
  ESCROW:                   '💰',
  SETTLE:                   '💰',
  // no show
  NO_SHOW:                  '👻',
  BOOKING_NO_SHOW:          '👻',
  // misc
  SYSTEM:                   '🛡️',
  ANNOUNCEMENT:             '🎁',
  HOLIDAY:                  '🗓️',
  SCHEDULE:                 '🗓️',
  STAFF:                    '👥',
  STAFF_JOINED:             '👥',
  BUSINESS:                 '🏢',
  BUSINESS_APPROVED:        '🏢',
}

function getEmoji(type: string): string {
  const t = (type ?? '').toUpperCase()
  // exact match first
  if (NOTIF_EMOJI[t]) return NOTIF_EMOJI[t]
  // substring match
  for (const [key, emoji] of Object.entries(NOTIF_EMOJI)) {
    if (t.includes(key)) return emoji
  }
  return '🔔'
}

function getColor(type: string): { color: string; bg: string } {
  const t = (type ?? '').toUpperCase()
  if (t.includes('CANCEL') || t.includes('REJECT') || t.includes('NO_SHOW'))
    return { color: 'var(--red)', bg: 'var(--red-bg)' }
  if (t.includes('PAYMENT') || t.includes('EARN') || t.includes('SETTLE') || t.includes('COMPLETE') || t.includes('CHECKED_IN') || t.includes('APPROVED') || t.includes('BUSINESS'))
    return { color: 'var(--green)', bg: 'var(--green-bg)' }
  if (t.includes('REVIEW') || t.includes('RATING') || t.includes('STAR') || t.includes('REMINDER') || t.includes('DELAY') || t.includes('QUEUE') || t.includes('HOLIDAY') || t.includes('SCHEDULE'))
    return { color: 'var(--yellow)', bg: 'rgba(245,158,11,0.13)' }
  if (t.includes('LEAVE'))
    return { color: 'var(--green)', bg: 'var(--green-bg)' }
  // default violet (booking, staff, system, announcement)
  return { color: 'var(--violet-light)', bg: 'var(--violet-bg)' }
}

function NotifCard({ n, onRead }: { n: Notif; onRead: (id: string) => void }) {
  const isUnread = !n.is_read
  const { color, bg } = getColor(n.type)
  const emoji = getEmoji(n.type)
  const extra = (n.data ?? {}) as any

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => { if (isUnread) onRead(n.id) }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        cursor: isUnread ? 'pointer' : 'default',
        background: isUnread ? bg : 'var(--bg-card)',
        border: isUnread ? `1px solid ${color}40` : '1px solid var(--border)',
        borderLeft: isUnread ? `3px solid ${color}` : '1px solid var(--border)',
        opacity: isUnread ? 1 : 0.72,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 17,
        background: isUnread ? `${color}22` : 'var(--bg-surface)',
        border: `1px solid ${isUnread ? color + '30' : 'var(--border)'}`,
      }}>
        {emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <p className="font-syne font-bold text-[13px] leading-snug"
            style={{ color: isUnread ? 'var(--text-1)' : 'var(--text-2)' }}>
            {n.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span className="text-[10px]" style={{ color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
              {timeFromNow(n.created_at)}
            </span>
            {isUnread && (
              <motion.div
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
              />
            )}
          </div>
        </div>

        {n.message && (
          <p className="text-[11px] mt-0.5 line-clamp-2"
            style={{ color: isUnread ? 'var(--text-2)' : 'var(--text-3)' }}>
            {n.message}
            {extra?.staffName && ` · ${extra.staffName}`}
            {extra?.businessName && ` · ${extra.businessName}`}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {isUnread && (
            <span className="font-syne font-black text-[9px] px-1.5 py-0.5 rounded-[4px]"
              style={{ background: color, color: '#fff', letterSpacing: '.04em' }}>
              NEW
            </span>
          )}
          <span className="text-[9px] font-syne px-2 py-0.5 rounded-[4px] uppercase tracking-wide"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-4)', border: '1px solid var(--border)' }}>
            {(n.type ?? '').replace(/_/g, ' ').toLowerCase()}
          </span>
          {n.business_name && (
            <span className="text-[9px] font-syne font-bold px-2 py-0.5 rounded-[4px]"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              {n.business_name}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── section label ──────────────────────────────────────────────── */
function SectionLabel({ dot, label }: { dot?: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 }}>
      {dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
      <p className="font-syne font-bold text-[10px] uppercase tracking-widest"
        style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 14px',
      borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--bg-surface)' }}
        className="animate-pulse" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, borderRadius: 6, background: 'var(--bg-surface)', width: '55%' }}
          className="animate-pulse" />
        <div style={{ height: 11, borderRadius: 6, background: 'var(--bg-surface)', width: '80%' }}
          className="animate-pulse" />
        <div style={{ height: 9, borderRadius: 6, background: 'var(--bg-surface)', width: '28%' }}
          className="animate-pulse" />
      </div>
    </div>
  )
}

export function NotificationsPage({ role, title = 'Notifications', description }: Props) {
  const qc = useQueryClient()
  const { resetBadge, decrementBadge } = useUiStore()

  const [pages, setPages]               = useState<Notif[][]>([])
  const [page, setPage]                 = useState(1)
  const [hasMore, setHasMore]           = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [unreadCount, setUnreadCount]   = useState(0)
  const [filterUnread, setFilterUnread] = useState(false)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const fetchingRef  = useRef(false)

  const baseUrl = `/${role}/notifications`

  const fetchPage = useCallback(async (p: number, unread: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await api.get(baseUrl, {
        params: { page: p, limit: 20, unread: unread || undefined },
      })
      const raw         = res.data?.data
      const notifs: Notif[] = raw?.notifications ?? (Array.isArray(raw) ? raw : [])
      const total_pages = raw?.pagination?.totalPages ?? raw?.pagination?.total_pages ?? 1
      const unread_cnt  = raw?.unread_count ?? 0

      if (p === 1) {
        setPages([notifs])
        setUnreadCount(unread_cnt)
        resetBadge(unread_cnt)
        setInitialLoading(false)
      } else {
        setPages(prev => [...prev, notifs])
      }
      setHasMore(p < total_pages)
    } catch {
      if (p === 1) setInitialLoading(false)
    } finally {
      fetchingRef.current = false
      setLoadingMore(false)
    }
  }, [baseUrl, resetBadge])

  useEffect(() => {
    setPages([])
    setPage(1)
    setHasMore(true)
    setInitialLoading(true)
    fetchingRef.current = false
    fetchPage(1, filterUnread)
  }, [filterUnread, fetchPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
          const next = page + 1
          setPage(next)
          setLoadingMore(true)
          fetchPage(next, filterUnread)
        }
      },
      { rootMargin: '400px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, page, filterUnread, fetchPage])

  const refresh = useCallback(() => {
    setPages([])
    setPage(1)
    setHasMore(true)
    setInitialLoading(true)
    fetchingRef.current = false
    fetchPage(1, filterUnread)
  }, [fetchPage, filterUnread])

  useSocketEvent('notification:new', refresh)

  const readMut = useMutation({
    mutationFn: (id: string) => api.patch(`${baseUrl}/${id}/read`),
    onMutate: (id) => {
      setPages(prev => prev.map(pg => pg.map(n => n.id === id ? { ...n, is_read: true } : n)))
      setUnreadCount(c => Math.max(0, c - 1))
      decrementBadge()
    },
  })

  const readAllMut = useMutation({
    mutationFn: () => api.patch(`${baseUrl}/read-all`),
    onSuccess: () => {
      toast.success('All notifications marked as read')
      setPages(prev => prev.map(pg => pg.map(n => ({ ...n, is_read: true }))))
      setUnreadCount(0)
      resetBadge(0)
      qc.invalidateQueries({ queryKey: [`${role}-notif-preview`] })
    },
  })

  const all    = Array.from(new Map(pages.flat().map(n => [n.id, n])).values())
  const unread = all.filter(n => !n.is_read)
  const read   = all.filter(n => n.is_read)

  return (
    /* No min-h-screen — page is exactly as tall as content, so no dead gap at bottom.
       pb-14 = 56px to exactly clear the fixed mobile nav bar. lg:pb-4 for desktop. */
    <div style={{ background: 'var(--bg-page)', paddingBottom: 'calc(var(--nav-height, 56px) + 8px)' }}>
      <div className="px-3 py-5 sm:px-4 md:px-6 lg:px-8" style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ── Header: always stacked (title → description → buttons) ── */}
        <div style={{ marginBottom: 20 }}>
          {/* Row 1: title + unread badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 className="font-syne font-black" style={{ fontSize: 24, color: 'var(--text-1)' }}>{title}</h1>
            {unreadCount > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center justify-center font-syne font-black text-[11px]"
                style={{ minWidth: 24, height: 24, borderRadius: 12, background: 'var(--violet)', color: '#fff', padding: '0 6px' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </div>
          {/* Row 2: description */}
          <p className="text-[12px]" style={{ color: 'var(--text-3)', marginBottom: 12 }}>
            {description ?? (unreadCount > 0 ? `${unreadCount} unread · live` : 'All caught up · live')}
          </p>
          {/* Row 3: action buttons — always in their own row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setFilterUnread(o => !o)}
              className="flex items-center gap-1.5 font-syne font-bold text-[12px]"
              style={{
                padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
                background: filterUnread ? 'var(--violet-bg)' : 'var(--bg-surface)',
                color: filterUnread ? 'var(--violet-light)' : 'var(--text-2)',
                border: `1px solid ${filterUnread ? 'var(--violet-border)' : 'var(--border)'}`,
              }}>
              <Bell size={12} />Unread only
            </button>
            {unreadCount > 0 && (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => readAllMut.mutate()}
                disabled={readAllMut.isPending}
                className="flex items-center gap-1.5 font-syne font-bold text-[12px] disabled:opacity-50"
                style={{
                  padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
                  background: 'var(--bg-surface)', color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}>
                <CheckCheck size={13} />Mark all read
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        {initialLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : all.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🔔</div>
            <p className="font-syne font-black text-[18px] mb-2" style={{ color: 'var(--text-1)' }}>
              {filterUnread ? 'No unread notifications' : 'All caught up!'}
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
              {filterUnread
                ? 'Toggle the filter to see all notifications.'
                : 'Booking alerts, payments and updates appear here.'}
            </p>
            {filterUnread && (
              <button onClick={() => setFilterUnread(false)}
                className="font-syne font-bold text-[12px] mt-4"
                style={{
                  padding: '8px 18px', borderRadius: 10,
                  background: 'var(--bg-surface)', color: 'var(--text-2)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}>
                Show all
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Unread ── */}
              {unread.length > 0 && (
                <div>
                  <SectionLabel dot="var(--violet-light)" label={`New · ${unread.length}`} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {unread.map(n => (
                      <NotifCard key={n.id} n={n} onRead={id => readMut.mutate(id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Read ── */}
              {read.length > 0 && (
                <div>
                  {unread.length > 0 && <SectionLabel label={`Earlier · ${read.length}`} />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {read.map(n => (
                      <NotifCard key={n.id} n={n} onRead={id => readMut.mutate(id)} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          </AnimatePresence>
        )}

        {/* Sentinel — placed AFTER content, fires 400px early so next page is ready before user hits end */}
        {!initialLoading && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

        {/* 3 dots — only while actually fetching more, never after last page */}
        {loadingMore && hasMore && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '8px 0' }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                transition={{ duration: 0.9, delay: i * 0.15, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--violet-light)' }}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

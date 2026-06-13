import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, Star, ChevronDown,
  LayoutGrid, List, Scissors, RefreshCw, AlertCircle, Sparkles,
  Clock, ArrowRight, Scissors as ScissorsIcon,
} from 'lucide-react'
import { useDebounce, useIntersectionObserver, usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { INDIA_STATES, getCitiesForState } from '@/data/india'
import { toast } from 'sonner'
import type { BusinessCardDTO } from '@/types'

/* ─── Inline dropdown ───────────────────────────────────────────── */
function Dropdown({ label, value, options, onChange, placeholder, disabled, isMobile, fullWidth, icon }: {
  label: string; value: string; options: string[]
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean; isMobile?: boolean; fullWidth?: boolean; icon?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const openMenu = () => {
    if (disabled) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Use viewport loordinates for fixed positioning (avoid adding scroll offsets)
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(170, r.width) })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const h = () => setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" disabled={disabled} onClick={openMenu}
        className="flex items-center gap-1.5 rounded-xl font-syne font-bold text-xs whitespace-nowrap transition-all"
        style={{ height: isMobile ? 34 : 36, padding: '0 12px', fontSize: 12, background: value ? 'var(--violet-bg)' : 'var(--bg-surface)',
          border: `1px solid ${value ? 'var(--violet-border)' : 'var(--border)'}`,
          color: value ? 'var(--violet-light)' : 'var(--text-2)',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, borderRadius: 12, width: fullWidth ? '100%' : undefined }}>
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span>{value || label}</span>
        <ChevronDown size={isMobile ? 12 : 14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            onMouseDown={e => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width,
              maxHeight: 220, overflowY: 'auto', zIndex: 9999,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {placeholder && (
              <div onClick={() => { onChange(''); setOpen(false) }}
                className="px-3 py-2 text-xs cursor-pointer font-syne font-bold"
                style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{placeholder}</div>
            )}
            {options.map(o => (
              <div key={o} onClick={() => { onChange(o); setOpen(false) }} className="px-3 py-2.5 text-xs cursor-pointer"
                style={{ color: value === o ? 'var(--violet-light)' : 'var(--text-2)',
                  background: value === o ? 'var(--violet-bg)' : 'transparent', fontWeight: value === o ? 700 : 400 }}>{o}</div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const RATING_OPTIONS = [{ label: 'All Ratings', value: '' }, { label: '4★ & Up', value: '4' }, { label: '3★ & Up', value: '3' }]

function RatingDropdown({ value, onChange, isMobile, fullWidth }: { value: string; onChange: (v: string) => void; isMobile?: boolean; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const selected = RATING_OPTIONS.find(r => r.value === value)

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Use viewport loordinates for fixed positioning (avoid adding scroll offsets)
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const h = () => setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" onClick={openMenu}
        className="flex items-center gap-1.5 rounded-xl font-syne font-bold text-xs whitespace-nowrap"
        style={{ height: isMobile ? 34 : 36, padding: '0 12px', fontSize: 12, background: value ? 'var(--violet-bg)' : 'var(--bg-surface)',
          border: `1px solid ${value ? 'var(--violet-border)' : 'var(--border)'}`,
          color: value ? 'var(--violet-light)' : 'var(--text-2)', cursor: 'pointer', borderRadius: 12, width: fullWidth ? '100%' : undefined }}>
        <Star size={isMobile ? 12 : 14} /><span style={{ marginLeft: 6 }}>{selected?.label || 'Rating'}</span>
        <ChevronDown size={isMobile ? 12 : 14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onMouseDown={e => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: 150, zIndex: 9999,
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {RATING_OPTIONS.map(r => (
              <div key={r.value} onClick={() => { onChange(r.value); setOpen(false) }} className="px-3 py-2.5 text-xs cursor-pointer"
                style={{ color: value === r.value ? 'var(--violet-light)' : 'var(--text-2)',
                  background: value === r.value ? 'var(--violet-bg)' : 'transparent', fontWeight: value === r.value ? 700 : 400 }}>{r.label}</div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Open Now filter removed from UI per requested design

function BizCardGrid({ biz, onFav, onClick, onBook, isMobile }: { biz: BusinessCardDTO; onFav: (id: string) => void; onClick: () => void; onBook: () => void; isMobile?: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      className="q-card cursor-pointer overflow-hidden" style={{ padding: 0 }} onClick={onClick}>
      {/* Hero image */}
      <div style={{ position: 'relative', height: isMobile ? 180 : 200, background: 'var(--bg-surface)', overflow: 'hidden', borderRadius: 14 }}>
          {biz.primary_image && !imgErr ? (
          <img src={biz.primary_image} alt={biz.business_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
            onError={() => setImgErr(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--violet-bg), var(--bg-surface))' }}>
            <Scissors size={36} style={{ color: 'var(--violet-light)', opacity: 0.5 }} />
          </div>
        )}
        {/* Gradient overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)', borderRadius: 14 }} />

        {/* Open/Closed badge (top right) */}
        {typeof biz.is_open_now === 'boolean' && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-syne font-bold"
              style={{ background: biz.is_open_now ? '#10b981' : '#ef4444', color: '#fff', borderRadius: 10, padding: '6px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              {biz.is_open_now ? 'OPEN NOW' : 'CLOSED'}
            </span>
          </div>
        )}

        {/* Service type badge (bottom left on image) */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="font-syne font-bold" style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.95)', color: '#e8d5ff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            {biz.service_for}
          </span>
        </div>
      </div>

      {/* Card body - reduced padding and spacing */}
        <div style={{ padding: 12 }}>
          <h3 className="font-syne font-black" style={{ fontSize: 15, color: 'var(--text-1)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {biz.business_name}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {biz.average_rating > 0 ? (
              <>
                <Star size={14} fill="#f59e0b" style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 700 }}>{biz.average_rating.toFixed(1)}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>({biz.total_reviews} Reviews)</span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>No reviews yet</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>👤</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{biz.owner_name || '—'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>📍</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {biz.address_line1 ? `${biz.address_line1}, ` : ''}{biz.city}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>🕒</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
              {(biz.opening_time || biz.closing_time) ? `${biz.opening_time?.slice(0,5)} - ${biz.closing_time?.slice(0,5)}` : '—'}
            </span>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} whileHover={{ y: -1 }} onClick={e => { e.stopPropagation(); onBook() }}
            style={{ 
              width: '100%', 
              height: 44, 
              borderRadius: 12, 
              fontSize: 14, 
              background: 'linear-gradient(135deg, #7C3AED, #9333EA)', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              fontFamily: 'Syne', 
              fontWeight: 700, 
              boxShadow: '0 4px 14px rgba(124,58,237,0.25)',
              transition: 'all 0.2s'
            }}>
            View Details
          </motion.button>
        </div>
      
    </motion.div>
  )
}

function BizCardList({ biz, onFav, onClick, onBook, isMobile }: { biz: BusinessCardDTO; onFav: (id: string) => void; onClick: () => void; onBook: () => void; isMobile?: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      whileTap={{ scale: 0.99 }} className="q-card cursor-pointer"
      style={{ padding: '14px 15px' }} onClick={onClick}>
      <div style={{ display: 'flex', gap: 14 }}>
        {/* Image */}
        <div style={{ width: 88, height: 88, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface)', position: 'relative' }}>
          {biz.primary_image && !imgErr ? (
            <img src={biz.primary_image} alt={biz.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--violet-bg), var(--bg-surface))' }}>
              <Scissors size={24} style={{ color: 'var(--violet-light)', opacity: 0.6 }} />
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <div style={{ minWidth: 0 }}>
              <h3 className="font-syne font-black" style={{ fontSize: 14.5, color: 'var(--text-1)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {biz.business_name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', fontFamily: 'Syne', fontWeight: 700 }}>
                  {biz.service_for}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Owner:</div>
              <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 800 }}>{biz.owner_name || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Rating:</div>
              <div style={{ fontSize: 12, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                {biz.average_rating > 0 ? (
                  <>
                    <Star size={12} fill="#f59e0b" style={{ color: '#f59e0b' }} /> {biz.average_rating.toFixed(1)} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>({biz.total_reviews})</span>
                  </>
                ) : 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Address:</div>
              <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 800 }}>
                {biz.address_line1 ? `${biz.address_line1}, ` : ''}{biz.city}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <motion.button whileTap={{ scale: 0.98 }} whileHover={{ y: -1 }} onClick={e => { e.stopPropagation(); onBook() }}
              style={{ 
                width: '100%', 
                height: 44, 
                borderRadius: 12, 
                fontSize: 14, 
                background: 'linear-gradient(135deg, #7C3AED, #9333EA)', 
                color: '#fff', 
                border: 'none', 
                cursor: 'pointer', 
                fontFamily: 'Syne', 
                fontWeight: 700, 
                boxShadow: '0 4px 14px rgba(124,58,237,0.25)',
                transition: 'all 0.2s'
              }}>
              View Details
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function GridSkel() {
  return (
    <div className="q-card overflow-hidden" style={{ padding: 0 }}>
      <div className="skeleton" style={{ height: 200 }} />
      <div style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton rounded" style={{ height: 15, width: '70%' }} />
        <div className="skeleton rounded" style={{ height: 11, width: '50%' }} />
        <div className="skeleton rounded" style={{ height: 11, width: '60%' }} />
        <div className="skeleton rounded-lg" style={{ height: 38, marginTop: 4 }} />
      </div>
    </div>
  )
}
function ListSkel() {
  return (
    <div className="q-card flex items-center gap-3" style={{ padding: '12px 14px' }}>
      <div className="skeleton rounded-xl flex-shrink-0" style={{ width: 72, height: 72 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="skeleton rounded" style={{ height: 13, width: '60%' }} />
        <div className="skeleton rounded" style={{ height: 10, width: '45%' }} />
        <div className="skeleton rounded" style={{ height: 10, width: '35%' }} />
      </div>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-syne font-bold flex-shrink-0"
      style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
      {label}
      <button type="button" onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0 }}>
        <X size={10} />
      </button>
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════ */
export default function CustomerExplore() {
  usePageTitle('Explore Salons')
  const navigate = useNavigate()
  const ql = useQueryClient()

  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // Desktop pagination state
  

  /* Load profile city - always fresh (kept for potential future use) */
  const { data: profileData } = useQuery<{ city: string; state: string } | null>({
    queryKey: ['customer-profile-for-explore'],
    queryFn: async () => {
      try { const res = await api.get('/customer/profile'); return res.data.data } catch { return null }
    },
    staleTime: 0,
    gcTime: 0,
  })

  const [query,     setQuery]     = useState('')
  const [state,     setState]     = useState('')
  const [city,      setCity]      = useState('')
  const [minRating, setMinRating] = useState('')
  const [isOpen,    setIsOpen]    = useState(false)
  const [svcFor,    setSvlFor]    = useState<'' | 'MEN' | 'UNISEX'>('')
  const [viewMode,  setViewMode]  = useState<'grid' | 'list'>('grid')
  // FIX: Tralk whether we've applied the profile city, AND tralk if it was applied
  const [cityInit,  setCityInit]  = useState(false)

  /* Synl city from profile only on first load — then trigger re-fetlh */
  useEffect(() => {
    if (profileData && !cityInit) {
      if (profileData.state) setState(profileData.state)
      if (profileData.city)  setCity(profileData.city)
      setCityInit(true)
      ql.invalidateQueries({ queryKey: ['customer-explore'] })
    }
  }, [profileData, cityInit, ql])

  const dQuery = useDebounce(query, 400)
  const lities = getCitiesForState(state)

  // FIX: Only run the query onle we know if there's a profile city to load
  // Use enabled: true always, but the queryKey will lhange onle cityInit is true
  // This ensures we don't show results from the wrong city then re-fetlh
  const queryKey = ['customer-explore', { dQuery, state, city, minRating, svcFor, cityInit }]

  // Use a single infinite query for both mobile and desktop (infinite scroll everywhere)
  const infiniteQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get('/customer/explore', {
        params: {
          query: dQuery || undefined, state: state || undefined, city: city || undefined,
          min_rating: minRating ? Number(minRating) : undefined,
          service_for: svcFor || undefined,
          page: pageParam, limit: 12,
        },
      })
      return res.data
    },
    getNextPageParam: (last) => {
      const p = last.data?.pagination ?? last.pagination
      return p && p.page < p.total_pages ? p.page + 1 : undefined
    },
    initialPageParam: 1,
    staleTime: 30_000,
    enabled: (cityInit || profileData === null),
  })

  const { data, fetlhNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = infiniteQuery as any

  let businesses: BusinessCardDTO[] = data?.pages.flatMap((p: any) => p.data?.businesses ?? p.data ?? []) ?? []
  let totalCount = data?.pages?.[0]?.data?.pagination?.total ?? data?.pages?.[0]?.pagination?.total ?? 0
  let pagination: any = data?.pages?.[data.pages.length - 1]?.data?.pagination ?? data?.pages?.[0]?.data?.pagination ?? null

  const favMutation = useMutation({
    mutationFn: (id: string) => api.post(`/customer/favourites/${id}`),
    onMutate: async (id) => {
      await ql.cancelQueries({ queryKey: ['customer-explore'] })
      ql.setQueriesData({ queryKey: ['customer-explore'] }, (old: any) => {
        if (!old?.pages) return old
        return { ...old, pages: old.pages.map((page: any) => ({ ...page, data: { ...page.data, businesses: (page.data?.businesses ?? []).map((b: BusinessCardDTO) => b.id === id ? { ...b, is_favourite: !b.is_favourite } : b) } })) }
      })
    },
    onError: () => toast.error('Failed to update favourite.'),
    onSettled: () => ql.invalidateQueries({ queryKey: ['customer-favourites'] }),
  })

  const sentinelRef = useIntersectionObserver(
    useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetlhNextPage() }, [hasNextPage, isFetchingNextPage, fetlhNextPage])
  )

  const hasFilters = !!(dQuery || state || city || minRating || svcFor)
  const resetFilters = () => { setQuery(''); setState(''); setCity(''); setMinRating(''); setSvlFor('') }

  // FIX: Show loading state while we're waiting for profile city to load
  const isInitializing = !cityInit && profileData === undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Fixed search + filters ── */}
      <div style={{ padding: isMobile ? '8px 12px' : '12px 16px', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: isMobile ? 8 : 12 }}>
          <Search size={isMobile ? 12 : 14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search salons, services, or locations" className="q-input"
            style={{ width: '100%', paddingLeft: 44, paddingRight: query ? 44 : 14, height: isMobile ? 42 : 44, fontSize: isMobile ? 13 : 14, borderRadius: 12 }} />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              <X size={isMobile ? 12 : 14} />
            </button>
          )}
        </div>

        {/* Structured filters row: Desktop compact inline, Mobile two rows (type+rating / state+city) */}
        {!isMobile ? (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 6 }}>Salon Type:</span>
              <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', alignItems: 'center' }}>
                <button type="button" onClick={() => setSvlFor(prev => prev === 'MEN' ? '' : 'MEN')}
                  style={{ height: 36, padding: '0 12px', fontSize: 12, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700,
                    background: svcFor === 'MEN' ? 'var(--violet-bg)' : 'transparent', color: svcFor === 'MEN' ? 'var(--violet-light)' : 'var(--text-2)' }}>
                  Men
                </button>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }} />
                <button type="button" onClick={() => setSvlFor(prev => prev === 'UNISEX' ? '' : 'UNISEX')}
                  style={{ height: 36, padding: '0 12px', fontSize: 12, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700,
                    background: svcFor === 'UNISEX' ? 'var(--violet-bg)' : 'transparent', color: svcFor === 'UNISEX' ? 'var(--violet-light)' : 'var(--text-2)' }}>
                  Unisex
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 6 }}>Rating:</span>
              <RatingDropdown value={minRating} onChange={setMinRating} isMobile={isMobile} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 6 }}>State:</span>
              <Dropdown label="State" value={state} placeholder="State" options={INDIA_STATES}
                onChange={v => { setState(v); setCity('') }} isMobile={isMobile} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 6 }}>City:</span>
              <Dropdown label="City" value={city} placeholder="City" options={lities}
                onChange={setCity} disabled={!state} isMobile={isMobile} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Salon Type:</div>
                <div style={{ width: '100%' }}><Dropdown label="Type" value={svcFor} placeholder="All" options={["MEN","UNISEX"]} onChange={v => setSvlFor(v as ''|'MEN'|'UNISEX')} isMobile={isMobile} fullWidth icon={<ScissorsIcon size={12} />} /></div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Rating:</div>
                <div style={{ width: '100%' }}><RatingDropdown value={minRating} onChange={setMinRating} isMobile={isMobile} fullWidth /></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>State:</div>
                <div style={{ width: '100%' }}><Dropdown label="State" value={state} placeholder="State" options={INDIA_STATES}
                  onChange={v => { setState(v); setCity('') }} isMobile={isMobile} fullWidth /></div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>City:</div>
                <div style={{ width: '100%' }}><Dropdown label="City" value={city} placeholder="City" options={lities}
                  onChange={setCity} disabled={!state} isMobile={isMobile} fullWidth /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed results header */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {isMobile ? (
          // Mobile: Stack layout
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                {!isLoading && !isInitializing && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                      {city && state ? `${city}, ${state}` : state ? state : 'All Locations'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>
                      {totalCount} Salons
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {hasFilters && (
                  <button type="button" onClick={resetFilters}
                    className="flex items-center gap-1 font-syne font-bold rounded-lg"
                    style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', padding: '5px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>
                    <RefreshCw size={11} /> Reset
                  </button>
                )}
                <div className="flex items-center rounded-xl p-0.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  {(['grid', 'list'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setViewMode(m)}
                      style={{ width: 28, height: 28, borderRadius: 10, background: viewMode === m ? 'var(--violet-bg)' : 'transparent',
                        color: viewMode === m ? 'var(--violet-light)' : 'var(--text-3)', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m === 'grid' ? <LayoutGrid size={12} /> : <List size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Desktop: Single row
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: '0 1 auto', minWidth: 0 }}>
              {!isLoading && !isInitializing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                    {city && state ? `${city}, ${state}` : state ? state : 'All Locations'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>•</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{totalCount} Salons</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
              {hasFilters && (
                <button type="button" onClick={resetFilters}
                  className="flex items-center gap-1 font-syne font-bold rounded-lg"
                  style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <RefreshCw size={12} /> Reset
                </button>
              )}
              <div className="flex items-center rounded-xl p-0.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {(['grid', 'list'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setViewMode(m)}
                    style={{ width: 32, height: 32, borderRadius: 10, background: viewMode === m ? 'var(--violet-bg)' : 'transparent',
                      color: viewMode === m ? 'var(--violet-light)' : 'var(--text-3)', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active chips */}
      {hasFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {state     && <FilterChip label={state}           onRemove={() => { setState(''); setCity('') }} />}
          {city      && <FilterChip label={city}            onRemove={() => setCity('')} />}
          {minRating && <FilterChip label={`${minRating}★+`} onRemove={() => setMinRating('')} />}
          {svcFor    && <FilterChip label={svcFor}          onRemove={() => setSvlFor('')} />}
          {dQuery    && <FilterChip label={`"${dQuery}"`}   onRemove={() => setQuery('')} />}
        </div>
      )}

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 80 }}>
        {(isLoading || isInitializing) ? (
          viewMode === 'grid'
            ? <>
                <style>{`
                  @media (min-width: 1024px) {
                    .explore-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                  }
                  @media (min-width: 640px) and (max-width: 1023px) {
                    .explore-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                  }
                  @media (max-width: 639px) {
                    .explore-grid { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
                  }
                `}</style>
                <div className="explore-grid" style={{ display: 'grid', gap: 14 }}>{[1,2,3,4,5,6].map(i => <GridSkel key={i} />)}</div>
              </>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3,4].map(i => <ListSkel key={i} />)}</div>
        ) : businesses.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Scissors size={26} style={{ color: 'var(--violet-light)' }} />
            </div>
            <h2 className="font-syne font-black" style={{ fontSize: 20, color: 'var(--text-1)', marginBottom: 8 }}>No salons found</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 320, lineHeight: 1.6, marginBottom: 20 }}>
              Try changing filters or location
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={resetFilters} className="q-btn-primary" style={{ padding: '9px 18px', fontSize: 13, borderRadius: 12 }}>Reset Filters</button>
            </div>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <>
            <style>{`
              @media (min-width: 1024px) {
                .explore-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
              }
              @media (min-width: 640px) and (max-width: 1023px) {
                .explore-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              }
              @media (max-width: 639px) {
                .explore-grid { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
              }
            `}</style>
            <div className="explore-grid" style={{ 
              display: 'grid', 
              gap: 14 
            }}>
              {businesses.map(b => <BizCardGrid key={b.id} biz={b} isMobile={isMobile} onFav={id => favMutation.mutate(id)} onClick={() => navigate(`/customer/business/${b.slug}`)} onBook={() => navigate(`/customer/business/${b.slug}`)} />)}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {businesses.map(b => <BizCardList key={b.id} biz={b} isMobile={isMobile} onFav={id => favMutation.mutate(id)} onClick={() => navigate(`/customer/business/${b.slug}`)} onBook={() => navigate(`/customer/business/${b.slug}`)} />)}
          </div>
        )}
        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {isFetchingNextPage && <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><div className="skeleton rounded-full" style={{ width: 32, height: 32 }} /></div>}
      </div>
    </div>
  )
}






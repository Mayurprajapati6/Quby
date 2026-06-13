import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Star, Clock, SlidersHorizontal, X, Search,
  Scissors, ChevronDown, TrendingUp, Sparkles,
  ArrowRight, LayoutGrid, List, Users, Award, Zap,
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { useDebounce, useIntersectionObserver } from '@/hooks'
import api from '@/lib/axios'
import type { BusinessCardDTO } from '@/types'
import { INDIA_STATES, getCitiesForState } from '@/data/india'

function Dropdown({ label, value, options, onChange, placeholder, disabled }: {
  label: string; value: string; options: string[]
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="xp-dd-wrap">
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(p => !p)}
        className={`xp-dd-btn${value ? ' xp-dd-btn--active' : ''}${disabled ? ' xp-dd-btn--disabled' : ''}`}
      >
        <span className="xp-dd-label">{label}</span>
        <span className="xp-dd-val">{value || placeholder || 'Any'}</span>
        <ChevronDown size={11} className={`xp-dd-caret${open ? ' xp-dd-caret--open' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="xp-dd-menu"
          >
            <div className="xp-dd-item xp-dd-item--none" onClick={() => { onChange(''); setOpen(false) }}>{placeholder || 'Any'}</div>
            {options.map(o => (
              <div key={o} className={`xp-dd-item${value === o ? ' xp-dd-item--sel' : ''}`}
                onClick={() => { onChange(o); setOpen(false) }}>{o}</div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Pill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  const cls = active
    ? color === 'green' ? 'xp-pill xp-pill--green'
    : color === 'red' ? 'xp-pill xp-pill--red'
    : 'xp-pill xp-pill--violet'
    : 'xp-pill'
  return <button type="button" className={cls} onClick={onClick}>{label}</button>
}

function CardSkel() {
  return (
    <div className="xp-card xp-skel">
      <div className="xp-card-img-wrap" style={{ height: 160, background: 'linear-gradient(90deg,var(--bg-surface) 25%,var(--bg-card) 50%,var(--bg-surface) 75%)', backgroundSize: '200% 100%', animation: 'xp-shimmer 1.4s infinite' }} />
      <div className="xp-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="xp-skel-line" style={{ width: '70%', height: 13 }} />
        <div className="xp-skel-line" style={{ width: '50%', height: 10 }} />
        <div className="xp-skel-line" style={{ width: '40%', height: 10 }} />
      </div>
    </div>
  )
}

function ListSkel() {
  return (
    <div className="xp-list-card xp-skel" style={{ pointerEvents: 'none' }}>
      <div className="xp-skel-box" style={{ width: 68, height: 68, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="xp-skel-line" style={{ width: '60%', height: 13 }} />
        <div className="xp-skel-line" style={{ width: '45%', height: 10 }} />
        <div className="xp-skel-line" style={{ width: '30%', height: 10 }} />
      </div>
    </div>
  )
}

function BizCardGrid({ biz, onClick }: { biz: BusinessCardDTO; onClick: () => void }) {
  const [err, setErr] = useState(false)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="xp-card"
      onClick={onClick}
    >
      <div className="xp-card-img-wrap">
        {biz.primary_image && !err
          ? <img src={biz.primary_image} alt={biz.business_name} className="xp-card-img" onError={() => setErr(true)} />
          : <div className="xp-card-img-fb"><Scissors size={28} /></div>
        }
        <div className="xp-card-grad" />
        <div className="xp-card-tl">
          <span className={`xp-badge${biz.is_open_now ? ' xp-badge--open' : ' xp-badge--closed'}`}>
            <span className="xp-badge-dot" />{biz.is_open_now ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="xp-card-tr">
          <span className="xp-badge xp-badge--svc">{biz.service_for}</span>
        </div>
        {biz.distance_km != null && (
          <div className="xp-card-br"><MapPin size={8} />{biz.distance_km.toFixed(1)} km</div>
        )}
      </div>
      <div className="xp-card-body">
        <h3 className="xp-card-name">{biz.business_name}</h3>
        <div className="xp-card-meta">
          <span className="xp-card-loc"><MapPin size={9} />{biz.city}, {biz.state}</span>
          <span className="xp-card-stars">
            <Star size={9} fill="currentColor" />{biz.average_rating.toFixed(1)}
            <span className="xp-card-rc">({biz.total_reviews})</span>
          </span>
        </div>
        {biz.opening_time && (
          <div className="xp-card-hrs"><Clock size={9} />{biz.opening_time} – {biz.closing_time}</div>
        )}
        <div className="xp-card-cta">Book now <ArrowRight size={11} /></div>
      </div>
    </motion.div>
  )
}

function BizCardList({ biz, onClick }: { biz: BusinessCardDTO; onClick: () => void }) {
  const [err, setErr] = useState(false)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      whileTap={{ scale: 0.99 }}
      className="xp-list-card"
      onClick={onClick}
    >
      <div className="xp-list-img-wrap">
        {biz.primary_image && !err
          ? <img src={biz.primary_image} alt={biz.business_name} className="xp-list-img" onError={() => setErr(true)} />
          : <div className="xp-list-img-fb"><Scissors size={18} /></div>
        }
        <span className={`xp-list-dot${biz.is_open_now ? ' open' : ''}`} />
      </div>
      <div className="xp-list-content">
        <div className="xp-list-row1">
          <h3 className="xp-list-name">{biz.business_name}</h3>
          <span className="xp-card-stars" style={{ fontSize: 11 }}>
            <Star size={9} fill="currentColor" />{biz.average_rating.toFixed(1)}
            <span className="xp-card-rc">({biz.total_reviews})</span>
          </span>
        </div>
        <div className="xp-list-meta">
          <MapPin size={9} />{biz.city}, {biz.state}
          {biz.opening_time ? <> · <Clock size={9} />{biz.opening_time}–{biz.closing_time}</> : null}
          {biz.distance_km != null ? <> · {biz.distance_km.toFixed(1)} km</> : null}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
          <span className="xp-badge xp-badge--svc" style={{ fontSize: 9 }}>{biz.service_for}</span>
          <span className={`xp-badge${biz.is_open_now ? ' xp-badge--open' : ' xp-badge--closed'}`} style={{ fontSize: 9 }}>
            <span className="xp-badge-dot" />{biz.is_open_now ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
      <ArrowRight size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
    </motion.div>
  )
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [serviceFor, setServiceFor] = useState('')
  const [minRating, setMinRating] = useState('')
  const [isOpen, setIsOpen] = useState<boolean | undefined>(undefined)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const debouncedSearch = useDebounce(search, 400)
  const cities = state ? getCitiesForState(state) : []
  const activeFilterCount = [state, city, serviceFor, minRating, isOpen !== undefined].filter(Boolean).length
  const handleStateChange = (s: string) => { setState(s); setCity('') }
  const clearAll = () => { setSearch(''); setState(''); setCity(''); setServiceFor(''); setMinRating(''); setIsOpen(undefined) }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['public-explore', { q: debouncedSearch, state, city, serviceFor, minRating, isOpen }],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get('/explore', {
        params: {
          name: debouncedSearch || undefined,
          city: city || undefined,
          state: state || undefined,
          service_for: serviceFor || undefined,
          min_rating: minRating || undefined,
          is_open: isOpen,
          page: pageParam,
          limit: 12,
        },
      })
      return res.data.data as { businesses: BusinessCardDTO[]; pagination: { total: number; page: number; limit: number; total_pages: number } }
    },
    getNextPageParam: (last) => {
      const p = last?.pagination; if (!p) return undefined
      return p.page < (p.total_pages ?? 1) ? p.page + 1 : undefined
    },
    initialPageParam: 1,
    staleTime: 5 * 60_000,
  })

  const allBiz = data?.pages.flatMap(p => p.businesses ?? []) ?? []
  const totalCount = data?.pages[0]?.pagination?.total ?? 0
  const loadMore = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  const sentinelRef = useIntersectionObserver(loadMore)

  return (
    <>
      <style>{XP_CSS}</style>
      <div className="xp-root">

        {/* HEADER */}
        <header className="xp-header">
          <div className="xp-header-inner">
            <div className="xp-header-top">
              <Logo variant="compact" />
              <div className="xp-tagline">
                <Sparkles size={12} style={{ color: 'var(--violet-light)' }} />
                <span>Discover India's finest salons</span>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/login')} className="xp-sign-btn">
                Sign in <ArrowRight size={12} />
              </motion.button>
            </div>

            <div className="xp-search-row">
              <div className="xp-search-box">
                <Search size={15} className="xp-search-ico" />
                <input type="text" className="xp-search-inp" placeholder="Search salons by name…"
                  value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button type="button" className="xp-search-clr" onClick={() => setSearch('')}><X size={12} /></button>}
              </div>
              <motion.button whileTap={{ scale: 0.94 }}
                onClick={() => setShowFilters(p => !p)}
                className={`xp-filter-toggle${showFilters || activeFilterCount > 0 ? ' active' : ''}`}
              >
                <SlidersHorizontal size={14} />
                {activeFilterCount > 0 && <span className="xp-fcount">{activeFilterCount}</span>}
              </motion.button>
              <div className="xp-view-toggle">
                <button type="button" className={`xp-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid size={13} /></button>
                <button type="button" className={`xp-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}><List size={13} /></button>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="xp-filter-panel"
                >
                  <div className="xp-filter-dropdowns">
                    <Dropdown label="State" value={state} options={INDIA_STATES} onChange={handleStateChange} placeholder="All states" />
                    <Dropdown label="City" value={city} options={cities} onChange={setCity} placeholder={state ? 'All cities' : 'Select state first'} disabled={!state} />
                    <Dropdown label="Min Rating" value={minRating} options={['3', '3.5', '4', '4.5']} onChange={setMinRating} placeholder="Any rating" />
                  </div>
                  <div className="xp-chips-row">
                    <span className="xp-chips-label">For</span>
                    {(['', 'MEN', 'WOMEN', 'UNISEX'] as const).map(v => (
                      <Pill key={v} label={v || 'All'} active={serviceFor === v} onClick={() => setServiceFor(v)} />
                    ))}
                  </div>
                  <div className="xp-chips-row">
                    <span className="xp-chips-label">Status</span>
                    <Pill label="Any" active={isOpen === undefined} onClick={() => setIsOpen(undefined)} />
                    <Pill label="Open now" active={isOpen === true} onClick={() => setIsOpen(true)} color="green" />
                    <Pill label="Closed" active={isOpen === false} onClick={() => setIsOpen(false)} color="red" />
                    {activeFilterCount > 0 && (
                      <button type="button" className="xp-clear-all" onClick={clearAll}><X size={10} /> Clear all</button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* STATS BAR */}
        <div className="xp-stats-bar">
          <div className="xp-stats-inner">
            {[
              { icon: <Scissors size={13} />, val: '500+', lbl: 'Verified Salons' },
              { icon: <Users size={13} />, val: '20K+', lbl: 'Happy Clients' },
              { icon: <Award size={13} />, val: '4.8★', lbl: 'Avg Rating' },
              { icon: <Zap size={13} />, val: 'Instant', lbl: 'Booking' },
            ].map((s, i) => (
              <div key={i} className="xp-stat">
                <span className="xp-stat-icon">{s.icon}</span>
                <span className="xp-stat-val">{s.val}</span>
                <span className="xp-stat-lbl">{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN */}
        <main className="xp-main">
          <div className="xp-results-hdr">
            <div>
              <span className="xp-results-num">{isLoading ? '…' : totalCount.toLocaleString()}</span>
              <span className="xp-results-lbl"> salon{totalCount !== 1 ? 's' : ''} found{(city || state) ? ` in ${city || state}` : ''}</span>
            </div>
            {!isLoading && totalCount > 0 && (
              <span className="xp-results-sort"><TrendingUp size={11} /> Highest rated first</span>
            )}
          </div>

          {isLoading ? (
            <div className={viewMode === 'grid' ? 'xp-grid' : 'xp-list-wrap'}>
              {Array.from({ length: 6 }).map((_, i) =>
                viewMode === 'grid' ? <CardSkel key={i} /> : <ListSkel key={i} />
              )}
            </div>
          ) : allBiz.length === 0 ? (
            <div className="xp-empty">
              <div className="xp-empty-icon"><Scissors size={32} /></div>
              <h3 className="xp-empty-title">No salons found</h3>
              <p className="xp-empty-desc">
                {city ? `No salons in ${city}. Try a different city or clear filters.`
                  : state ? `No salons in ${state}. Try a different state.`
                  : 'Try adjusting your search or filters.'}
              </p>
              {activeFilterCount > 0 && (
                <button type="button" className="xp-empty-btn" onClick={clearAll}>Clear filters</button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className={viewMode === 'grid' ? 'xp-grid' : 'xp-list-wrap'}>
                {allBiz.map(biz =>
                  viewMode === 'grid'
                    ? <BizCardGrid key={biz.id} biz={biz} onClick={() => navigate(`/businesses/${biz.slug}`)} />
                    : <BizCardList key={biz.id} biz={biz} onClick={() => navigate(`/businesses/${biz.slug}`)} />
                )}
              </div>
            </AnimatePresence>
          )}

          <div ref={sentinelRef} className="xp-sentinel">
            {isFetchingNextPage && (
              <div className="xp-loader">
                {[0,1,2].map(i => (
                  <motion.span key={i} className="xp-loader-dot"
                    animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            )}
            {!hasNextPage && allBiz.length > 6 && !isFetchingNextPage && (
              <p className="xp-end-msg">All salons loaded</p>
            )}
          </div>
        </main>

        {/* FOOTER CTA */}
        <div className="xp-footer-cta">
          <div className="xp-footer-cta-inner">
            <span className="xp-footer-cta-txt">
              <Sparkles size={12} style={{ color: 'var(--violet-light)' }} />
              Sign in to save favourites &amp; get personalised results
            </span>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/login')} className="xp-footer-cta-btn">
              Get started <ArrowRight size={12} />
            </motion.button>
          </div>
        </div>
      </div>
    </>
  )
}

const XP_CSS = `
.xp-root{min-height:100vh;background:var(--bg-page);display:flex;flex-direction:column}
.xp-header{position:sticky;top:0;z-index:50;background:var(--topbar-bg);border-bottom:1px solid var(--border);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.xp-header-inner{max-width:1120px;margin:0 auto;padding:12px 16px}
.xp-header-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.xp-tagline{flex:1;display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-3)}
@media(max-width:500px){.xp-tagline{display:none}}
.xp-sign-btn{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;background:var(--violet-bg);border:1px solid var(--violet-border);color:var(--violet-light);font-family:'Syne',sans-serif;font-weight:700;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s}
.xp-sign-btn:hover{background:var(--violet);color:#fff;border-color:var(--violet)}
.xp-search-row{display:flex;gap:8px;align-items:center}
.xp-search-box{flex:1;position:relative;display:flex;align-items:center}
.xp-search-ico{position:absolute;left:12px;color:var(--text-3);pointer-events:none}
.xp-search-inp{width:100%;height:40px;background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:0 36px 0 38px;font-size:13px;font-family:'DM Sans',sans-serif;color:var(--text-1);outline:none;transition:border-color .15s}
.xp-search-inp::placeholder{color:var(--text-3)}
.xp-search-inp:focus{border-color:var(--violet-border)}
.xp-search-clr{position:absolute;right:10px;background:none;border:none;cursor:pointer;color:var(--text-3);display:flex;align-items:center;padding:2px}
.xp-search-clr:hover{color:var(--text-1)}
.xp-filter-toggle{width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:10px;background:var(--bg-surface);border:1px solid var(--border);color:var(--text-2);cursor:pointer;position:relative;transition:all .15s}
.xp-filter-toggle.active,.xp-filter-toggle:hover{background:var(--violet-bg);border-color:var(--violet-border);color:var(--violet-light)}
.xp-fcount{position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;background:var(--violet);color:#fff;font-size:8px;font-weight:700;font-family:'Syne',sans-serif;display:flex;align-items:center;justify-content:center}
.xp-view-toggle{display:flex;gap:2px;background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:3px;flex-shrink:0}
.xp-view-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:7px;border:none;cursor:pointer;color:var(--text-3);background:transparent;transition:all .15s}
.xp-view-btn.active{background:var(--violet-bg);color:var(--violet-light)}
.xp-filter-panel{margin-top:12px;padding:14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;gap:12px}
.xp-filter-dropdowns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
@media(max-width:640px){.xp-filter-dropdowns{grid-template-columns:1fr 1fr}}
@media(max-width:400px){.xp-filter-dropdowns{grid-template-columns:1fr}}
.xp-chips-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.xp-chips-label{font-size:10px;font-family:'Syne',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-right:2px}
.xp-clear-all{display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;border:1px solid rgba(239,68,68,.25);background:var(--red-bg);color:var(--red);font-size:10px;font-family:'Syne',sans-serif;font-weight:700;cursor:pointer;margin-left:auto;transition:all .15s}
.xp-pill{padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;font-family:'Syne',sans-serif;font-weight:700;cursor:pointer;transition:all .15s}
.xp-pill:hover{border-color:var(--violet-border);color:var(--violet-light)}
.xp-pill--violet{background:var(--violet-bg);border-color:var(--violet-border);color:var(--violet-light)}
.xp-pill--green{background:var(--green-bg);border-color:var(--green-border);color:var(--green)}
.xp-pill--red{background:var(--red-bg);border-color:rgba(239,68,68,.25);color:var(--red)}
.xp-dd-wrap{position:relative}
.xp-dd-btn{width:100%;display:flex;flex-direction:column;gap:2px;padding:8px 30px 8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:9px;cursor:pointer;text-align:left;transition:border-color .15s;position:relative}
.xp-dd-btn:hover:not(.xp-dd-btn--disabled){border-color:var(--violet-border)}
.xp-dd-btn--active{border-color:var(--violet-border)}
.xp-dd-btn--disabled{opacity:.45;cursor:not-allowed}
.xp-dd-label{font-size:9px;color:var(--text-4);font-family:'Syne',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.xp-dd-val{font-size:12px;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xp-dd-caret{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-3);transition:transform .2s}
.xp-dd-caret--open{transform:translateY(-50%) rotate(180deg)}
.xp-dd-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;max-height:200px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.xp-dd-item{padding:8px 12px;font-size:12px;font-family:'DM Sans',sans-serif;color:var(--text-2);cursor:pointer;transition:background .1s}
.xp-dd-item:hover{background:var(--bg-surface);color:var(--text-1)}
.xp-dd-item--none{color:var(--text-3);font-style:italic}
.xp-dd-item--sel{background:var(--violet-bg);color:var(--violet-light)}
.xp-stats-bar{background:var(--bg-surface);border-bottom:1px solid var(--border);padding:10px 16px}
.xp-stats-inner{max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:center}
.xp-stat{display:flex;align-items:center;gap:6px;padding:0 20px;border-right:1px solid var(--border)}
.xp-stat:last-child{border-right:none}
.xp-stat-icon{color:var(--violet-light)}
.xp-stat-val{font-family:'Syne',sans-serif;font-weight:800;font-size:13px;color:var(--text-1)}
.xp-stat-lbl{font-size:10px;color:var(--text-3)}
@media(max-width:600px){.xp-stat{padding:0 12px}.xp-stat-lbl{display:none}}
@media(max-width:360px){.xp-stat{padding:0 8px}}
.xp-main{max-width:1120px;margin:0 auto;padding:20px 16px 48px;flex:1;width:100%}
.xp-results-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.xp-results-num{font-family:'Syne',sans-serif;font-weight:800;font-size:20px;color:var(--text-1)}
.xp-results-lbl{font-size:13px;color:var(--text-3)}
.xp-results-sort{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-3)}
.xp-grid{display:grid;grid-template-columns:repeat(1,1fr);gap:16px}
@media(min-width:640px){.xp-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.xp-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1280px){.xp-grid{grid-template-columns:repeat(4,1fr)}}
.xp-list-wrap{display:flex;flex-direction:column;gap:10px}
.xp-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .2s,box-shadow .2s}
.xp-card:hover{border-color:var(--violet-border);box-shadow:0 8px 36px rgba(124,58,237,.16)}
.xp-card-img-wrap{position:relative;aspect-ratio:16/9;overflow:hidden;background:var(--bg-surface);border-radius:14px 14px 0 0}
.xp-card-img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.xp-card:hover .xp-card-img{transform:scale(1.06)}
.xp-card-img-fb{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bg-surface),var(--bg-card));color:var(--text-4)}
.xp-card-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55) 0%,transparent 55%);pointer-events:none}
.xp-card-tl{position:absolute;top:8px;left:8px}
.xp-card-tr{position:absolute;top:8px;right:8px}
.xp-card-br{position:absolute;bottom:8px;right:8px;display:flex;align-items:center;gap:3px;font-size:9px;background:rgba(0,0,0,.6);color:#fff;padding:3px 7px;border-radius:999px;backdrop-filter:blur(4px)}
.xp-card-body{padding:12px}
.xp-card-name{font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--text-1);margin:0 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xp-card-meta{display:flex;align-items:center;gap:10px;font-size:11px;flex-wrap:wrap}
.xp-card-loc{display:flex;align-items:center;gap:3px;color:var(--text-3);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xp-card-stars{display:flex;align-items:center;gap:3px;color:#f59e0b;flex-shrink:0}
.xp-card-rc{color:var(--text-3)}
.xp-card-hrs{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-4);margin-top:5px}
.xp-card-cta{display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:11px;font-family:'Syne',sans-serif;font-weight:700;color:var(--violet-light);margin-top:9px;opacity:0;transition:opacity .2s}
.xp-card:hover .xp-card-cta{opacity:1}
.xp-list-card{display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.xp-list-card:hover{border-color:var(--violet-border);box-shadow:0 4px 18px rgba(124,58,237,.1)}
.xp-list-img-wrap{width:68px;height:68px;border-radius:10px;overflow:hidden;flex-shrink:0;position:relative;background:var(--bg-surface)}
.xp-list-img{width:100%;height:100%;object-fit:cover}
.xp-list-img-fb{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-4)}
.xp-list-dot{position:absolute;bottom:3px;right:3px;width:9px;height:9px;border-radius:50%;background:var(--red);border:1.5px solid var(--bg-card)}
.xp-list-dot.open{background:var(--green)}
.xp-list-content{flex:1;min-width:0}
.xp-list-row1{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}
.xp-list-name{font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
.xp-list-meta{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-3);flex-wrap:wrap}
.xp-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font-size:10px;font-family:'Syne',sans-serif;font-weight:700;border:1px solid transparent}
.xp-badge--open{background:var(--green-bg);border-color:var(--green-border);color:var(--green)}
.xp-badge--closed{background:var(--red-bg);border-color:rgba(239,68,68,.2);color:var(--red)}
.xp-badge--svc{background:var(--violet-bg);border-color:var(--violet-border);color:var(--violet-light)}
.xp-badge-dot{width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}
.xp-empty{text-align:center;padding:60px 20px}
.xp-empty-icon{width:72px;height:72px;border-radius:50%;background:var(--violet-bg);border:1px solid var(--violet-border);display:flex;align-items:center;justify-content:center;color:var(--violet-light);margin:0 auto 16px}
.xp-empty-title{font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:var(--text-1);margin:0 0 8px}
.xp-empty-desc{font-size:13px;color:var(--text-3);max-width:340px;margin:0 auto 20px;line-height:1.65}
.xp-empty-btn{padding:9px 22px;border-radius:9px;border:1px solid var(--violet-border);background:var(--violet-bg);color:var(--violet-light);font-family:'Syne',sans-serif;font-weight:700;font-size:12px;cursor:pointer}
.xp-sentinel{height:48px;display:flex;align-items:center;justify-content:center;margin-top:16px}
.xp-loader{display:flex;gap:6px;align-items:center}
.xp-loader-dot{display:block;width:8px;height:8px;border-radius:50%;background:var(--violet-light)}
.xp-end-msg{font-size:11px;color:var(--text-3)}
.xp-skel-box{background:linear-gradient(90deg,var(--bg-surface) 25%,var(--bg-card) 50%,var(--bg-surface) 75%);background-size:200% 100%;animation:xp-shimmer 1.4s infinite}
.xp-skel-line{border-radius:6px;background:linear-gradient(90deg,var(--bg-surface) 25%,var(--bg-card) 50%,var(--bg-surface) 75%);background-size:200% 100%;animation:xp-shimmer 1.4s infinite}
@keyframes xp-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.xp-footer-cta{border-top:1px solid var(--border);background:var(--bg-surface);padding:14px 16px}
.xp-footer-cta-inner{max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.xp-footer-cta-txt{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-3);margin:0}
.xp-footer-cta-btn{display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:9px;background:var(--violet);color:#fff;font-family:'Syne',sans-serif;font-weight:700;font-size:12px;border:none;cursor:pointer;box-shadow:var(--shadow-btn);transition:opacity .15s;white-space:nowrap}
.xp-footer-cta-btn:hover{opacity:.88}
`

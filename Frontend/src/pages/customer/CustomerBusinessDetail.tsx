import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Phone, Star, Heart, ExternalLink, ChevronLeft,
  ChevronRight, Instagram, Facebook, X, Scissors, MessageSquare,
} from 'lucide-react'
import { Skeleton, EmptyState } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { MapModal } from '@/components/shared/MapModal'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import type { PublicBusinessProfileDTO } from '@/types'

type StaffItem = PublicBusinessProfileDTO['staff'][number]
type ReviewItem = PublicBusinessProfileDTO['reviews'][number]

/* ─── Lightbox ──────────────────────────────────────────────────── */
function Lightbox({ images, initialIdx, onClose }: { images: string[]; initialIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIdx)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(images.length - 1, i + 1))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [images.length, onClose])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
      onClick={onClose}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><X size={18} /></button>
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <img src={images[idx]} alt="" style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }} />
        {images.length > 1 && (
          <>
            <button onClick={() => setIdx(i => Math.max(0, i - 1))}
              style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setIdx(i => Math.min(images.length - 1, i + 1))}
              style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === images.length - 1 ? 0.3 : 1 }}>
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 14 }} onClick={e => e.stopPropagation()}>
        {images.map((url: string, i: number) => (
          <div key={i} onClick={() => setIdx(i)} style={{ width: 42, height: 36, borderRadius: 7, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${i === idx ? 'var(--violet-light)' : 'transparent'}`, flexShrink: 0 }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 }}>{idx + 1} / {images.length}</p>
    </motion.div>
  )
}

/* ─── Staff Reviews Modal (infinite scroll) ─────────────────────── */
function StaffReviewsModal({ staff, businessSlug, onClose }: { staff: StaffItem; businessSlug: string | undefined; onClose: () => void }) {
  const sentinelRef = useRef(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['staff-reviews-modal', staff.id],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get(`/customer/business/${businessSlug}/staff/${staff.id}/reviews`, { params: { page: pageParam, limit: 10 } })
      return res.data.data
    },
    getNextPageParam: (last) => last?.pagination?.page < last?.pagination?.total_pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 60_000,
  })

  const reviews = data?.pages.flatMap(p => p?.reviews ?? []) ?? []

  // Intersection observer for infinite scroll in modal
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const statusColor = staff.status === 'FREE' ? '#34d399' : staff.status === 'BUSY' ? '#f59e0b' : '#5a5c7a'

  return (
    <div className="modal-sheet-container">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="modal-sheet-panel"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 540, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-sheet-handle" style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '12px auto 0', flexShrink: 0 }} />
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-3)' }}>
          <X size={14} />
        </button>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={staff.name} src={staff.avatar_url} size="lg" />
              <span style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: statusColor, border: '2px solid var(--bg-card)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)', marginBottom: 2 }}>{staff.name}</h3>
              {staff.specialization && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>{staff.specialization}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: '#f59e0b' }}>
                  <Star size={12} fill="#f59e0b" />
                  <span className="font-syne font-bold">{staff.average_rating.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-3)' }}>({staff.total_reviews} reviews)</span>
                </span>
                {staff.experience_years != null && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{staff.experience_years} yr exp</span>
                )}
              </div>
            </div>
          </div>

          {/* Services */}
          {staff.services?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Services</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {staff.services.map((s, i: number) => (
                  <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reviews list - scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 24px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase' }}>Reviews</p>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton rounded-xl" style={{ height: 80 }} />)}
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 }}>No reviews yet for this staff member</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {reviews.map((r, i: number) => (
                <div key={r.id} style={{ padding: '12px 0', borderBottom: i < reviews.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                    <Avatar name={r.customer.name} src={r.customer.avatar_url} size="xs" />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p className="font-syne font-bold text-sm" style={{ color: 'var(--text-1)' }}>{r.customer.name}</p>
                        <div style={{ display: 'flex', gap: 1 }}>
                          {[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= r.rating ? '#f59e0b' : 'var(--border-2)', fontSize: 11 }}>★</span>)}
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: r.services?.length > 0 ? 6 : 0 }}>{r.comment}</p>}
                  {r.services?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {r.services.map((s: any, si: number) => (
                        <div key={si} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 6,
                          background: 'var(--violet-bg)', border: '1px solid var(--violet-border)',
                        }}>
                          {s.image_url && (
                            <img src={s.image_url} alt="" style={{ width: 14, height: 14, borderRadius: 4, objectFit: 'cover' }} />
                          )}
                          <span style={{ fontSize: 10, color: 'var(--violet-light)' }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.images?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {r.images.slice(0, 4).map((url: string, ii: number) => (
                        <div key={ii} style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {r.business_response && (
                    <div style={{ background: 'var(--violet-bg)', borderLeft: '2px solid var(--violet)', borderRadius: '0 8px 8px 0', padding: '6px 10px', marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: 'var(--violet-light)', marginBottom: 2 }}>Business replied</p>
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.business_response}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {isFetchingNextPage && <div className="skeleton rounded-xl" style={{ height: 50, marginTop: 10 }} />}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Business Reviews Modal (infinite scroll, newest first) ─────── */
function AllReviewsModal({ businessSlug, onClose }: { businessSlug: string | undefined; onClose: () => void }) {
  const sentinelRef = useRef(null)
  const [filterRating, setFilterRating] = useState(0)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['biz-reviews-modal', businessSlug, filterRating],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get(`/customer/business/${businessSlug}/reviews`, {
        params: { page: pageParam, limit: 10, ...(filterRating ? { rating: filterRating } : {}) }
      })
      return res.data.data
    },
    getNextPageParam: (last) => last?.pagination?.page < last?.pagination?.total_pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 60_000,
  })

  const reviews = data?.pages.flatMap(p => p?.reviews ?? []) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="modal-sheet-container">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="modal-sheet-panel"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 540, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-sheet-handle" style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '12px auto 0', flexShrink: 0 }} />
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-3)' }}>
          <X size={14} />
        </button>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)', marginBottom: 10 }}>All Reviews</h3>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[0,5,4,3,2,1].map(n => (
              <button key={n} type="button" onClick={() => setFilterRating(n)}
                className="px-3 py-1 rounded-full text-xs font-syne font-bold flex-shrink-0"
                style={{ background: filterRating === n ? 'var(--violet)' : 'var(--bg-surface)', color: filterRating === n ? '#fff' : 'var(--text-3)', border: `1px solid ${filterRating === n ? 'transparent' : 'var(--border)'}`, cursor: 'pointer' }}>
                {n === 0 ? 'All' : `${n}★`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 24px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton rounded-xl" style={{ height: 90 }} />)}
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 }}>No reviews found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {reviews.map((r, i: number) => (
                <div key={r.id} style={{ padding: '12px 0', borderBottom: i < reviews.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                    <Avatar name={r.customer.name} src={r.customer.avatar_url} size="xs" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <p className="font-syne font-bold text-sm" style={{ color: 'var(--text-1)' }}>{r.customer.name}</p>
                        <div style={{ display: 'flex', gap: 1 }}>
                          {[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= r.rating ? '#f59e0b' : 'var(--border-2)', fontSize: 11 }}>★</span>)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>with</span>
                        {r.staff?.avatar_url ? (
                          <img src={r.staff.avatar_url} alt={r.staff.name}
                            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontFamily: 'Syne', fontWeight: 700 }}>
                            {r.staff?.name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.staff?.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: r.images?.length > 0 ? 6 : 0 }}>{r.comment}</p>}
                  {r.services?.length > 0 && (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
    {r.services.map((s: any, i: number) => (
      <div key={i} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        background: 'var(--violet-bg)',
        border: '1px solid var(--violet-border)',
      }}>
        {s.image_url && (
          <img
            src={s.image_url}
            style={{ width: 14, height: 14, borderRadius: 4 }}
          />
        )}
        <span style={{ fontSize: 10, color: 'var(--violet-light)' }}>
          {s.name}
        </span>
      </div>
    ))}
  </div>
)}
                  {r.images?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.images.slice(0, 4).map((url: string, ii: number) => (
                        <div key={ii} style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {r.business_response && (
                    <div style={{ background: 'var(--violet-bg)', borderLeft: '2px solid var(--violet)', borderRadius: '0 8px 8px 0', padding: '6px 10px', marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: 'var(--violet-light)', marginBottom: 2 }}>Business replied</p>
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.business_response}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {isFetchingNextPage && <div className="skeleton rounded-xl" style={{ height: 60, marginTop: 10 }} />}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════ */
export default function CustomerBusinessDetail() {
  const { slug }   = useParams()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const [lightboxIdx,    setLightboxIdx]    = useState<number | null>(null)
  const [selectedStaff,  setSelectedStaff]  = useState<StaffItem | null>(null)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [mapOpen,        setMapOpen]        = useState(false)
  const [reviewTab,      setReviewTab]      = useState('all')
  const [activeImgIdx,   setActiveImgIdx]   = useState(0)

  usePageTitle('Business Details')

  const { data: biz, isLoading } = useQuery<PublicBusinessProfileDTO>({
    queryKey: ['customer-business', slug],
    queryFn: async () => {
      const res = await api.get(`/customer/business/${slug}`)
      return res.data.data as PublicBusinessProfileDTO
    },
    enabled: !!slug,
    staleTime: 60_000,
  })

  if (isLoading) return <DetailSkeleton />
  if (!biz) return <EmptyState title="Business not found" />

  const gallery   = biz.gallery ?? []
  // Prefer gallery ordering from backend: primary first (is_primary) then by sort_order.
  const allImages = (gallery.slice().sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  }).map(g => g.image_url).filter(Boolean))
  // Use primary_image as fallback only when gallery has no images or doesn't contain it.
  if (biz.primary_image && allImages.length === 0) allImages.push(biz.primary_image)

  const staffList = [...(biz.staff ?? [])].sort((a, b) => b.average_rating - a.average_rating)
  const services  = biz.services ?? []
  const reviews   = biz.reviews ?? []
  const schedules = biz.schedules ?? []

  const filteredReviews = reviewTab === 'all' ? reviews : reviews.filter(r => Math.round(r.rating) === Number(reviewTab))

  return (
    <div className="min-h-screen pb-20 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto">

      {/* ── Gallery ───────────────────────────────────────── */}
      <div style={{ position: 'relative', background: 'var(--bg-surface)' }}>
        {/* Main active image */}
        <div style={{ position: 'relative', height: 280, overflow: 'hidden', cursor: 'pointer' }}
          onClick={() => setLightboxIdx(activeImgIdx)}>
          {allImages[activeImgIdx] ? (
            <motion.img key={activeImgIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              src={allImages[activeImgIdx]} alt={biz.business_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scissors size={48} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5))' }} />
          {allImages.length > 1 && (
            <div style={{ position: 'absolute', bottom: 8, right: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '3px 8px' }}>
              <span style={{ color: '#fff', fontSize: 11 }}>{activeImgIdx + 1}/{allImages.length}</span>
            </div>
          )}
        </div>

        {/* Horizontal thumbnail strip */}
        {allImages.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: 'var(--bg-surface)', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {allImages.map((url: string, i: number) => (
              <motion.div key={i} whileTap={{ scale: 0.95 }}
                onClick={() => setActiveImgIdx(i)}
                style={{ width: 60, height: 50, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, border: `2px solid ${i === activeImgIdx ? 'var(--violet-light)' : 'transparent'}`, transition: 'border-color .15s' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Badges */}
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-syne font-bold"
            style={{ background: biz.is_open_now ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)', color: biz.is_open_now ? '#34d399' : '#ef4444', backdropFilter: 'blur(8px)', border: `1px solid ${biz.is_open_now ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: biz.is_open_now ? '#34d399' : '#ef4444' }} />
            {biz.is_open_now ? 'Open now' : 'Closed'}
            {!biz.is_open_now && biz.todays_schedule?.open_time && <span style={{ opacity: 0.8 }}> · Opens {biz.todays_schedule.open_time.slice(0,5)}</span>}
          </span>
        </div>

      </div>

      {/* ── Business Header ────────────────────────────── */}
      <div className="q-card" style={{ padding: '16px 18px', marginTop: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="font-syne font-black" style={{ fontSize: 22, color: 'var(--text-1)', lineHeight: 1.2, marginBottom: 4 }}>{biz.business_name}</h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>{biz.service_for} · by {biz.owner_name}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <span style={{ color: '#f59e0b', fontSize: 16 }}>★</span>
                <span className="font-syne font-black" style={{ fontSize: 18, color: 'var(--text-1)' }}>{biz.average_rating.toFixed(1)}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{biz.total_reviews} reviews</span>
            </div>
          </div>

          {biz.description && <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)', marginBottom: 12 }}>{biz.description}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <MapPin size={14} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {biz.address_line1}{biz.address_line2 ? `, ${biz.address_line2}` : ''}, {biz.city} – {biz.pincode}
              </span>
            </div>
            {biz.business_phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                <a href={`tel:${biz.business_phone}`} style={{ fontSize: 13, color: 'var(--violet-light)', textDecoration: 'none' }}>{biz.business_phone}</a>
              </div>
            )}
            {biz.map_link && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExternalLink size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                <a href={biz.map_link} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--violet-light)', textDecoration: 'none' }}>
                  Get directions
                </a>
              </div>
            )}
            {biz.social_links?.instagram && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Instagram size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                <a href={biz.social_links.instagram} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--violet-light)', textDecoration: 'none' }}>
                  Instagram
                </a>
              </div>
            )}
            {biz.social_links?.facebook && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Facebook size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                <a href={biz.social_links.facebook} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--violet-light)', textDecoration: 'none' }}>
                  Facebook
                </a>
              </div>
            )}
          </div>
        </div>


        {/* ── Services ──────────────────────────────────── */}
        {services.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
              <h2 className="font-syne font-black" style={{ fontSize: 20, color: 'var(--text-1)' }}>Services</h2>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{services.length} available</span>
            </div>
            <style>{`
              @media (min-width: 1024px) {
                .services-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
              }
              @media (min-width: 640px) and (max-width: 1023px) {
                .services-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              }
              @media (max-width: 639px) {
                .services-grid { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
              }
            `}</style>
            <div className="services-grid" style={{ display: 'grid', gap: 14 }}>
              {services.map(s => (
                <motion.div key={s.id} whileHover={{ y: -4 }} className="q-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', height: 140, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Scissors size={32} style={{ color: 'var(--text-3)', opacity: 0.3 }} />
                    )}
                    {s.is_featured && (
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.95)', color: '#fff', fontFamily: 'Syne', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>★ Featured</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 className="font-syne font-bold" style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', fontFamily: 'Syne', fontWeight: 700 }}>{s.service_for}</span>
                      <div style={{ textAlign: 'right' }}>
                        {s.discounted_price != null && (
                          <p style={{ fontSize: 10, textDecoration: 'line-through', color: 'var(--text-4)', margin: 0, lineHeight: 1.4 }}>{formatINR(s.price)}</p>
                        )}
                        <p className="font-syne font-bold" style={{ fontSize: 15, color: 'var(--violet-light)', margin: 0, lineHeight: 1.4, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
                          {formatINR(s.discounted_price ?? s.price)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Staff ─────────────────────────────────────── */}
        {staffList.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
              <h2 className="font-syne font-black" style={{ fontSize: 20, color: 'var(--text-1)' }}>Our Team</h2>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{staffList.length} professionals</span>
            </div>
            <style>{`
              @media (min-width: 1024px) {
                .staff-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
              }
              @media (min-width: 640px) and (max-width: 1023px) {
                .staff-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              }
              @media (max-width: 639px) {
                .staff-grid { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
              }
            `}</style>
            <div className="staff-grid" style={{ display: 'grid', gap: 14 }}>
              {staffList.map(s => {
                const statusColor = s.status === 'FREE' ? '#34d399' : s.status === 'BUSY' ? '#f59e0b' : '#5a5c7a'
                return (
                  <motion.div key={s.id} whileHover={{ y: -4 }} className="q-card" style={{ padding: 16, textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                      <Avatar name={s.name} src={s.avatar_url} size="xl" />
                      <span style={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: statusColor, border: '3px solid var(--bg-card)' }} />
                    </div>
                    <h3 className="font-syne font-bold" style={{ fontSize: 15, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{s.name}</h3>
                    {s.specialization && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{s.specialization}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <span style={{ color: '#f59e0b', fontSize: 13 }}>★</span>
                      <span className="font-syne font-bold" style={{ fontSize: 14, color: 'var(--text-1)' }}>{s.average_rating.toFixed(1)}</span>
                    </div>
                    {s.experience_years != null && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>{s.experience_years} {s.experience_years === 1 ? 'Year' : 'Years'} Experience</p>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedStaff(s)}
                      style={{ width: '100%', height: 36, borderRadius: 10, fontSize: 13, background: 'linear-gradient(135deg, #7C3AED, #9333EA)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, marginTop: 'auto' }}>
                      View Profile
                    </motion.button>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Schedule ──────────────────────────────────── */}
        {schedules.length > 0 && (
          <div className="q-card" style={{ padding: '16px 18px', marginBottom: 12 }}>
            <p className="font-syne font-black text-base" style={{ color: 'var(--text-1)', marginBottom: 12 }}>Business Hours</p>
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '8px' }}>
              {schedules.map(s => {
                const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() === s.day_of_week?.toUpperCase()
                return (
                  <div key={s.day_of_week} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="font-syne font-bold" style={{ fontSize: 12, color: isToday ? 'var(--violet-light)' : 'var(--text-2)', minWidth: 50 }}>
                      {s.day_of_week?.slice(0, 3)}
                    </span>
                    <span style={{ fontSize: 12, color: s.is_open ? 'var(--text-1)' : 'var(--text-4)' }}>
                      {s.is_open ? `${s.open_time?.slice(0,5)} – ${s.close_time?.slice(0,5)}` : 'Closed'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Reviews ───────────────────────────────────── */}
        <div className="q-card" style={{ padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="font-syne font-black" style={{ fontSize: 20, color: 'var(--text-1)' }}>Reviews</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <p className="font-syne font-black" style={{ fontSize: 36, color: 'var(--text-1)', lineHeight: 1 }}>{biz.review_summary?.average_rating?.toFixed(1) ?? '0.0'}</p>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center', margin: '4px 0' }}>
                {[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= Math.round(biz.review_summary?.average_rating ?? 0) ? '#f59e0b' : 'var(--border-2)', fontSize: 14 }}>★</span>)}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{biz.total_reviews} Reviews</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {([5,4,3,2,1]).map(star => {
                const KEY_MAP = ['five','four','three','two','one'] as const
                const key = KEY_MAP[5 - star]
                const count = biz.review_summary?.rating_breakdown?.[key] ?? 0
                const pct = biz.review_summary?.total_reviews ? Math.round((count / biz.review_summary.total_reviews) * 100) : 0
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', width: 14 }}>{star}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--bg-surface)', borderRadius: 99 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', width: 24, textAlign: 'right' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {reviews.length === 0 ? (
            <p style={{ fontSize: 13, textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>No reviews yet</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {reviews.slice(0, 5).map((r, i) => (
                  <div key={r.id} style={{ padding: '12px 0', borderBottom: i < Math.min(reviews.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                      <Avatar name={r.customer.name} src={r.customer.avatar_url} size="xs" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className="font-syne font-bold text-sm" style={{ color: 'var(--text-1)', marginBottom: 2 }}>{r.customer.name}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>with</span>
                              {r.staff?.avatar_url ? (
                                <img src={r.staff.avatar_url} alt={r.staff.name}
                                  style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
                              ) : (
                                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontFamily: 'Syne', fontWeight: 700 }}>
                                  {r.staff?.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                              )}
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.staff?.name}</span>
                            </div>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 1, marginBottom: 2 }}>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= r.rating ? '#f59e0b' : 'var(--border-2)', fontSize: 11 }}>★</span>)}</div>
                            <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {r.services?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, overflowX: 'hidden' }}>
                        {r.services.map((s: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', flexShrink: 0 }}>
                            {s.image_url && <img src={s.image_url} style={{ width: 14, height: 14, borderRadius: 4, objectFit: 'cover' }} />}
                            <span style={{ fontSize: 10, color: 'var(--violet-light)' }}>{s.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.comment && <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)', marginBottom: r.images?.length > 0 ? 8 : 0, wordBreak: 'break-word' }}>{r.comment}</p>}
                    
                    {r.images?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                        {r.images.slice(0,4).map((url, ii) => (
                          <div key={ii} style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {r.business_response && (
                      <div style={{ background: 'var(--violet-bg)', borderLeft: '2px solid var(--violet)', borderRadius: '0 8px 8px 0', padding: '7px 10px', marginTop: 8 }}>
                        <p style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700, color: 'var(--violet-light)', marginBottom: 2 }}>Business replied</p>
                        <p style={{ fontSize: 12, color: 'var(--text-2)', wordBreak: 'break-word' }}>{r.business_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {biz.total_reviews > 0 && (
                <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={() => setShowAllReviews(true)}
                  style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 12, background: 'var(--bg-surface)', color: 'var(--text-1)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <MessageSquare size={16} /> View All Reviews
                </motion.button>
              )}
            </>
          )}
        </div>

        {/* ── Book CTA ─────────────────────────────────── */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(`/customer/book/${biz.slug}`)}
          style={{ width: '100%', height: 54, fontSize: 15, borderRadius: 14, background: 'linear-gradient(135deg, #7C3AED, #9333EA)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 700, boxShadow: '0 4px 20px rgba(124,58,237,0.3)', marginTop: 14, marginBottom: 80 }}>
          Book Appointment →
        </motion.button>

      {/* Modals */}
      <AnimatePresence>
        {lightboxIdx !== null && <Lightbox images={allImages} initialIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {selectedStaff && <StaffReviewsModal staff={selectedStaff} businessSlug={slug} onClose={() => setSelectedStaff(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAllReviews && <AllReviewsModal businessSlug={slug} onClose={() => setShowAllReviews(false)} />}
      </AnimatePresence>
      <MapModal open={mapOpen} onClose={() => setMapOpen(false)} businessName={biz.business_name} address={biz.address_line1 ?? ''} city={biz.city} state={biz.state} mapLink={biz.map_link ?? undefined} />
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen pb-20 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="skeleton" style={{ height: 280 }} />
        <div style={{ height: 8, background: 'var(--bg-surface)' }} />
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: 'var(--bg-surface)', overflowX: 'auto' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton rounded-lg flex-shrink-0" style={{ width: 60, height: 50 }} />)}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="q-card skeleton" style={{ height: 140 }} />
          <div className="q-card skeleton" style={{ height: 180 }} />
          <div className="q-card skeleton" style={{ height: 100 }} />
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star, MessageSquare, Loader2, X, ChevronDown,
  Building2, Send, Check, Image as ImageIcon, ChevronUp, User, Scissors,
} from 'lucide-react'
import { EmptyState, Skeleton, ConfirmDialog } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { usePageTitle, useIntersectionObserver } from '@/hooks'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ color: n <= rating ? '#f59e0b' : 'var(--border-2)', fontSize: size }}>★</span>
      ))}
    </span>
  )
}

// ── Business Filter Modal ─────────────────────────────────────────
function BizModal({ businesses, selected, onSelect, onClose }: {
  businesses: { id: string; business_name: string; logo_url?: string }[]
  selected: string; onSelect: (id: string) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm q-card z-10 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Filter by Business</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-[7px] flex items-center justify-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
        {[{ id: '', business_name: 'All Businesses' }, ...businesses].map(b => (
         <button
  key={b.id}
  type="button"
  onClick={() => { onSelect(b.id); onClose() }}
  className="w-full flex items-center gap-2 p-2.5 rounded-[9px] text-left mb-1"
  style={{
    background: selected === b.id ? 'var(--violet-bg)' : 'transparent',
    border: `1px solid ${selected === b.id ? 'var(--violet-border)' : 'transparent'}`,
    cursor: 'pointer',
  }}
>
  {b.id ? (
  <Avatar
    name={b.business_name}
    src={b.logo_url}
    size="xs"
  />
) : (
  <Building2 size={12} style={{ color: 'var(--text-3)' }} />
)}

  <span
    className="font-syne font-bold text-[12px]"
    style={{ color: selected === b.id ? 'var(--violet-light)' : 'var(--text-1)' }}
  >
    {b.business_name}
  </span>
</button>
        ))}
      </motion.div>
    </div>
  )
}

// ── Respond Modal ─────────────────────────────────────────────────
function RespondModal({ reviewId, onClose, onDone }: { reviewId: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')

  const respondMut = useMutation({
    mutationFn: () => api.post(`/owner/reviews/${reviewId}/respond`, { response: text }),
    onSuccess: () => { toast.success('Response submitted!'); onDone(); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm q-card z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: 'var(--violet-bg)' }}>
              <MessageSquare size={14} style={{ color: 'var(--violet-light)' }} />
            </div>
            <h3 className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Respond to Review</h3>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-[7px] flex items-center justify-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>

        <div>
          <label className="q-label">Your Response</label>
          <textarea className="q-input" rows={4} placeholder="Write your response to this review…"
            value={text} onChange={e => setText(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="q-btn-ghost flex-1 h-9 text-[12px]">Cancel</button>
          <motion.button whileTap={{ scale: 0.97 }} type="button"
            onClick={() => respondMut.mutate()}
            disabled={respondMut.isPending || !text.trim()}
            className="q-btn-primary flex-1 h-9 text-[12px] flex items-center justify-center gap-2 disabled:opacity-50">
            {respondMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Submit
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Review Card ───────────────────────────────────────────────────
function ReviewCard({ review, onRespond, expanded, onToggleComment, onImageClick }: {
  review: any; onRespond: () => void; expanded: boolean; onToggleComment: () => void; onImageClick: (img: string) => void
}) {
  const commentLines = review.comment?.split('\n').length || 0
  const shouldTruncate = commentLines > 4 && !expanded

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="p-3 space-y-2.5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={review.customer_name} src={review.customer_avatar} size="md" />
            <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>{review.customer_name}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <StarRow rating={review.rating} size={14} />
              <span className="text-[13px] font-syne font-bold" style={{ color: '#f59e0b' }}>{review.rating.toFixed(1)}</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{formatDate(review.service_date)}</p>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-1.5">
          {/* Business Row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" style={{ width: 75 }}>
              <Building2 size={13} style={{ color: 'var(--text-3)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Saloon:-</span>
            </div>
            <div className="flex items-center gap-1.5">
              {review.business_logo && (
                <img src={review.business_logo} alt="" className="w-4 h-4 rounded object-cover" />
              )}
              <span className="text-[12px] font-syne font-bold" style={{ color: 'var(--text-1)' }}>{review.business_name}</span>
            </div>
          </div>

          {/* Staff Row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" style={{ width: 75 }}>
              <User size={13} style={{ color: 'var(--text-3)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Staff:-</span>
            </div>
            <div className="flex items-center gap-1.5">
              {review.staff_avatar && (
                <img src={review.staff_avatar} alt="" className="w-4 h-4 rounded object-cover" />
              )}
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{review.staff_name}</span>
            </div>
          </div>

          {/* Services Row */}
          {review.services?.length > 0 && (
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1.5" style={{ width: 75 }}>
                <Scissors size={13} style={{ color: 'var(--text-3)', marginTop: 1.5 }} />
                <span className="text-[11px]" style={{ color: 'var(--text-3)', marginTop: 1.5 }}>Services:-</span>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {review.services.map((s: any, i: number) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-syne font-bold"
                    style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                    {s.image && (
                      <img src={s.image} alt="" className="w-3 h-3 rounded object-cover" />
                    )}
                    {typeof s === "string" ? s : s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comment */}
        {review.comment && (
          <div>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {shouldTruncate ? review.comment.split('\n').slice(0, 4).join('\n') + '...' : review.comment}
            </p>
            {commentLines > 4 && (
              <button onClick={onToggleComment} className="text-[11px] font-syne font-bold mt-1"
                style={{ color: 'var(--violet-light)', cursor: 'pointer' }}>
                {expanded ? 'Read Less' : 'Read More'}
              </button>
            )}
          </div>
        )}

        {/* Review Images */}
        {review.images?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {review.images.map((img: string, i: number) => (
              <img key={i} src={img} alt="" onClick={() => onImageClick(img)}
                className="w-16 h-16 rounded-[6px] object-cover flex-shrink-0 cursor-pointer"
                style={{ border: '1px solid var(--border)' }} />
            ))}
          </div>
        )}

        {/* Response Section */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {review.business_response ? (
            <div className="p-2.5 rounded-[8px]" style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
              <p className="text-[11px] font-syne font-bold mb-1" style={{ color: 'var(--violet-light)' }}>You Replied</p>
              <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>{review.business_response}</p>
              {review.business_response_at && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{formatDate(review.business_response_at)}</p>
              )}
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onRespond}
              className="w-full py-2 rounded-[8px] flex items-center justify-center gap-2 text-[12px] font-syne font-bold"
              style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <MessageSquare size={13} /> Respond
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function OwnerReviews() {
  usePageTitle('Reviews')
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [bizFilter, setBizFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [respondId, setRespondId] = useState<string | null>(null)
  const [showBizModal, setShowBizModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'responded'>('pending')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['owner-reviews', { page, bizFilter, ratingFilter }],
    queryFn: async () => {
      const res = await api.get('/owner/reviews/', {
        params: { page, limit: 30, business_id: bizFilter || undefined, rating: ratingFilter || undefined },
      })
      return res.data
    },
    staleTime: 0,
    placeholderData: (prev) => prev,
  })

  // Infinite scroll
  const loaderRef = useIntersectionObserver(useCallback(() => {
    const totalPages = data?.data?.pagination?.total_pages ?? 1
    if (totalPages > page && !isFetching && !isLoading) {
      setPage(p => p + 1)
    }
  }, [data, page, isFetching, isLoading]))

  // Reset page when filters change
  const prevBizFilterRef = useRef(bizFilter)
  const prevRatingFilterRef = useRef(ratingFilter)
  const prevTabRef = useRef(activeTab)
  if (prevBizFilterRef.current !== bizFilter || prevRatingFilterRef.current !== ratingFilter || prevTabRef.current !== activeTab) {
    setPage(1)
    prevBizFilterRef.current = bizFilter
    prevRatingFilterRef.current = ratingFilter
    prevTabRef.current = activeTab
  }

  const { data: bizList } = useQuery({
    queryKey: ['owner-businesses-simple'],
    queryFn: async () => {
      const r = await api.get('/owner/businesses', { params: { limit: 100 } })
      return (r.data.data?.businesses ?? []) as {
        id: string
        business_name: string
        logo_url?: string
      }[]
    },
    staleTime: 10 * 60_000,
  })

  const reviews: any[] = data?.data?.reviews ?? []
  const pagination = data?.data?.pagination
  const totalPages = pagination?.total_pages ?? 1
  const selectedBizName = bizList?.find((b: any) => b.id === bizFilter)?.business_name
  const selectedBiz = bizList?.find((b: any) => b.id === bizFilter)

  const pendingCount = reviews.filter((r: any) => !r.business_response).length
  const respondedCount = reviews.filter((r: any) => r.business_response).length

  const toggleComment = (id: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6">
          <h1 className="font-syne font-black text-[28px]" style={{ color: 'var(--text-1)' }}>Reviews</h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
            Manage customer reviews for your businesses
          </p>
        </motion.div>

        {/* Sticky Tabs */}
        <div className="sticky top-0 z-10 mb-5" style={{ background: 'var(--bg-page)', paddingTop: '4px' }}>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('pending')}
              className="flex-1 h-10 rounded-[10px] text-[13px] font-syne font-bold"
              style={{
                background: activeTab === 'pending' ? 'var(--violet)' : 'var(--bg-surface)',
                color: activeTab === 'pending' ? '#fff' : 'var(--text-2)',
                border: `1px solid ${activeTab === 'pending' ? 'var(--violet)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              Needs Response ({pendingCount})
            </button>
            <button onClick={() => setActiveTab('responded')}
              className="flex-1 h-10 rounded-[10px] text-[13px] font-syne font-bold"
              style={{
                background: activeTab === 'responded' ? 'var(--violet)' : 'var(--bg-surface)',
                color: activeTab === 'responded' ? '#fff' : 'var(--text-2)',
                border: `1px solid ${activeTab === 'responded' ? 'var(--violet)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              Responded ({respondedCount})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <button type="button" onClick={() => setShowBizModal(true)}
            className="flex items-center gap-2 px-4 h-10 rounded-[10px] text-[13px] font-syne font-bold"
            style={{
              background: bizFilter ? 'var(--violet-bg)' : 'var(--bg-surface)',
              color: bizFilter ? 'var(--violet-light)' : 'var(--text-2)',
              border: `1px solid ${bizFilter ? 'var(--violet-border)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            {selectedBizName ? selectedBizName.slice(0, 20) + (selectedBizName.length > 20 ? '…' : '') : 'All Businesses'}
            <ChevronDown size={12} />
          </button>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['', '5', '4', '3', '2', '1'].map(r => (
              <button key={r} type="button" onClick={() => { setRatingFilter(r); setPage(1) }}
                className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-syne font-bold flex-shrink-0"
                style={{
                  background: ratingFilter === r ? 'var(--violet)' : 'var(--bg-surface)',
                  color: ratingFilter === r ? '#fff' : 'var(--text-2)',
                  border: `1px solid ${ratingFilter === r ? 'var(--violet)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}>
                {r === '' ? 'All' : (
                  <>
                    
                    {r}★
                  </>
                )}
              </button>
            ))}
          </div>

          {(bizFilter || ratingFilter) && (
            <button type="button" onClick={() => { setBizFilter(''); setRatingFilter(''); setPage(1) }}
              className="flex items-center gap-1 px-3 h-8 rounded-[8px] text-[11px] font-syne font-bold flex-shrink-0"
              style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
              <X size={10} /> Clear
            </button>
          )}
        </div>

        {/* Reviews */}
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => <Skeleton key={i} height="200px" className="rounded-[14px]" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'pending' && reviews.filter((r: any) => !r.business_response).length === 0 && (
              <EmptyState icon={<Star size={28} />} title="No pending reviews"
                description={bizFilter || ratingFilter ? 'Try adjusting your filters.' : 'All reviews have been responded to.'} />
            )}
            {activeTab === 'responded' && reviews.filter((r: any) => r.business_response).length === 0 && (
              <EmptyState icon={<Star size={28} />} title="No responded reviews"
                description={bizFilter || ratingFilter ? 'Try adjusting your filters.' : 'Responded reviews will appear here.'} />
            )}
            {(activeTab === 'pending' ? reviews.filter((r: any) => !r.business_response) : reviews.filter((r: any) => r.business_response)).map((r: any, i: number) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}>
                <ReviewCard review={r} onRespond={() => setRespondId(r.id)}
                  expanded={expandedComments.has(r.id)} onToggleComment={() => toggleComment(r.id)}
                  onImageClick={(img: string) => setLightboxImage(img)} />
              </motion.div>
            ))}
            <div ref={loaderRef} />
          </div>
        )}

      {/* Modals */}
      <AnimatePresence>
        {showBizModal && (
          <BizModal businesses={bizList ?? []} selected={bizFilter}
            onSelect={v => { setBizFilter(v); setPage(1) }} onClose={() => setShowBizModal(false)} />
        )}
        {respondId && (
          <RespondModal reviewId={respondId} onClose={() => setRespondId(null)}
            onDone={() => qc.invalidateQueries({ queryKey: ['owner-reviews'] })} />
        )}
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
      </AnimatePresence>
      </div>
    </div>
  )
}

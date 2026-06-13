import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Camera, Loader2, X, Image as ImageIcon, User, Scissors } from 'lucide-react'
import { EmptyState, Skeleton } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { usePageTitle, useSocketEvent, useIntersectionObserver } from '@/hooks'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { PendingReviewItemDTO, ReviewItemDTO } from '@/types'

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n} type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 28, transition: 'transform .1s', transform: n <= (hover || value) ? 'scale(1.1)' : 'scale(1)' }}
        >
          <span style={{ color: n <= (hover || value) ? '#f59e0b' : 'var(--border-2)' }}>★</span>
        </button>
      ))}
    </div>
  )
}

function ReviewModal({ item, onClose }: { item: PendingReviewItemDTO; onClose: () => void }) {
  const qc = useQueryClient()
  const [rating,   setRating]   = useState(0)
  const [comment,  setComment]  = useState('')
  const [images,   setImages]   = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (rating === 0) { toast.error('Please select a rating.'); throw new Error('no rating') }
      const fd = new FormData()
      fd.append('booking_id', item.booking_id)
      fd.append('rating', String(rating))
      if (comment.trim()) fd.append('comment', comment.trim())
      images.forEach(f => fd.append('images', f))
      await api.post('/customer/reviews/', fd)
    },
    onSuccess: () => {
      toast.success('Review submitted! Thank you ⭐')
      qc.invalidateQueries({ queryKey: ['customer-pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['customer-reviews'] })
      qc.invalidateQueries({ queryKey: ['customer-bookings'] })
      qc.invalidateQueries({ queryKey: ['customer-dashboard'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message
      if (msg) toast.error(msg)
    },
  })

  const addImages = (files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - images.length)
    setImages(prev => [...prev, ...newFiles])
    setPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))])
  }

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 480,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 20, overflow: 'hidden',
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-syne font-black text-lg" style={{ color: 'var(--text-1)' }}>Leave a Review</h2>
          <button type="button" onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-3)' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Business + staff info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 12 }}>
            <Avatar name={item.business_name} src={item.business_logo} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="font-syne font-bold text-sm" style={{ color: 'var(--text-1)' }}>{item.business_name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>with</span>
                <Avatar name={item.staff_name} src={item.staff_avatar} size="xs" />
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>{item.staff_name}</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>{formatDate(item.service_date, 'd MMM, yyyy')}</span>
              </div>
              {item.services?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.services.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                      {(s.image_url ?? s.image)
                        ? <img src={s.image_url ?? s.image} className="w-3 h-3 rounded object-cover flex-shrink-0" />
                        : <Scissors size={10} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />}
                      <span className="text-[10px]" style={{ color: 'var(--violet-light)' }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Star rating */}
          <div>
            <label className="q-label" style={{ marginBottom: 8 }}>Your Rating</label>
            <StarInput value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-sm mt-2 font-syne font-bold" style={{ color: '#f59e0b' }}>
                {['', 'Terrible 😞', 'Poor 😕', 'Okay 😐', 'Good 😊', 'Excellent 🤩'][rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="q-label">Your Review (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="How was your experience? Share details…"
              rows={3}
              maxLength={1000}
              className="q-input resize-none"
              style={{ fontSize: 14 }}
            />
            <p className="text-xs text-right mt-1" style={{ color: 'var(--text-3)' }}>{comment.length}/1000</p>
          </div>

          {/* Photos */}
          <div>
            <label className="q-label" style={{ marginBottom: 8 }}>Photos (optional, max 5)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {previews.map((url: string, idx: number) => (
                <div key={idx} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                  <button type="button" onClick={() => removeImage(idx)}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label style={{ width: 72, height: 72, borderRadius: 10, cursor: 'pointer', background: 'var(--bg-surface)', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Camera size={18} style={{ color: 'var(--text-3)' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Add</span>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            disabled={mutation.isPending || rating === 0}
            onClick={() => mutation.mutate()}
            className="q-btn-primary flex items-center justify-center gap-2"
            style={{ height: 48, fontSize: 15, borderRadius: 14 }}
          >
            {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Star size={16} fill="currentColor" />}
            {mutation.isPending ? 'Submitting…' : 'Submit Review'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

function MyReviewCard({ review }: { review: ReviewItemDTO }) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

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
            <Avatar name={review.business_name} src={review.business_logo} size="md" />
            <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>{review.business_name}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ color: n <= Math.round(review.rating) ? '#f59e0b' : 'var(--border-2)', fontSize: 14 }}>★</span>
              ))}
              <span className="text-[13px] font-syne font-bold" style={{ color: '#f59e0b' }}>{review.rating.toFixed(1)}</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{formatDate(review.created_at)}</p>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-1.5">
          {/* Staff Row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" style={{ width: 60 }}>
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
              <div className="flex items-center gap-1.5" style={{ width: 60 }}>
                <Scissors size={13} style={{ color: 'var(--text-3)', marginTop: 1.5 }} />
                <span className="text-[11px]" style={{ color: 'var(--text-3)', marginTop: 1.5 }}>Services:-</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {review.services.map((s: any, i: number) => (
                  <span key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-syne font-bold"
                    style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                    {(s.image_url ?? s.image)
                      ? <img src={s.image_url ?? s.image} alt="" className="w-3 h-3 rounded object-cover flex-shrink-0" />
                      : <Scissors size={10} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />}
                    {s.name}
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
              <button onClick={() => setExpanded(!expanded)} className="text-[11px] font-syne font-bold mt-1"
                style={{ color: 'var(--violet-light)', cursor: 'pointer' }}>
                {expanded ? 'Read Less' : 'Read More'}
              </button>
            )}
          </div>
        )}

        {/* Review Images */}
        {review.images && review.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {review.images.map((img: string, i: number) => (
              <img key={i} src={img} alt="" onClick={() => setLightboxImage(img)}
                className="w-16 h-16 rounded-[6px] object-cover flex-shrink-0 cursor-pointer"
                style={{ border: '1px solid var(--border)' }} />
            ))}
          </div>
        )}

        {/* Business Response */}
        {review.business_response && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="p-2.5 rounded-[8px]" style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
              <p className="text-[11px] font-syne font-bold mb-1" style={{ color: 'var(--violet-light)' }}>Business Replied</p>
              <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>{review.business_response}</p>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
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
    </motion.div>
  )
}

export default function CustomerReviews() {
  usePageTitle('Reviews')
  const qc = useQueryClient()
  const [activeTab,     setActiveTab]     = useState<'pending' | 'submitted'>('pending')
  const [reviewingItem, setReviewingItem] = useState<PendingReviewItemDTO | null>(null)
  const [myPage,        setMyPage]        = useState(1)

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ['customer-pending-reviews'],
    queryFn:  async () => {
      const res = await api.get('/customer/reviews/pending')
      return res.data.data as PendingReviewItemDTO[]
    },
    staleTime: 60_000,
  })

  const { data: reviewsData, isLoading: reviewsLoading, isFetching } = useQuery({
    queryKey: ['customer-reviews', myPage],
    queryFn:  async () => {
      const res = await api.get('/customer/reviews', { params: { page: myPage, limit: 10 } })
      return res.data
    },
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
  })

  // Infinite scroll for My Reviews
  const loaderRef = useIntersectionObserver(useCallback(() => {
    const totalPages = reviewsData?.data?.pagination?.total_pages ?? 1
    if (totalPages > myPage && !isFetching && !reviewsLoading && activeTab === 'submitted') {
      setMyPage(p => p + 1)
    }
  }, [reviewsData, myPage, isFetching, reviewsLoading, activeTab]))

  useSocketEvent('service:completed', () => {
    qc.invalidateQueries({ queryKey: ['customer-pending-reviews'] })
  })

  const myReviews: ReviewItemDTO[] = reviewsData?.data?.reviews ?? []
  const pagination = reviewsData?.data?.pagination

  const sortedPending = [...(pending ?? [])].sort((a, b) =>
    new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
  )

  useEffect(() => {
    if (!pending) return                     // wait for data
    const bookingId = sessionStorage.getItem('open_review_booking_id')
    if (!bookingId) return
    sessionStorage.removeItem('open_review_booking_id')   // consume immediately

    const match = pending.find(p => p.booking_id === bookingId)
    if (match) {
      setReviewingItem(match)
    } else {
      // Booking may already have a review — just show a toast
      toast.info('This booking has already been reviewed.')
    }
  }, [pending])   // re-runs once pending data arrives

  return (
    <div className="min-h-screen pb-20 lg:pb-8" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6">
        <h1 className="font-syne font-black text-[28px]" style={{ color: 'var(--text-1)' }}>Reviews</h1>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
          Rate your experiences & see submitted reviews
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
            Pending Reviews ({sortedPending.length})
          </button>
          <button onClick={() => setActiveTab('submitted')}
            className="flex-1 h-10 rounded-[10px] text-[13px] font-syne font-bold"
            style={{
              background: activeTab === 'submitted' ? 'var(--violet)' : 'var(--bg-surface)',
              color: activeTab === 'submitted' ? '#fff' : 'var(--text-2)',
              border: `1px solid ${activeTab === 'submitted' ? 'var(--violet)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            My Reviews ({pagination?.total ?? 0})
          </button>
        </div>
      </div>

      {/* ── Pending reviews ── */}
      {activeTab === 'pending' && (
        pendingLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} height="150px" className="rounded-[14px]" />)}
          </div>
        ) : sortedPending.length === 0 ? (
          <EmptyState
            icon={<Star size={26} />}
            title="All caught up!"
            description="No pending reviews. Book your next appointment and leave a review afterwards."
          />
        ) : (
          <div className="space-y-4">
            {sortedPending.map(item => (
              <motion.div
                key={item.booking_id}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.998 }}
                className="rounded-[14px] overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="p-3 space-y-2.5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={item.business_name} src={item.business_logo} size="md" />
                      <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>{item.business_name}</p>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{formatDate(item.service_date)}</p>
                  </div>

                  {/* Details Section */}
                  <div className="space-y-1.5">
                    {/* Staff Row */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5" style={{ width: 60 }}>
                        <User size={13} style={{ color: 'var(--text-3)' }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Staff:-</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.staff_avatar && (
                          <img src={item.staff_avatar} alt="" className="w-4 h-4 rounded object-cover" />
                        )}
                        <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{item.staff_name}</span>
                      </div>
                    </div>

                    {/* Services Row */}
                    {item.services?.length > 0 && (
                      <div className="flex items-start gap-2">
                        <div className="flex items-center gap-1.5" style={{ width: 60 }}>
                          <Scissors size={15} style={{ color: 'var(--text-3)', marginTop: 1.5 }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-3)', marginTop: 1.5 }}>Services:-</span>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-1">
                          {item.services.map((s: any, i: number) => (
                            <span key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-syne font-bold"
                              style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                              {(s.image_url ?? s.image)
                                ? <img src={s.image_url ?? s.image} alt="" className="w-3 h-3 rounded object-cover flex-shrink-0" />
                                : <Scissors size={10} style={{ color: 'var(--violet-light)', flexShrink: 0 }} />}
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setReviewingItem(item)}
                    className="w-full py-2 rounded-[8px] flex items-center justify-center gap-2 text-[12px] font-syne font-bold"
                    style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    <Star size={13} /> Give Review
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* ── Submitted reviews ── */}
      {activeTab === 'submitted' && (
        reviewsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} height="200px" className="rounded-[14px]" />)}
          </div>
        ) : myReviews.length === 0 ? (
          <EmptyState
            icon={<Star size={26} />}
            title="No reviews yet"
            description="Complete bookings and share your experience with the community."
          />
        ) : (
          <>
            <div className="space-y-4">
              {myReviews.map(r => <MyReviewCard key={r.id} review={r} />)}
            </div>
            {/* Infinite scroll loader */}
            <div ref={loaderRef} className="py-4" />
          </>
        )
      )}

      {/* Review modal */}
      <AnimatePresence>
        {reviewingItem && (
          <ReviewModal item={reviewingItem} onClose={() => setReviewingItem(null)} />
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

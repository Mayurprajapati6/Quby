import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MapPin, Phone, Globe, Clock, ArrowLeft, Star, ExternalLink, Instagram, Facebook, Twitter } from 'lucide-react'
import { Skeleton, StatusBadge, RatingDisplay, EmptyState, StarRating } from '@/components/shared'
import { MapModal } from '@/components/shared/MapModal'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import api from '@/lib/axios'
import { formatINR, formatDate } from '@/lib/utils'
import type { PublicBusinessProfileDTO } from '@/types'

export default function BusinessPublicPage() {
  const { slug }   = useParams<{ slug: string }>()
  const navigate   = useNavigate()
  const [mapOpen,  setMapOpen]  = useState(false)
  const [activeTab, setActiveTab] = useState<'services'|'staff'|'reviews'>('services')

  const { data: biz, isLoading } = useQuery({
    queryKey: ['public-business', slug],
    queryFn: async () => {
      const res = await api.get(`/businesses/${slug}`)
      return res.data.data as PublicBusinessProfileDTO
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  })

  if (isLoading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4 pt-16">
        <Skeleton height="220px" className="rounded-[14px]" />
        <Skeleton height="28px" width="60%" />
        <Skeleton height="14px" width="40%" />
        {[1,2,3].map(i => <Skeleton key={i} height="60px" className="rounded-[9px]" />)}
      </div>
    </div>
  )

  if (!biz) return <EmptyState title="Business not found" description="This salon may have been removed." />

  const ratingBreakdown = biz.review_summary?.rating_breakdown
  const totalRevs = biz.review_summary?.total_reviews ?? 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 px-4 h-12 flex items-center gap-3 border-b"
        style={{ background: 'var(--topbar-bg)', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}>
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1 font-syne font-bold text-[13px]"
          style={{ color: 'var(--text-1)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex-1" />
        <Logo variant="compact" />
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-5 space-y-4 pb-16">

        {/* ── Hero image / gallery ───────────────────────────── */}
        <div className="relative h-56 rounded-[14px] overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
          {biz.primary_image
            ? <img src={biz.primary_image} alt={biz.business_name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-6xl">✂️</div>
          }
          {/* Open/Closed overlay badge */}
          <div className="absolute top-3 right-3">
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold font-syne ${biz.is_open_now ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {biz.is_open_now ? '● Open now' : '● Closed'}
            </span>
          </div>
        </div>

        {/* ── Main info card ────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="q-card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="font-syne font-bold text-[20px]" style={{ color: 'var(--text-1)' }}>
                {biz.business_name}
              </h1>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                by {biz.owner_name} · <span className="font-bold">{biz.service_for}</span>
              </p>
            </div>
            {biz.service_for && (
              <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                {biz.service_for}
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3 mb-4">
            <RatingDisplay rating={biz.average_rating} count={biz.total_reviews} />
          </div>

          {biz.description && (
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--text-2)' }}>{biz.description}</p>
          )}

          {/* Address row — clickable to open map */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setMapOpen(true)}
            className="w-full flex items-start gap-3 p-3 rounded-[10px] mb-3 transition-all text-left"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--violet-bg)' }}>
              <MapPin size={14} style={{ color: 'var(--violet-light)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold" style={{ color: 'var(--text-1)' }}>
                {biz.address_line1}
                {biz.address_line2 ? `, ${biz.address_line2}` : ''}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {biz.city}, {biz.state} {biz.pincode ? `- ${biz.pincode}` : ''}
              </p>
            </div>
            <ExternalLink size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--violet-light)' }} />
          </motion.button>

          {/* Contact + schedule */}
          <div className="space-y-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            {biz.business_phone && (
              <a href={`tel:${biz.business_phone}`} className="flex items-center gap-2 hover:text-violet-400 transition-colors"
                style={{ textDecoration: 'none', color: 'inherit' }}>
                <Phone size={13} /> {biz.business_phone}
              </a>
            )}
            {biz.website_url && (
              <a href={biz.website_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 hover:text-violet-400 transition-colors"
                style={{ textDecoration: 'none', color: 'inherit' }}>
                <Globe size={13} /> {biz.website_url}
              </a>
            )}
            {biz.todays_schedule && (
              <div className="flex items-center gap-2">
                <Clock size={13} />
                {biz.todays_schedule.is_open
                  ? `Today: ${biz.todays_schedule.open_time} – ${biz.todays_schedule.close_time}`
                  : 'Closed today'}
              </div>
            )}
          </div>

          {/* Social links */}
          {biz.social_links && (biz.social_links.instagram || biz.social_links.facebook || biz.social_links.twitter) && (
            <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              {biz.social_links.instagram && (
                <a href={biz.social_links.instagram} target="_blank" rel="noreferrer"
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  <Instagram size={14} />
                </a>
              )}
              {biz.social_links.facebook && (
                <a href={biz.social_links.facebook} target="_blank" rel="noreferrer"
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  <Facebook size={14} />
                </a>
              )}
              {biz.social_links.twitter && (
                <a href={biz.social_links.twitter} target="_blank" rel="noreferrer"
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  <Twitter size={14} />
                </a>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Gallery ───────────────────────────────────────── */}
        {biz.gallery && biz.gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {biz.gallery.map(img => (
              <div key={img.id} className="flex-shrink-0 w-24 h-24 rounded-[10px] overflow-hidden"
                style={{ background: 'var(--bg-surface)' }}>
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs: Services / Staff / Reviews ─────────────── */}
        <div className="q-card">
          <div className="flex gap-1 p-1 rounded-[10px] mb-4" style={{ background: 'var(--bg-surface)' }}>
            {(['services','staff','reviews'] as const).map(t => (
              <button type="button" key={t} onClick={() => setActiveTab(t)}
                className="flex-1 py-1.5 rounded-[8px] text-[12px] font-syne font-bold capitalize transition-all"
                style={{
                  background: activeTab === t ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === t ? 'var(--violet-light)' : 'var(--text-3)',
                  border: activeTab === t ? '1px solid var(--violet-border)' : '1px solid transparent',
                }}>
                {t}
                {t === 'reviews' && biz.total_reviews > 0 && ` (${biz.total_reviews})`}
              </button>
            ))}
          </div>

          {/* Services tab */}
          {activeTab === 'services' && (
            biz.services.length > 0 ? (
              <div className="space-y-2">
                {biz.services.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="text-[13px] font-bold" style={{ color: 'var(--text-1)' }}>{s.name}</span>
                      {s.is_featured && (
                        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: 'var(--yellow)', color: '#000' }}>Popular</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.discounted_price && (
                        <span className="text-[11px] line-through" style={{ color: 'var(--text-4)' }}>
                          {formatINR(s.price)}
                        </span>
                      )}
                      <span className="font-syne font-bold text-[14px]" style={{ color: 'var(--violet-light)' }}>
                        {formatINR(s.discounted_price ?? s.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No services listed" />
          )}

          {/* Staff tab */}
          {activeTab === 'staff' && (
            biz.staff.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {biz.staff.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-[10px]"
                    style={{ background: 'var(--bg-surface)' }}>
                    <Avatar name={s.name} src={s.avatar_url} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-syne font-bold text-[13px]" style={{ color: 'var(--text-1)' }}>{s.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          s.status === 'FREE' ? 'bg-green-500/15 text-green-400' :
                          s.status === 'BUSY' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
                        }`}>{s.status}</span>
                      </div>
                      {s.specialization && (
                        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{s.specialization}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Star size={10} fill="#f59e0b" style={{ color: '#f59e0b' }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                          {s.average_rating.toFixed(1)} ({s.total_reviews})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No staff listed" />
          )}

          {/* Reviews tab */}
          {activeTab === 'reviews' && (
            biz.reviews && biz.reviews.length > 0 ? (
              <div className="space-y-4">
                {/* Rating summary */}
                {ratingBreakdown && totalRevs > 0 && (
                  <div className="flex gap-4 p-4 rounded-[10px] mb-4" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-center flex-shrink-0">
                      <p className="font-syne font-black text-[36px] leading-none" style={{ color: 'var(--text-1)' }}>
                        {biz.review_summary.average_rating.toFixed(1)}
                      </p>
                      <StarRating value={Math.round(biz.review_summary.average_rating)} readonly size={12} />
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{totalRevs} reviews</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5,4,3,2,1].map(n => {
                        const count = ratingBreakdown[['','one','two','three','four','five'][n] as keyof typeof ratingBreakdown] ?? 0
                        const pct = totalRevs ? Math.round((Number(count) / totalRevs) * 100) : 0
                        return (
                          <div key={n} className="flex items-center gap-2">
                            <span className="text-[10px] w-4 flex-shrink-0" style={{ color: 'var(--text-3)' }}>{n}★</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#f59e0b', transition: 'width 0.6s' }} />
                            </div>
                            <span className="text-[9px] w-6 flex-shrink-0" style={{ color: 'var(--text-4)' }}>{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {biz.reviews.map(r => (
                  <div key={r.id} className="border-b pb-4 last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-start gap-2.5 mb-2">
                      <Avatar name={r.customer.name} src={r.customer.avatar_url} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-syne font-bold text-[12px]" style={{ color: 'var(--text-1)' }}>{r.customer.name}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>{formatDate(r.created_at, 'dd MMM yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} size={11} fill={n <= r.rating ? '#f59e0b' : 'none'} style={{ color: '#f59e0b' }} />
                          ))}
                          {r.staff && <span className="text-[10px] ml-1" style={{ color: 'var(--text-3)' }}>· {r.staff.name}</span>}
                        </div>
                      </div>
                    </div>
                    {r.comment && <p className="text-[12px]" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{r.comment}</p>}
                    {r.business_response && (
                      <div className="mt-2 p-2.5 rounded-[8px]" style={{ background: 'var(--bg-surface)', borderLeft: '2px solid var(--violet-border)' }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--violet-light)' }}>Business replied:</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-2)' }}>{r.business_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No reviews yet" description="Be the first to review this salon." />
          )}
        </div>

        {/* ── Weekly schedule ────────────────────────────────── */}
        {biz.schedules && biz.schedules.length > 0 && (
          <div className="q-card">
            <h2 className="font-syne font-bold text-[14px] mb-3" style={{ color: 'var(--text-1)' }}>Business hours</h2>
            <div className="space-y-1.5">
              {biz.schedules.map(s => (
                <div key={s.day_of_week} className="flex items-center justify-between text-[12px]">
                  <span className="capitalize font-bold w-24 flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                    {s.day_of_week.charAt(0) + s.day_of_week.slice(1).toLowerCase()}
                  </span>
                  {s.is_open
                    ? <span style={{ color: 'var(--green)' }}>{s.open_time} – {s.close_time}</span>
                    : <span style={{ color: 'var(--text-4)' }}>Closed</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA ───────────────────────────────────────────── */}
        <div className="q-card text-center p-6" style={{ borderColor: 'var(--violet-border)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--violet-bg)' }}>
            <span className="text-xl">✂️</span>
          </div>
          <h2 className="font-syne font-bold text-[16px] mb-2" style={{ color: 'var(--text-1)' }}>
            Book at {biz.business_name}
          </h2>
          <p className="text-[12px] mb-5" style={{ color: 'var(--text-3)' }}>
            Sign in to book an appointment with your preferred stylist.
          </p>
          <div className="flex gap-3 justify-center">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/login')}
              className="q-btn-ghost h-10 px-5 text-[13px]">Sign in</motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/register')}
              className="q-btn-primary h-10 px-5 text-[13px]">Register & book</motion.button>
          </div>
        </div>
      </main>

      {/* ── Map Modal ─────────────────────────────────────────── */}
      <MapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        businessName={biz.business_name}
        address={biz.address_line1 + (biz.address_line2 ? `, ${biz.address_line2}` : '')}
        city={biz.city}
        state={biz.state}
        mapLink={biz.map_link ?? undefined}
      />
    </div>
  )
}


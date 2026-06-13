import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus, MapPin, Trash2, Edit3, Building2,
  Search, Star, Loader2,
} from 'lucide-react'
import { EmptyState, Skeleton, ConfirmDialog, PaginationBar } from '@/components/shared'
import { useDebounce, usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { toast } from 'sonner'

interface BizItem {
  id: string; business_name: string; service_for: string; city: string; state: string
  primary_image: string | null; logo_url: string | null; is_active: boolean
  is_verified: boolean; average_rating: number; total_reviews: number
  active_staff_count: number; today_bookings: number; total_earning_inr: number
}


function BizCard({ biz, allBiz }: { biz: BizItem; allBiz: BizItem[] }) {
  const navigate = useNavigate()
  const ql = useQueryClient()
  const [delOpen, setDelOpen] = useState(false)

  const del = useMutation({
    mutationFn: () => api.delete(`/owner/businesses/${biz.id}`),
    onSuccess: () => {
      toast.success(`"${biz.business_name}" deleted`)
      ql.invalidateQueries({ queryKey: ['owner-businesses'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cannot delete — active bookings exist'),
  })

  return (
    <>
      <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[14px] overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

        {/* Cover */}
        <div className="relative w-full rounded-t-[14px]" style={{ height: '200px', background: 'var(--bg-surface)' }}>
          {biz.primary_image ? (
            <img src={biz.primary_image} alt={biz.business_name}
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Building2 size={36} style={{ color: 'var(--text-4)' }} />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {/* <span className="px-2 py-0.5 rounded-full text-[9px] font-syne font-bold"
              style={{ background: biz.is_verified ? 'rgba(52,211,153,0.9)' : 'rgba(245,158,11,0.9)', color: '#fff' }}>
              {biz.is_verified ? '✓ Verified' : 'Unverified'}
            </span> */}
            <span className="px-2 py-0.5 rounded-full text-[9px] font-syne font-bold"
              style={{ background: biz.is_active ? 'rgba(52,211,153,0.8)' : 'rgba(0,0,0,0.6)', color: biz.is_active ? '#fff' : '#aaa' }}>
              {biz.is_active ? '● Active' : '○ Off'}
            </span>
          </div>

        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 gap-3">
          <div className="flex items-start gap-3">
            {biz.logo_url && (
              <img src={biz.logo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                style={{ border: '1px solid var(--border)' }} />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-syne font-black text-[15px]" style={{ color: 'var(--text-1)' }}>
                {biz.business_name}
              </h3>
              <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-3)' }}>
                <MapPin size={10} />{biz.city}, {biz.state}
              </p>
            </div>
            {biz.average_rating >= 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={11} fill="#f59e0b" style={{ color: '#f59e0b' }} />
                <span className="text-[12px] font-syne font-bold" style={{ color: 'var(--text-1)' }}>
                  {biz.average_rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/owner/businesses/${biz.id}/edit`)}
              className="flex-1 h-9 rounded-[9px] flex items-center justify-center gap-1.5 text-[12px] font-syne font-bold"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <Edit3 size={12} />Edit
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setDelOpen(true)}
              className="flex-1 h-9 rounded-[9px] flex items-center justify-center gap-1.5 text-[12px] font-syne font-bold"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}>
              <Trash2 size={12} />Delete
            </motion.button>
          </div>
        </div>
      </motion.article>

      <ConfirmDialog open={delOpen} danger title={`Delete "${biz.business_name}"?`}
        description="This permanently deletes the business and all its data."
        confirmLabel="Delete Business" loading={del.isPending}
        onConfirm={() => del.mutate()} onCancel={() => setDelOpen(false)} />
    </>
  )
}

export default function OwnerBusinesses() {
  usePageTitle('My Businesses')
  const navigate = useNavigate()
  const location = useLocation()
  // Use lolal state for input — debounle only for query
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const observerTarget = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)
  const dSearch = useDebounce(searchInput, 500)

  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['owner-businesses', dSearch, page],
    queryFn: async () => {
      const r = await api.get('/owner/businesses', { params: { name: dSearch || undefined, page, limit: 30 } })
      return r.data
    },
    staleTime: 0,
  })

  const businesses: BizItem[] = data?.data?.businesses ?? []
  const totalPages = data?.data?.total_pages ?? 1
  const total = data?.data?.total ?? 0

  // Invalidate query on first mount to fix navigation bug
  useEffect(() => {
    setPage(1)
    qc.invalidateQueries({ queryKey: ['owner-businesses'] })
  }, [location.key])

  // Infinite scroll for mobile
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && page < totalPages) {
          setPage(p => p + 1)
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    )

    const current = observerTarget.current
    if (current) observer.observe(current)

    return () => {
      if (current) observer.unobserve(current)
    }
  }, [totalPages, page, isLoading])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-syne font-black text-[24px] md:text-[28px]" style={{ color: 'var(--text-1)' }}>
              My Businesses
            </h1>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              {total} business{total !== 1 ? 'es' : ''}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/owner/businesses/new')}
            className="flex items-center gap-2 px-5 h-10 rounded-[10px] text-[13px] font-syne font-bold flex-shrink-0"
            style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={15} />New Business
          </motion.button>
        </div>

        {/* Search — unlontrolled input for instant typing, debounled query */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-3)' }} />
          <input
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1) }}
            placeholder="Search businesses by name…"
            className="w-full h-10 rounded-[10px] text-[13px] font-syne outline-none"
            style={{ paddingLeft: '36px', paddingRight: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} height="420px" className="rounded-[14px]" />)}
          </div>
        ) : businesses.length === 0 ? (
          <EmptyState icon={<Building2 size={32} />}
            title={searchInput ? 'No businesses match' : 'No businesses yet'}
            description={searchInput ? 'Try different search.' : 'Create your first business to get started.'}
            action={!searchInput ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/owner/businesses/new')}
                className="flex items-center gap-2 px-5 h-10 rounded-[10px] text-[13px] font-syne font-bold"
                style={{ background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Plus size={15} />Create Business
              </motion.button>
            ) : undefined} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {businesses.map(biz => <BizCard key={biz.id} biz={biz} allBiz={businesses} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 hidden md:block">
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}

        {/* Infinite scroll loader for mobile */}
        {page < totalPages && (
          <div ref={observerTarget} className="md:hidden mt-4 flex justify-center">
            <Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-3)' }} />
          </div>
        )}
      </div>
    </div>
  )
}






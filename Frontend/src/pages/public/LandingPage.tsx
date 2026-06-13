import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Star, Clock, Shield, ArrowRight, Scissors,
  MapPin, ChevronRight, Zap, Users, TrendingUp,
  Instagram, Twitter, Facebook, Mail, Phone,
  CheckCircle, Sparkles, Play, Calendar
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import api from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────
interface BizCard {
  id: string; slug: string; business_name: string; city: string; state: string
  average_rating: number; total_reviews: number; primary_image?: string; service_for: string
  is_open_now: boolean
}

// ── Animated counter ──────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const dur = 1800
        const start = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - start) / dur, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          setVal(Math.round(ease * to))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [to])

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

// ── Floating salon card ───────────────────────────────────────────
function FloatingCard({ biz, delay }: { biz: BizCard; delay: number }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 120, damping: 20 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => navigate(`/businesses/${biz.slug}`)}
      className="cursor-pointer overflow-hidden max-w-[280px]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="h-32 overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        {biz.primary_image
          ? <img src={biz.primary_image} alt={biz.business_name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">✂️</div>
        }
        <div className="absolute top-2 right-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${biz.is_open_now ? 'bg-green-500 text-white' : 'bg-red-500/80 text-white'}`}>
            {biz.is_open_now ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
      <div className="p-3 relative">
        <p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>
          {biz.business_name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
            <MapPin size={9} />{biz.city}
          </span>
          <span className="flex items-center gap-0.5 text-[11px]" style={{ color: '#f59e0b' }}>
            <Star size={9} fill="#f59e0b" />{biz.average_rating.toFixed(1)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── How it works step ─────────────────────────────────────────────
const HOW_STEPS = [
  { n: '01', icon: Search,   title: 'Find a salon',      desc: 'Browse nearby salons filtered by service, rating, and availability.' },
  { n: '02', icon: Calendar, title: 'Pick a slot',       desc: 'Choose your date and preferred staff. See live queue position.' },
  { n: '03', icon: Shield,   title: 'Pay securely',      desc: 'Razorpay-secured payment. Get your QR booking confirmation instantly.' },
  { n: '04', icon: Scissors, title: 'Walk in & go',      desc: 'Show your QR on arrival. Track your queue in real time.' },
]

// ── Testimonials ──────────────────────────────────────────────────
const TESTIMONIALS = [
  { name: 'Arjun Sharma',  role: 'Regular customer',   rating: 5, text: 'No more waiting blindly. I know exactly when to arrive. Life-changing for busy professionals.' },
  { name: 'Priya Mehta',   role: 'Salon owner',        rating: 5, text: 'Quby transformed how we manage bookings. Staff efficiency went up 40% in the first month.' },
  { name: 'Rohan Patel',   role: 'Customer',           rating: 5, text: 'The QR check-in is brilliant. Showed up right on time, zero waiting.' },
]

export default function LandingPage() {
  const navigate  = useNavigate()
  const [search,  setSearch]  = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const heroRef   = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY       = useTransform(scrollY, [0, 300], [0, -60])

  const { data: topSalons } = useQuery({
    queryKey: ['landing-top-salons'],
    queryFn: async () => {
      const res = await api.get('/explore', { params: { min_rating: 4.0, limit: 8, page: 1 } })
      return res.data.data.businesses as BizCard[]
    },
    staleTime: 10 * 60_000,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/explore${search ? `?name=${encodeURIComponent(search)}` : ''}`)
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── NAVBAR ────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-14"
        style={{ background: 'var(--topbar-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <Logo variant="compact" />

        <div className="hidden md:flex items-center gap-6 text-[13px] font-syne font-bold" style={{ color: 'var(--text-2)' }}>
          <button type="button" onClick={() => navigate('/explore')} className="hover:text-violet-400 transition-colors bg-transparent border-none cursor-pointer"
            style={{ color: 'inherit', font: 'inherit' }}>Explore</button>
          <button type="button" onClick={() => navigate('/register')} className="hover:text-violet-400 transition-colors bg-transparent border-none cursor-pointer"
            style={{ color: 'inherit', font: 'inherit' }}>For Owners</button>
          <a href="#how-it-works" className="hover:text-violet-400 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
            How it works
          </a>
        </div>

        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/login')}
            className="q-btn-ghost text-[12px] h-8 px-4 hidden sm:flex">
            Sign in
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/register')}
            className="q-btn-primary text-[12px] h-8 px-4">
            Get started
          </motion.button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-14"
      >
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(circle at 75% 75%, rgba(99,102,241,0.08) 0%, transparent 60%)',
          }}>
          <div className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
              opacity: 0.4,
            }} />
        </div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}
        >
          <Sparkles size={13} style={{ color: 'var(--violet-light)' }} />
          <span className="text-[12px] font-syne font-bold" style={{ color: 'var(--violet-light)' }}>
            India's smartest salon queue platform
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 22 }}
          className="font-syne font-black text-center leading-[1.1] mb-6"
          style={{ fontSize: 'clamp(36px, 6vw, 72px)', color: 'var(--text-1)', maxWidth: 800 }}
        >
          Your salon queue,{' '}
          <span style={{
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            beautifully
          </span>
          {' '}managed.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center max-w-xl mb-10"
          style={{ fontSize: 'clamp(14px, 2vw, 17px)', color: 'var(--text-2)', lineHeight: 1.7 }}
        >
          Book appointments at top salons, track your live queue position, and get real-time updates — all from your phone.
        </motion.p>

        {/* Search bar */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSearch}
          className="flex gap-2 w-full max-w-md mb-8"
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search salons, services…"
              className="q-input pl-9 h-11 w-full text-[13px]"
              style={{ borderColor: 'var(--violet-border)' }}
            />
          </div>
          <motion.button whileTap={{ scale: 0.97 }} type="submit"
            className="q-btn-primary h-11 px-5 text-[13px] flex items-center gap-2 flex-shrink-0">
            Search
          </motion.button>
        </motion.form>

        {/* CTA pair */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap gap-3 justify-center mb-16"
        >
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/explore')}
            className="q-btn-primary h-11 px-7 text-[14px] flex items-center gap-2">
            <MapPin size={15} /> Explore salons
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/register')}
            className="q-btn-ghost h-11 px-7 text-[14px] flex items-center gap-2">
            Register free <ArrowRight size={14} />
          </motion.button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-4 text-[12px]"
          style={{ color: 'var(--text-3)' }}
        >
          <div className="flex -space-x-2">
            {['A','R','P','K','M'].map((n, i) => (
              <div key={n} className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                style={{
                  background: `hsl(${i * 60}, 60%, 55%)`,
                  color: '#fff',
                  borderColor: 'var(--bg-page)',
                }}>
                {n}
              </div>
            ))}
          </div>
          <span>Trusted by <strong style={{ color: 'var(--text-1)' }}>10,000+</strong> happy customers</span>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ color: 'var(--text-4)' }}
        >
          <span className="text-[9px] font-syne uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, var(--text-4), transparent)' }} />
        </motion.div>
      </motion.section>

      {/* ── STATS BAND ────────────────────────────────────────── */}
      <section className="py-16 border-y" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: 500,   suffix: '+',  label: 'Salons',         icon: Scissors },
            { val: 10000, suffix: '+',  label: 'Happy customers', icon: Users },
            { val: 50000, suffix: '+',  label: 'Bookings done',   icon: Calendar },
            { val: 4.8,   suffix: '★',  label: 'Average rating',  icon: Star },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="font-syne font-black text-[36px] md:text-[44px]"
                style={{ color: 'var(--violet-light)', lineHeight: 1 }}>
                <Counter to={s.val} suffix={s.suffix} />
              </p>
              <p className="text-[12px] mt-1 font-syne font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TOP SALONS ───────────────────────────────────────── */}
      {topSalons && topSalons.length > 0 && (
        <section className="py-16 px-4 md:px-8 lg:px-16">
          <div className="max-w-none">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[11px] font-syne font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--violet-light)' }}>
                  Featured
                </p>
                <h2 className="font-syne font-black text-[28px]" style={{ color: 'var(--text-1)' }}>
                  Top-rated salons
                </h2>
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate('/explore')}
                className="q-btn-ghost text-[12px] h-9 px-4 flex items-center gap-1.5">
                See all <ChevronRight size={13} />
              </motion.button>
            </motion.div>

            {/* Grid of cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {topSalons.map((biz, i) => (
                <FloatingCard key={biz.id} biz={biz} delay={i * 0.06} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 px-4 md:px-8 lg:px-16" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-[11px] font-syne font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--violet-light)' }}>
              Simple & Fast
            </p>
            <h2 className="font-syne font-black text-[32px]" style={{ color: 'var(--text-1)' }}>How Quby works</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_STEPS.map((step, i) => (
              <motion.div key={step.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%+12px)] right-[-12px] h-px"
                    style={{ background: 'linear-gradient(to right, var(--violet-border), transparent)', width: 'calc(100% + 24px)' }} />
                )}

                <div className="q-card p-5 h-full">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-[5px]"
                      style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)' }}>
                      {step.n}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4"
                    style={{ background: 'var(--violet-bg)' }}>
                    <step.icon size={18} style={{ color: 'var(--violet-light)' }} />
                  </div>
                  <h3 className="font-syne font-bold text-[14px] mb-2" style={{ color: 'var(--text-1)' }}>{step.title}</h3>
                  <p className="text-[12px]" style={{ color: 'var(--text-3)', lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────── */}
      <section className="py-16 px-4 md:px-8 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <h2 className="font-syne font-black text-[32px]" style={{ color: 'var(--text-1)' }}>
              Built for everyone
            </h2>
            <p className="text-[14px] mt-3 max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
              Whether you're booking a haircut or running a salon chain — Quby has you covered.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                tag: 'Customers',
                icon: '👤',
                color: 'var(--violet-light)',
                bg: 'var(--violet-bg)',
                border: 'var(--violet-border)',
                points: ['Real-time queue tracking', 'QR-based check-in', 'Instant booking + payment', 'Favourite salons list', 'Review & rate stylists'],
              },
              {
                tag: 'Salon Owners',
                icon: '🏢',
                color: 'var(--green)',
                bg: 'var(--green-bg)',
                border: 'var(--green-border)',
                points: ['Multi-branch management', 'Staff attendance auto-tracking', 'Live today\'s view Kanban', 'Earnings & payout dashboard', 'Leave approval workflow'],
              },
              {
                tag: 'Staff',
                icon: '✂️',
                color: '#f59e0b',
                bg: 'rgba(245,158,11,0.1)',
                border: 'rgba(245,158,11,0.25)',
                points: ['Today\'s queue at a glance', 'QR scanner built-in', 'Leave management', 'Attendance heatmap', 'Customer reviews'],
              },
            ].map((card, i) => (
              <motion.div key={card.tag}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="q-card p-6"
                style={{ borderColor: card.border }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">{card.icon}</span>
                  <span className="font-syne font-black text-[16px]" style={{ color: 'var(--text-1)' }}>
                    {card.tag}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {card.points.map(p => (
                    <li key={p} className="flex items-start gap-2">
                      <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: card.color }} />
                      <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="py-16 px-4 md:px-8 lg:px-16" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <h2 className="font-syne font-black text-[28px]" style={{ color: 'var(--text-1)' }}>
              What people are saying
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="q-card p-5"
              >
                <div className="flex mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={13} fill="#f59e0b" style={{ color: '#f59e0b' }} />
                  ))}
                </div>
                <p className="text-[13px] mb-4" style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>"{t.text}"</p>
                <div className="flex items-center gap-2.5">
                  <Avatar name={t.name} size="sm" />
                  <div>
                    <p className="font-syne font-bold text-[12px]" style={{ color: 'var(--text-1)' }}>{t.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OWNER CTA ─────────────────────────────────────────── */}
      <section className="py-16 px-4 md:px-8 lg:px-16">
        <div className="max-w-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-[14px] p-10 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--violet), #3B7FFF)',
              border: 'none'
            }}
          >
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>
                <TrendingUp size={22} style={{ color: '#fff' }} />
              </div>
              <h2 className="font-syne font-black text-[26px] mb-3" style={{ color: '#fff' }}>
                Own a salon? Grow with Quby.
              </h2>
              <p className="text-[14px] mb-8 max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                Join 500+ salon owners who streamlined their business. No setup fee. Start in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/register')}
                  className="h-11 px-8 text-[14px] flex items-center justify-center gap-2 rounded-[9px] font-syne font-bold"
                  style={{ background: '#fff', color: 'var(--violet)', border: 'none' }}>
                  <Zap size={15} /> Register your salon
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/explore')}
                  className="h-11 px-8 text-[14px] rounded-[9px] font-syne font-bold"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                  Browse the platform
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

            {/* Brand */}
            <div className="md:col-span-2">
              <Logo variant="compact" />
              <p className="text-[13px] mt-4 max-w-xs" style={{ color: 'var(--text-3)', lineHeight: 1.7 }}>
                Quby is India's smartest salon booking and queue management platform. Book in seconds, wait less, look great.
              </p>
              <div className="flex gap-3 mt-5">
                {[Instagram, Twitter, Facebook].map((Icon, i) => (
                  <motion.a key={i} href="#" whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 rounded-[9px] flex items-center justify-center"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                    <Icon size={15} />
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="font-syne font-bold text-[12px] uppercase tracking-widest mb-4" style={{ color: 'var(--text-1)' }}>
                Platform
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Explore salons', to: '/explore' },
                  { label: 'How it works', to: '#how-it-works' },
                  { label: 'For owners', to: '/register' },
                  { label: 'Sign in', to: '/login' },
                  { label: 'Create account', to: '/register' },
                ].map(link => (
                  <li key={link.label}>
                    <button type="button" onClick={() => link.to.startsWith('#') ? document.querySelector(link.to)?.scrollIntoView({behavior:'smooth'}) : navigate(link.to)}
                      className="text-[13px] hover:text-violet-400 transition-colors"
                      style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-syne font-bold text-[12px] uppercase tracking-widest mb-4" style={{ color: 'var(--text-1)' }}>
                Contact
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-3)' }}>
                  <Mail size={13} /> hello@quby.in
                </li>
                <li className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-3)' }}>
                  <Phone size={13} /> +91 98765 43210
                </li>
                <li className="flex items-start gap-2 text-[13px]" style={{ color: 'var(--text-3)' }}>
                  <MapPin size={13} className="flex-shrink-0 mt-0.5" /> Ahmedabad, Gujarat, India
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderColor: 'var(--border)' }}>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              © 2026 Quby Technologies Pvt. Ltd. All rights reserved.
            </p>
            <div className="flex gap-4 text-[11px]" style={{ color: 'var(--text-4)' }}>
              <button type="button" className="hover:text-violet-400 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>Privacy Policy</button>
              <button type="button" className="hover:text-violet-400 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>Terms of Service</button>
              <button type="button" className="hover:text-violet-400 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>Cookie Policy</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

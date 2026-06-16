import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Star, ArrowRight, Scissors, MapPin, ChevronRight,
  Zap, Users, TrendingUp, Github, Linkedin, CheckCircle,
  Sparkles, Calendar, Camera, Upload, Building2,
  User, Shield, Menu, X
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import api from '@/lib/axios'

/* ─── Types ──────────────────────────────────────────────────────── */
interface BizCard {
  id: string; slug: string; business_name: string; city: string; state: string
  average_rating: number; total_reviews: number; primary_image?: string
  service_for: string; is_open_now: boolean
}

/* ─── Real Unsplash image URLs ───────────────────────────────────── */
// People face photos (diverse, professional)
const PEOPLE_IMGS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=80&h=80&fit=crop&crop=face',
]

// Salon interior photos
const SALON_IMGS = [
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1560066984-138daaa0c8a9?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=200&fit=crop',
]

/* ─── Global CSS injected once ───────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=Inter:wght@400;500;600&display=swap');
  :root {
    --bg-page:#0d0d14; --bg-surface:#111118; --bg-card:#16161f;
    --bg-card2:#1a1a2e; --border:rgba(255,255,255,0.08);
    --text-1:#f1f0ff; --text-2:#bbb8d4; --text-3:#8884a8; --text-4:#5a5875;
    --violet:#8b5cf6; --violet-light:#a78bfa;
    --violet-bg:rgba(139,92,246,0.12); --violet-border:rgba(139,92,246,0.25);
    --green:#22c55e; --amber:#f59e0b; --indigo:#6366f1;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Inter',sans-serif;background:var(--bg-page);color:var(--text-1);overflow-x:hidden}
  input{font-family:'Inter',sans-serif}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-track{background:var(--bg-page)}
  ::-webkit-scrollbar-thumb{background:var(--violet-border);border-radius:3px}

  .q-hero-grid   { display:grid; grid-template-columns:48% 52%; gap:48px; align-items:start }
  .q-how-grid    { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; position:relative }
  .q-feat-grid   { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:48px }
  .q-testi-grid  { display:grid; grid-template-columns:repeat(3,1fr); gap:18px }
  .q-queue-grid  { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center }
  .q-salon-grid  { display:grid; grid-template-columns:repeat(5,1fr); gap:16px }
  .q-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:48px; margin-bottom:48px }
  .q-stats-wrap  { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
  .q-cta-row     { display:flex; align-items:center; gap:32px; flex-wrap:wrap }
  .q-cta-btns    { display:flex; flex-direction:column; gap:10px; flex-shrink:0 }
  .q-hero-right  { display:block }
  .q-nav-links   { display:flex; align-items:center; gap:28px }
  .q-hamburger   { display:none }
  .q-mobile-preview { display:none }
  .q-hero-chips  { display:flex; flex-wrap:wrap; gap:8px }
  .q-hero-ctas   { display:flex; flex-wrap:wrap; gap:12px }

  @media(max-width:1024px){
    .q-hero-grid   { grid-template-columns:1fr }
    .q-hero-right  { display:none }
    .q-mobile-preview { display:block }
    .q-queue-grid  { grid-template-columns:1fr; gap:36px }
    .q-footer-grid { grid-template-columns:1fr 1fr; gap:28px }
    .q-salon-grid  { grid-template-columns:repeat(3,1fr) }
    .q-stats-wrap  { grid-template-columns:repeat(2,1fr); }
  }
  @media(max-width:768px){
    .q-nav-links   { display:none }
    .q-hamburger   { display:flex }
    .q-how-grid    { grid-template-columns:1fr 1fr }
    .q-feat-grid   { grid-template-columns:1fr }
    .q-testi-grid  { grid-template-columns:1fr }
    .q-salon-grid  { grid-template-columns:repeat(2,1fr) }
    .q-footer-grid { grid-template-columns:1fr; gap:24px }
    .q-cta-row     { flex-direction:column; align-items:flex-start }
    .q-cta-btns    { flex-direction:row; flex-wrap:wrap }
    .q-stats-wrap  { grid-template-columns:1fr 1fr; }
  }
  @media(max-width:480px){
    .q-how-grid    { grid-template-columns:1fr }
    .q-hero-ctas   { flex-direction:column }
    .q-hero-ctas button { width:100%; justify-content:center }
    .q-cta-btns button  { flex:1; justify-content:center }
    .q-stats-wrap  { grid-template-columns:1fr 1fr; }
  }
`

/* ─── Inline style helpers ───────────────────────────────────────── */
const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
}
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  background: 'linear-gradient(135deg,#8b5cf6 0%,#6366f1 100%)',
  color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
  fontFamily: "'Syne',sans-serif", fontWeight: 700, transition: 'opacity .2s',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  background: 'transparent', color: 'var(--text-2)',
  border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
  fontFamily: "'Syne',sans-serif", fontWeight: 700,
}

/* ═══════════════════════════════════════════════════════════════════
   QR CODE SVG
═══════════════════════════════════════════════════════════════════ */
function QRCodeSVG({ size = 80, color = '#a78bfa' }: { size?: number; color?: string }) {
  const modules = [
    [1,1,1,1,1,1,1,0,1,0,1,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0],
    [1,0,1,1,1,0,1,0,0,1,1,1,0,0,1,0,1,1,1,0],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,1,1,0,1,1,1,0],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,1,1,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,1,0,0,1,1,0,1,1,0,1,0,1,1],
    [0,1,1,0,0,1,0,0,1,0,0,1,0,0,1,1,0,1,0,0],
    [1,1,0,0,1,0,1,1,0,1,1,0,1,1,0,0,1,1,0,1],
    [0,0,1,1,0,0,0,0,1,0,0,1,0,1,1,0,0,0,1,0],
    [1,0,0,0,1,1,1,1,0,1,1,0,1,0,0,1,1,1,0,1],
    [0,0,0,0,0,0,0,0,1,0,1,1,0,0,1,0,1,0,0,1],
    [1,1,1,1,1,1,1,0,0,1,0,0,1,0,1,0,0,1,1,0],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,1,0,1,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,1,1,0,1,0,1,1,0,0],
    [1,0,1,1,1,0,1,0,1,0,0,0,1,1,0,1,0,0,1,1],
    [1,0,0,0,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1,0],
    [1,1,1,1,1,1,1,0,0,0,1,0,1,1,0,1,0,1,0,1],
  ]
  const cols = modules[0].length
  const rows = modules.length
  const cellSize = size / Math.max(cols, rows)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill="transparent" rx={4} />
      {modules.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect key={`${r}-${c}`} x={c * cellSize + 0.5} y={r * cellSize + 0.5}
              width={cellSize - 1} height={cellSize - 1} fill={color} rx={0.5} />
          ) : null
        )
      )}
    </svg>
  )
}

/* ─── Rotating headline ──────────────────────────────────────────── */
const HEADLINES = [
  { text: 'Skip the waiting room.',            hl: 'waiting' },
  { text: "Know exactly when it's your turn.", hl: 'turn'    },
  { text: 'Track your queue in real time.',    hl: 'real'    },
  { text: 'Never waste time waiting again.',   hl: 'waiting' },
  { text: 'Book. Track. Arrive.',              hl: 'Arrive'  },
]

function RotatingHeadline() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % HEADLINES.length), 3200)
    return () => clearInterval(t)
  }, [])
  const { text, hl } = HEADLINES[idx]
  const parts = text.split(hl)
  return (
    <AnimatePresence mode="wait">
      <motion.h1
        key={idx}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.45 }}
        style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 900,
          fontSize: 'clamp(34px,4.2vw,54px)', lineHeight: 1.15,
          color: 'var(--text-1)', minHeight: 'clamp(130px,13vw,180px)',
        }}
      >
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && (
              <span style={{
                background: 'linear-gradient(135deg,#8b5cf6 0%,#a78bfa 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{hl}</span>
            )}
            {p}
          </span>
        ))}
      </motion.h1>
    </AnimatePresence>
  )
}

/* ─── Animated counter ───────────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const dur = 1800, t0 = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - t0) / dur, 1)
          setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    obs.observe(el); return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

/* ─── Floating salon card ────────────────────────────────────────── */
function FloatingCard({ biz, delay }: { biz: BizCard; delay: number }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, type: 'spring', stiffness: 120, damping: 20 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => navigate(`/businesses/${biz.slug}`)}
      style={{ ...card, cursor: 'pointer', overflow: 'hidden', borderRadius: 14 }}
    >
      <div style={{ height: 144, overflow: 'hidden', position: 'relative', background: 'var(--bg-card)' }}>
        {biz.primary_image
          ? <img src={biz.primary_image} alt={biz.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✂️</div>
        }
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <span style={{
            fontSize: 9, padding: '3px 8px', borderRadius: 999, fontWeight: 700,
            background: biz.is_open_now ? '#22c55e' : 'rgba(239,68,68,0.8)', color: '#fff',
          }}>{biz.is_open_now ? 'Open' : 'Closed'}</span>
        </div>
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(0,0,0,0.6)', color: '#f59e0b',
          }}>
            <Star size={8} fill="#f59e0b" color="#f59e0b" />
            {biz.average_rating.toFixed(1)}
          </span>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {biz.business_name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
          <MapPin size={9} color="var(--text-3)" />
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{biz.city}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {biz.service_for.split(',').slice(0, 2).map((svc, i) => (
            <span key={i} style={{
              fontSize: 9, padding: '3px 8px', borderRadius: 999,
              background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', color: 'var(--violet-light)',
            }}>{svc.trim()}</span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   HERO RIGHT — 3 labeled cards with REAL IMAGES
═══════════════════════════════════════════════════════════════════ */
function HeroCards() {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position:'absolute', top:-80, right:-60, width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.5) 0%,transparent 70%)', filter:'blur(64px)', opacity:.3, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-60, left:-40, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,.5) 0%,transparent 70%)', filter:'blur(60px)', opacity:.2, pointerEvents:'none' }} />

      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 90, damping: 18 }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, position: 'relative', zIndex: 2 }}
      >
        {/* ── LEFT: Customer card ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <LabelBadge>Customer</LabelBadge>
          <motion.div
            initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:0.45, type:'spring', stiffness:100, damping:16 }}
            style={{ borderRadius:28, overflow:'hidden', background:'linear-gradient(180deg,#1a1a2e 0%,#16213e 100%)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 24px 56px -12px rgba(0,0,0,0.65)' }}
          >
            {/* Header with real user photo */}
            <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0, overflow:'hidden', border:'2px solid rgba(139,92,246,0.4)' }}>
                <img src={PEOPLE_IMGS[0]} alt="Royur" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
              <div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'#fff' }}>Royur</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Anand, Gujarat</p>
              </div>
            </div>

            {/* Your Booking — with salon image */}
            <div style={{ padding:'10px 16px 4px', fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:600 }}>Your Booking</div>
            <div style={{ padding:'6px 16px 12px', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', flexShrink:0, border:'1px solid rgba(139,92,246,0.25)' }}>
                <img src={SALON_IMGS[0]} alt="Style Studio" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
              <div>
                <p style={{ fontSize:12, fontWeight:600, color:'#fff' }}>Style Studio</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>Anand, Gujarat</p>
              </div>
            </div>

            {/* Queue number */}
            <div style={{ margin:'0 16px 12px', padding:'16px 12px', textAlign:'center', background:'rgba(139,92,246,0.1)', borderRadius:14, border:'1px solid rgba(139,92,246,0.22)' }}>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:4 }}>Your Queue Number</p>
              <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:52, color:'#a78bfa', lineHeight:1 }}>#3</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:4 }}>People ahead of you</p>
            </div>

            {/* Wait */}
            <div style={{ padding:'0 16px 10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Estimated wait</span>
                <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color:'#fff' }}>12 mins</span>
              </div>
              <div style={{ height:6, borderRadius:999, background:'rgba(255,255,255,0.1)' }}>
                <div style={{ height:'100%', width:'35%', borderRadius:999, background:'linear-gradient(to right,#8b5cf6,#a78bfa)' }} />
              </div>
            </div>

            {/* Dots */}
            <div style={{ display:'flex', justifyContent:'center', gap:6, padding:'8px 0 12px' }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i<=3 ? '#8b5cf6' : 'rgba(255,255,255,0.18)' }} />)}
            </div>

            {/* CTA */}
            <div style={{ padding:'0 16px 16px' }}>
              <button style={{ width:'100%', height:40, borderRadius:10, border:'none', background:'linear-gradient(135deg,#8b5cf6 0%,#a78bfa 100%)', color:'#fff', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, cursor:'pointer', boxShadow:'0 4px 14px rgba(139,92,246,0.4)' }}>
                View Live Queue
              </button>
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Salon Owner card */}
          <div style={{ display:'flex', flexDirection:'column' }}>
            <LabelBadge>Salon Owner</LabelBadge>
            <motion.div
              initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.55, type:'spring', stiffness:100, damping:16 }}
              style={{ borderRadius:22, overflow:'hidden', background:'linear-gradient(180deg,#1a1a2e 0%,#16213e 100%)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 20px 48px -12px rgba(0,0,0,0.6)' }}
            >
              <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Building2 size={15} color="#22c55e" />
                </div>
                <div>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, color:'#fff' }}>Today's Overview</p>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              <div style={{ padding:'12px 12px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                {/* Bookings */}
                <div style={{ padding:'10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', textAlign:'center' }}>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginBottom:4 }}>Bookings</p>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:22, color:'#fff', lineHeight:1, letterSpacing:'-0.5px' }}>14</p>
                </div>
                {/* Revenue — ₹ rendered same size/weight as digits to prevent baseline shift */}
                <div style={{ padding:'10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', textAlign:'center' }}>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginBottom:4 }}>Revenue</p>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'#fff', lineHeight:1, letterSpacing:'-0.3px', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:13, verticalAlign:'baseline' }}>₹</span>
                    <span style={{ fontSize:13, verticalAlign:'baseline' }}>24,680</span>
                  </p>
                </div>
              </div>

              <div style={{ padding:'2px 12px 6px', fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.45)' }}>Live Queue</div>

              {/* Queue rows with real face images */}
              <div style={{ padding:'0 12px', display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
                {[
                  { n:1, name:'Riya Patel',   status:'Checked In',  color:'#22c55e', img: PEOPLE_IMGS[1] },
                  { n:2, name:'Mohit Sharma', status:'In Progress', color:'#f59e0b', img: PEOPLE_IMGS[2] },
                  { n:3, name:'You',          status:'12 mins',     color:'#a78bfa', img: PEOPLE_IMGS[0] },
                  { n:4, name:'Neha Singh',   status:'18 mins',     color:'rgba(255,255,255,0.38)', img: PEOPLE_IMGS[3] },
                ].map(r => (
                  <div key={r.n} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px', borderRadius:7, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, overflow:'hidden', border:'1px solid rgba(139,92,246,0.3)' }}>
                        <img src={r.img} alt={r.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </div>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>{r.name}</span>
                    </div>
                    <span style={{ fontSize:9, color:r.color }}>{r.status}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding:'0 12px 12px' }}>
                <button style={{ width:'100%', height:34, borderRadius:9, border:'none', background:'linear-gradient(135deg,#8b5cf6 0%,#a78bfa 100%)', color:'#fff', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:10, cursor:'pointer', boxShadow:'0 4px 12px rgba(139,92,246,0.38)' }}>
                  View All Appointments
                </button>
              </div>
            </motion.div>
          </div>

          {/* Staff QR card */}
          <div style={{ display:'flex', flexDirection:'column' }}>
            <LabelBadge>Staff</LabelBadge>
            <motion.div
              initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.65, type:'spring', stiffness:100, damping:16 }}
              style={{ borderRadius:22, overflow:'hidden', background:'linear-gradient(180deg,#1a1a2e 0%,#16213e 100%)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 20px 48px -12px rgba(0,0,0,0.6)' }}
            >
              <div style={{ padding:'12px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M17 14h3M14 17h3v3"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, color:'#fff' }}>QR Check-In</p>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>Scan to check-in customer</p>
                </div>
              </div>

              <div style={{ padding:12, display:'flex', gap:10 }}>
                <div style={{ flex:1, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', padding:8, position:'relative', aspectRatio:'1' }}>
                  <QRCodeSVG size={110} color="#a78bfa" />
                  <div style={{ position:'absolute', width:28, height:28, borderRadius:7, background:'#1a1a2e', border:'1px solid rgba(139,92,246,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Camera size={12} color="#a78bfa" />
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, width:56 }}>
                  <button style={{ flex:1, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#8b5cf6,#a78bfa)', color:'#fff', fontSize:9, fontWeight:700, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, boxShadow:'0 4px 12px rgba(139,92,246,0.4)' }}>
                    <Camera size={11} /><span>Camera</span>
                  </button>
                  <button style={{ flex:1, borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.12)', fontSize:9, fontWeight:700, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3 }}>
                    <Upload size={11} /><span>Upload</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function LabelBadge({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'inline-flex', alignSelf:'center', alignItems:'center', padding:'4px 14px', borderRadius:999, marginBottom:8, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.13)', fontSize:11, fontWeight:700, color:'var(--text-2)', fontFamily:"'Syne',sans-serif" }}>
      {children}
    </div>
  )
}

/* ─── Testimonial data with real photos ─────────────────────────── */
const TESTIMONIALS = [
  {
    name:'Arjun Sharma', role:'Regular customer', rating:4,
    text:'No more waiting blindly. I know exactly when to arrive. Life-changing for busy professionals.',
    date:'May 2026', img: PEOPLE_IMGS[4],
  },
  {
    name:'Priya Mehta', role:'Salon owner', rating:5,
    text:'Quby transformed how we manage bookings. Staff efficiency went up 40% in the first month.',
    date:'April 2026', img: PEOPLE_IMGS[6],
  },
  {
    name:'Rohan Patel', role:'Customer', rating:4,
    text:'The QR check-in is brilliant. Showed up right on time, zero waiting. Highly recommend!',
    date:'March 2026', img: PEOPLE_IMGS[5],
  },
]

const HOW_STEPS = [
  { n:'01', Icon:Search,   title:'Find a salon',     desc:'Search nearby salons by service, rating, and availability.' },
  { n:'02', Icon:Calendar, title:'Pick a slot',      desc:'Choose your date and preferred staff. See live queue position.' },
  { n:'03', Icon:Shield,   title:'Pay securely',     desc:'Razorpay-secured payment. Get your QR booking confirmation instantly.' },
  { n:'04', Icon:Scissors, title:'Walk in & go',     desc:'Show your QR on arrival. Track your queue in real-time.' },
]

/* ═══════════════════════════════════════════════════════════════════
   STATS BAND — single bordered card, 4 cols, icon-left + number/label right
═══════════════════════════════════════════════════════════════════ */
function StatsBand() {
  const StarIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
  const items = [
    { label:'Salons',         to:500,   suffix:'+', Icon:Search,   iconBg:'rgba(139,92,246,0.15)', iconBorder:'rgba(139,92,246,0.3)', iconColor:'#a78bfa', amber:false },
    { label:'Customers',      to:10000, suffix:'+', Icon:Users,    iconBg:'rgba(139,92,246,0.15)', iconBorder:'rgba(139,92,246,0.3)', iconColor:'#a78bfa', amber:false },
    { label:'Bookings',       to:50000, suffix:'+', Icon:Calendar, iconBg:'rgba(139,92,246,0.15)', iconBorder:'rgba(139,92,246,0.3)', iconColor:'#a78bfa', amber:false },
    { label:'Average Rating', raw:'4.7', rawSuffix:'★', sublabel:'from 2,800+ reviews', Icon:StarIcon, iconBg:'rgba(245,158,11,0.15)', iconBorder:'rgba(245,158,11,0.3)', iconColor:'#f59e0b', amber:true },
  ]

  return (
    <section style={{ padding:'60px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.10) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.07) 0%,transparent 60%)' }}>
        <div style={{ position:'absolute', inset:0,
          backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
          backgroundSize:'60px 60px', opacity:0.4 }} />
      </div>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <motion.div
          initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
          style={{
            display:'grid', gridTemplateColumns:'repeat(4,1fr)',
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius:18, overflow:'hidden',
          }}
        >
          {items.map(({ label, to, suffix, raw, rawSuffix, sublabel, Icon, amber, iconBg, iconBorder, iconColor }: any, i) => (
            <motion.div key={label}
              initial={{ opacity:0, y:12 }} whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true }} transition={{ delay: i * 0.09 }}
              style={{
                display:'flex', alignItems:'center', gap:16, padding:'28px 22px',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Icon pill */}
              <div style={{ width:52, height:52, borderRadius:13, flexShrink:0,
                background:iconBg, border:`1px solid ${iconBorder}`,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                {typeof Icon === 'function' && Icon.length === 0
                  ? <Icon />
                  : <Icon size={22} color={iconColor} />
                }
              </div>
              {/* Number + label */}
              <div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:28, lineHeight:1, marginBottom:3,
                  color: amber ? '#f59e0b' : 'var(--text-1)', whiteSpace:'nowrap' }}>
                  {raw
                    ? <>{raw}<span style={{ fontSize:22, verticalAlign:'middle' }}>{rawSuffix}</span></>
                    : <Counter to={to} suffix={suffix} />
                  }
                </p>
                <p style={{ fontSize:12, color:'var(--text-2)', fontWeight:600 }}>{label}</p>
                {sublabel && <p style={{ fontSize:10, color:'var(--text-4)', marginTop:1 }}>{sublabel}</p>}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   LIVE QUEUE PROGRESS — pixel-perfect match to reference
   Reference: 5 circles (7 filled, 4 filled, 2 active glow, 1 dim, ✓ green)
   connected by a line, labels + times below each
═══════════════════════════════════════════════════════════════════ */
function LiveQueueProgress() {
  const steps = [
    { label:'7', sublabel:'Booked',          time:'10:00 AM', state:'done'    },
    { label:'4', sublabel:'Ahead of you',    time:'10:12 AM', state:'done'    },
    { label:'2', sublabel:'Almost there',    time:'10:25 AM', state:'active'  },
    { label:'1', sublabel:'Next in line',    time:'10:30 AM', state:'future'  },
    { label:'✓', sublabel:"It's your turn!", time:'10:32 AM', state:'check'   },
  ]

  const bubbleStyle = (state: string): React.CSSProperties => {
    if (state === 'done')   return { background:'var(--violet)', color:'#fff', border:'none', boxShadow:'none', width:44, height:44, fontSize:15 }
    if (state === 'active') return { background:'rgba(139,92,246,0.18)', color:'var(--violet-light)', border:'2.5px solid var(--violet-light)', boxShadow:'0 0 0 7px rgba(139,92,246,0.13),0 0 22px rgba(139,92,246,0.35)', width:52, height:52, fontSize:18 }
    if (state === 'check')  return { background:'#22c55e', color:'#fff', border:'none', boxShadow:'0 0 16px rgba(34,197,94,0.45)', width:44, height:44, fontSize:15 }
    /* future */            return { background:'var(--bg-card)', color:'var(--text-4)', border:'2px solid rgba(255,255,255,0.12)', boxShadow:'none', width:44, height:44, fontSize:15 }
  }

  return (
    <motion.div
      initial={{ opacity:0, x:-28 }} whileInView={{ opacity:1, x:0 }}
      viewport={{ once:true }}
      style={{ ...card, padding:'28px 24px 24px' }}
    >
      <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:'var(--text-1)', marginBottom:4 }}>
        Live Queue Progress
      </p>
      <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:36 }}>See your queue move in real time</p>

      {/* Bubble + line row */}
      <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:4 }}>

        {/* Full connector line (behind bubbles) */}
        <div style={{ position:'absolute', left:'calc(10% + 4px)', right:'calc(10% + 4px)', top:'50%', height:2, transform:'translateY(-50%)', zIndex:0, borderRadius:2, overflow:'hidden' }}>
          {/* done→done: solid violet */}
          <div style={{ position:'absolute', left:0, width:'25%', height:'100%', background:'var(--violet)' }} />
          {/* done→active: gradient */}
          <div style={{ position:'absolute', left:'25%', width:'25%', height:'100%', background:'linear-gradient(to right,var(--violet),var(--violet-light))' }} />
          {/* active→future: fading */}
          <div style={{ position:'absolute', left:'50%', width:'25%', height:'100%', background:'linear-gradient(to right,rgba(139,92,246,0.35),rgba(255,255,255,0.08))' }} />
          {/* future→check: dim */}
          <div style={{ position:'absolute', left:'75%', right:0, height:'100%', background:'rgba(255,255,255,0.07)' }} />
        </div>

        {steps.map(({ label, state }, idx) => {
          const s = bubbleStyle(state)
          return (
            <div key={idx} style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{
                width: s.width, height: s.height, borderRadius:'50%', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize: s.fontSize,
                background: s.background, color: s.color,
                border: s.border as string,
                boxShadow: s.boxShadow as string,
                transition:'all 0.3s',
              }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Labels row — aligned under each bubble */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:14 }}>
        {steps.map(({ sublabel, time, state }, idx) => (
          <div key={idx} style={{ textAlign:'center', flex:1 }}>
            <p style={{
              fontSize:9.5, lineHeight:1.35, marginBottom:2, fontWeight: state === 'active' ? 700 : 500,
              color: state === 'done' ? 'var(--text-2)' : state === 'active' ? 'var(--violet-light)' : state === 'check' ? '#22c55e' : 'var(--text-4)',
            }}>
              {sublabel}
            </p>
            <p style={{ fontSize:9, color:'var(--text-4)' }}>{time}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()
  const [search, setSearch]     = useState('')
  const [mobileOpen, setMobile] = useState(false)
  const heroRef                 = useRef<HTMLElement>(null)
  const { scrollY }             = useScroll()
  const heroOpacity             = useTransform(scrollY, [0, 380], [1, 0])
  const heroY                   = useTransform(scrollY, [0, 280], [0, -50])

  useEffect(() => {
    if (document.getElementById('quby-global-css')) return
    const el = document.createElement('style')
    el.id = 'quby-global-css'; el.textContent = GLOBAL_CSS
    document.head.appendChild(el)
  }, [])

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
    <div style={{ minHeight:'100vh', overflowX:'hidden', background:'var(--bg-page)' }}>

      {/* ════ NAVBAR ════ */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', background:'rgba(13,13,20,0.88)', borderBottom:'1px solid var(--border)', backdropFilter:'blur(18px)' }}>
        <Logo variant="compact" />
        <div className="q-nav-links" style={{ flex:1, justifyContent:'center' }}>
          {[
            { label:'Explore Salons', path:'/explore' },
            { label:'For Owners',     path:'/register' },
            { label:'How it works',   path:'#how-it-works' },
          ].map(({ label, path }) => (
            <button key={label}
              onClick={() => path.startsWith('#') ? document.querySelector(path)?.scrollIntoView({ behavior:'smooth' }) : navigate(path)}
              style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'var(--text-2)', background:'none', border:'none', cursor:'pointer', padding:'0 20px' }}
            >{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => navigate('/login')} className="q-nav-links" style={{ height:34, padding:'0 16px', fontSize:12, display:'inline-flex', alignItems:'center', gap:7, background:'rgba(255,255,255,0.10)', color:'var(--text-1)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:10, cursor:'pointer', fontFamily:"'Syne',sans-serif", fontWeight:700, backdropFilter:'blur(4px)' }}>Sign in</button>
          <button onClick={() => navigate('/register')} style={{ ...btnPrimary, height:34, padding:'0 18px', fontSize:12 }}>Get started</button>
          <button onClick={() => setMobile(v => !v)} className="q-hamburger" style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', padding:4 }}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
            style={{ position:'fixed', top:56, left:0, right:0, zIndex:99, background:'rgba(13,13,20,0.97)', borderBottom:'1px solid var(--border)', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16, backdropFilter:'blur(16px)' }}
          >
            {[
              { label:'Explore Salons', path:'/explore' },
              { label:'For Owners',     path:'/register' },
              { label:'How it works',   path:'#how-it-works' },
            ].map(({ label, path }) => (
              <button key={label}
                onClick={() => { setMobile(false); path.startsWith('#') ? document.querySelector(path)?.scrollIntoView({ behavior:'smooth' }) : navigate(path) }}
                style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:'var(--text-2)', background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}
              >{label}</button>
            ))}
            <div style={{ display:'flex', gap:10, paddingTop:8 }}>
              <button onClick={() => { setMobile(false); navigate('/login') }}    style={{ ...btnGhost, flex:1, height:42, justifyContent:'center', fontSize:13 }}>Sign in</button>
              <button onClick={() => { setMobile(false); navigate('/register') }} style={{ ...btnPrimary, flex:1, height:42, justifyContent:'center', fontSize:13 }}>Get started</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ HERO ════ */}
      <section ref={heroRef as any} style={{ minHeight:'100vh', display:'flex', alignItems:'center', padding:'80px 20px 60px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.5 }} />
        </div>

        <div className="q-hero-grid" style={{ maxWidth:1280, margin:'0 auto', width:'100%', position:'relative', zIndex:2 }}>
          {/* ── LEFT ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <motion.div initial={{ opacity:0, scale:.92 }} animate={{ opacity:1, scale:1 }} transition={{ delay:.08 }}
              style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 16px', borderRadius:999, background:'var(--violet-bg)', border:'1px solid var(--violet-border)', width:'fit-content' }}>
              <Sparkles size={12} color="var(--violet-light)" />
              <span style={{ fontSize:12, fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--violet-light)' }}>
                India's first smart queue management platform
              </span>
            </motion.div>

            <RotatingHeadline />

            <motion.p initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.28 }}
              style={{ fontSize:15, color:'var(--text-2)', lineHeight:1.72, maxWidth:440 }}>
              Skip the waiting room. Track your live queue and arrive at the salon at exactly the right time.
            </motion.p>

            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.34 }} className="q-hero-chips">
              {['Live Queue Tracking','QR Check-In','Real-Time Updates'].map(c => (
                <span key={c} style={{ padding:'6px 14px', borderRadius:999, fontSize:11, fontWeight:500, background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-2)' }}>
                  ✓ {c}
                </span>
              ))}
            </motion.div>

            {/* Search bar */}
            <motion.form initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.38 }} onSubmit={handleSearch}
              style={{ display:'flex', gap:8, maxWidth:440 }}>
              <div style={{ position:'relative', flex:1 }}>
                <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search salons, services…"
                  style={{ width:'100%', height:44, padding:'0 12px 0 36px', background:'var(--bg-card)', border:'1px solid var(--violet-border)', borderRadius:10, color:'var(--text-1)', fontSize:13, outline:'none' }}
                />
              </div>
              <button type="submit" style={{ ...btnPrimary, height:44, padding:'0 20px', fontSize:13, flexShrink:0 }}>Search</button>
            </motion.form>

            {/* CTA buttons */}
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.42 }} className="q-hero-ctas">
              <button onClick={() => navigate('/explore')} style={{ ...btnPrimary, height:44, padding:'0 24px', fontSize:14 }}>
                Find Your Salon <ArrowRight size={15} />
              </button>
              <button onClick={() => navigate('/register')} style={{ ...btnGhost, height:44, padding:'0 24px', fontSize:14 }}>
                For Salon Owners <ArrowRight size={14} />
              </button>
            </motion.div>

            {/* ── Trust indicators with REAL Unsplash photos ── */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.52 }}
              style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ display:'flex' }}>
                {PEOPLE_IMGS.slice(0, 5).map((src, i) => (
                  <div key={i} style={{ marginLeft: i===0 ? 0 : -10, zIndex:5-i, width:34, height:34, borderRadius:'50%', overflow:'hidden', border:'2.5px solid var(--bg-page)', flexShrink:0 }}>
                    <img src={src} alt={`User ${i+1}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:'var(--text-3)' }}>
                Join <strong style={{ color:'var(--text-1)' }}>10,000+</strong> happy customers across <strong style={{ color:'var(--text-1)' }}>500+</strong> salons
              </p>
            </motion.div>

            {/* Mobile-only preview card */}
            <div className="q-mobile-preview">
              <MobilePreviewCard />
            </div>
          </div>

          {/* ── RIGHT: desktop hero cards ── */}
          <div className="q-hero-right">
            <HeroCards />
          </div>
        </div>
      </section>

      {/* ════ STATS BAND — reference style ════ */}
      <StatsBand />

      {/* ════ HOW IT WORKS ════ */}
      <section id="how-it-works" style={{ padding:'80px 20px', background:'var(--bg-surface)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
        </div>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} style={{ textAlign:'center', marginBottom:56 }}>
            <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.12em', color:'var(--violet-light)', marginBottom:10 }}>Simple &amp; Fast</p>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(24px,3vw,34px)', color:'var(--text-1)' }}>
              How <span style={{ color:'var(--violet-light)' }}>Quby</span> works
            </h2>
            <p style={{ fontSize:14, color:'var(--text-3)', marginTop:10 }}>Four simple steps to a smarter salon experience.</p>
          </motion.div>

          <div className="q-how-grid">
            {HOW_STEPS.map(({ n, Icon, title, desc }, i) => (
              <motion.div key={n}
                initial={{ opacity:0, y:22 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay: i * 0.1 }}
                style={{ ...card, padding:20, position:'relative', zIndex:1 }}
              >
                <span style={{ display:'inline-block', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:10, padding:'3px 8px', borderRadius:5, background:'var(--violet-bg)', color:'var(--violet-light)', marginBottom:14 }}>{n}</span>
                <div style={{ width:42, height:42, borderRadius:10, background:'var(--violet-bg)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <Icon size={18} color="var(--violet-light)" />
                </div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:'var(--text-1)', marginBottom:8 }}>{title}</p>
                <p style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.6 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ LIVE QUEUE DEMO — reference style ════ */}
      <section style={{ padding:'80px 20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
        </div>
        <div className="q-queue-grid" style={{ maxWidth:1100, margin:'0 auto' }}>
          <LiveQueueProgress />

          <motion.div initial={{ opacity:0, x:28 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:999, background:'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.08))', border:'1px solid rgba(34,197,94,0.3)', fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:14, letterSpacing:0.5 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', boxShadow:'0 0 8px rgba(34,197,94,0.6)' }} />
              LIVE &amp; ACCURATE
            </span>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(24px,2.8vw,34px)', color:'var(--text-1)', marginBottom:16 }}>
              See your queue <span style={{ color:'var(--violet-light)' }}>before you</span> leave home
            </h2>
            <p style={{ fontSize:14, color:'var(--text-3)', lineHeight:1.7, marginBottom:24 }}>
              Get real-time updates on your queue position. We update every few seconds so you never wait longer than you should.
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {['Accurate','Real-time','Reliable'].map(l => (
                <span key={l} style={{ fontSize:12, fontWeight:600, padding:'5px 14px', borderRadius:999, background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-3)' }}>{l}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════ TOP SALONS ════ */}
      {topSalons && topSalons.length > 0 && (
        <section style={{ padding:'80px 20px', background:'var(--bg-surface)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
            <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
          </div>
          <div style={{ maxWidth:1280, margin:'0 auto' }}>
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
              style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:32 }}>
              <div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.12em', color:'var(--violet-light)', marginBottom:6 }}>Featured</p>
                <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(22px,2.8vw,28px)', color:'var(--text-1)' }}>Top rated salons near you</h2>
              </div>
              <button onClick={() => navigate('/explore')} style={{ ...btnGhost, height:36, padding:'0 16px', fontSize:12 }}>
                View all salons <ChevronRight size={13} />
              </button>
            </motion.div>
            <div className="q-salon-grid">
              {topSalons.slice(0, 5).map((biz, i) => (
                <FloatingCard key={biz.id} biz={biz} delay={i * 0.06} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════ FEATURES ════ */}
      <section style={{ padding:'80px 20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
        </div>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} style={{ textAlign:'center', marginBottom:0 }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(24px,3vw,34px)', color:'var(--text-1)' }}>Built for everyone</h2>
            <p style={{ fontSize:14, color:'var(--text-3)', marginTop:10, maxWidth:400, margin:'10px auto 0' }}>Whether you're booking a haircut or running a salon chain — Quby has you covered.</p>
          </motion.div>
          <div className="q-feat-grid">
            {[
              { tag:'Customers',    emoji:'👤', color:'var(--violet-light)', border:'var(--violet-border)', points:['Book appointments online','Track live queue position','QR-based check-in','Appointment reminders','Real-time notifications'] },
              { tag:'Salon Owners', emoji:'🏢', color:'var(--green)',        border:'rgba(34,197,94,0.25)', points:['Appointment management','Queue management','Staff tracking','Revenue insights','Multi-location support'] },
              { tag:'Staff',        emoji:'✂️', color:'#f59e0b',             border:'rgba(245,158,11,0.25)', points:['QR scanning','Queue dashboard','Attendance management','Customer history','Daily schedules'] },
            ].map(({ tag, emoji, color, border, points }, i) => (
              <motion.div key={tag}
                initial={{ opacity:0, y:22 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay: i * 0.12 }}
                style={{ ...card, padding:24, borderColor:border }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <span style={{ fontSize:22 }}>{emoji}</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:16, color:'var(--text-1)' }}>{tag}</span>
                </div>
                <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                  {points.map(p => (
                    <li key={p} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--text-2)' }}>
                      <CheckCircle size={14} color={color} style={{ flexShrink:0, marginTop:1 }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ TESTIMONIALS — with real face photos ════ */}
      <section style={{ padding:'80px 20px', background:'var(--bg-surface)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
        </div>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(22px,2.8vw,30px)', color:'var(--text-1)' }}>What our customers say</h2>
          </motion.div>
          <div className="q-testi-grid">
            {TESTIMONIALS.map(({ name, role, rating, text, date, img }, i) => (
              <motion.div key={name}
                initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay: i * 0.1 }}
                style={{ ...card, padding:20, display:'flex', flexDirection:'column' }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ display:'flex', gap:3 }}>
                    {Array.from({ length:5 }).map((_, j) => (
                      <Star key={j} size={13} fill={j < rating ? '#f59e0b' : 'none'} color={j < rating ? '#f59e0b' : 'var(--text-4)'} />
                    ))}
                  </div>
                  <span style={{ fontSize:10, color:'var(--text-4)' }}>{date}</span>
                </div>
                <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, flex:1, marginBottom:16 }}>"{text}"</p>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {/* Real face photo */}
                  <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:'2px solid var(--violet-border)' }}>
                    <img src={img} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  <div>
                    <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, color:'var(--text-1)' }}>{name}</p>
                    <p style={{ fontSize:10, color:'var(--text-3)' }}>{role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ OWNER CTA ════ */}
      <section style={{ padding:'80px 20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
        </div>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <motion.div
            initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
            className="q-cta-row"
            style={{ borderRadius:20, background:'linear-gradient(135deg,#8b5cf6 0%,#6366f1 100%)', border:'1px solid var(--violet-border)', padding:'52px 48px' }}
          >
            <div style={{ width:64, height:64, borderRadius:14, flexShrink:0, background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <TrendingUp size={28} color="#fff" />
            </div>
            <div style={{ flex:1, minWidth:240 }}>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(20px,2.8vw,30px)', color:'#fff', marginBottom:10 }}>
                Join 500+ salon owners growing their business with Quby.
              </h2>
              <p style={{ fontSize:15, color:'rgba(255,255,255,0.88)', lineHeight:1.6 }}>No setup fee. Start in minutes. Cancel anytime.</p>
            </div>
            <div className="q-cta-btns">
              <button onClick={() => navigate('/register')} style={{ height:44, padding:'0 28px', borderRadius:10, border:'none', background:'#fff', color:'var(--violet)', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Zap size={14} /> Register your salon
              </button>
              <button onClick={() => navigate('/explore')} style={{ height:44, padding:'0 28px', borderRadius:10, background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Browse the platform
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{ background:'var(--bg-surface)', borderTop:'1px solid var(--border)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle at 25% 25%,rgba(124,58,237,0.12) 0%,transparent 60%),radial-gradient(circle at 75% 75%,rgba(99,102,241,0.08) 0%,transparent 60%)' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.4 }} />
        </div>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'56px 20px 32px' }}>
          <div className="q-footer-grid">
            <div>
              <Logo variant="compact" />
              <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.7, marginTop:14, maxWidth:260 }}>
                Modern appointment and queue management platform for salons. Book in seconds, wait less, look great.
              </p>
              <div style={{ display:'flex', gap:10, marginTop:18 }}>
                {[
                  { Icon:Github,   href:'https://github.com/Mayurprajapati6' },
                  { Icon:Linkedin, href:'https://www.linkedin.com/in/mayurprajapati068/' },
                ].map(({ Icon, href }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                    style={{ width:36, height:36, borderRadius:9, background:'var(--bg-card)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)', textDecoration:'none' }}>
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--text-1)', marginBottom:16 }}>Platform</h4>
              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Explore Salons', path:'/explore' },
                  { label:'How it works',   path:'#how-it-works' },
                  { label:'For Owners',     path:'/register' },
                  { label:'Sign in',        path:'/login' },
                  { label:'Create account', path:'/register' },
                ].map(({ label, path }) => (
                  <li key={label}>
                    <button onClick={() => path.startsWith('#') ? document.querySelector(path)?.scrollIntoView({ behavior:'smooth' }) : navigate(path)}
                      style={{ fontSize:13, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:"'Inter',sans-serif" }}>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--text-1)', marginBottom:16 }}>Company</h4>
              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                {['About us','Contact us','Blog','Careers'].map(l => (
                  <li key={l}><button style={{ fontSize:13, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:"'Inter',sans-serif" }}>{l}</button></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--text-1)', marginBottom:16 }}>Legal</h4>
              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                {['Privacy Policy','Terms of Service','Cookie Policy'].map(l => (
                  <li key={l}><button style={{ fontSize:13, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:"'Inter',sans-serif" }}>{l}</button></li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ borderTop:'1px solid var(--border)', paddingTop:22, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <p style={{ fontSize:11, color:'var(--text-4)' }}>© 2026 Quby Technologies Pvt. Ltd. All rights reserved.</p>
            <div style={{ display:'flex', gap:20 }}>
              {['Privacy Policy','Terms of Service','Cookie Policy'].map(l => (
                <button key={l} style={{ fontSize:11, color:'var(--text-4)', background:'none', border:'none', cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─── Mobile hero preview ────────────────────────────────────────── */
function MobilePreviewCard() {
  return (
    <motion.div
      initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:.6 }}
      style={{ borderRadius:20, overflow:'hidden', background:'linear-gradient(180deg,#1a1a2e 0%,#16213e 100%)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 20px 48px -12px rgba(0,0,0,0.6)', maxWidth:500, marginTop:24 }}
    >
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(139,92,246,0.3)' }}>
            <img src={PEOPLE_IMGS[0]} alt="User" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
          <div>
            <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:'#fff' }}>Style Studio</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Anand, Gujarat</p>
          </div>
        </div>
        <span style={{ fontSize:10, padding:'4px 12px', borderRadius:999, fontWeight:700, background:'rgba(34,197,94,0.15)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.28)' }}>● Open</span>
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div style={{ padding:'16px 12px', textAlign:'center', background:'rgba(139,92,246,0.1)', borderRadius:14, border:'1px solid rgba(139,92,246,0.22)' }}>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:4 }}>Your Queue Number</p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:48, color:'#a78bfa', lineHeight:1 }}>#3</p>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:4 }}>People ahead of you</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[{ l:'Est. Wait', v:'12 min' },{ l:'Position', v:'3rd' }].map(s => (
              <div key={s.l} style={{ padding:12, borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', flex:1 }}>
                <p style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginBottom:4 }}>{s.l}</p>
                <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20, color:'#fff' }}>{s.v}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Queue progress</span>
            <span style={{ fontSize:11, color:'var(--violet-light)', fontWeight:600 }}>35%</span>
          </div>
          <div style={{ height:6, borderRadius:999, background:'rgba(255,255,255,0.1)' }}>
            <div style={{ height:'100%', width:'35%', borderRadius:999, background:'linear-gradient(to right,#8b5cf6,#a78bfa)' }} />
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:14 }}>
          {[
            { n:1, name:'Riya Patel',   status:'Checked In',  color:'#22c55e',               img: PEOPLE_IMGS[1] },
            { n:2, name:'Mohit Sharma', status:'In Progress', color:'#f59e0b',               img: PEOPLE_IMGS[2] },
            { n:3, name:'You',          status:'12 mins',     color:'#a78bfa',               img: PEOPLE_IMGS[0] },
            { n:4, name:'Neha Singh',   status:'18 mins',     color:'rgba(255,255,255,0.4)', img: PEOPLE_IMGS[3] },
          ].map(r => (
            <div key={r.n} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:'1px solid rgba(139,92,246,0.3)' }}>
                  <img src={r.img} alt={r.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>{r.name}</span>
              </div>
              <span style={{ fontSize:11, color:r.color, fontWeight:600 }}>{r.status}</span>
            </div>
          ))}
        </div>
        <button style={{ width:'100%', height:44, borderRadius:11, border:'none', background:'linear-gradient(135deg,#8b5cf6 0%,#a78bfa 100%)', color:'#fff', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(139,92,246,0.4)' }}>
          View Live Queue
        </button>
      </div>
    </motion.div>
  )
}

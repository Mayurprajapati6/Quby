import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <header className="px-5 h-12 flex items-center border-b"
        style={{ background: 'var(--topbar-bg)', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}>
        <Logo variant="compact" />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="text-center max-w-md"
        >
          {/* Big 404 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 16 }}
            className="font-syne font-black mb-4"
            style={{
              fontSize: 'clamp(80px,15vw,140px)',
              lineHeight: 1,
              background: 'linear-gradient(135deg, var(--violet-light), var(--violet))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl mb-5"
          >
            ✂️
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-syne font-black text-[24px] mb-3"
            style={{ color: 'var(--text-1)' }}
          >
            Page not found
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[14px] mb-8"
            style={{ color: 'var(--text-3)', lineHeight: 1.6 }}
          >
            The page you're looking for doesn't exist or has been moved. Try exploring our salon listings instead.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/')}
              className="q-btn-primary h-11 px-6 flex items-center justify-center gap-2">
              <Home size={15} /> Go home
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/explore')}
              className="q-btn-ghost h-11 px-6 flex items-center justify-center gap-2">
              <Search size={15} /> Explore salons
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(-1)}
              className="q-btn-ghost h-11 px-6 flex items-center justify-center gap-2">
              <ArrowLeft size={15} /> Go back
            </motion.button>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

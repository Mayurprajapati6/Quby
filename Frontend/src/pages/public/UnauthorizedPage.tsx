import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowLeft, LogIn, Home } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { useAuthStore } from '@/stores'
import { getRoleDashboard } from '@/lib/utils'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <header className="px-5 h-12 flex items-center border-b"
        style={{ background: 'var(--topbar-bg)', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}>
        <Logo variant="compact" />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="text-center max-w-sm"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 18 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--red-bg)', border: '2px solid rgba(239,68,68,0.25)' }}
          >
            <Lock size={32} style={{ color: 'var(--red)' }} />
          </motion.div>

          {/* Text */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-syne font-black text-[28px] mb-3"
            style={{ color: 'var(--text-1)' }}
          >
            Access Restricted
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-[14px] mb-8"
            style={{ color: 'var(--text-2)', lineHeight: 1.7 }}
          >
            {isAuthenticated
              ? "You don't have permission to access this page. Please check the URL or go back to your dashboard."
              : "You need to sign in to access this page. Please log in to continue."
            }
          </motion.p>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col gap-3"
          >
            {isAuthenticated && user ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(getRoleDashboard(user.role))}
                  className="q-btn-primary h-11 w-full flex items-center justify-center gap-2"
                >
                  <Home size={15} /> Go to Dashboard
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(-1)}
                  className="q-btn-ghost h-11 w-full flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={15} /> Go back
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/login')}
                  className="q-btn-primary h-11 w-full flex items-center justify-center gap-2"
                >
                  <LogIn size={15} /> Sign in
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/')}
                  className="q-btn-ghost h-11 w-full flex items-center justify-center gap-2"
                >
                  <Home size={15} /> Go home
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { AppRouter } from './router'
import { useAuthStore } from './stores'
import './index.css'
import { connectSocket } from './lib/socket'
import { setApiAccessToken } from './lib/axios'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,      
      staleTime: 15_000,        
    },
    mutations: {
      retry: false,
    },
  },
})

function AuthInit() {
  useEffect(() => {
    const refreshToken = localStorage.getItem('quby_refresh_token')
    const { setAuthReady, logout } = useAuthStore.getState()

    if (!refreshToken) {
      
      setAuthReady(true)
      return
    }

    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3004') + '/api/v1'

    fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh_failed')
        const json = await res.json()
        const { accessToken, refreshToken: newRefresh } = json.data

        localStorage.setItem('quby_refresh_token', newRefresh)

        setApiAccessToken(accessToken)

        useAuthStore.getState().setAccessToken(accessToken)

        console.log('✅ Auto-login success')
      })
      .catch(() => {
        console.warn('❌ Auto-login failed — clearing session')
        
        localStorage.removeItem('quby_refresh_token')
        logout()
      })
      .finally(() => {
        
        useAuthStore.getState().setAuthReady(true)
      })
  }, [])

  return null
}

function SocketInit() {
  const token = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!token) return
    connectSocket(token)
  }, [token])

  return null
}

function ThemeInit() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const meta = document.getElementById('theme-color-meta')
    if (meta) meta.setAttribute('content', '#7c3aed')
  }, [])
  return null
}

  function QubyToaster() {
    return (
      <Toaster
        
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
           
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          },
         
          classNames: {
            success: 'border-l-2 border-l-[var(--green)]',
            error:   'border-l-2 border-l-[var(--red)]',
            info:    'border-l-2 border-l-[var(--violet-light)]',
            warning: 'border-l-2 border-l-[#f59e0b]',
          },
        }}
        richColors
        closeButton
        duration={4000}
        
        expand={false}
        visibleToasts={4}
        gap={8}
        offset="60px"   
      />
    )
  }

function AppWrapper() {
  const isAuthReady = useAuthStore((s) => s.isAuthReady)

  if (!isAuthReady) return <AppLoader />

  return (
    <>
      <ThemeInit />
      <SocketInit />
      <AppRouter />
      <QubyToaster />
    </>
  )
}

function AppLoader() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--text-2)] border-t-transparent" />
        <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>Loading…</span>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthInit />
      <AppWrapper />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)

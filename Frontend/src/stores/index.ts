import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { connectSocket, disconnectSocket, isSocketConnected } from '@/lib/socket'

interface AuthState {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean
  isAuthReady: boolean
  setAuthReady: (v: boolean) => void
  login: (accessToken: string, refreshToken: string, user: User) => void
  logout: () => void
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  setUserAvatar: (avatar_url: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isAuthReady: false,
      setAuthReady: (v) => set({ isAuthReady: v }),

      login: (accessToken, refreshToken, user) => {
        localStorage.setItem('quby_refresh_token', refreshToken)
        import('@/lib/axios').then(({ setApiAccessToken }) => setApiAccessToken(accessToken))

        try {
          const raw = localStorage.getItem('quby-staff-profile-v2')
          if (raw && user.role === 'STAFF') {
            const parsed = JSON.parse(raw)
            const cachedAvatarUrl = parsed?.state?.profile?.avatar_url
            if (cachedAvatarUrl && !user.avatar_url) {
              set({ accessToken, user: { ...user, avatar_url: cachedAvatarUrl }, isAuthenticated: true })
              return
            }
          }
        } catch { /* ignore */ }

        try {
          const raw = localStorage.getItem('quby-owner-profile-v1')
          if (raw && user.role === 'OWNER') {
            const parsed = JSON.parse(raw)
            const cachedAvatarUrl = parsed?.state?.avatar_url
            
            const resolvedAvatar = user.avatar_url ?? cachedAvatarUrl ?? null
            if (resolvedAvatar !== user.avatar_url) {
              set({ accessToken, user: { ...user, avatar_url: resolvedAvatar }, isAuthenticated: true })
              return
            }
          }
        } catch { /* ignore */ }

        try {
          const raw = localStorage.getItem('quby-customer-profile-v1')
          if (raw && user.role === 'CUSTOMER') {
            const parsed = JSON.parse(raw)
            const cachedAvatarUrl = parsed?.state?.avatar_url
            const resolvedAvatar = user.avatar_url ?? cachedAvatarUrl ?? null
            if (resolvedAvatar !== user.avatar_url) {
              set({ accessToken, user: { ...user, avatar_url: resolvedAvatar }, isAuthenticated: true })
              return
            }
          }
        } catch { /* ignore */ }

        set({ accessToken, user, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('quby_refresh_token')
        
        import('@/lib/axios').then(({ setApiAccessToken }) => setApiAccessToken(null))
        disconnectSocket()
        set({ accessToken: null, user: null, isAuthenticated: false })
      },

      setAccessToken: (token) => {
        import('@/lib/axios').then(({ setApiAccessToken }) => setApiAccessToken(token))
        set({ accessToken: token })
      },

      setUser: (user) => set({ user }),

      setUserAvatar: (avatar_url) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, avatar_url } })
      },
    }),
    {
      name: 'quby_auth',
      
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
)

interface SocketState {
  isConnected: boolean
  connect: (token: string) => void
  disconnect: () => void
  setConnected: (v: boolean) => void
}

export const useSocketStore = create<SocketState>()((set) => ({
  isConnected: false,

  connect: (token) => {
    const socket = connectSocket(token)
    socket.on('connect',    () => set({ isConnected: true }))
    socket.on('disconnect', () => set({ isConnected: false }))
    set({ isConnected: isSocketConnected() })
  },

  disconnect: () => {
    disconnectSocket()
    set({ isConnected: false })
  },

  setConnected: (v) => set({ isConnected: v }),
}))

interface UiState {
  notificationBadgeCount: number
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  incrementBadge: () => void
  decrementBadge: () => void
  resetBadge: (count?: number) => void
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      notificationBadgeCount: 0,
      theme: 'dark',
      sidebarCollapsed: false,

      incrementBadge: () =>
        set((s) => ({ notificationBadgeCount: s.notificationBadgeCount + 1 })),

      decrementBadge: () =>
        set((s) => ({ notificationBadgeCount: Math.max(0, s.notificationBadgeCount - 1) })),

      resetBadge: (count = 0) => set({ notificationBadgeCount: count }),

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        const metaTheme = document.getElementById('theme-color-meta')
        if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#7c3aed' : '#3B7FFF')
        set({ theme })
      },

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        get().setTheme(next)
      },

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'quby_ui',
      partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme)
        }
      },
    },
  ),
)
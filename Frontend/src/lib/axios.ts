import axios, { AxiosRequestConfig } from 'axios'
import { toast } from 'sonner'

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3004/api/v1'

// ── Create instance ───────────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: import.meta.env.PROD ? 90_000 : 30_000,
})

// ── In-memory token store (never written to localStorage) ─────────
let _accessToken: string | null = null

// 🔥 LOAD TOKEN FROM LOCAL STORAGE ON APP START
const storedAuth = localStorage.getItem('quby_auth')

if (storedAuth) {
  try {
    const parsed = JSON.parse(storedAuth)
    _accessToken = parsed?.accessToken || null
  } catch {
    _accessToken = null
  }
}

export function setApiAccessToken(token: string | null) {
  _accessToken = token
}

export function getApiAccessToken(): string | null {
  return _accessToken
}

// ── Refresh state ─────────────────────────────────────────────────
let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  failedQueue = []
}

// ── REQUEST interceptor — attach Bearer token ─────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`
  }
  // For FormData, let browser set Content-Type automatically
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// ── RESPONSE interceptor — 401 → silent refresh → retry ──────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Never try to refresh on auth endpoints themselves — just pass error to component
      const url = (originalRequest.url ?? '')
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')
      if (isAuthEndpoint) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest)
        }).catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('quby_refresh_token')

      if (!refreshToken) {
        isRefreshing = false
        clearAuthAndRedirect()
        if (error.response?.status !== 401) {
          toast.error(error.response?.data?.message || 'Something went wrong')
        }
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        const { accessToken, refreshToken: newRefresh } = response.data.data

        localStorage.setItem('quby_refresh_token', newRefresh)
        _accessToken = accessToken

        import('@/stores').then(({ useAuthStore }) => {
          useAuthStore.getState().setAccessToken(accessToken)
        })

        // Update socket auth token after silent refresh (per 03_Realtime_Strategy)
        import('@/lib/socket').then(({ getSocket }) => {
          const s = getSocket()
          if (s) {
            s.auth = { token: accessToken }
            s.disconnect().connect()
          }
        })

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }

        processQueue(null, accessToken)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

function clearAuthAndRedirect() {
  _accessToken = null
  localStorage.removeItem('quby_refresh_token')
  localStorage.removeItem('quby_auth')
  // Only redirect if NOT already on an auth page — prevents login form from
  // resetting itself when credentials are wrong
  const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/staff/setup']
  const isOnAuthPage = authPages.some(p => window.location.pathname.startsWith(p))
  if (!isOnAuthPage) {
    window.location.href = '/login'
  }
}

// ── Helpers ───────────────────────────────────────────────────────
export function unwrap<T>(response: { data: { data: T; pagination?: unknown } }): T {
  return response.data.data
}

export function unwrapPaginated<T>(response: { data: { data: T[]; pagination: unknown } }) {
  return {
    data: response.data.data as T[],
    pagination: response.data.pagination as {
      total: number; page: number; limit: number;
      total_pages?: number; totalPages?: number
    },
  }
}

export function normalizePagination(p: {
  total?: number; page?: number; limit?: number;
  total_pages?: number; totalPages?: number
}) {
  const totalPages = p.total_pages ?? p.totalPages ?? 1
  return { ...p, total_pages: totalPages, totalPages }
}

export default api

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '@/lib/socket'
import { useSocketStore } from '@/stores'

// ── useDebounce ───────────────────────────────────────────────────
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ── useCountdown (seconds) ────────────────────────────────────────
export function useCountdown(initialSeconds: number, onExpire?: () => void) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    setSeconds(initialSeconds)
  }, [initialSeconds])

  useEffect(() => {
    if (seconds <= 0) {
      clearInterval(intervalRef.current)
      onExpire?.()
      return
    }
    intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [seconds, onExpire])

  return seconds
}

// ── useSocketEvent ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSocketEvent<T = any>(event: string, handler: (data: T) => void) {
  const isConnected = useSocketStore((s) => s.isConnected)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const cb = (data: T) => handlerRef.current(data)
    socket.on(event, cb)
    return () => { socket.off(event, cb) }
  }, [event, isConnected])
}

// ── useIntersectionObserver (for infinite scroll) ─────────────────
export function useIntersectionObserver(
  callback: () => void,
  options: IntersectionObserverInit = {},
) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) callback()
    }, { threshold: 0.1, ...options })

    observer.observe(el)
    return () => observer.disconnect()
  }, [callback, options])

  return ref
}

// ── useLocalStorage ───────────────────────────────────────────────
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch { /* ignore */ }
  }, [key, storedValue])

  return [storedValue, setValue] as const
}

// ── useCamera (for QR scanning) ───────────────────────────────────
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsActive(true)
        setError(null)
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    const video = videoRef.current
    if (video?.srcObject) {
      const tracks = (video.srcObject as MediaStream).getTracks()
      tracks.forEach((t) => t.stop())
      video.srcObject = null
      setIsActive(false)
    }
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  return { videoRef, isActive, error, startCamera, stopCamera }
}

// ── useWindowSize ─────────────────────────────────────────────────
export function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return size
}

export function useIsMobile(): boolean {
  const { width } = useWindowSize()
  return width < 768
}

export function useIsTablet(): boolean {
  const { width } = useWindowSize()
  return width >= 768 && width < 1024
}

export function useIsDesktop(): boolean {
  const { width } = useWindowSize()
  return width >= 1024
}

// ── usePageTitle ──────────────────────────────────────────────────
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Quby`
    return () => { document.title = 'Quby' }
  }, [title])
}

// ── useRazorpay ───────────────────────────────────────────────────
interface RazorpayOptions {
  order_id: string
  amount: number     // paise — passed as-is to Razorpay
  name?: string
  description?: string
  onSuccess: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
  onFailure?: (error: unknown) => void
}

export function useRazorpay() {
  const openCheckout = useCallback(({ order_id, amount, name, description, onSuccess, onFailure }: RazorpayOptions) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Razorpay = (window as any).Razorpay
    if (!Razorpay) {
      console.error('Razorpay SDK not loaded')
      return
    }
    const rzp = new Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      order_id,
      amount,
      currency: 'INR',
      name: name ?? 'Quby',
      description: description ?? 'Salon Booking',
      theme: { color: '#7c3aed' },
      handler: onSuccess,
      modal: {
        ondismiss: () => onFailure?.('dismissed'),
      },
    })
    rzp.on('payment.failed', (response: unknown) => onFailure?.(response))
    rzp.open()
  }, [])

  return { openCheckout }
}

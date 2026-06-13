import { useState, useRef, useEffect, useCallback } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, Users, AlarmClock,
  TrendingUp, X, Upload, Keyboard, CheckCircle, XCircle,
  QrCode, Play, CalendarCheck, Award, ChevronLeft,
  ChevronRight, Phone, Clock, Activity, Camera, RefreshCw, ArrowRight
} from 'lucide-react'
import { useSocketEvent, usePageTitle } from '@/hooks'
import { useSocketStore } from '@/stores'
import { ConfirmDialog } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import api from '@/lib/axios'
import { toast } from 'sonner'
import jsQR from 'jsqr'
import { useCameraStore } from '@/lib/cameraStore'



function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function fmtMMSS(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}
function getScanErrorMessage(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('different booking') || m.includes('another booking') || m.includes('does not match this active booking')) return 'This QR belongs to a different booking. Open that booking or ask the customer for the correct QR.'
  if (m.includes('scan window not open') || m.includes('too early') || m.includes('opens at')) return msg
  if (m.includes('no show') || m.includes('marked as no show') || m.includes('scan window closed')) return msg
  if (m.includes('already been started') || m.includes('already started')) return 'This service has already been started.'
  if (m.includes('already completed')) return 'This booking is already completed.'
  if (m.includes('already used') || m.includes('already been scanned')) return 'This QR code has already been scanned for this booking.'
  if (m.includes('another service') || m.includes('already in progress')) return 'Another service is already in progress. Complete it before scanning a new one.'
  if (m.includes('not assigned') || m.includes('not your') || m.includes('not belong')) return 'This QR does not belong to your bookings.'
  if (m.includes('mismatch') || m.includes('wrong booking') || m.includes('does not belong to this booking')) return 'This QR belongs to a different booking.'
  if (m.includes('signature') || m.includes('invalid qr')) return 'Invalid QR code. Ask the customer to refresh their booking QR.'
  if (m.includes('not found')) return 'Booking not found. The booking may have been cancelled.'
  if (m.includes('network') || m.includes('timeout')) return 'Connection error. Check your internet and try again.'
  return msg || 'Scan failed. Please try again.'
}

function readQrPayload(raw: string): { bookingId?: string; qrId?: string } {
  const text = raw.trim()
  if (!text) return {}

  try {
    const parsed = JSON.parse(text)
    return {
      bookingId: parsed.booking_id ?? parsed.bookingId,
      qrId: parsed.qr_id ?? parsed.qrId ?? parsed.qr_code_id ?? parsed.qrCodeId,
    }
  } catch {}

  try {
    const url = new URL(text)
    return {
      bookingId: url.searchParams.get('booking_id') ?? url.searchParams.get('bookingId') ?? undefined,
      qrId: url.searchParams.get('qr_id') ?? url.searchParams.get('qrId') ?? url.searchParams.get('qr_code_id') ?? undefined,
    }
  } catch {}

  return { qrId: text }
}

function useNow(serverOffset: number) {
  const offsetRef  = useRef(serverOffset)
  const rafRef     = useRef<number>()
  const lastSecRef = useRef(-1)
  const [now, setNow] = useState(() => Date.now() - serverOffset)

  useEffect(() => {
    offsetRef.current = serverOffset
    const corrected = Date.now() - serverOffset
    lastSecRef.current = Math.floor(corrected / 1000)
    setNow(corrected)
  }, [serverOffset])

  useEffect(() => {
    const loop = () => {
      const corrected = Date.now() - offsetRef.current
      const sec = Math.floor(corrected / 1000)
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec
        setNow(corrected)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    const corrected = Date.now() - offsetRef.current
    lastSecRef.current = Math.floor(corrected / 1000)
    setNow(corrected)
    rafRef.current = requestAnimationFrame(loop)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const c = Date.now() - offsetRef.current
        lastSecRef.current = Math.floor(c / 1000)
        setNow(c)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return now
}

interface QueueBooking {
  id: string
  booking_number: string
  queue_number: number
  status: string
  service_date: string
  service_start_time: string
  arrival_window_start: string
  arrival_window_end: string
  scan_window_end?: string | null
  service_end_time: string
  checked_in_at: string | null
  service_started_at: string | null
  service_completed_at: string | null
  estimated_duration: number
  actual_duration?: number | null
  notes?: string
  services: { name: string; duration: number; image: string | null; additional_note?: string }[]
  customer: { id: string; name: string; phone: string | null; avatar_url: string | null }
}

interface ScanResult {
  type: 'success' | 'error'
  booking_id?: string
  booking_number?: string
  customer_name?: string
  services?: string[]
  started_at?: string
  message: string
}

function useActiveQueue(
  liveBookings: QueueBooking[],
  serverOffset: number,
  optimisticRunningId: string | null,
  optimisticStartedAt: string | null,
  clientNoShowIds: Set<string>,
) {
  const nowMs = useNow(serverOffset)

  const transitioned = (() => {
    // Deep copy — never mutate liveBookings directly
    const bookings = liveBookings.map(b => ({ ...b }))

    for (const b of bookings) {
      if (clientNoShowIds.has(b.id) && b.status !== 'NO_SHOW') {
        b.status = 'NO_SHOW'
      }
    }

    // Check if any booking is ALREADY RUNNING (from backend or from above override)
    let autoMoved = bookings.some(b => b.status === 'RUNNING')

    // Sort by queue_number for correct autoMove priority
    const sorted = [...bookings].sort((a, b) => a.queue_number - b.queue_number)

    for (const b of sorted) {
      if (b.status === 'NO_SHOW' || b.status === 'COMPLETED') continue

      const arrivalStart = new Date(b.arrival_window_start).getTime()
      const scanEnd      = new Date(b.scan_window_end || b.service_start_time).getTime()

      if (
        b.status === 'CONFIRMED' &&
        nowMs >= arrivalStart &&
        nowMs <= scanEnd &&
        !autoMoved
      ) {
        b.status = 'RUNNING'
        autoMoved = true
        continue
      }

      if (
        (b.status === 'CONFIRMED' || b.status === 'RUNNING') &&
        b.service_started_at === null &&
        nowMs > scanEnd
      ) {
        b.status = 'NO_SHOW'
        // Note: caller tracks this in clientNoShowIds to prevent oscillation
      }
    }

    if (optimisticRunningId && optimisticStartedAt) {
      const b = bookings.find(b => b.id === optimisticRunningId)
      if (b) {
        b.status = 'RUNNING'
        b.service_started_at = optimisticStartedAt
      }
    }

    return bookings
  })()

  const allRunning   = transitioned.filter(b => b.status === 'RUNNING')
  const allUpcoming  = transitioned.filter(b => b.status === 'CONFIRMED')
  const allCompleted = transitioned.filter(b => b.status === 'COMPLETED')
  const sortedUpcoming = [...allUpcoming].sort((a, b) => a.queue_number - b.queue_number)

  // Running booking: prefer QR-scanned (service_started_at set), then first awaiting
  const runningBooking =
    allRunning.find(b => !!b.service_started_at) ??
    (allRunning.length > 0 ? allRunning[0] : null)

  // hasQrRunning: true when ANY booking occupies the running slot
  // (scanned OR awaiting scan). This blocks Scan & Start on upcoming bookings.
  const hasQrRunning = runningBooking !== null

  // activeBooking: shown in RunningCard
  const activeBooking = runningBooking ?? null

  // visibleUpcoming: all CONFIRMED except the one in RunningCard
  const visibleUpcoming = sortedUpcoming.filter(b => b.id !== activeBooking?.id)

  // Stat card: only QR-scanned count as "running" for the metric
  const qrRunningCount = allRunning.filter(b => !!b.service_started_at).length

  // Return the set of booking IDs that are client-NO_SHOW this render
  // so the caller can track them in clientNoShowIds ref
  const clientNoShowThisTick = new Set(
    transitioned.filter(b => b.status === 'NO_SHOW' && !liveBookings.find(lb => lb.id === b.id && lb.status === 'NO_SHOW')).map(b => b.id)
  )

  return {
    allRunning, allUpcoming, allCompleted, sortedUpcoming,
    runningBooking, hasQrRunning, activeBooking,
    visibleUpcoming, nowMs, qrRunningCount,
    clientNoShowThisTick,
  }
}

// ── Camera Scanner ────────────────────────────────────────────────────
function CameraScanner({ onResult, onError }: {
  onResult: (bookingId: string, qrId: string) => void
  onError: (msg: string) => void
}) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>()
  const streamRef = useRef<MediaStream>()
  const lockedRef = useRef(false)
  const [active, setActive]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const scanFrame = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame); return
    }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' })
    if (processing || lockedRef.current) { rafRef.current = requestAnimationFrame(scanFrame); return }
    if (code?.data) {
      const parsed = readQrPayload(code.data)
      if (parsed.qrId) {
        lockedRef.current = true; setProcessing(true)
        streamRef.current?.getTracks().forEach(t => t.stop())
        onResult(parsed.bookingId ?? '', parsed.qrId); return
      }
      toast.warning('Not a valid booking QR code.')
    }
    rafRef.current = requestAnimationFrame(scanFrame)
  }, [onResult, processing])

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().then(() => { setActive(true); rafRef.current = requestAnimationFrame(scanFrame) })
      }
    }).catch(() => { setErr('Camera access denied. Use upload or manual entry.'); onError('Camera access denied') })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [scanFrame, onError])

  return (
    <div className="relative rounded-[16px] overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
      {active && !processing && !err && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: 180, height: 180 }}>
            {['top-0 left-0 border-t-[3px] border-l-[3px]', 'top-0 right-0 border-t-[3px] border-r-[3px]',
              'bottom-0 left-0 border-b-[3px] border-l-[3px]', 'bottom-0 right-0 border-b-[3px] border-r-[3px]'].map((cls, i) => (
              <div key={i} className={`absolute w-9 h-9 ${cls} rounded-sm`} style={{ borderColor: 'var(--violet-light)' }} />
            ))}
            <motion.div className="absolute left-2 right-2 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, var(--violet-light), #fff, var(--violet-light), transparent)', boxShadow: '0 0 10px 2px rgba(167,139,250,0.6)' }}
              animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
          <p className="absolute bottom-4 text-center text-white/80 font-syne font-bold text-[12px]">
            Align customer QR within the frame
          </p>
        </div>
      )}
      {active && !processing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
            className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
          <span className="text-[11px] font-bold text-white">Scanning...</span>
        </div>
      )}
      {processing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--violet-light)' }} />
          <p className="font-syne font-bold text-[14px] text-white">Verifying QR...</p>
        </div>
      )}
      {err && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: 'rgba(0,0,0,0.92)' }}>
          <XCircle size={28} style={{ color: 'var(--red)' }} />
          <p className="font-syne font-bold text-[14px] text-white">Camera Denied</p>
          <p className="text-[12px] text-white/60">{err}</p>
        </div>
      )}
    </div>
  )
}

// ── Upload Zone ───────────────────────────────────────────────────────
function UploadZone({ onResult, onError, isVerifying }: {
  onResult: (bookingId: string, qrId: string) => void
  onError: (msg: string) => void
  isVerifying: boolean
}) {
  const [dragOver, setDragOver]   = useState(false)
  const [file, setFile]           = useState<File | null>(null)
  const [fileReady, setFileReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const decodeImage = useCallback(async (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })
    if (!code) { onError('No QR code found in this image.'); return }
    const parsed = readQrPayload(code.data)
    if (parsed.qrId) { onResult(parsed.bookingId ?? '', parsed.qrId); return }
    onError('Invalid QR. Please upload a valid booking QR image.')
  }, [onResult, onError])

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { onError('Please upload a valid image file.'); return }
    setFile(f); setFileReady(true)
  }, [onError])

  const processScan = useCallback(() => {
    if (!file || isVerifying) return
    const url = URL.createObjectURL(file)
    const img  = new Image()
    img.onload = () => { decodeImage(img); URL.revokeObjectURL(url) }
    img.src = url
  }, [file, decodeImage, isVerifying])

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find(i => i.type.startsWith('image/'))
      if (imageItem) { const blob = imageItem.getAsFile(); if (blob) handleFile(blob) }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [handleFile])

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => !file && inputRef.current?.click()}
        className="rounded-[14px] flex flex-col items-center justify-center p-6 gap-3 cursor-pointer transition-all"
        style={{ border: `2px dashed ${dragOver ? 'var(--violet-light)' : 'var(--border-2)'}`, background: dragOver ? 'var(--violet-bg)' : 'var(--bg-surface)' }}>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <Upload size={24} style={{ color: 'var(--violet-light)' }} />
        <div className="text-center">
          <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Drop QR image or paste</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>PNG, JPG · Ctrl+V to paste</p>
        </div>
        <button onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
          className="q-btn-primary h-9 px-4 flex items-center gap-2 text-[12px]">
          <Upload size={13} /> Choose File
        </button>
      </div>
      {file && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-[10px]"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="w-10 h-10 rounded-[8px] overflow-hidden flex-shrink-0">
            <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{file.name}</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>✓ Ready</span>
          <button onClick={() => { setFile(null); setFileReady(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
            <X size={14} />
          </button>
        </motion.div>
      )}
      {fileReady && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={processScan} disabled={isVerifying}
          className="q-btn-primary w-full h-11 flex items-center justify-center gap-2 text-[13px]">
          {isVerifying
            ? <><div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> Verifying...</>
            : <><QrCode size={14} /> Scan QR Image</>}
        </motion.button>
      )}
    </div>
  )
}

// ── Scan Modal ────────────────────────────────────────────────────────
function ScanModal({ booking, queryClient, onClose, onSuccess, onOptimisticStart }: {
  booking: QueueBooking
  queryClient: QueryClient
  onClose: () => void
  onSuccess: () => void
  onOptimisticStart: (bookingId: string, startedAt: string) => void
}) {
  const mobile = isMobile()
  const { permissionGranted, setPermissionGranted } = useCameraStore()
  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [scanTab, setScanTab]     = useState<'camera' | 'upload' | 'manual'>(mobile ? 'camera' : 'upload')
  const [cameraKey, setCameraKey] = useState(0)
  const [manualId, setManualId]   = useState('')
  const [scanResult, setScanResult]   = useState<ScanResult | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError]     = useState(false)

  const scanMutation = useMutation({
    mutationFn: async ({ bookingId, qrId }: { bookingId: string; qrId: string }) => {
      if (bookingId && bookingId !== booking.id) throw new Error('mismatch: This QR belongs to a different booking.')
      const r = await api.post(`/staff/bookings/${booking.id}/scan`, { qr_id: qrId, scan_method: 'CAMERA' })
      return r.data.data
    },
    onSuccess: data => {
      onOptimisticStart(booking.id, data.started_at ?? data.startedAt ?? new Date().toISOString())
      queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
      onSuccess()
    },
    onError: (e: any) => {
      const rawMsg = e?.message?.startsWith('mismatch:')
        ? e.message.replace('mismatch: ', '')
        : (e?.response?.data?.message ?? '')
      setScanResult({ type: 'error', message: getScanErrorMessage(rawMsg) })
      setShowError(true)
      setCameraKey(p => p + 1)
    },
  })

  const manualMutation = useMutation({
    mutationFn: async (rawQr: string) => {
      const parsed = readQrPayload(rawQr)
      if (parsed.bookingId && parsed.bookingId !== booking.id) throw new Error('mismatch: This QR belongs to a different booking.')
      if (!parsed.qrId) throw new Error('Invalid QR code. Paste the customer QR payload or QR ID.')
      const r = await api.post(`/staff/bookings/${booking.id}/scan`, { qr_id: parsed.qrId, scan_method: 'MANUAL' })
      return r.data.data
    },
    onSuccess: data => {
      onOptimisticStart(booking.id, data.started_at ?? data.startedAt ?? new Date().toISOString())
      setManualId('')
      queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
      onSuccess()
    },
    onError: (e: any) => {
      const rawMsg = e?.message?.startsWith('mismatch:')
        ? e.message.replace('mismatch: ', '')
        : (e?.response?.data?.message ?? e?.message ?? '')
      setScanResult({ type: 'error', message: getScanErrorMessage(rawMsg) })
      setShowError(true)
    },
  })

  const isVerifying = scanMutation.isPending || manualMutation.isPending
  const handleScanResult = (bookingId: string, qrId: string) => { if (!isVerifying) scanMutation.mutate({ bookingId, qrId }) }
  const handleReset = () => {
    setScanResult(null); setShowSuccess(false); setShowError(false)
    scanMutation.reset(); manualMutation.reset(); setCameraKey(p => p + 1)
  }

  const steps = [{ n: 1, label: 'Customer' }, { n: 2, label: 'Services' }, { n: 3, label: 'Scan QR' }]

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
        onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto q-card pointer-events-auto rounded-2xl"
          style={{ borderTop: '3px solid var(--violet-light)' }}
          onClick={e => e.stopPropagation()}>

          <div className="sticky top-0 z-10 px-5 pt-5 pb-4"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1 mb-4">
              {steps.map(({ n, label }, idx) => (
                <div key={n} className="flex items-center gap-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    <motion.div animate={{ scale: step === n ? 1.1 : 1 }}
                      className="w-7 h-7 rounded-full flex items-center justify-center font-syne font-black text-[11px] flex-shrink-0"
                      style={{
                        background: step > n ? 'linear-gradient(135deg, var(--green), #059669)' : step === n ? 'linear-gradient(135deg, var(--violet), #6366f1)' : 'var(--bg-surface)',
                        color: step >= n ? '#fff' : 'var(--text-3)',
                        border: step < n ? '1.5px solid var(--border)' : 'none',
                        boxShadow: step === n ? '0 0 16px rgba(124,58,237,0.4)' : 'none',
                      }}>
                      {step > n ? '✓' : n}
                    </motion.div>
                    <span className="text-[11px] font-syne font-bold hidden sm:block"
                      style={{ color: step === n ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 rounded-full" style={{ background: step > n ? 'var(--green)' : 'var(--border)' }} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-syne font-black text-[18px]" style={{ color: 'var(--text-1)' }}>Start Service</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {step === 1 ? 'Review customer info' : step === 2 ? 'Confirm services' : 'Scan QR to begin'}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            {booking.notes && (
              <div className="p-3.5 rounded-[14px]"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.35)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[16px]">⚠️</span>
                  <p className="font-syne font-bold text-[12px]" style={{ color: 'var(--yellow)' }}>Special Instructions</p>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{booking.notes}</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="rounded-[18px] overflow-hidden" style={{ border: '1.5px solid var(--border)', background: 'var(--bg-surface)' }}>
                    <div className="flex items-center gap-4 p-5"
                      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.06))' }}>
                      <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="xl" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-syne font-black text-[20px]" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</h3>
                        {booking.customer.phone && (
                          <p className="flex items-center gap-1.5 text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
                            <Phone size={11} /> {booking.customer.phone}
                          </p>
                        )}
                        <p className="text-[11px] mt-1 font-bold" style={{ color: 'var(--violet-light)' }}>#{booking.booking_number}</p>
                      </div>
                      <div className="text-center flex-shrink-0 p-3 rounded-[12px]"
                        style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-3)' }}>Queue</p>
                        <span className="font-syne font-black text-[24px]" style={{ color: 'var(--violet-light)' }}>#{booking.queue_number}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x" style={{ borderTop: '1px solid var(--border)' }}>
                      {[
                        { label: 'Queue #', val: `#${booking.queue_number}` },
                        { label: 'Arrival Window', val: `${fmtTime(booking.arrival_window_start)} – ${fmtTime(booking.arrival_window_end)}` },
                        { label: 'Duration', val: `${booking.estimated_duration} min` },
                      ].map(({ label, val }) => (
                        <div key={label} className="p-3 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                          <p className="text-[11px] font-bold" style={{ color: 'var(--text-1)' }}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 q-btn-ghost h-11 text-[13px]">Cancel</button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(2)}
                      className="flex-1 h-11 rounded-[12px] font-syne font-bold text-[13px] flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', boxShadow: '0 0 24px rgba(124,58,237,0.35)', cursor: 'pointer' }}>
                      Next: Services <ChevronRight size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                    Services Booked ({booking.services.length})
                  </p>
                  <div className="space-y-2.5">
                    {booking.services.map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="rounded-[14px] overflow-hidden" style={{ border: '1.5px solid var(--border)', background: 'var(--bg-surface)' }}>
                        <div className="flex">
                          <div className="w-20 h-20 flex-shrink-0" style={{ background: 'var(--violet-bg)' }}>
                            <img src={s.image || '/placeholder-service.png'} alt={s.name} className="w-full h-full object-cover"
                              onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-service.png' }} />
                          </div>
                          <div className="flex-1 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-syne font-bold text-[13px]" style={{ color: 'var(--text-1)' }}>{s.name}</p>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)' }}>{s.duration} min</span>
                            </div>
                            {s.additional_note && (
                              <div className="mt-1.5 flex items-start gap-1.5 p-2 rounded-[8px]"
                                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
                                <p className="text-[11px] leading-tight" style={{ color: 'var(--yellow)' }}>📝 {s.additional_note}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Booked Time', val: fmtTime(booking.service_start_time), icon: '🕐' },
                      { label: 'Duration', val: `${booking.estimated_duration}m`, icon: '⏱️' },
                    ].map(({ label, val, icon }) => (
                      <div key={label} className="p-3 rounded-[12px] text-center"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <p className="text-[14px] mb-1">{icon}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
                        <p className="text-[12px] font-bold" style={{ color: 'var(--text-1)' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setStep(1)} className="h-11 px-4 q-btn-ghost flex items-center gap-1.5 text-[13px]">
                      <ChevronLeft size={14} /> Back
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(3)}
                      className="flex-1 h-11 rounded-[12px] font-syne font-bold text-[13px] flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', boxShadow: '0 0 24px rgba(124,58,237,0.35)', cursor: 'pointer' }}>
                      <Play size={14} fill="white" /> Proceed to Scan
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  
                  <div className="flex gap-1 p-1 rounded-[10px]" style={{ background: 'var(--bg-surface)' }}>
                    {[
                      ...(mobile ? [{ id: 'camera' as const, label: 'Camera', icon: <Camera size={13} /> }] : []),
                      { id: 'upload' as const, label: 'Upload', icon: <Upload size={13} /> },
                      { id: 'manual' as const, label: 'Manual', icon: <Keyboard size={13} /> },
                    ].map(t => (
                      <button key={t.id} onClick={() => setScanTab(t.id)}
                        className="flex-1 py-2 rounded-[8px] text-[11px] font-syne font-bold flex items-center justify-center gap-1.5"
                        style={{ background: scanTab === t.id ? 'var(--bg-card)' : 'transparent', color: scanTab === t.id ? 'var(--text-1)' : 'var(--text-3)', cursor: 'pointer', border: 'none' }}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                  {scanTab === 'camera' && mobile && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-syne font-bold" style={{ color: 'var(--text-1)' }}>Camera</p>
                        <button onClick={() => setPermissionGranted(!permissionGranted)}
                          className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                          style={{ background: permissionGranted ? 'var(--green-bg)' : 'var(--bg-surface)', color: permissionGranted ? 'var(--green)' : 'var(--text-3)', border: `1px solid ${permissionGranted ? 'var(--green-border)' : 'var(--border)'}`, cursor: 'pointer' }}>
                          {permissionGranted ? '🟢 On' : '⚫ Off'}
                        </button>
                      </div>
                      {permissionGranted
                        ? <CameraScanner key={cameraKey} onResult={handleScanResult}
                            onError={msg => { setScanResult({ type: 'error', message: msg }); setShowError(true) }} />
                        : <div className="text-center p-8 rounded-[12px]" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-2)' }}>
                            <Camera size={24} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
                            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Enable camera to scan QR</p>
                          </div>
                      }
                    </div>
                  )}
                  {scanTab === 'upload' && (
                    <UploadZone onResult={handleScanResult}
                      onError={msg => { setScanResult({ type: 'error', message: msg }); setShowError(true) }}
                      isVerifying={isVerifying} />
                  )}
                  {scanTab === 'manual' && (
                    <div className="space-y-3">
                      <input className="q-input" placeholder="Enter QR Code ID"
                        value={manualId} onChange={e => setManualId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && manualId.trim() && !isVerifying && manualMutation.mutate(manualId.trim())} />
                      <button disabled={!manualId.trim() || isVerifying}
                        onClick={() => manualMutation.mutate(manualId.trim())}
                        className="q-btn-primary w-full h-11 flex items-center justify-center gap-2 text-[13px]">
                        {isVerifying
                          ? <><div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" />Verifying...</>
                          : <><QrCode size={14} />Start Service</>}
                      </button>
                    </div>
                  )}
                  {isVerifying && scanTab !== 'manual' && (
                    <div className="flex items-center justify-center gap-2 py-2" style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--violet-light)' }} />
                      Verifying with server...
                    </div>
                  )}
                  <button onClick={() => setStep(2)} className="q-btn-ghost w-full h-9 text-[12px] flex items-center justify-center gap-1.5">
                    <ChevronLeft size={12} /> Back to Services
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showError && scanResult?.type === 'error' && (
          <ScanErrorModal message={scanResult.message}
            onRetry={() => { setShowError(false); handleReset() }}
            onSwitchMode={() => { setShowError(false); setScanTab('manual'); setCameraKey(p => p + 1) }}
            onClose={() => { setShowError(false); handleReset() }} />
        )}
      </AnimatePresence>
    </>
  )
}

function ScanSuccessModal({ result }: { result: ScanResult }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
      <motion.div initial={{ opacity: 0, scale: 0.7, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 440, damping: 24 }}
        className="relative w-full max-w-xs z-10 rounded-[24px] overflow-hidden pointer-events-auto"
        style={{ background: 'var(--bg-card)', border: '1.5px solid rgba(52,211,153,0.5)', boxShadow: '0 0 60px rgba(52,211,153,0.3)' }}>
        <div className="px-6 pt-7 pb-4 text-center"
          style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.15) 0%, transparent 100%)' }}>
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.05 }}
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.15))', border: '2.5px solid var(--green)', boxShadow: '0 0 40px rgba(52,211,153,0.45)' }}>
            <CheckCircle size={32} style={{ color: 'var(--green)' }} />
          </motion.div>
          <p className="q-page-title" style={{ color: 'var(--green)' }}>Service Started!</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            {result.customer_name} · {result.services?.join(', ')}
          </p>
        </div>
        <div className="px-5 pb-5">
          <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[
              { label: 'Started', val: result.started_at ? fmtTime(result.started_at) : '—', icon: '🕐' },
              { label: 'Booking', val: result.booking_number, icon: '🎫' },
            ].filter(x => x.val).map(({ label, val, icon }, idx, arr) => (
              <div key={label} className="flex items-center justify-between px-4 py-2"
                style={{ background: idx % 2 === 0 ? 'var(--bg-surface)' : 'transparent', borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-3)' }}><span>{icon}</span>{label}</span>
                <span className="text-[11px] font-bold" style={{ color: 'var(--text-1)' }}>{val}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] mt-3" style={{ color: 'var(--text-3)' }}>Closing automatically…</p>
        </div>
      </motion.div>
    </div>
  )
}

function ScanErrorModal({ message, onRetry, onSwitchMode, onClose }: {
  message: string; onRetry: () => void; onSwitchMode: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative w-full max-w-sm q-card p-5 z-10" style={{ borderTop: '4px solid var(--red)' }}>
        <button onClick={onClose} className="absolute top-4 right-4"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
          <X size={16} />
        </button>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--red-bg)', border: '2px solid rgba(239,68,68,0.3)' }}>
          <XCircle size={28} style={{ color: 'var(--red)' }} />
        </div>
        <p className="font-syne font-bold text-[18px] text-center mb-2" style={{ color: 'var(--text-1)' }}>Scan Failed</p>
        <p className="text-[13px] text-center mb-5 leading-relaxed" style={{ color: 'var(--red)' }}>{message}</p>
        <div className="flex flex-col gap-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={onRetry}
            className="q-btn-primary h-10 flex items-center justify-center gap-2 text-[13px]">
            <RefreshCw size={13} /> Try Again
          </motion.button>
          <button onClick={onSwitchMode} className="q-btn-ghost h-9 text-[12px]">Switch to manual entry</button>
        </div>
      </motion.div>
    </div>
  )
}

function ServiceTimer({ startedAt, estimatedMin, serverOffset }: {
  startedAt: string; estimatedMin: number; serverOffset: number
}) {
  const [elapsed, setElapsed] = useState(0)
  const offsetRef = useRef(serverOffset)
  useEffect(() => { offsetRef.current = serverOffset }, [serverOffset])

  useEffect(() => {
    const origin = new Date(startedAt).getTime()
    let rafId: number; let lastSec = -1
    const loop = () => {
      const val = Math.max(0, Math.floor((Date.now() - offsetRef.current - origin) / 1000))
      if (val !== lastSec) { lastSec = val; setElapsed(val) }
      rafId = requestAnimationFrame(loop)
    }
    const resync = () => {
      if (document.visibilityState === 'visible') {
        const val = Math.max(0, Math.floor((Date.now() - offsetRef.current - origin) / 1000))
        lastSec = val; setElapsed(val)
      }
    }
    const val0 = Math.max(0, Math.floor((Date.now() - offsetRef.current - origin) / 1000))
    lastSec = val0; setElapsed(val0)
    rafId = requestAnimationFrame(loop)
    document.addEventListener('visibilitychange', resync)
    return () => { cancelAnimationFrame(rafId); document.removeEventListener('visibilitychange', resync) }
  }, [startedAt])

  const totalSec  = Math.max(estimatedMin * 60, 1)
  const pct       = Math.min(100, (elapsed / totalSec) * 100)
  const remaining = Math.max(0, totalSec - elapsed)
  const overrun   = elapsed > totalSec + 30
  const nearEnd   = !overrun && pct > 80
  const barColor  = overrun ? 'var(--red)' : nearEnd ? 'var(--yellow)' : 'var(--green)'
  const status    = overrun ? '⚠ Overrun' : nearEnd ? 'Near end' : 'On track'
  const statusCol = overrun ? 'var(--red)' : nearEnd ? 'var(--yellow)' : 'var(--green)'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'ELAPSED', val: fmtMMSS(elapsed), color: 'var(--green)', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.22)' },
          { label: overrun ? 'OVERRUN' : 'REMAINING', val: overrun ? `+${fmtMMSS(elapsed - totalSec)}` : fmtMMSS(remaining), color: overrun ? 'var(--red)' : nearEnd ? 'var(--yellow)' : '#f97316', bg: overrun ? 'rgba(239,68,68,0.10)' : nearEnd ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)', border: overrun ? 'rgba(239,68,68,0.28)' : nearEnd ? 'rgba(245,158,11,0.25)' : 'var(--border)' },
          { label: 'EST.', val: `${estimatedMin}m`, color: 'var(--text-1)', bg: 'var(--bg-surface)', border: 'var(--border)' },
        ].map(({ label, val, color, bg, border }) => (
          <div key={label} className="rounded-[12px] p-3 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <p className="font-syne font-bold uppercase tracking-widest mb-1" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</p>
            <p className="font-mono font-black leading-none" style={{ fontSize: 24, color, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-syne font-bold uppercase tracking-widest" style={{ fontSize: 9, color: 'var(--text-3)' }}>PROGRESS</span>
          <span className="font-syne font-bold text-[10px]" style={{ color: statusCol }}>{status}</span>
          <span className="font-syne font-bold" style={{ fontSize: 9, color: 'var(--text-3)' }}>{Math.round(pct)}%</span>
        </div>
        <div className="relative h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
          <motion.div style={{ position: 'absolute', inset: '0 auto 0 0', borderRadius: 9999, background: barColor, boxShadow: `0 0 10px ${barColor}88` }}
            animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'linear' }} />
        </div>
      </div>
    </div>
  )
}

function CompleteServiceModal({ booking, onClose, onConfirm, isLoading }: {
  booking: QueueBooking; onClose: () => void; onConfirm: () => void; isLoading: boolean
}) {
  const [elapsed, setElapsed] = useState(0)
  const startedAt = booking.service_started_at
  useEffect(() => {
    if (!startedAt) return
    const origin = new Date(startedAt).getTime()
    let rafId: number; let lastSec = -1
    const loop = () => {
      const val = Math.max(0, Math.floor((Date.now() - origin) / 1000))
      if (val !== lastSec) { lastSec = val; setElapsed(val) }
      rafId = requestAnimationFrame(loop)
    }
    const val0 = Math.max(0, Math.floor((Date.now() - origin) / 1000))
    lastSec = val0; setElapsed(val0)
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [startedAt])

  const estimatedSec = booking.estimated_duration * 60
  const diff         = elapsed - estimatedSec
  const isOnTime     = diff <= 0
  const pct          = Math.min(100, (elapsed / Math.max(estimatedSec, 1)) * 100)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.87)', backdropFilter: 'blur(14px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.85, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative w-full max-w-sm z-10 rounded-[24px] overflow-hidden"
        style={{ border: '1.5px solid rgba(52,211,153,0.35)', background: 'var(--bg-card)' }}>
        <div className="px-5 pt-6 pb-4 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.14) 0%, transparent 100%)', borderBottom: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(16,185,129,0.2))', border: '2px solid var(--green)' }}>
            <CheckCircle2 size={26} style={{ color: 'var(--green)' }} />
          </div>
          <p className="font-syne font-black text-[20px]" style={{ color: 'var(--text-1)' }}>Complete Service?</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>For {booking.customer.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[10px] p-3 text-center" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--green)' }}>ACTUAL</p>
              <p className="font-mono font-black text-[20px] leading-none" style={{ color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fmtMMSS(elapsed)}</p>
            </div>
            <div className="rounded-[10px] p-3 text-center"
              style={{ background: isOnTime ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isOnTime ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.2)'}` }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: isOnTime ? 'var(--green)' : 'var(--red)' }}>{isOnTime ? 'UNDER' : 'OVER'}</p>
              <p className="font-mono font-black text-[20px] leading-none" style={{ color: isOnTime ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                {isOnTime ? `-${fmtMMSS(Math.abs(diff))}` : `+${fmtMMSS(diff)}`}
              </p>
            </div>
            <div className="rounded-[10px] p-3 text-center" style={{ background: 'var(--bg-surface)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>EST.</p>
              <p className="font-syne font-black text-[18px] leading-none mt-0.5" style={{ color: 'var(--text-2)' }}>{booking.estimated_duration}m</p>
            </div>
          </div>
          <div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
              <motion.div className="h-full rounded-full"
                style={{ width: `${Math.min(pct, 100)}%`, background: isOnTime ? 'linear-gradient(90deg, var(--green), #34d399)' : 'linear-gradient(90deg, var(--yellow), var(--red))' }}
                initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.8 }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{startedAt ? fmtTime(startedAt) : '—'} start</span>
              <span className="text-[10px] font-bold" style={{ color: isOnTime ? 'var(--green)' : 'var(--red)' }}>
                {isOnTime ? `✓ ${Math.ceil(elapsed / 60)}min — within estimate` : `⚠ ${Math.ceil(diff / 60)}m overrun`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-[10px]"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={13} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
            <p className="text-[11px]" style={{ color: 'var(--yellow)' }}>
              This will mark the service complete and move the next customer to active.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 q-btn-ghost h-11">Cancel</button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={onConfirm} disabled={isLoading}
              className="flex-1 h-11 rounded-[10px] font-syne font-bold text-[13px] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #059669, #34d399)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {isLoading ? <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> : <><Award size={14} /> Yes, Complete</>}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function ExtendModal({ onClose, onApply, isLoading }: {
  onClose: () => void; onApply: (m: number) => void; isLoading: boolean
}) {
  const [minutes, setMinutes] = useState(15)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm q-card rounded-2xl p-5 z-10" style={{ borderTop: '3px solid var(--violet-light)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-[10px]" style={{ background: 'var(--violet-bg)' }}>
            <AlarmClock size={18} style={{ color: 'var(--violet-light)' }} />
          </div>
          <div>
            <h3 className="font-syne font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>Extend Service Time</h3>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Queue auto-shifts for affected upcoming bookings</p>
          </div>
        </div>
        <div className="space-y-4 mb-5">
          <div className="flex items-center justify-center p-4 rounded-[12px]"
            style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
            <span className="font-syne font-black text-[48px] leading-none" style={{ color: 'var(--violet-light)' }}>{minutes}</span>
            <span className="font-syne font-bold text-[18px] ml-2 mt-4" style={{ color: 'var(--violet-light)' }}>min</span>
          </div>
          <input type="range" min={5} max={60} step={5} value={minutes}
            onChange={e => setMinutes(+e.target.value)} className="w-full accent-violet-500" />
          <div className="grid grid-cols-5 gap-1.5">
            {[5, 10, 15, 20, 30].map(m => (
              <button key={m} onClick={() => setMinutes(m)}
                className="py-2 rounded-[8px] text-[11px] font-syne font-bold"
                style={{ background: minutes === m ? 'var(--violet-bg)' : 'var(--bg-surface)', color: minutes === m ? 'var(--violet-light)' : 'var(--text-3)', border: `1px solid ${minutes === m ? 'var(--violet-border)' : 'var(--border)'}`, cursor: 'pointer' }}>
                {m}m
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-[8px]"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <AlertTriangle size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <p className="text-[11px]" style={{ color: 'var(--blue)' }}>
              Adds {minutes} min. Only affected bookings are shifted and notified.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 q-btn-ghost h-11">Cancel</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onApply(minutes)} disabled={isLoading}
            className="flex-1 h-11 rounded-[9px] font-syne font-bold text-[13px] flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {isLoading ? <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> : <><AlarmClock size={14} /> Apply Extension</>}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

function OverrunPanel({ startedAt, estimatedMin, serverOffset, onExtend, onComplete, isActing }: {
  startedAt: string; estimatedMin: number; serverOffset: number
  onExtend: () => void; onComplete: () => void; isActing: boolean
}) {
  const [overrunSec, setOverrunSec] = useState(0)
  const offsetRef = useRef(serverOffset)
  useEffect(() => { offsetRef.current = serverOffset }, [serverOffset])

  useEffect(() => {
    const origin   = new Date(startedAt).getTime()
    const totalSec = estimatedMin * 60
    let rafId: number; let lastSec = -1
    const loop = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - offsetRef.current - origin) / 1000))
      const over    = Math.max(0, elapsed - totalSec)
      if (elapsed !== lastSec) { lastSec = elapsed; setOverrunSec(over) }
      rafId = requestAnimationFrame(loop)
    }
    const resync = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Math.max(0, Math.floor((Date.now() - offsetRef.current - origin) / 1000))
        lastSec = elapsed; setOverrunSec(Math.max(0, elapsed - totalSec))
      }
    }
    const elapsed0 = Math.max(0, Math.floor((Date.now() - offsetRef.current - origin) / 1000))
    lastSec = elapsed0; setOverrunSec(Math.max(0, elapsed0 - totalSec))
    rafId = requestAnimationFrame(loop)
    document.addEventListener('visibilitychange', resync)
    return () => { cancelAnimationFrame(rafId); document.removeEventListener('visibilitychange', resync) }
  }, [startedAt, estimatedMin])

  if (overrunSec <= 30) return null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] p-3 mt-2"
      style={{ background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
          </motion.div>
          <div>
            <p className="font-syne font-bold text-[12px]" style={{ color: 'var(--red)' }}>
              Running {Math.ceil(overrunSec / 60)}m over — please take action
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Next customer may be affected.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <motion.button whileTap={{ scale: 0.96 }} onClick={onExtend} disabled={isActing}
            className="h-8 px-3 rounded-[8px] font-syne font-bold text-[11px]"
            style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer' }}>
            Extend
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onComplete} disabled={isActing}
            className="h-8 px-3 rounded-[8px] font-syne font-bold text-[11px]"
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer' }}>
            Complete
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

function RunningCard({ booking, onComplete, onExtend, isActing, serverOffset, onStart }: {
  booking: QueueBooking; onComplete: () => void; onExtend: (m: number) => void
  isActing: boolean; serverOffset: number; onStart: (b: QueueBooking) => void
}) {
  const [showExtend, setShowExtend]               = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const hasStarted = !!booking.service_started_at

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="queue-running-card overflow-hidden mb-4 w-full"
        style={{
          border:     hasStarted ? '1.5px solid rgba(52,211,153,0.4)' : '1.5px solid rgba(124,58,237,0.4)',
          boxShadow:  hasStarted ? '0 0 40px rgba(52,211,153,0.07)' : '0 0 40px rgba(124,58,237,0.07)',
          background: 'var(--bg-card)',
        }}>
        <div className="flex items-center justify-between px-5 py-2.5"
          style={{
            background:   hasStarted ? 'rgba(52,211,153,0.10)' : 'rgba(124,58,237,0.08)',
            borderBottom: `1px solid ${hasStarted ? 'rgba(52,211,153,0.18)' : 'rgba(124,58,237,0.18)'}`,
          }}>
          <div className="flex items-center gap-2">
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: hasStarted ? 'var(--green)' : 'var(--violet-light)', boxShadow: hasStarted ? '0 0 8px var(--green)' : '0 0 8px var(--violet-light)' }} />
            <span className="font-syne font-black uppercase tracking-widest text-[11px]"
              style={{ color: hasStarted ? 'var(--green)' : 'var(--violet-light)' }}>
              {hasStarted ? 'In Progress' : 'Arrival Open · Scan QR to Start'}
            </span>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{
              background: hasStarted ? 'rgba(52,211,153,0.15)' : 'var(--violet-bg)',
              color:      hasStarted ? 'var(--green)' : 'var(--violet-light)',
              border:     `1px solid ${hasStarted ? 'rgba(52,211,153,0.35)' : 'var(--violet-border)'}`,
            }}>
            {hasStarted ? 'Running' : 'Awaiting Check-in'}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="md" />
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {booking.services.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md"
                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <img src={s.image || '/placeholder-service.png'} className="w-4 h-4 rounded-sm object-cover" />
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--violet-light)' }}>{s.name}</span>
                  </div>
                ))}
              </div>
              {booking.customer.phone && (
                <a href={`tel:${booking.customer.phone}`} className="flex items-center gap-1 mt-2 text-[12px]"
                  style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
                  <Phone size={11} /> {booking.customer.phone}
                </a>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="font-syne font-bold text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>
                Q-{booking.queue_number}
              </span>
              <p className="font-syne font-bold text-[12px] mt-2" style={{ color: 'var(--violet-light)' }}>#{booking.booking_number}</p>
            </div>
          </div>

          {hasStarted && booking.service_started_at && (
            <div className="mb-5 p-4 rounded-[14px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-syne font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Live Timer</p>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-3)' }}>
                  <Clock size={10} /> Started {fmtTime(booking.service_started_at)}
                </div>
              </div>
              <ServiceTimer startedAt={booking.service_started_at} estimatedMin={booking.estimated_duration} serverOffset={serverOffset} />
            </div>
          )}

          {!hasStarted && (
            <div className="mb-5 p-4 rounded-[14px] flex items-center gap-3"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}>
                <QrCode size={18} style={{ color: 'var(--violet-light)' }} />
              </div>
              <div>
                <p className="font-syne font-bold text-[13px]" style={{ color: 'var(--violet-light)' }}>Arrival window open — scan QR to start</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Window: {fmtTime(booking.arrival_window_start)} – {fmtTime(booking.arrival_window_end)}
                  &nbsp;·&nbsp;Scan by {fmtTime(booking.scan_window_end || booking.service_start_time)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 py-3 mb-4"
            style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'QUEUE',    val: `Q-${booking.queue_number}` },
              { label: 'DURATION', val: `${booking.estimated_duration} min` },
              { label: hasStarted ? 'STARTED' : 'BOOKED TIME', val: hasStarted && booking.service_started_at ? fmtTime(booking.service_started_at) : fmtTime(booking.service_start_time) },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="font-syne font-bold uppercase tracking-widest mb-1" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</p>
                <p className="font-syne font-bold" style={{ fontSize: 12, color: 'var(--text-1)' }}>{val}</p>
              </div>
            ))}
          </div>

          {!hasStarted ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onStart(booking)}
              className="w-full h-12 rounded-[10px] font-syne font-bold text-[14px] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', boxShadow: '0 0 24px rgba(124,58,237,0.4)', cursor: 'pointer' }}>
              <QrCode size={16} /> Scan QR to Start
            </motion.button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCompleteModal(true)} disabled={isActing}
                  className="h-11 rounded-[10px] font-syne font-bold text-[13px] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #059669, #34d399)', color: '#fff', border: '1px solid rgba(52,211,153,0.4)', boxShadow: '0 0 16px rgba(52,211,153,0.3)', cursor: isActing ? 'not-allowed' : 'pointer' }}>
                  {isActing ? <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> : <><CheckCircle2 size={14} /> Complete</>}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowExtend(true)} disabled={isActing}
                  className="h-11 rounded-[10px] font-syne font-bold text-[13px] flex items-center justify-center gap-2"
                  style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: isActing ? 'not-allowed' : 'pointer' }}>
                  <AlarmClock size={14} /> Extend
                </motion.button>
              </div>
              {booking.service_started_at && (
                <OverrunPanel startedAt={booking.service_started_at} estimatedMin={booking.estimated_duration}
                  serverOffset={serverOffset} onExtend={() => setShowExtend(true)}
                  onComplete={() => setShowCompleteModal(true)} isActing={isActing} />
              )}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showExtend && (
          <ExtendModal isLoading={isActing} onClose={() => setShowExtend(false)}
            onApply={m => { onExtend(m); setShowExtend(false) }} />
        )}
        {showCompleteModal && (
          <CompleteServiceModal booking={booking} onClose={() => setShowCompleteModal(false)}
            onConfirm={() => { setShowCompleteModal(false); onComplete() }} isLoading={isActing} />
        )}
      </AnimatePresence>
    </>
  )
}

function QueueCard({ booking, rank, onStart, hasQrRunning, nowMs }: {
  booking: QueueBooking; rank: number; onStart: (b: QueueBooking) => void
  hasQrRunning: boolean; nowMs: number
}) {
  const arrivalOpenMs = new Date(booking.arrival_window_start).getTime()
  const scanEndMs     = new Date(booking.scan_window_end || booking.service_start_time).getTime()
  const arrivalOpen   = nowMs >= arrivalOpenMs
  const scanExpired   = nowMs > scanEndMs
  const isWaiting     = arrivalOpen && hasQrRunning && !scanExpired
  const isFirst       = rank === 0

  return (
    <motion.div layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 px-3 py-3"
        style={{
          background: isFirst
            ? scanExpired ? 'rgba(239,68,68,0.04)' : isWaiting ? 'rgba(245,158,11,0.04)' : arrivalOpen ? 'rgba(52,211,153,0.05)' : 'rgba(124,58,237,0.04)'
            : 'transparent',
          borderRadius: isFirst ? 10 : 0,
          border: isFirst
            ? `1.5px solid ${scanExpired ? 'rgba(239,68,68,0.2)' : isWaiting ? 'rgba(245,158,11,0.25)' : arrivalOpen ? 'rgba(52,211,153,0.25)' : 'rgba(124,58,237,0.18)'}`
            : 'none',
          marginBottom: isFirst ? 4 : 0,
          opacity: scanExpired ? 0.55 : 1,
        }}>
        <div className="flex-shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center font-syne font-black text-[11px]"
          style={{
            background: isFirst ? (scanExpired ? 'rgba(239,68,68,0.12)' : isWaiting ? 'rgba(245,158,11,0.15)' : arrivalOpen ? 'rgba(52,211,153,0.15)' : 'var(--violet-bg)') : 'var(--bg-surface)',
            color:      isFirst ? (scanExpired ? 'var(--red)' : isWaiting ? 'var(--yellow)' : arrivalOpen ? 'var(--green)' : 'var(--violet-light)') : 'var(--text-3)',
            border:     `1px solid ${isFirst ? (scanExpired ? 'rgba(239,68,68,0.3)' : isWaiting ? 'rgba(245,158,11,0.3)' : arrivalOpen ? 'var(--green-border)' : 'var(--violet-border)') : 'var(--border)'}`,
          }}>
          {rank + 1}
        </div>
        <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {scanExpired ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>Expired</span>
            ) : isWaiting ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.3)' }}>Waiting</span>
            ) : arrivalOpen ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>
                {isFirst ? 'Next Up' : 'Ready'}
              </span>
            ) : isFirst ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)' }}>Next Up</span>
            ) : null}
            <p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</p>
          </div>
          <div className="flex items-center gap-1 mb-0.5">
            {booking.services.slice(0, 3).map((s, i) => (
              <img key={i} src={s.image || '/placeholder-service.png'} className="w-5 h-5 rounded-md object-cover" />
            ))}
          </div>
          <p className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>
            {booking.services.map(s => s.name).join(', ')} · {booking.estimated_duration}m
          </p>
          <p className="text-[10px] mt-0.5"
            style={{ color: scanExpired ? 'var(--red)' : arrivalOpen ? (isWaiting ? 'var(--yellow)' : 'var(--green)') : 'var(--text-3)' }}>
            {scanExpired
              ? '⛔ Scan window closed — marking No Show'
              : isWaiting
              ? `⏳ Waiting · Window: ${fmtTime(booking.arrival_window_start)} – ${fmtTime(booking.arrival_window_end)}`
              : arrivalOpen
              ? '✓ Arrival window open'
              : `Window: ${fmtTime(booking.arrival_window_start)} – ${fmtTime(booking.arrival_window_end)}`}
          </p>
        </div>
        <div className="flex-shrink-0 text-right hidden sm:block" style={{ minWidth: 68 }}>
          <span className="text-[9px] font-syne font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Booked</span>
          <p className="text-[11px] font-bold" style={{ color: 'var(--text-2)' }}>{fmtTime(booking.service_start_time)}</p>
          <p className="text-[9px]" style={{ color: 'var(--text-3)' }}>Q-{booking.queue_number}</p>
        </div>
        {scanExpired ? (
          <motion.button disabled
            className="flex-shrink-0 font-syne font-bold rounded-[8px] h-9 px-3 text-[11px] whitespace-nowrap"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'not-allowed' }}>
            Expired
          </motion.button>
        ) : arrivalOpen && hasQrRunning ? (
          <div className="flex-shrink-0 font-syne font-bold rounded-[8px] h-9 px-3 text-[11px] whitespace-nowrap flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.10)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.3)' }}>
            Waiting...
          </div>
        ) : arrivalOpen && !hasQrRunning ? (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onStart(booking)}
            className="flex-shrink-0 font-syne font-bold rounded-[8px] h-9 px-3 text-[11px] whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', boxShadow: '0 0 14px rgba(124,58,237,0.35)', cursor: 'pointer' }}>
            Scan & Start
          </motion.button>
        ) : (
          <motion.button disabled
            className="flex-shrink-0 font-syne font-bold rounded-[8px] h-9 px-3 text-[11px] whitespace-nowrap"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-3)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.85 }}>
            Scheduled
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

function CompletedRow({ booking, rank }: { booking: QueueBooking; rank: number }) {
  const startedAt = booking.service_started_at
  const endedAt   = booking.service_completed_at
  let takenMin: number | null = null
  if (startedAt && endedAt)
    takenMin = Math.ceil((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  const actualMin = booking.actual_duration ?? takenMin
  const onTime    = actualMin !== null ? actualMin <= booking.estimated_duration + 2 : true

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.04 }}
      className="rounded-[14px] p-4 mb-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-syne font-bold text-[13px] truncate" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</p>
          <div className="flex items-center gap-1 mt-1">
            {booking.services.slice(0, 3).map((s, i) => (
              <img key={i} src={s.image || '/placeholder-service.png'} alt={s.name} className="w-5 h-5 rounded-md object-cover" />
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Q-{booking.queue_number}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>Done</span>
        {actualMin !== null && (
          <span className="text-[11px] font-bold ml-1" style={{ color: onTime ? 'var(--green)' : 'var(--red)' }}>{actualMin}m</span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        {booking.services.map((s, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-[8px]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <img src={s.image || '/placeholder-service.png'} alt={s.name} className="w-7 h-7 rounded-[6px] object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-service.png' }} />
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-2)' }}>{s.name}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 text-center pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        {[
          { label: 'Started',   val: startedAt ? fmtTime(startedAt) : '—', color: 'var(--text-2)' },
          { label: 'Completed', val: endedAt   ? fmtTime(endedAt)   : '—', color: 'var(--green)' },
          { label: 'Actual',    val: actualMin !== null ? `${actualMin} min` : '—', color: onTime ? 'var(--green)' : 'var(--red)' },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
            <p className="text-[12px] font-bold" style={{ color }}>{val}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function StatCard({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; bg: string
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="q-card p-3 sm:p-4 flex items-center gap-3"
      style={{ borderColor: `${color}22`, background: `linear-gradient(135deg, ${color}06, var(--bg-card))` }}>
      <div className="p-2 sm:p-2.5 rounded-[12px] flex-shrink-0" style={{ background: bg, boxShadow: `0 0 16px ${color}25` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="font-syne font-bold uppercase tracking-widest" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</p>
        <p className="font-syne font-black leading-tight" style={{ fontSize: 20, color }}>{value}</p>
        {sub && <p style={{ fontSize: 10, color: 'var(--text-3)' }} className="truncate">{sub}</p>}
      </div>
    </motion.div>
  )
}

function UpcomingQueueCard({ bookings, hasQrRunning, onStart, nowMs }: {
  bookings: QueueBooking[]; hasQrRunning: boolean; onStart: (b: QueueBooking) => void; nowMs: number
}) {
  return (
    <div className="q-card queue-upcoming-card overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: 'var(--blue)' }} />
          <p className="font-syne font-black uppercase tracking-widest text-[11px]" style={{ color: 'var(--text-2)' }}>Upcoming Queue</p>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(96,165,250,0.15)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.3)' }}>
          {bookings.length}
        </span>
      </div>
      {bookings.length > 0 && (
        <div className="px-4 py-2" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            {hasQrRunning
              ? '⏳ Service in progress — next scan enabled after completion'
              : ''}
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 200 }}>
        {bookings.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {bookings.map((b, i) => (
              <QueueCard key={b.id} booking={b} rank={i} hasQrRunning={hasQrRunning} onStart={onStart} nowMs={nowMs} />
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}>
              <Users size={20} style={{ color: 'var(--blue)' }} />
            </div>
            <p className="font-syne font-bold text-[14px]" style={{ color: 'var(--text-2)' }}>Queue is Empty</p>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>No upcoming bookings</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadgeV2({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'green' | 'violet' | 'blue' | 'yellow' | 'red' }) {
  const tones = {
    green:  { bg: 'rgba(52,211,153,0.12)', color: 'var(--green)', border: 'rgba(52,211,153,0.28)' },
    violet: { bg: 'var(--violet-bg)', color: 'var(--violet-light)', border: 'var(--violet-border)' },
    blue:   { bg: 'rgba(96,165,250,0.12)', color: 'var(--blue)', border: 'rgba(96,165,250,0.28)' },
    yellow: { bg: 'rgba(245,158,11,0.12)', color: 'var(--yellow)', border: 'rgba(245,158,11,0.28)' },
    red:    { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: 'rgba(239,68,68,0.28)' },
  }[tone]

  return (
    <span className="inline-flex h-7 items-center justify-center rounded-full px-3 text-[11px] font-bold"
      style={{ background: tones.bg, color: tones.color, border: `1px solid ${tones.border}` }}>
      {children}
    </span>
  )
}

function SectionHeaderV2({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-syne text-[13px] font-black uppercase tracking-widest" style={{ color: 'var(--text-2)' }}>{title}</h2>
      </div>
      {typeof count === 'number' && <StatusBadgeV2 tone="blue">{count}</StatusBadgeV2>}
    </div>
  )
}

function StatCardV2({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; bg: string
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="q-card rounded-2xl p-2.5 sm:p-5 min-h-[88px] sm:min-h-[116px] grid grid-cols-1 sm:grid-cols-[auto_1fr] items-center justify-items-center sm:justify-items-start gap-2 sm:gap-4 text-center sm:text-left"
      style={{ borderColor: `${color}24`, background: `linear-gradient(135deg, ${color}07, var(--bg-card))` }}>
      <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-syne text-[8px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</p>
        <p className="font-syne text-[20px] sm:text-[26px] font-black leading-none" style={{ color }}>{value}</p>
        {sub && <p className="mt-1 hidden truncate text-[12px] sm:block" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
    </motion.div>
  )
}

function EmptyRunningCardV2() {
  return (
    <div className="q-card rounded-2xl p-5 sm:p-6 min-h-[330px] lg:h-[360px]">
      <SectionHeaderV2 icon={<Activity size={16} style={{ color: 'var(--green)' }} />} title="Running Service" />
      <div className="grid h-[260px] lg:h-[290px] place-items-center py-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.24)' }}>
            <Activity size={22} style={{ color: 'var(--green)' }} />
          </div>
          <p className="font-syne text-[16px] font-bold" style={{ color: 'var(--text-2)' }}>No Active Service</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-3)' }}>Waiting for next booking window</p>
        </div>
      </div>
    </div>
  )
}

function CompleteServiceModalV2({ booking, onClose, onConfirm, isLoading }: {
  booking: QueueBooking; onClose: () => void; onConfirm: () => void; isLoading: boolean
}) {
  const [elapsed, setElapsed] = useState(0)
  const startedAt = booking.service_started_at

  useEffect(() => {
    if (!startedAt) return
    const origin = new Date(startedAt).getTime()
    let rafId: number
    let lastSec = -1
    const loop = () => {
      const val = Math.max(0, Math.floor((Date.now() - origin) / 1000))
      if (val !== lastSec) {
        lastSec = val
        setElapsed(val)
      }
      rafId = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafId)
  }, [startedAt])

  const estimatedSec = booking.estimated_duration * 60
  const diff = elapsed - estimatedSec
  const pct = Math.min(100, (elapsed / Math.max(estimatedSec, 1)) * 100)
  const completedAt = new Date().toISOString()

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className="relative z-10 w-full max-w-lg rounded-2xl p-5 sm:p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(52,211,153,0.28)', boxShadow: '0 24px 80px rgba(0,0,0,0.36)' }}>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.32)' }}>
            <CheckCircle2 size={30} style={{ color: 'var(--green)' }} />
          </div>
          <h3 className="font-syne text-[22px] font-black" style={{ color: 'var(--text-1)' }}>Complete Service?</h3>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="sm" />
            <p className="font-syne text-[15px] font-bold" style={{ color: 'var(--text-2)' }}>{booking.customer.name}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCardV2 label="Actual Time" value={fmtMMSS(elapsed)} />
          <MetricCardV2 label="Estimated Time" value={`${booking.estimated_duration} min`} />
          <MetricCardV2 label="Difference" value={diff <= 0 ? `-${fmtMMSS(Math.abs(diff))}` : `+${fmtMMSS(diff)}`} />
        </div>

        <div className="mt-5 rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlockV2 label="Started At" value={startedAt ? fmtTime(startedAt) : '-'} />
            <InfoBlockV2 label="Completed At" value={fmtTime(completedAt)} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #059669, #34d399)' }}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 2 }} />
          <p className="text-[13px]" style={{ color: 'var(--yellow)' }}>Completing this service will activate the next customer in queue.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button onClick={onClose} className="h-12 rounded-2xl font-syne text-[14px] font-bold"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <motion.button whileTap={{ scale: 0.98 }} onClick={onConfirm} disabled={isLoading}
            className="h-12 rounded-2xl font-syne text-[14px] font-bold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #059669, #34d399)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {isLoading ? <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin border-white" /> : <><CheckCircle2 size={16} /> Complete Service</>}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

function RunningCardV2({ booking, onComplete, onExtend, isActing, serverOffset, onStart }: {
  booking: QueueBooking; onComplete: () => void; onExtend: (m: number) => void
  isActing: boolean; serverOffset: number; onStart: (b: QueueBooking) => void
}) {
  const [showExtend, setShowExtend]               = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const hasStarted = !!booking.service_started_at
  const startedAt  = booking.service_started_at

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="q-card rounded-2xl overflow-hidden min-h-[330px] lg:h-[360px]"
        style={{ borderColor: hasStarted ? 'rgba(52,211,153,0.32)' : 'rgba(124,58,237,0.36)' }}>
        <div className="grid h-full content-start gap-5 p-4 sm:p-6">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="md" />
            <div className="min-w-0">
              <p className="font-syne text-[17px] font-bold truncate" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</p>
              {booking.customer.phone && (
                <a href={`tel:${booking.customer.phone}`} className="mt-1 inline-flex items-center gap-1 text-[12px]"
                  style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
                  <Phone size={12} /> {booking.customer.phone}
                </a>
              )}
            </div>
            <StatusBadgeV2 tone={hasStarted ? 'green' : 'violet'}>{hasStarted ? 'Running' : 'Awaiting Check-In'}</StatusBadgeV2>
          </div>

          {!hasStarted ? (
            <div className="grid gap-5">
              <div className="grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-[1fr_auto]"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.22)' }}>
                <div>
                  <p className="font-syne text-[16px] font-black" style={{ color: 'var(--violet-light)' }}>Arrival Window Open</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoBlockV2 label="Window" value={`${fmtTime(booking.arrival_window_start)} - ${fmtTime(booking.arrival_window_end)}`} />
                    <InfoBlockV2 label="Start Time" value={fmtTime(booking.service_start_time)} />
                  </div>
                </div>
                <div className="rounded-2xl px-5 py-4 text-left sm:text-right" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Queue</p>
                  <p className="font-syne text-[28px] font-black leading-none" style={{ color: 'var(--violet-light)' }}>#{booking.queue_number}</p>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => onStart(booking)}
                className="h-14 w-full rounded-2xl font-syne text-[15px] font-black flex items-center justify-center gap-3"
                style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <QrCode size={18} /> Scan QR
              </motion.button>
            </div>
          ) : startedAt ? (
            <div className="grid gap-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricCardV2 label="Queue Number" value={`#${booking.queue_number}`} />
                <MetricCardV2 label="Duration" value={`${booking.estimated_duration} min`} />
                <MetricCardV2 label="Started Time" value={fmtTime(startedAt)} />
              </div>
              <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <ServiceTimer startedAt={startedAt} estimatedMin={booking.estimated_duration} serverOffset={serverOffset} />
              </div>
              <OverrunPanel startedAt={startedAt} estimatedMin={booking.estimated_duration} serverOffset={serverOffset}
                onExtend={() => setShowExtend(true)} onComplete={() => setShowCompleteModal(true)} isActing={isActing} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowCompleteModal(true)} disabled={isActing}
                  className="h-12 rounded-2xl font-syne text-[14px] font-bold flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #059669, #34d399)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  <CheckCircle2 size={16} /> Complete
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowExtend(true)} disabled={isActing}
                  className="h-12 rounded-2xl font-syne text-[14px] font-bold flex items-center justify-center gap-2"
                  style={{ background: 'var(--violet-bg)', color: 'var(--violet-light)', border: '1px solid var(--violet-border)', cursor: 'pointer' }}>
                  <AlarmClock size={16} /> Extend
                </motion.button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>

      <AnimatePresence>
        {showCompleteModal && (
          <CompleteServiceModalV2 booking={booking} onClose={() => setShowCompleteModal(false)}
            onConfirm={() => { setShowCompleteModal(false); onComplete() }} isLoading={isActing} />
        )}
        {showExtend && (
          <ExtendModal onClose={() => setShowExtend(false)}
            onApply={m => { setShowExtend(false); onExtend(m) }} isLoading={isActing} />
        )}
      </AnimatePresence>
    </>
  )
}

function InfoBlockV2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="mt-1 font-semibold" style={{ color: 'var(--text-2)' }}>{value}</p>
    </div>
  )
}

function MetricCardV2({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="mt-2 font-syne text-[18px] font-black" style={{ color: 'var(--text-1)' }}>{value}</p>
    </div>
  )
}

function UpcomingBookingCardV2({ booking, hasQrRunning, onStart, nowMs, rank }: {
  booking: QueueBooking; hasQrRunning: boolean; onStart: (b: QueueBooking) => void; nowMs: number; rank: number
}) {
  const arrivalOpenMs = new Date(booking.arrival_window_start).getTime()
  const scanEndMs     = new Date(booking.scan_window_end || booking.service_start_time).getTime()
  const arrivalOpen   = nowMs >= arrivalOpenMs
  const scanExpired   = nowMs > scanEndMs
  const badgeTone     = scanExpired ? 'red' : arrivalOpen ? 'violet' : 'green'
  const badgeText     = scanExpired ? 'Expired' : arrivalOpen ? 'Awaiting Check-In' : 'Confirmed'

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.04 }}
      className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="grid gap-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="sm" />
          <p className="min-w-0 truncate font-syne text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</p>
          <StatusBadgeV2 tone={badgeTone}>{badgeText}</StatusBadgeV2>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Queue</p>
          <p className="mt-1 font-syne text-[30px] font-black leading-none" style={{ color: 'var(--violet-light)' }}>#{booking.queue_number}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoBlockV2 label="Arrival Window" value={`${fmtTime(booking.arrival_window_start)} - ${fmtTime(booking.arrival_window_end)}`} />
          <InfoBlockV2 label="Start Time" value={fmtTime(booking.service_start_time)} />
        </div>
        {arrivalOpen && !scanExpired && !hasQrRunning && (
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => onStart(booking)}
            className="h-11 rounded-2xl font-syne text-[13px] font-bold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <QrCode size={15} /> Scan QR
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

function UpcomingQueueCardV2({ bookings, hasQrRunning, onStart, nowMs, onViewAll }: {
  bookings: QueueBooking[]; hasQrRunning: boolean; onStart: (b: QueueBooking) => void; nowMs: number; onViewAll: () => void
}) {
  const visible = bookings.slice(0, 3)

  return (
    <section className="q-card rounded-2xl p-4 sm:p-6 min-h-[330px] lg:h-[360px] flex flex-col">
      <SectionHeaderV2 icon={<Clock size={16} style={{ color: 'var(--blue)' }} />} title="Upcoming Queue" count={bookings.length} />
      <div className="mt-5 grid flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 lg:grid-cols-1">
        {visible.length > 0 ? (
          visible.map((booking, index) => (
            <UpcomingBookingCardV2 key={booking.id} booking={booking} hasQrRunning={hasQrRunning}
              onStart={onStart} nowMs={nowMs} rank={index} />
          ))
        ) : (
          <div className="md:col-span-2 lg:col-span-1 grid min-h-[210px] place-items-center rounded-2xl text-center">
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.24)' }}>
                <Users size={22} style={{ color: 'var(--blue)' }} />
              </div>
              <p className="font-syne text-[15px] font-bold" style={{ color: 'var(--text-2)' }}>Queue is Empty</p>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>No upcoming bookings</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-center">
        <button type="button" onClick={onViewAll}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-5 font-syne text-[13px] font-bold sm:w-auto"
          style={{ background: 'linear-gradient(135deg, var(--violet), #6366f1)', color: '#fff', border: 'none', boxShadow: '0 12px 28px rgba(124,58,237,0.24)', cursor: 'pointer' }}>
          View All Upcoming Bookings <ArrowRight size={15} />
        </button>
      </div>
    </section>
  )
}

function CompletedTodayPanelV2({ bookings, onViewAll }: { bookings: QueueBooking[]; onViewAll: () => void }) {
  const visible = bookings.slice(0, 3)

  return (
    <section className="q-card rounded-2xl p-4 sm:p-6 min-h-[300px]">
      <SectionHeaderV2 icon={<CheckCircle2 size={16} style={{ color: 'var(--green)' }} />} title="Completed Today" count={bookings.length} />
      <div className="mt-5">
        {visible.length > 0 ? (
          <>
            <div className="hidden rounded-2xl md:block" style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div className="grid grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_120px_120px_120px_96px] items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-3)' }}>
                <span>Customer</span><span>Service</span><span>Started</span><span>Completed</span><span>Time Taken</span><span>Status</span>
              </div>
              {visible.map((booking, index) => <CompletedRowV2 key={booking.id} booking={booking} rank={index} />)}
            </div>
            <div className="grid gap-3 md:hidden">
              {visible.map((booking, index) => <CompletedRowV2 key={booking.id} booking={booking} rank={index} />)}
            </div>
          </>
        ) : (
          <div className="grid min-h-[150px] place-items-center rounded-2xl text-center">
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.24)' }}>
                <CalendarCheck size={22} style={{ color: 'var(--green)' }} />
              </div>
              <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>No completed services yet</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-center">
        <button type="button" onClick={onViewAll}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-5 font-syne text-[13px] font-bold sm:w-auto"
          style={{ background: 'linear-gradient(135deg, #059669, #34d399)', color: '#fff', border: 'none', boxShadow: '0 12px 28px rgba(52,211,153,0.2)', cursor: 'pointer' }}>
          View All Completed Bookings <ArrowRight size={15} />
        </button>
      </div>
    </section>
  )
}

function CompletedRowV2({ booking, rank }: { booking: QueueBooking; rank: number }) {
  const startedAt = booking.service_started_at
  const endedAt   = booking.service_completed_at
  const firstService = booking.services[0]
  let takenMin: number | null = null
  if (startedAt && endedAt) takenMin = Math.ceil((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  const actualMin = booking.actual_duration ?? takenMin

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.04 }}>
      <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_120px_120px_120px_96px] items-center gap-3 px-4 py-4 md:grid"
        style={{ borderTop: rank === 0 ? 'none' : '1px solid var(--border)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="sm" />
          <span className="truncate font-semibold" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <img src={firstService?.image || '/placeholder-service.png'} alt={firstService?.name || 'Service'} className="h-9 w-9 rounded-xl object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-service.png' }} />
          <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>{firstService?.name || 'Service'}</span>
        </div>
        <TimeCellV2 value={startedAt ? fmtTime(startedAt) : '-'} />
        <TimeCellV2 value={endedAt ? fmtTime(endedAt) : '-'} />
        <TimeCellV2 value={actualMin !== null ? `${actualMin} min` : '-'} />
        <StatusBadgeV2 tone="green">Done</StatusBadgeV2>
      </div>
      <div className="rounded-2xl p-4 md:hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={booking.customer.name} src={booking.customer.avatar_url ?? undefined} size="sm" />
            <p className="truncate font-syne text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>{booking.customer.name}</p>
          </div>
          <StatusBadgeV2 tone="green">Done</StatusBadgeV2>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Service</p>
          <div className="flex min-w-0 items-center gap-2">
          <img src={firstService?.image || '/placeholder-service.png'} alt={firstService?.name || 'Service'} className="h-10 w-10 rounded-xl object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-service.png' }} />
          <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>{firstService?.name || 'Service'}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MobileTimeStatV2 label="Started" value={startedAt ? fmtTime(startedAt) : '-'} />
          <MobileTimeStatV2 label="Completed" value={endedAt ? fmtTime(endedAt) : '-'} />
          <MobileTimeStatV2 label="Taken" value={actualMin !== null ? `${actualMin} min` : '-'} />
        </div>
      </div>
    </motion.div>
  )
}

function TimeCellV2({ value }: { value: string }) {
  return <span className="font-mono text-[13px] font-semibold" style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
}

function MobileTimeStatV2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[60px] flex-col items-center justify-center rounded-xl p-2 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="mt-1 font-mono text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

export default function StaffQueue() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  usePageTitle("Today's Queue")
  const isSocketConnected = useSocketStore(s => s.isConnected)
  const [actingId, setActingId]               = useState<string | null>(null)
  const [showRebuild, setShowRebuild]         = useState(false)
  const [scanModalOpen, setScanModalOpen]     = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<QueueBooking | null>(null)
  const [liveBookings, setLiveBookings]       = useState<QueueBooking[]>([])

  const clientNoShowIdsRef = useRef<Set<string>>(new Set())
  const [clientNoShowIds, setClientNoShowIds] = useState<Set<string>>(new Set())

  // Optimistic scan state
  const [optimisticRunningId, setOptimisticRunningId] = useState<string | null>(null)
  const [optimisticStartedAt, setOptimisticStartedAt] = useState<string | null>(null)

  // Clear optimistic scan once backend confirms service_started_at
  useEffect(() => {
    if (!optimisticRunningId) return
    const confirmed = liveBookings.some(b => b.id === optimisticRunningId && !!b.service_started_at)
    if (confirmed) {
      setOptimisticRunningId(null)
      setOptimisticStartedAt(null)
    }
  }, [liveBookings, optimisticRunningId])

  // Server clock offset
  const [serverOffset, setServerOffset] = useState(0)
  const serverOffsetRef = useRef(0)

  const REFETCH_INTERVAL = 1000

  const { data, isLoading, refetch } = useQuery<{
    running: QueueBooking[]; upcoming: QueueBooking[]; completed: QueueBooking[]
    served_today: number; staff_id: string; server_now: string
  }>({
    queryKey: ['staff-queue'],
    queryFn:  async () => {
      const r = await api.get('/staff/queue/today')
      return r.data.data
    },
    staleTime:                   0,
    refetchInterval:             REFETCH_INTERVAL,  // ← FIXED: always 1s
    refetchIntervalInBackground: true,
    refetchOnWindowFocus:        true,
  })

  // Clock offset: EWMA smoothed (alpha=0.3)
  useEffect(() => {
    if (!data?.server_now) return
    const tRecv       = Date.now()
    const serverNowMs = new Date(data.server_now).getTime()
    const rawOffset   = tRecv - serverNowMs
    const prev        = serverOffsetRef.current
    const newOffset   = prev === 0 ? rawOffset : Math.round(0.7 * prev + 0.3 * rawOffset)
    serverOffsetRef.current = newOffset
    setServerOffset(newOffset)
  }, [data?.server_now])

  useEffect(() => {
    if (!data) return

    const rawBookings = [
      ...(data.running ?? []),
      ...(data.upcoming ?? []),
      ...(data.completed ?? []),
    ]

    const currentClientNoShows = clientNoShowIdsRef.current
    const newClientNoShows = new Set<string>()

    for (const id of currentClientNoShows) {
      // Check if backend has confirmed this booking as NO_SHOW or it's gone from the response
      const inResponse = rawBookings.find(b => b.id === id)
      if (inResponse && inResponse.status !== 'NO_SHOW') {
        // Backend hasn't confirmed yet — keep the override
        newClientNoShows.add(id)
      }
      // If not in response (removed from running/upcoming) or status=NO_SHOW, drop from tracking
    }

    clientNoShowIdsRef.current = newClientNoShows
    setClientNoShowIds(new Set(newClientNoShows))
    setLiveBookings(rawBookings)
  }, [data])

  const {
    allRunning,
    allCompleted,
    hasQrRunning,
    activeBooking,
    visibleUpcoming,
    nowMs,
    qrRunningCount,
    clientNoShowThisTick,
  } = useActiveQueue(liveBookings, serverOffset, optimisticRunningId, optimisticStartedAt, clientNoShowIds)

  useEffect(() => {
    if (clientNoShowThisTick.size === 0) return
    let changed = false
    const next = new Set(clientNoShowIdsRef.current)
    for (const id of clientNoShowThisTick) {
      if (!next.has(id)) { next.add(id); changed = true }
    }
    if (changed) {
      clientNoShowIdsRef.current = next
      setClientNoShowIds(new Set(next))
    }
  }, [clientNoShowThisTick])


  useSocketEvent('queue:updated',        () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))
  useSocketEvent('booking:updated',      () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))
  useSocketEvent('service:overrun',      () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))
  useSocketEvent('booking:time_updated', () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))
  useSocketEvent('queue:extended', () => {
    queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
    queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] })
  })
  useSocketEvent('service:delayed',   () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))
  useSocketEvent('service:started',   () => {
    queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
    setScanModalOpen(false); setSelectedBooking(null)
  })
  useSocketEvent('service:completed', () => {
    queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
    queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] })
  })
  useSocketEvent('booking:confirmed', () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))
  useSocketEvent('booking:cancelled', () => {
    queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
    queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] })
  })
  useSocketEvent('booking:no_show',   () => queryClient.invalidateQueries({ queryKey: ['staff-queue'] }))

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post('/staff/queue/complete', { booking_id: id }),
    onSuccess:  () => {
      toast.success('✅ Service completed!')
      queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] })
      refetch()
    },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to complete'),
    onSettled: () => setActingId(null),
  })

  const extraMinRef = useRef(0)
  const extendMutation = useMutation({
    mutationFn: ({ id, extra }: { id: string; extra: number }) =>
      api.post('/staff/queue/extend', { booking_id: id, extra_minutes: extra }),
    onSuccess: () => {
      toast.success(`+${extraMinRef.current}m extended. Affected bookings notified.`)
      queryClient.invalidateQueries({ queryKey: ['staff-queue'] })
      refetch()
    },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Extend failed'),
    onSettled: () => setActingId(null),
  })

  const rebuildMutation = useMutation({
    mutationFn: () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      return api.post('/staff/queue/rebuild', { date: today })
    },
    onSuccess: () => { toast.success('Queue rebuilt'); refetch(); setShowRebuild(false) },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Rebuild failed'),
  })

  const openScan  = (booking: QueueBooking) => { setSelectedBooking(booking); setScanModalOpen(true) }
  const closeScan = () => { setScanModalOpen(false); setSelectedBooking(null) }
  const goToBookingsTab = (status: 'upcoming' | 'completed') => navigate(`/staff/bookings?status=${status}`)

  if (isLoading) {
    return (
      <div className="grid w-full gap-4 px-4 py-5 sm:gap-6 md:px-6 lg:px-8">
        <div className="grid grid-cols-[1fr_auto] items-start gap-4">
          <div>
            <div className="skeleton h-9 w-36 rounded-xl" />
            <div className="skeleton mt-3 h-4 w-56 rounded-lg" />
          </div>
          <div className="skeleton h-9 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          {[1, 2, 3].map(i => <div key={i} className="q-card min-h-[88px] sm:min-h-[116px] rounded-2xl skeleton" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(340px,0.95fr)]">
          <div className="q-card min-h-[330px] lg:h-[360px] rounded-2xl skeleton" />
          <div className="q-card min-h-[330px] lg:h-[360px] rounded-2xl skeleton" />
        </div>
        <div className="q-card min-h-[300px] rounded-2xl skeleton" />
      </div>
    )
  }

  return (
    <div className="grid w-full gap-4 px-4 py-5 sm:gap-6 md:px-6 lg:px-8">
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        <div>
          <h1 className="q-page-title" style={{ color: 'var(--text-1)' }}>Queue</h1>
          <p className="q-page-description" style={{ color: 'var(--text-3)' }}>Real-time · QR scan starts service</p>
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: isSocketConnected ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${isSocketConnected ? 'var(--green-border)' : 'rgba(239,68,68,0.3)'}` }}>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="h-2 w-2 rounded-full" style={{ background: isSocketConnected ? 'var(--green)' : 'var(--red)' }} />
          <span className="font-syne text-[11px] font-bold" style={{ color: isSocketConnected ? 'var(--green)' : 'var(--red)' }}>
            {isSocketConnected ? 'Live' : 'Offline'}
          </span>
          <span className="hidden font-mono text-[10px] sm:inline" style={{ color: 'var(--text-3)' }}>
            · {new Date(nowMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        <StatCardV2 icon={<Activity size={18} />} label="Running" value={qrRunningCount}
          sub={hasQrRunning ? 'In progress' : activeBooking ? 'Awaiting scan' : 'None active'}
          color="var(--green)" bg="rgba(52,211,153,0.12)" />
        <StatCardV2 icon={<Users size={18} />} label="Waiting" value={visibleUpcoming.length}
          sub={visibleUpcoming.length > 0 ? 'In queue' : 'Empty'} color="var(--blue)" bg="var(--blue-bg)" />
        <StatCardV2 icon={<TrendingUp size={18} />} label="Served" value={data?.served_today ?? 0}
          sub="Today" color="var(--violet-light)" bg="var(--violet-bg)" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(340px,0.95fr)]">
        <section className="min-w-0">
          {activeBooking ? (
            <AnimatePresence mode="popLayout">
              <RunningCardV2
                key={activeBooking.id}
                booking={activeBooking}
                serverOffset={serverOffset}
                isActing={actingId === activeBooking.id}
                onComplete={() => { setActingId(activeBooking.id); completeMutation.mutate(activeBooking.id) }}
                onExtend={m => {
                  setActingId(activeBooking.id)
                  extraMinRef.current = m
                  extendMutation.mutate({ id: activeBooking.id, extra: m })
                }}
                onStart={openScan}
              />
            </AnimatePresence>
          ) : (
            <EmptyRunningCardV2 />
          )}
        </section>

        <UpcomingQueueCardV2 bookings={visibleUpcoming} hasQrRunning={hasQrRunning} onStart={openScan} nowMs={nowMs}
          onViewAll={() => goToBookingsTab('upcoming')} />
      </div>

      <CompletedTodayPanelV2 bookings={allCompleted} onViewAll={() => goToBookingsTab('completed')} />

      <ConfirmDialog open={showRebuild} title="Rebuild queue?"
        description="Recalculates all queue positions from the database. Use only if the queue appears broken."
        confirmLabel="Rebuild" danger loading={rebuildMutation.isPending}
        onCancel={() => setShowRebuild(false)} onConfirm={() => rebuildMutation.mutate()} />

      <AnimatePresence>
        {scanModalOpen && selectedBooking && (
          <ScanModal
            booking={selectedBooking}
            queryClient={queryClient}
            onClose={closeScan}
            onOptimisticStart={(bookingId, startedAt) => {
              setOptimisticRunningId(bookingId)
              setOptimisticStartedAt(startedAt)
            }}
            onSuccess={async () => {
              closeScan()
              await refetch()
              queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )

 
}

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Navigation, ExternalLink, MapPin, Copy, Check } from 'lucide-react'

interface MapModalProps {
  open: boolean
  onClose: () => void
  businessName: string
  address: string
  city: string
  state: string
  mapLink?: string
  lat?: number
  lng?: number
}

declare global {
  interface Window {
    
    L: any
  }
}

export function MapModal({ open, onClose, businessName, address, city, state, mapLink, lat, lng }: MapModalProps) {
  const mapRef    = useRef<HTMLDivElement>(null)
  
  const mapObjRef = useRef<any>(null)
  const [copied,  setCopied]  = useState(false)
  const [leafletReady, setLeafletReady] = useState(false)

  const fullAddress = [address, city, state].filter(Boolean).join(', ')

  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(
    lat && lng ? { lat, lng } : null
  )
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.L) { setLeafletReady(true); return }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setLeafletReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!open || coords || geocoding) return
    setGeocoding(true)
    const query = encodeURIComponent(`${address}, ${city}, ${state}, India`)
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) {
          setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        }
      })
      .catch(() => {})
      .finally(() => setGeocoding(false))
  }, [open, address, city, state, coords, geocoding])

  useEffect(() => {
    if (!open || !leafletReady || !coords || !mapRef.current) return

    const L = window.L
    if (!L) return

    if (mapObjRef.current) {
      mapObjRef.current.remove()
      mapObjRef.current = null
    }

    setTimeout(() => {
      if (!mapRef.current) return
      const map = L.map(mapRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        html: `<div style="
          width:36px;height:36px;
          background:linear-gradient(135deg,#7c3aed,#6366f1);
          border-radius:50% 50% 50% 4px;
          transform:rotate(-45deg);
          border:3px solid #fff;
          box-shadow:0 4px 12px rgba(124,58,237,0.5);
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:14px;">✂️</span>
        </div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      })

      const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(map)
      marker.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;min-width:140px;">
          <strong style="font-size:13px;">${businessName}</strong><br/>
          <span style="font-size:11px;color:#666;">${fullAddress}</span>
        </div>
      `).openPopup()

      mapObjRef.current = map

      // Fix gray tiles bug
      setTimeout(() => map.invalidateSize(), 100)
    }, 50)

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove()
        mapObjRef.current = null
      }
    }
  }, [open, leafletReady, coords, businessName, fullAddress])

  const openInMaps = () => {
    if (mapLink) { window.open(mapLink, '_blank'); return }
    if (coords) {
      window.open(`https://www.google.com/maps?q=${coords.lat},${coords.lng}`, '_blank')
      return
    }
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`, '_blank')
  }

  const openDirections = () => {
    if (coords) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank')
      return
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`, '_blank')
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-lg z-10 overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--violet-bg)' }}>
                  <MapPin size={16} style={{ color: 'var(--violet-light)' }} />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
                    {businessName}
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{fullAddress}</p>
                </div>
              </div>
              <button type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full ml-2 flex-shrink-0"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Map container */}
            <div className="relative mx-4 mb-3 rounded-[12px] overflow-hidden" style={{ height: 280 }}>
              {(geocoding || !coords) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
                  style={{ background: 'var(--bg-surface)' }}>
                  {geocoding ? (
                    <>
                      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-2"
                        style={{ borderColor: 'var(--violet-light)', borderTopColor: 'transparent' }} />
                      <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Finding location…</p>
                    </>
                  ) : (
                    <>
                      <MapPin size={32} style={{ color: 'var(--text-4)', marginBottom: 8 }} />
                      <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Location not available</p>
                      <p className="text-[11px] mt-1 text-center px-8" style={{ color: 'var(--text-4)' }}>
                        {fullAddress}
                      </p>
                    </>
                  )}
                </div>
              )}
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 px-4 pb-4">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={openDirections}
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-[10px] transition-all"
                style={{ background: 'var(--violet-bg)', border: '1px solid var(--violet-border)' }}
              >
                <Navigation size={15} style={{ color: 'var(--violet-light)' }} />
                <span className="text-[10px] font-syne font-bold" style={{ color: 'var(--violet-light)' }}>
                  Directions
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={openInMaps}
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-[10px] transition-all"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <ExternalLink size={15} style={{ color: 'var(--text-2)' }} />
                <span className="text-[10px] font-syne font-bold" style={{ color: 'var(--text-2)' }}>
                  Open Maps
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={copyAddress}
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-[10px] transition-all"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                {copied
                  ? <Check size={15} style={{ color: 'var(--green)' }} />
                  : <Copy size={15} style={{ color: 'var(--text-2)' }} />
                }
                <span className="text-[10px] font-syne font-bold" style={{ color: copied ? 'var(--green)' : 'var(--text-2)' }}>
                  {copied ? 'Copied!' : 'Copy'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

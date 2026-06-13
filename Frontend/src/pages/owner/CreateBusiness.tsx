import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, ChevronLeft, ChevronRight, Check, Plus, Trash2, Upload,
  ImageIcon, Calendar, Tag, Loader2, X, Phone, Globe, Instagram,
  Facebook, MapPin, Star, Users, AlertTriangle, Pencil, Clock,
} from 'lucide-react'
import { Skeleton, ConfirmDialog } from '@/components/shared'
import { Avatar } from '@/components/shared/Avatar'
import { usePageTitle } from '@/hooks'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { INDIA_STATES_CITIES } from '@/data/india'

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'] as const
type Day = typeof DAYS[number]
const DAY_SHORT: Record<Day,string> = { MONDAY:'Mon',TUESDAY:'Tue',WEDNESDAY:'Wed',THURSDAY:'Thu',FRIDAY:'Fri',SATURDAY:'Sat',SUNDAY:'Sun' }
const DEFAULT_SCHED = DAYS.map(d => ({ day_of_week:d, is_open:d!=='SUNDAY', open_time:'09:00', close_time:'20:00' }))

function Toggle({ checked, onChange }: { checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
      style={{ background: checked ? 'var(--green)' : 'var(--border-2)', border:'none', cursor:'pointer' }}>
      <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200"
        style={{ background:'#fff', left: checked ? 'calc(100% - 18px)' : '2px', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

function FieldLabel({ label, required }: { label:string; required?:boolean }) {
  return (
    <label className="block text-[11px] font-syne font-bold mb-1.5" style={{ color:'var(--text-2)' }}>
      {label}{required && <span style={{ color:'var(--red)' }}> *</span>}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, type='text', min, max }: {
  value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; min?:string; max?:string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} max={max}
      className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
      style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
  )
}

// ── Step 1: Details ───────────────────────────────────────────────
function StepDetails({ data, onChange, errors }: { data:any; onChange:(d:any)=>void; errors:Record<string,string> }) {
  const u = (k:string,v:any) => onChange({ ...data, [k]:v })
  const states = Object.keys(INDIA_STATES_CITIES).sort()
  const cities = data.state ? (INDIA_STATES_CITIES[data.state] ?? []) : []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-syne font-black text-[18px] mb-0.5" style={{ color:'var(--text-1)' }}>Business Details</h2>
        <p className="text-[12px]" style={{ color:'var(--text-3)' }}>Fill all required fields to continue</p>
      </div>

      {/* Name + Service */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Business Name" required />
          <TextInput value={data.business_name??''} onChange={v => u('business_name',v)} placeholder="e.g. Glamour Studio" />
          {errors.business_name && <p className="text-[10px] mt-1" style={{ color:'var(--red)' }}>{errors.business_name}</p>}
        </div>
        <div>
          <FieldLabel label="Service For" required />
          <select value={data.service_for??'UNISEX'} onChange={e => u('service_for',e.target.value)}
            className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
            style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }}>
            <option value="MEN">Men</option>
            <option value="UNISEX">Unisex (Men & Women)</option>
          </select>
        </div>
      </div>

      <div>
        <FieldLabel label="Business Phone" />
        <TextInput value={data.business_phone??''} onChange={v => u('business_phone',v)} placeholder="+91 98765 43210" />
      </div>

      <div>
        <FieldLabel label="Description" />
        <textarea value={data.description??''} onChange={e => u('description',e.target.value)} rows={3}
          placeholder="Describe your salon — services, specialities, vibe…"
          className="w-full rounded-[9px] px-3 py-2.5 text-[13px] font-syne outline-none resize-none"
          style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
      </div>

      {/* Address */}
      <div className="space-y-3">
        <p className="text-[11px] font-syne font-bold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Address</p>
        <div>
          <FieldLabel label="Address Line 1" required />
          <TextInput value={data.address_line1??''} onChange={v => u('address_line1',v)} placeholder="Street, Building, Area" />
          {errors.address_line1 && <p className="text-[10px] mt-1" style={{ color:'var(--red)' }}>{errors.address_line1}</p>}
        </div>
        <div>
          <FieldLabel label="Address Line 2" />
          <TextInput value={data.address_line2??''} onChange={v => u('address_line2',v)} placeholder="Landmark (optional)" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel label="State" required />
            <select value={data.state??''} onChange={e => { u('state',e.target.value); onChange({ ...data, state:e.target.value, city:'' }) }}
              className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
              style={{ background:'var(--bg-surface)', border:`1px solid ${errors.state ? 'var(--red)' : 'var(--border)'}`, color:'var(--text-1)' }}>
              <option value="">Select State</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <p className="text-[10px] mt-1" style={{ color:'var(--red)' }}>{errors.state}</p>}
          </div>
          <div>
            <FieldLabel label="City" required />
            <select value={data.city??''} onChange={e => u('city',e.target.value)}
              className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
              style={{ background:'var(--bg-surface)', border:`1px solid ${errors.city ? 'var(--red)' : 'var(--border)'}`, color:'var(--text-1)' }}>
              <option value="">Select City</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.city && <p className="text-[10px] mt-1" style={{ color:'var(--red)' }}>{errors.city}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel label="Pincode" required />
            <TextInput value={data.pincode??''} onChange={v => u('pincode',v)} placeholder="400001" />
            {errors.pincode && <p className="text-[10px] mt-1" style={{ color:'var(--red)' }}>{errors.pincode}</p>}
          </div>
          <div>
            <FieldLabel label="Google Maps Link" />
            <TextInput value={data.map_link??''} onChange={v => u('map_link',v)} placeholder="https://maps.google.com/…" />
          </div>
        </div>
      </div>

      {/* Social */}
      <div className="space-y-3">
        <p className="text-[11px] font-syne font-bold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Social & Web (optional)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { k:'website_url',   label:'Website',   placeholder:'https://…' },
            { k:'instagram_url', label:'Instagram',  placeholder:'https://instagram.com/…' },
            { k:'facebook_url',  label:'Facebook',   placeholder:'https://facebook.com/…' },
            { k:'whatsapp_number',label:'WhatsApp',  placeholder:'10-digit number' },
          ].map(f => (
            <div key={f.k}>
              <FieldLabel label={f.label} />
              <TextInput value={(data as any)[f.k]??''} onChange={v => u(f.k,v)} placeholder={f.placeholder} />
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel label="Break Between Bookings (min)" />
          <input type="number" min={0} max={60} value={data.break_time_minutes??5} onChange={e => u('break_time_minutes',+e.target.value)}
            className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
            style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
        </div>
        <div>
          <FieldLabel label="Cancellation Window (hrs)" />
          <input type="number" min={0} max={48} value={data.cancellation_window_hours??2} onChange={e => u('cancellation_window_hours',+e.target.value)}
            className="w-full h-10 rounded-[9px] px-3 text-[13px] font-syne outline-none"
            style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
        </div>
      </div>

      {/* Logo + Cover */}
      <div>
        <p className="text-[11px] font-syne font-bold uppercase tracking-widest mb-3" style={{ color:'var(--text-3)' }}>Logo & Cover Image</p>
        <div className="grid grid-cols-2 gap-4">
          {(['logo','cover'] as const).map(field => {
            const prev = data[`_${field}Prev`] || data[field==='logo' ? 'logo_url' : 'cover_image_url']
            return (
              <div key={field}>
                <p className="text-[11px] font-syne font-bold mb-1.5 capitalize" style={{ color:'var(--text-2)' }}>{field}</p>
                <label className="flex flex-col items-center justify-center h-28 rounded-[10px] cursor-pointer overflow-hidden"
                  style={{ background:'var(--bg-surface)', border:'2px dashed var(--border-2)' }}>
                  {prev
                    ? <img src={prev} className="w-full h-full object-cover" alt="" />
                    : <div className="flex flex-col items-center gap-1.5">
                        <Upload size={20} style={{ color:'var(--text-4)' }} />
                        <span className="text-[10px] font-syne font-bold" style={{ color:'var(--text-3)' }}>Upload {field}</span>
                      </div>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return
                    onChange({ ...data, [`_${field}File`]:f, [`_${field}Prev`]:URL.createObjectURL(f) })
                  }} />
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Service Image Component ──────────────────────────────────────
function ServiceImage({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const [imgErr, setImgErr] = useState(false)
  const showImg = !!url && !imgErr
  return (
    <div className="rounded-[8px] overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: 'var(--violet-bg)', flexShrink: 0 }}>
      {showImg
        ? <img src={url!} alt={name} onError={() => setImgErr(true)} className="w-full h-full object-cover" />
        : <span style={{ fontSize: Math.round(size * 0.42) }}>✂️</span>
      }
    </div>
  )
}

// ── Step 2: Services ──────────────────────────────────────────────
function StepServices({ businessId, serviceFor, onCountChange }: {
  businessId:string|null; serviceFor:string; onCountChange:(n:number)=>void
}) {
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [selected, setSelected] = useState('')
  const [localSvcs, setLocalSvcs] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editDiscount, setEditDiscount] = useState('')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: platformSvcs, isLoading: psLoading } = useQuery({
    queryKey: ['platform-services-all'],
    queryFn: async () => {
      const r = await api.get('/owner/platform-services', { params: { is_active: true } })
      const raw = r.data.data
      return (Array.isArray(raw) ? raw : raw?.services ?? []) as any[]
    },
    staleTime: 5 * 60_000,
  })

  // ✅ FIX: correct filtering
  // UNISEX salon → show ALL services (MEN + UNISEX)
  // MEN salon    → show MEN + UNISEX services (not women-only)
  const allFiltered = (platformSvcs ?? []).filter((s:any) =>
    serviceFor === 'UNISEX'
      ? true
      : s.service_for === 'MEN' || s.service_for === 'UNISEX'
  )

  const { data: bizSvcs, refetch } = useQuery({
    queryKey: ['biz-services', businessId],
    queryFn: async () => {
      const r = await api.get(`/owner/businesses/${businessId}/services`)
      return (r.data.data ?? []) as any[]
    },
    enabled: !!businessId,
    staleTime: 60_000,
  })

  const display = businessId ? (bizSvcs ?? []) : localSvcs

  // ✅ Filter out already-added services from dropdown
  const addedPlatformIds = new Set(
    display.map((s:any) => s.platform_service_id ?? s.platform_service?.id ?? s.id)
  )
  const availableToAdd = allFiltered.filter((s:any) =>
    !addedPlatformIds.has(s.id) &&
    (search === '' || s.name.toLowerCase().includes(search.toLowerCase()))
  )

  useEffect(() => { onCountChange(display.length) }, [display.length])

  const addMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a service')
      const priceVal = parseInt(price)
      if (!priceVal || priceVal < 1) throw new Error('Enter a valid price (₹)')
      const platform = allFiltered.find((s:any) => s.id === selected)
      if (!platform) throw new Error('Service not found')
      if (businessId) {
        await api.post(`/owner/businesses/${businessId}/services`, {
          platform_service_id: selected,
          price: priceVal * 100,
          discounted_price: discount ? parseInt(discount) * 100 : undefined,
        })
        refetch()
      } else {
        setLocalSvcs(prev => [...prev, {
          platform_service_id: selected,
          platform_service: platform,
          price: priceVal,
          discounted_price: discount ? parseInt(discount) : null,
        }])
      }
      toast.success('Service added')
      setSelected(''); setPrice(''); setDiscount('')
    },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, isLocal }: { id: string; isLocal: boolean }) => {
      const p = parseInt(editPrice)
      if (!p || p < 1) throw new Error('Enter a valid price')
      if (isLocal) {
        setLocalSvcs(prev => prev.map(s =>
          (s.platform_service_id === id)
            ? { ...s, price: p, discounted_price: editDiscount ? parseInt(editDiscount) : null }
            : s
        ))
      } else {
        await api.patch(`/owner/businesses/${businessId}/services/${id}`, {
          price: p * 100,
          discounted_price: editDiscount ? parseInt(editDiscount) * 100 : null,
        })
        refetch()
      }
      setEditingId(null)
      toast.success('Price updated')
    },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'),
  })

  const removeMut = useMutation({
    mutationFn: async (svcId:string) => {
      if (businessId) {
        await api.delete(`/owner/businesses/${businessId}/services/${svcId}`)
        refetch()
      } else {
        setLocalSvcs(prev => prev.filter(s => s.platform_service_id !== svcId && s.id !== svcId))
      }
      toast.success('Removed')
    },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Cannot remove — active bookings'),
  })

  // selected service object for preview
  const selectedSvc = allFiltered.find((s:any) => s.id === selected)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-syne font-black text-[18px] mb-0.5" style={{ color:'var(--text-1)' }}>Services & Pricing</h2>
        <p className="text-[12px]" style={{ color:'var(--text-3)' }}>
          Add at least <strong>1 service</strong> — select from the list and set your price
        </p>
      </div>

      {/* Add service panel */}
      <div className="rounded-[14px] overflow-hidden" style={{ border:'1px solid var(--border)', background:'var(--bg-surface)' }}>
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-syne font-bold text-[13px] mb-1" style={{ color:'var(--text-1)' }}>Select a Service</h3>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]">🔍</span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search services…"
                className="w-full h-9 pl-9 pr-3 rounded-[9px] text-[12px] font-syne outline-none"
                style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-1)' }}
              />
            </div>
          </div>

          {psLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-[10px] animate-pulse" style={{ background:'var(--border)' }} />)}</div>
          ) : allFiltered.length === 0 ? (
            <p className="text-[12px] text-center py-4" style={{ color:'var(--text-3)' }}>No services found. Admin must create services first.</p>
          ) : availableToAdd.length === 0 && !search ? (
            <div className="flex items-center gap-2 p-3 rounded-[9px]" style={{ background:'var(--green-bg)', border:'1px solid var(--green-border)' }}>
              <Check size={13} style={{ color:'var(--green)', flexShrink:0 }} />
              <p className="text-[12px] font-syne font-bold" style={{ color:'var(--green)' }}>All available services have been added!</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {availableToAdd.length === 0 && search ? (
                <p className="text-[12px] text-center py-3" style={{ color:'var(--text-3)' }}>No services match "{search}"</p>
              ) : availableToAdd.map((s:any) => (
                <motion.div key={s.id} whileTap={{ scale:0.98 }}
                  onClick={() => setSelected(s.id === selected ? '' : s.id)}
                  className="flex items-center gap-3 p-2.5 rounded-[10px] cursor-pointer transition-all"
                  style={{
                    background: selected === s.id ? 'var(--violet-bg)' : 'var(--bg-card)',
                    border: `1px solid ${selected === s.id ? 'var(--violet-border)' : 'var(--border)'}`,
                  }}>
                  <ServiceImage url={s.image_url} name={s.name} size={38} />
                  <div className="flex-1 min-w-0">
                    <p className="font-syne font-bold text-[13px] truncate" style={{ color: selected === s.id ? 'var(--violet-light)' : 'var(--text-1)' }}>{s.name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--text-3)' }}>
                      {s.service_for === 'UNISEX' ? '👥 Unisex' : '👨 Men'}
                    </p>
                  </div>
                  {selected === s.id && <Check size={14} style={{ color:'var(--violet-light)', flexShrink:0 }} />}
                </motion.div>
              ))}
            </div>
          )}

          {selected && (
            <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
              className="mt-3 p-3 rounded-[10px] space-y-2"
              style={{ background:'var(--bg-card)', border:'1px solid var(--violet-border)' }}>
              <p className="text-[10px] font-syne font-bold uppercase tracking-wider" style={{ color:'var(--violet-light)' }}>Set Price</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] mb-1" style={{ color:'var(--text-3)' }}>Price (₹) *</p>
                  <input type="number" min={1} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 299"
                    className="w-full h-9 rounded-[8px] px-3 text-[13px] font-syne outline-none"
                    style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
                </div>
                <div>
                  <p className="text-[10px] mb-1" style={{ color:'var(--text-3)' }}>Discount (₹)</p>
                  <input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Optional"
                    className="w-full h-9 rounded-[8px] px-3 text-[13px] font-syne outline-none"
                    style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
                </div>
              </div>
              <motion.button whileTap={{ scale:0.97 }} onClick={() => addMut.mutate()}
                disabled={addMut.isPending || !price}
                className="w-full h-9 rounded-[8px] flex items-center justify-center gap-2 text-[12px] font-syne font-bold disabled:opacity-50"
                style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
                {addMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add Service
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Added services list */}
      {display.length === 0 ? (
        <div className="text-center py-8 rounded-[12px]" style={{ border:'1px dashed var(--border-2)' }}>
          <Tag size={28} style={{ color:'var(--text-4)', margin:'0 auto 8px' }} />
          <p className="text-[13px] font-syne font-bold" style={{ color:'var(--text-3)' }}>No services added yet</p>
          <p className="text-[11px] mt-1" style={{ color:'var(--text-4)' }}>At least 1 service required</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-syne font-bold uppercase tracking-wider" style={{ color:'var(--text-3)' }}>
            Added Services ({display.length})
          </p>
          <AnimatePresence>
            {display.map((s:any) => {
              const sId = s.id ?? s.platform_service_id
              const isEditingThis = editingId === sId
              const rawPrice = businessId ? s.price / 100 : s.price
              const rawDiscount = s.discounted_price ? (businessId ? s.discounted_price / 100 : s.discounted_price) : null
              const imgUrl = s.platform_service?.image_url ?? null
              const svcName = s.platform_service?.name ?? 'Service'

              return (
                <motion.div key={sId}
                  initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }}
                  className="rounded-[11px] overflow-hidden"
                  style={{ background:'var(--bg-surface)', border:`1px solid ${isEditingThis ? 'var(--violet-border)' : 'var(--border)'}` }}>
                  {/* Main row */}
                  <div className="flex items-center gap-3 p-3">
                    <ServiceImage url={imgUrl} name={svcName} size={42} />
                    <div className="flex-1 min-w-0">
                      <p className="font-syne font-bold text-[13px] truncate" style={{ color:'var(--text-1)' }}>{svcName}</p>
                      {!isEditingThis && (
                        <p className="text-[11px] mt-0.5" style={{ color:'var(--text-3)' }}>
                          {rawDiscount
                            ? <><span style={{ color:'var(--green)', fontWeight:700 }}>₹{rawDiscount.toFixed(0)}</span> <span className="line-through opacity-60">₹{rawPrice.toFixed(0)}</span></>
                            : <span style={{ color:'var(--green)', fontWeight:700 }}>₹{rawPrice.toFixed(0)}</span>
                          }
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          if (isEditingThis) { setEditingId(null) }
                          else { setEditingId(sId); setEditPrice(String(Math.round(rawPrice))); setEditDiscount(rawDiscount ? String(Math.round(rawDiscount)) : '') }
                        }}
                        className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                        style={{ background: isEditingThis ? 'var(--violet-bg)' : 'var(--bg-card)', color: isEditingThis ? 'var(--violet-light)' : 'var(--text-3)', border:`1px solid ${isEditingThis ? 'var(--violet-border)' : 'var(--border)'}`, cursor:'pointer' }}>
                        {isEditingThis ? <X size={11} /> : <Pencil size={11} />}
                      </button>
                      <button onClick={() => removeMut.mutate(sId)}
                        disabled={removeMut.isPending}
                        className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                        style={{ background:'var(--red-bg)', color:'var(--red)', border:'none', cursor:'pointer' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {/* Inline edit panel */}
                  <AnimatePresence>
                    {isEditingThis && (
                      <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                        className="overflow-hidden border-t" style={{ borderColor:'var(--violet-border)' }}>
                        <div className="p-3 space-y-2" style={{ background:'var(--violet-bg)' }}>
                          <p className="text-[10px] font-syne font-bold" style={{ color:'var(--violet-light)' }}>Edit Price</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] mb-1" style={{ color:'var(--text-3)' }}>Price (₹) *</p>
                              <input type="number" min={1} value={editPrice} onChange={e => setEditPrice(e.target.value)}
                                placeholder="Price" autoFocus
                                className="w-full h-8 rounded-[7px] px-2.5 text-[12px] font-syne outline-none"
                                style={{ background:'var(--bg-card)', border:'1px solid var(--violet-border)', color:'var(--text-1)' }} />
                            </div>
                            <div>
                              <p className="text-[10px] mb-1" style={{ color:'var(--text-3)' }}>Discount (₹)</p>
                              <input type="number" min={0} value={editDiscount} onChange={e => setEditDiscount(e.target.value)}
                                placeholder="Optional"
                                className="w-full h-8 rounded-[7px] px-2.5 text-[12px] font-syne outline-none"
                                style={{ background:'var(--bg-card)', border:'1px solid var(--violet-border)', color:'var(--text-1)' }} />
                            </div>
                          </div>
                          <button onClick={() => updateMut.mutate({ id: sId, isLocal: !businessId })}
                            disabled={updateMut.isPending}
                            className="w-full h-8 rounded-[7px] flex items-center justify-center gap-1.5 text-[12px] font-syne font-bold disabled:opacity-60"
                            style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
                            {updateMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Save Price
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ── Step 3: Schedule ──────────────────────────────────────────────
function StepSchedule({ businessId, schedule, onChange }: {
  businessId:string|null; schedule:any[]; onChange:(s:any[])=>void
}) {
  const [local, setLocal] = useState(() => {
    if (schedule.length > 0) return DAYS.map(d => {
      const ex = schedule.find((s:any) => s.day_of_week === d)
      return ex ? { day_of_week:d, is_open:ex.is_open??true, open_time:ex.open_time??'09:00', close_time:ex.close_time??'20:00' }
        : DEFAULT_SCHED.find(s => s.day_of_week === d)!
    })
    return [...DEFAULT_SCHED]
  })

  useEffect(() => { onChange(local) }, [local])

  const upd = (i:number, k:string, v:any) => setLocal(prev => { const n = [...prev]; n[i] = { ...n[i], [k]:v }; return n })

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!businessId) return
      await api.put(`/owner/businesses/${businessId}/schedule`, {
        schedules: local.map(s => ({ day_of_week:s.day_of_week, is_open:s.is_open, open_time:s.open_time, close_time:s.close_time }))
      })
    },
    onSuccess: () => toast.success('Schedule saved!'),
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-syne font-black text-[18px] mb-0.5" style={{ color:'var(--text-1)' }}>Weekly Schedule</h2>
          <p className="text-[12px]" style={{ color:'var(--text-3)' }}>Set your regular opening hours for each day</p>
        </div>
        {businessId && (
          <motion.button whileTap={{ scale:0.97 }} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="flex items-center gap-1.5 px-3 h-9 rounded-[9px] text-[12px] font-syne font-bold disabled:opacity-60"
            style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
            {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </motion.button>
        )}
      </div>

      <div className="space-y-2">
        {local.map((day, i) => (
          <div key={day.day_of_week} className="flex items-center gap-3 p-3 rounded-[10px]"
            style={{ background:'var(--bg-surface)', border:'1px solid var(--border)' }}>
            <Toggle checked={day.is_open} onChange={v => upd(i,'is_open',v)} />
            <span className="w-9 text-[12px] font-syne font-bold flex-shrink-0"
              style={{ color: day.is_open ? 'var(--text-1)' : 'var(--text-4)' }}>
              {DAY_SHORT[day.day_of_week as Day]}
            </span>
            {day.is_open ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input type="time" value={day.open_time??'09:00'} onChange={e => upd(i,'open_time',e.target.value)}
                  className="h-8 px-2 rounded-[7px] text-[12px] font-syne outline-none flex-1 min-w-0"
                  style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
                <span className="text-[11px] flex-shrink-0" style={{ color:'var(--text-3)' }}>to</span>
                <input type="time" value={day.close_time??'20:00'} onChange={e => upd(i,'close_time',e.target.value)}
                  className="h-8 px-2 rounded-[7px] text-[12px] font-syne outline-none flex-1 min-w-0"
                  style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
              </div>
            ) : (
              <span className="flex-1 text-[12px]" style={{ color:'var(--text-4)' }}>Closed</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Images ────────────────────────────────────────────────
function StepImages({ businessId, pendingFiles, onPendingChange }: {
  businessId:string|null; pendingFiles:File[]; onPendingChange:(f:File[])=>void
}) {
  const { data: savedImages, refetch } = useQuery({
    queryKey: ['biz-images', businessId],
    queryFn: async () => {
      const r = await api.get(`/owner/businesses/${businessId}`)
      return (r.data.data?.images ?? []) as any[]
    },
    enabled: !!businessId,
    staleTime: 30_000,
  })

  const uploadMut = useMutation({
    mutationFn: async (files:File[]) => {
      const fd = new FormData(); files.forEach(f => fd.append('images',f))
      await api.post(`/owner/businesses/${businessId}/images`, fd)
    },
    onSuccess: () => { toast.success('Images uploaded!'); refetch() },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (imageId:string) => api.delete(`/owner/businesses/${businessId}/images/${imageId}`),
    onSuccess: () => { toast.success('Removed'); refetch() },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const setPrimaryMut = useMutation({
    mutationFn: (imageId:string) => api.patch(`/owner/businesses/${businessId}/images/${imageId}/primary`),
    onSuccess: () => { toast.success('Primary image updated'); refetch() },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-syne font-black text-[18px] mb-0.5" style={{ color:'var(--text-1)' }}>Gallery Images</h2>
        <p className="text-[12px]" style={{ color:'var(--text-3)' }}>Upload salon photos (max 10). Click ★ to set primary.</p>
      </div>

      <label className="flex flex-col items-center justify-center h-32 rounded-[12px] cursor-pointer"
        style={{ background:'var(--bg-surface)', border:'2px dashed var(--border-2)' }}>
        {uploadMut.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin" style={{ color:'var(--violet-light)' }} />
            <span className="text-[12px]" style={{ color:'var(--text-3)' }}>Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} style={{ color:'var(--text-4)' }} />
            <span className="text-[12px] font-syne font-bold" style={{ color:'var(--text-2)' }}>Click to upload photos</span>
            <span className="text-[10px]" style={{ color:'var(--text-3)' }}>JPG, PNG, WebP · multiple OK</span>
          </div>
        )}
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (businessId) uploadMut.mutate(files)
            else onPendingChange([...pendingFiles, ...files].slice(0,10))
            e.target.value = ''
          }} />
      </label>

      {savedImages && savedImages.length > 0 && (
        <div>
          <p className="text-[11px] font-syne font-bold uppercase tracking-wider mb-2" style={{ color:'var(--text-3)' }}>
            Saved Images ({savedImages.length}/10)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {savedImages.map((img:any) => (
              <div key={img.id} className="relative aspect-square rounded-[10px] overflow-hidden"
                style={{ border:`2px solid ${img.is_primary ? 'var(--violet)' : 'var(--border)'}` }}>
                <img src={img.image_url} className="w-full h-full object-cover" alt="" />
                {img.is_primary && (
                  <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center"
                    style={{ background:'var(--violet)', fontSize:8, color:'#fff', fontFamily:'Syne,sans-serif', fontWeight:700 }}>
                    PRIMARY
                  </div>
                )}
                <div className="absolute top-1 right-1 flex flex-col gap-1">
                  {!img.is_primary && (
                    <button onClick={() => setPrimaryMut.mutate(img.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background:'rgba(124,58,237,0.85)', border:'none', cursor:'pointer' }}>
                      <Star size={9} color="#fff" />
                    </button>
                  )}
                  <button onClick={() => deleteMut.mutate(img.id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background:'rgba(0,0,0,0.7)', border:'none', cursor:'pointer' }}>
                    <X size={9} color="#fff" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div>
          <p className="text-[11px] font-syne font-bold uppercase tracking-wider mb-2" style={{ color:'var(--text-3)' }}>
            To Upload
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pendingFiles.map((f,i) => (
              <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden"
                style={{ border:`2px solid ${i===0 ? 'var(--violet)' : 'var(--border)'}` }}>
                <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="" />
                {i===0 && (
                  <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center"
                    style={{ background:'var(--violet)', fontSize:8, color:'#fff', fontFamily:'Syne,sans-serif', fontWeight:700 }}>
                    PRIMARY
                  </div>
                )}
                <button onClick={() => onPendingChange(pendingFiles.filter((_,j) => j!==i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background:'rgba(0,0,0,0.7)', border:'none', cursor:'pointer' }}>
                  <X size={9} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create Business ───────────────────────────────────────────────
const CREATE_STEPS = [
  { id:1, label:'Details',  icon:Building2 },
  { id:2, label:'Services', icon:Tag },
  { id:3, label:'Schedule', icon:Calendar },
  { id:4, label:'Images',   icon:ImageIcon },
]

export default function CreateBusiness() {
  usePageTitle('Create Business')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [details, setDetails] = useState<any>({ service_for:'UNISEX', break_time_minutes:5, cancellation_window_hours:2 })
  const [schedule, setSchedule] = useState<any[]>([])
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [createdId, setCreatedId] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [svcCount, setSvcCount] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({})

  const validateStep1 = () => {
    const errs: Record<string,string> = {}
    if (!details.business_name?.trim()) errs.business_name = 'Business name is required'
    if (!details.address_line1?.trim()) errs.address_line1 = 'Address is required'
    if (!details.state) errs.state = 'State is required'
    if (!details.city) errs.city = 'City is required'
    if (!details.pincode?.trim()) errs.pincode = 'Pincode is required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep2 = () => {
    if (svcCount === 0) { toast.error('Add at least 1 service to continue'); return false }
    return true
  }

  const handleNext = async () => {
    if (step === 1) {
      if (!validateStep1()) return
      if (!createdId) {
        setSaving(true)
        try {
          const fd = new FormData()
          const SKIP = ['_logoFile','_logoPreview','_coverFile','_coverPreview','_logoPrev','_coverPrev']
          Object.entries(details).forEach(([k,v]) => {
            if (SKIP.some(s => k.includes(s.replace('_','')))) return
            if (k.startsWith('_') || v===undefined || v===null || v==='') return
            fd.append(k, String(v))
          })
          if (details._logoFile) fd.append('logo', details._logoFile)
          if (details._coverFile) fd.append('cover', details._coverFile)
          const r = await api.post('/owner/businesses', fd)
          setCreatedId(r.data.data.id)
          toast.success('Business created! Now add services.')
          setStep(2)
        } catch (e:any) {
          toast.error(e?.response?.data?.message ?? 'Failed to create business')
        } finally { setSaving(false) }
        return
      }
      setStep(2); return
    }
    if (step === 2) {
      if (!validateStep2()) return
      setStep(3); return
    }
    setStep(s => Math.min(s+1, CREATE_STEPS.length))
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      if (createdId) {
        if (schedule.length > 0) {
          await api.put(`/owner/businesses/${createdId}/schedule`, {
            schedules: schedule.map(s => ({ day_of_week:s.day_of_week, is_open:s.is_open, open_time:s.open_time, close_time:s.close_time }))
          }).catch(() => {})
        }
        if (pendingImages.length > 0) {
          const fd = new FormData(); pendingImages.forEach(f => fd.append('images',f))
          await api.post(`/owner/businesses/${createdId}/images`, fd).catch(() => {})
        }
        await api.post(`/owner/businesses/${createdId}/submit-verification`).catch(() => {})
        toast.success('Business setup complete! Submitted for verification.')
        qc.invalidateQueries({ queryKey: ['owner-businesses'] })
        navigate('/owner/businesses')
      }
    } catch (e:any) {
      toast.error(e?.response?.data?.message ?? 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-8 overflow-x-hidden" style={{ background:'var(--bg-page)' }}>
      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-4xl mx-auto overflow-x-hidden">
        <button onClick={() => navigate('/owner/businesses')}
          className="flex items-center gap-1.5 text-[12px] font-syne font-bold mb-6"
          style={{ color:'var(--text-3)', background:'none', border:'none', cursor:'pointer' }}>
          <ChevronLeft size={15} />My Businesses
        </button>

        <div className="mb-4">
          <h1 className="font-syne font-black text-[22px]" style={{ color:'var(--text-1)' }}>Create Business</h1>
          <p className="text-[12px] mt-1" style={{ color:'var(--text-3)' }}>Complete all steps to set up your salon</p>
        </div>

        {/* Steps indicator */}
        <div className="hidden md:flex items-center justify-center mb-6 gap-1">
          {CREATE_STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: step > s.id ? 'var(--green)' : step===s.id ? 'var(--violet)' : 'var(--bg-surface)',
                    border:`2px solid ${step >= s.id ? (step>s.id ? 'var(--green)' : 'var(--violet)') : 'var(--border)'}`,
                  }}>
                  {step > s.id ? <Check size={14} color="#fff" /> : <s.icon size={14} style={{ color: step===s.id ? '#fff' : 'var(--text-3)' }} />}
                </div>
                <span className="text-[9px] font-syne font-bold text-center whitespace-nowrap"
                  style={{ color: step===s.id ? 'var(--violet-light)' : 'var(--text-3)' }}>{s.label}</span>
              </div>
              {i < CREATE_STEPS.length - 1 && (
                <div className="w-8 h-0.5 mb-5 flex-shrink-0 mx-1"
                  style={{ background: step > s.id ? 'var(--green)' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Validation warning */}
        {step === 2 && svcCount === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-[10px] mb-4"
            style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={14} style={{ color:'var(--yellow)', flexShrink:0 }} />
            <p className="text-[11px]" style={{ color:'var(--yellow)' }}>Add at least 1 service before continuing</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }}
            transition={{ duration:0.16 }}
            className="rounded-[14px] p-5 md:p-6 overflow-x-hidden"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            {step===1 && <StepDetails data={details} onChange={setDetails} errors={fieldErrors} />}
            {step===2 && <StepServices businessId={createdId} serviceFor={details.service_for??'UNISEX'} onCountChange={setSvcCount} />}
            {step===3 && <StepSchedule businessId={createdId} schedule={schedule} onChange={setSchedule} />}
            {step===4 && <StepImages businessId={createdId} pendingFiles={pendingImages} onPendingChange={setPendingImages} />}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mt-5">
          {step > 1 && (
            <button onClick={() => setStep(s => s-1)}
              className="flex-1 h-11 rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold"
              style={{ background:'var(--bg-surface)', color:'var(--text-2)', border:'1px solid var(--border)', cursor:'pointer' }}>
              <ChevronLeft size={15} />Back
            </button>
          )}
          {step < CREATE_STEPS.length ? (
            <motion.button whileTap={{ scale:0.97 }} onClick={handleNext} disabled={saving}
              className="flex-1 h-11 rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold disabled:opacity-60"
              style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {step===1 && !createdId ? (saving ? 'Creating…' : 'Create & Continue') : 'Next'}
              {!saving && <ChevronRight size={15} />}
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale:0.97 }} onClick={handleFinish} disabled={saving}
              className="flex-1 h-11 rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold disabled:opacity-60"
              style={{ background:'var(--green)', color:'#fff', border:'none', cursor:'pointer' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {saving ? 'Finishing…' : 'Complete Setup'}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit Business ─────────────────────────────────────────────────
const EDIT_TABS = [
  { id:'details',  label:'Details',  icon:Building2 },
  { id:'services', label:'Services', icon:Tag },
  { id:'schedule', label:'Schedule', icon:Calendar },
  { id:'staff',    label:'Staff',    icon:Users },
  { id:'images',   label:'Images',   icon:ImageIcon },
]

// AddStaffModal + StepStaff imported from shared — just inline minimal version:
// ── Staff service+schedule edit modal ────────────────────────────
// NOTE: DAYS already declared at top of file

function StaffEditModal({ staff, businessId, bizSvcs, onClose }: {
  staff: any; businessId: string; bizSvcs: any[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'services'|'schedule'>('services')

  // Staff detail — services + schedule
  const { data: detail, isLoading } = useQuery({
    queryKey: ['staff-detail-modal', staff.id],
    queryFn: async () => {
      // ✅ FIX: correct URL is /owner/staff/:id/detail (not /owner/staff-detail/:id)
      const r = await api.get(`/owner/staff/${staff.id}/detail`)
      return r.data.data
    },
    staleTime: 30_000,
  })

  // ✅ FIX (b): only initialise svcRows ONCE when detail first loads
  // Using a ref to guard prevents resetting unsaved edits on re-fetch
  const svcInitRef = useRef(false)
  const [svcRows, setSvcRows] = useState<{ service_offering_id:string; duration_minutes:number }[]>([])
  useEffect(() => {
    if (detail?.services && !svcInitRef.current) {
      svcInitRef.current = true
      setSvcRows(detail.services.map((s:any) => ({
        service_offering_id: s.id,
        duration_minutes: s.duration_minutes ?? 0,
      })))
    }
  }, [detail])

  // Schedule state — same guard
  const schInitRef = useRef(false)
  const [schedule, setSchedule] = useState<any[]>([])
  useEffect(() => {
    if (!schInitRef.current) {
      if (detail?.schedule) {
        schInitRef.current = true
        setSchedule(detail.schedule.map((s:any) => ({
          day_of_week: s.day_of_week,
          is_available: s.is_available ?? true,
          start_time: s.start_time ?? '09:00',
          end_time: s.end_time ?? '20:00',
        })))
      } else if (!isLoading) {
        schInitRef.current = true
        setSchedule(DAYS.map(d => ({ day_of_week:d, is_available:true, start_time:'09:00', end_time:'20:00' })))
      }
    }
  }, [detail, isLoading])

  const saveSvcMut = useMutation({
    mutationFn: () => api.patch(`/owner/staff/${staff.id}/services`, { services: svcRows }),
    onSuccess: () => {
      toast.success('Services saved')
      qc.invalidateQueries({ queryKey: ['staff-detail-modal', staff.id] })
      qc.invalidateQueries({ queryKey: ['biz-staff-edit', businessId] })
    },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Failed to save services'),
  })

  const saveSchMut = useMutation({
    mutationFn: () => api.patch(`/owner/staff/${staff.id}/schedule`, { schedule }),
    onSuccess: () => {
      toast.success('Schedule saved')
      qc.invalidateQueries({ queryKey: ['staff-detail-modal', staff.id] })
    },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Failed to save schedule'),
  })

  const addSvc = (offeringId: string) => {
    if (!offeringId || svcRows.find(r => r.service_offering_id === offeringId)) return
    setSvcRows(prev => [...prev, { service_offering_id: offeringId, duration_minutes: 0 }])
  }
  const removeSvc = (offeringId: string) => setSvcRows(prev => prev.filter(r => r.service_offering_id !== offeringId))
  const updateDuration = (offeringId: string, mins: number) => {
    setSvcRows(prev => prev.map(r => r.service_offering_id === offeringId ? { ...r, duration_minutes: mins } : r))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)' }}>
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        className="w-full max-w-lg rounded-[16px] overflow-hidden flex flex-col"
        style={{ background:'var(--bg-card)', border:'1px solid var(--border)', maxHeight:'85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor:'var(--border)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={staff.name} src={staff.avatar_url} size="md" />
            <div>
              <p className="font-syne font-black text-[15px]" style={{ color:'var(--text-1)' }}>{staff.name}</p>
              <p className="text-[11px]" style={{ color:'var(--text-3)' }}>{staff.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-2)' }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b" style={{ borderColor:'var(--border)' }}>
          {([['services','Services & Duration'],['schedule','Schedule']] as const).map(([k,label]) => (
            <button key={k} onClick={() => setTab(k)}
              className="flex-1 h-8 rounded-[7px] text-[12px] font-syne font-bold"
              style={{
                background: tab===k ? 'var(--violet-bg)' : 'var(--bg-surface)',
                color: tab===k ? 'var(--violet-light)' : 'var(--text-2)',
                border: `1px solid ${tab===k ? 'var(--violet-border)' : 'var(--border)'}`,
                cursor:'pointer',
              }}>{label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color:'var(--violet)' }} />
            </div>
          ) : tab === 'services' ? (
            <>
              {/* ✅ FIX: Show ALL business services — assigned ones highlighted with duration, unassigned can be added */}
              {bizSvcs.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[12px] font-syne font-bold" style={{ color:'var(--text-3)' }}>No services in this business</p>
                  <p className="text-[11px] mt-1" style={{ color:'var(--text-4)' }}>Add services in the Services tab first</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bizSvcs.map((svc:any) => {
                    const row = svcRows.find(r => r.service_offering_id === svc.id)
                    const isAssigned = !!row
                    const svcName = svc.platform_service?.name ?? svc.name ?? 'Service'
                    const imgUrl = svc.platform_service?.image_url ?? null
                    return (
                      <div key={svc.id}
                        className="flex items-center gap-3 p-3 rounded-[11px] transition-all"
                        style={{
                          background: isAssigned ? 'var(--violet-bg)' : 'var(--bg-surface)',
                          border: `1px solid ${isAssigned ? 'var(--violet-border)' : 'var(--border)'}`,
                        }}>
                        {/* Checkbox toggle */}
                        <button
                          onClick={() => isAssigned ? removeSvc(svc.id) : addSvc(svc.id)}
                          className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0"
                          style={{ background: isAssigned ? 'var(--violet)' : 'var(--bg-card)', border:`1.5px solid ${isAssigned ? 'var(--violet)' : 'var(--border-2)'}`, cursor:'pointer' }}>
                          {isAssigned && <Check size={10} color="#fff" strokeWidth={3} />}
                        </button>
                        {/* Service image */}
                        <ServiceImage url={imgUrl} name={svcName} size={36} />
                        {/* Name only — no price */}
                        <div className="flex-1 min-w-0">
                          <p className="font-syne font-bold text-[12px] truncate"
                            style={{ color: isAssigned ? 'var(--violet-light)' : 'var(--text-1)' }}>
                            {svcName}
                          </p>
                        </div>
                        {/* Duration input — only when assigned */}
                        {isAssigned && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.duration_minutes === 0 ? '' : String(row.duration_minutes)}
                              placeholder="0"
                              onChange={e => {
                                const v = e.target.value.replace(/[^0-9]/g, '')
                                updateDuration(svc.id, v === '' ? 0 : Math.min(480, parseInt(v)))
                              }}
                              className="w-14 h-10 rounded-[8px] text-[15px] text-center font-syne font-black outline-none tabular-nums"
                              style={{ background:'var(--bg-card)', border:'1.5px solid var(--violet-border)', color:'var(--violet-light)' }}
                            />
                            <span className="text-[11px] font-syne font-bold" style={{ color:'var(--text-3)' }}>min</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            /* Schedule tab */
            <div className="space-y-2">
              {schedule.map((day:any, idx:number) => (
                <div key={day.day_of_week} className="flex items-center gap-3 p-2.5 rounded-[10px]"
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--border)' }}>
                  <Toggle checked={day.is_available}
                    onChange={v => setSchedule(prev => prev.map((d,i) => i===idx ? {...d, is_available:v} : d))} />
                  <span className="w-24 text-[11px] font-syne font-bold flex-shrink-0" style={{ color: day.is_available ? 'var(--text-1)' : 'var(--text-4)' }}>
                    {day.day_of_week.slice(0,3)}
                  </span>
                  {day.is_available ? (
                    <>
                      <input type="time" value={day.start_time}
                        onChange={e => setSchedule(prev => prev.map((d,i) => i===idx ? {...d, start_time:e.target.value} : d))}
                        className="flex-1 h-8 rounded-[7px] px-2 text-[12px] font-syne outline-none"
                        style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
                      <span className="text-[10px]" style={{ color:'var(--text-3)' }}>–</span>
                      <input type="time" value={day.end_time}
                        onChange={e => setSchedule(prev => prev.map((d,i) => i===idx ? {...d, end_time:e.target.value} : d))}
                        className="flex-1 h-8 rounded-[7px] px-2 text-[12px] font-syne outline-none"
                        style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
                    </>
                  ) : (
                    <span className="text-[11px] flex-1" style={{ color:'var(--text-4)' }}>Day off</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex gap-2" style={{ borderColor:'var(--border)' }}>
          <button onClick={onClose} className="flex-1 h-9 rounded-[9px] text-[12px] font-syne font-bold"
            style={{ background:'var(--bg-surface)', color:'var(--text-2)', border:'1px solid var(--border)', cursor:'pointer' }}>
            Close
          </button>
          <motion.button whileTap={{ scale:0.97 }}
            onClick={() => tab==='services' ? saveSvcMut.mutate() : saveSchMut.mutate()}
            disabled={saveSvcMut.isPending || saveSchMut.isPending}
            className="flex-1 h-9 rounded-[9px] flex items-center justify-center gap-1.5 text-[12px] font-syne font-bold disabled:opacity-50"
            style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
            {(saveSvcMut.isPending || saveSchMut.isPending) ? <Loader2 size={13} className="animate-spin" /> : null}
            Save {tab==='services' ? 'Services' : 'Schedule'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

function StepStaff({ businessId }: { businessId:string }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any>(null)
  const [form, setForm] = useState({ name:'',email:'',phone:'',specialization:'',experience_years:'',bio:'' })
  const [avatar, setAvatar] = useState<File|null>(null)
  const u = (k:string,v:string) => setForm(f => ({ ...f, [k]:v }))

  const { data: staff, refetch } = useQuery({
    queryKey: ['biz-staff-edit', businessId],
    queryFn: async () => {
      const r = await api.get(`/owner/businesses/${businessId}/staff`)
      return (r.data.data ?? []) as any[]
    },
    staleTime: 30_000,
  })

  const { data: bizSvcs = [] } = useQuery({
    queryKey: ['biz-services', businessId],
    queryFn: async () => {
      const r = await api.get(`/owner/businesses/${businessId}/services`)
      return (r.data.data ?? []) as any[]
    },
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.name||!form.email||!form.phone) throw new Error('Name, email, phone required')
      const fd = new FormData()
      fd.append('name',form.name); fd.append('email',form.email); fd.append('phone',form.phone)
      if (form.specialization) fd.append('specialization',form.specialization)
      if (form.experience_years) fd.append('experience_years',form.experience_years)
      if (form.bio) fd.append('bio',form.bio)
      if (avatar) fd.append('image',avatar)
      await api.post(`/owner/businesses/${businessId}/staff`, fd)
    },
    onSuccess: () => { toast.success('Staff invited!'); setShowAdd(false); refetch(); setForm({ name:'',email:'',phone:'',specialization:'',experience_years:'',bio:'' }); setAvatar(null) },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }:{ id:string; is_active:boolean }) => api.patch(`/owner/staff/${id}/toggle-active`, { is_active }),
    onSuccess: (_,v) => { toast.success(v.is_active ? 'Activated' : 'Deactivated'); refetch() },
    onError: (e:any) => toast.error(e?.response?.data?.message ?? 'Cannot toggle — active bookings may exist'),
  })

  return (
    <div className="space-y-4">
      {/* Staff edit modal */}
      <AnimatePresence>
        {editingStaff && (
          <StaffEditModal
            staff={editingStaff}
            businessId={businessId}
            bizSvcs={bizSvcs}
            onClose={() => setEditingStaff(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-syne font-black text-[18px]" style={{ color:'var(--text-1)' }}>Staff</h2>
          <p className="text-[12px]" style={{ color:'var(--text-3)' }}>Add staff, then click a card to assign services & schedule</p>
        </div>
        <motion.button whileTap={{ scale:0.97 }} onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 px-3 h-9 rounded-[9px] text-[12px] font-syne font-bold"
          style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
          <Plus size={13} />Add Staff
        </motion.button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
            className="overflow-hidden">
            <div className="rounded-[12px] p-4 space-y-3" style={{ background:'var(--bg-surface)', border:'1px solid var(--border)' }}>
              <p className="font-syne font-bold text-[13px]" style={{ color:'var(--text-1)' }}>New Staff Member</p>
              <div className="flex items-center gap-3 mb-2">
                <label className="relative cursor-pointer">
                  <Avatar name={form.name||'S'} src={avatar ? URL.createObjectURL(avatar) : null} size="md" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background:'var(--violet)' }}>
                    <Upload size={9} color="#fff" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setAvatar(e.target.files?.[0]??null)} />
                </label>
                <p className="text-[11px]" style={{ color:'var(--text-3)' }}>Optional photo</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { k:'name',label:'Full Name *',type:'text',ph:'Name' },
                  { k:'email',label:'Email *',type:'email',ph:'email@…' },
                  { k:'phone',label:'Phone *',type:'tel',ph:'6-9xxxxxxxxx' },
                  { k:'specialization',label:'Specialization',type:'text',ph:'Hair Stylist' },
                  { k:'experience_years',label:'Experience (yrs)',type:'number',ph:'0' },
                ].map(f => (
                  <div key={f.k}>
                    <p className="text-[10px] font-syne font-bold mb-1" style={{ color:'var(--text-3)' }}>{f.label}</p>
                    <input type={f.type} value={(form as any)[f.k]} onChange={e => u(f.k,e.target.value)} placeholder={f.ph}
                      className="w-full h-8 rounded-[8px] px-2.5 text-[12px] font-syne outline-none"
                      style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-1)' }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 h-9 rounded-[8px] text-[12px] font-syne font-bold"
                  style={{ background:'var(--bg-surface)', color:'var(--text-2)', border:'1px solid var(--border)', cursor:'pointer' }}>
                  Cancel
                </button>
                <motion.button whileTap={{ scale:0.97 }} onClick={() => createMut.mutate()} disabled={createMut.isPending}
                  className="flex-1 h-9 rounded-[8px] flex items-center justify-center gap-1.5 text-[12px] font-syne font-bold disabled:opacity-60"
                  style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
                  {createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                  Create & Invite
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff list */}
      {!staff?.length ? (
        <div className="text-center py-8" style={{ color:'var(--text-4)' }}>
          <Users size={28} style={{ margin:'0 auto 8px' }} />
          <p className="text-[13px] font-syne font-bold" style={{ color:'var(--text-3)' }}>No staff yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map((s:any) => (
            <div key={s.id} className="p-3 rounded-[12px] cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background:'var(--bg-surface)', border:'1px solid var(--border)' }}
              onClick={() => setEditingStaff(s)}>
              <div className="flex items-center gap-3">
                <Avatar name={s.name} src={s.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-syne font-bold text-[13px] truncate" style={{ color:'var(--text-1)' }}>{s.name}</p>
                  <p className="text-[10px] truncate" style={{ color:'var(--text-3)' }}>{s.email}</p>
                  {s.specialization && <p className="text-[10px]" style={{ color:'var(--violet-light)' }}>{s.specialization}</p>}
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-[9px] font-syne font-bold px-1.5 py-0.5 rounded"
                    style={{ background: s.is_active ? 'var(--green-bg)' : 'var(--bg-surface)', color: s.is_active ? 'var(--green)' : 'var(--text-4)' }}>
                    {s.is_active ? 'Active' : 'Off'}
                  </span>
                  <Toggle checked={s.is_active} onChange={v => toggleMut.mutate({ id:s.id, is_active:v })} />
                </div>
              </div>
              <p className="text-[10px] mt-2 pl-1" style={{ color:'var(--violet-light)' }}>Tap to edit services & schedule →</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function EditBusiness() {
  usePageTitle('Edit Business')
  const { id } = useParams<{ id:string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [details, setDetails] = useState<any>(null)
  const [schedule, setSchedule] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [svcCount, setSvcCount] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({})

  // ✅ FIX (a): return the full payload from queryFn so we can derive details
  // Never call setDetails() inside queryFn — it's unreliable and causes blank details tab
  const { data: bizData, isLoading } = useQuery({
    queryKey: ['owner-biz-edit', id],
    queryFn: async () => {
      const [bizR, schR] = await Promise.all([
        api.get(`/owner/businesses/${id}`),
        api.get(`/owner/businesses/${id}/schedule`),
      ])
      const b   = bizR.data.data
      const sch = schR.data.data?.schedule ?? schR.data.data ?? []
      return { biz: b, schedule: sch }
    },
    enabled: !!id,
  })
  const biz = bizData?.biz

  // Derive details + schedule from query data (no setState inside queryFn)
  useEffect(() => {
    if (!bizData) return
    const b = bizData.biz
    setDetails({
      business_name:             b.business_name ?? '',
      service_for:               b.service_for ?? 'UNISEX',
      description:               b.description ?? '',
      business_phone:            b.business_phone ?? '',
      address_line1:             b.address_line1 ?? '',
      address_line2:             b.address_line2 ?? '',
      state:                     b.state ?? '',
      city:                      b.city ?? '',
      pincode:                   b.pincode ?? '',
      map_link:                  b.map_link ?? '',
      website_url:               b.website_url ?? '',
      instagram_url:             b.instagram_url ?? '',
      facebook_url:              b.facebook_url ?? '',
      whatsapp_number:           b.whatsapp_number ?? '',
      break_time_minutes:        b.break_time_minutes ?? 5,
      cancellation_window_hours: b.cancellation_window_hours ?? 2,
      logo_url:                  b.logo_url ?? null,
      cover_image_url:           b.cover_image_url ?? null,
      _raw: b,
    })
    setSchedule((bizData.schedule ?? []).map((sc: any) => ({
      day_of_week: sc.day_of_week, is_open: sc.is_open ?? true,
      open_time: sc.open_time ?? '09:00', close_time: sc.close_time ?? '20:00',
    })))
  }, [bizData])

  const saveDetails = async () => {
    if (!id || !details) return
    setSaving(true)
    try {
      const fd = new FormData()
      const SKIP = ['id','owner_id','slug','created_at','updated_at','images','schedules','services','_count',
        'is_active','is_verified','verification_status','average_rating','total_reviews','active_staff_count',
        'today_bookings','total_earning_inr','primary_image','cover_image_url']
      Object.entries(details).forEach(([k,v]) => {
        if (SKIP.includes(k) || k.startsWith('_') || v===undefined||v===null||v==='') return
        fd.append(k, String(v))
      })
      if (details._logoFile) fd.append('logo', details._logoFile)
      if (details._coverFile) fd.append('cover', details._coverFile)
      await api.patch(`/owner/businesses/${id}`, fd)
      toast.success('Business details updated!')
      qc.invalidateQueries({ queryKey: ['owner-businesses'] })
      qc.invalidateQueries({ queryKey: ['owner-biz-edit', id] })
    } catch (e:any) {
      toast.error(e?.response?.data?.message ?? 'Update failed')
    } finally { setSaving(false) }
  }

  if (isLoading) return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-4">
      <Skeleton height="32px" width="200px" />
      <Skeleton height="500px" className="rounded-[16px]" />
    </div>
  )

  return (
    <div className="overflow-x-hidden" style={{ background:'var(--bg-page)', minHeight:'100vh' }}>
      <div className="w-full p-4 md:p-6 lg:p-8 pb-24 overflow-x-hidden">
        <button onClick={() => navigate('/owner/businesses')}
          className="flex items-center gap-1.5 text-[12px] font-syne font-bold mb-4"
          style={{ color:'var(--text-3)', background:'none', border:'none', cursor:'pointer' }}>
          <ChevronLeft size={15} />My Businesses
        </button>

        <div className="mb-5">
          <h1 className="font-syne font-black text-[22px]" style={{ color:'var(--text-1)' }}>Edit Business</h1>
          {biz && <p className="text-[12px] mt-0.5" style={{ color:'var(--text-3)' }}>{biz.business_name}</p>}
        </div>

        {/* Tab bar */}
        <div className="hidden md:flex gap-1.5 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
          {EDIT_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-[9px] text-[11px] font-syne font-bold flex-shrink-0 transition-all"
              style={{
                background: activeTab===t.id ? 'var(--violet-bg)' : 'var(--bg-surface)',
                color: activeTab===t.id ? 'var(--violet-light)' : 'var(--text-2)',
                border:`1px solid ${activeTab===t.id ? 'var(--violet-border)' : 'var(--border)'}`,
                cursor:'pointer',
              }}>
              <t.icon size={12} />{t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            transition={{ duration:0.14 }}
            className="rounded-[16px] p-5 md:p-6 overflow-x-hidden"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            {activeTab==='details' && details && <StepDetails data={details} onChange={setDetails} errors={fieldErrors} />}
            {activeTab==='services' && id && <StepServices businessId={id} serviceFor={details?.service_for??'UNISEX'} onCountChange={setSvcCount} />}
            {activeTab==='schedule' && id && <StepSchedule businessId={id} schedule={schedule} onChange={setSchedule} />}
            {activeTab==='staff' && id && <StepStaff businessId={id} />}
            {activeTab==='images' && id && <StepImages businessId={id} pendingFiles={[]} onPendingChange={() => {}} />}
          </motion.div>
        </AnimatePresence>

        {activeTab === 'details' && (
          <motion.button whileTap={{ scale:0.97 }} onClick={saveDetails} disabled={saving}
            className="w-full h-11 rounded-[10px] flex items-center justify-center gap-2 text-[13px] font-syne font-bold mt-5 disabled:opacity-60"
            style={{ background:'var(--violet)', color:'#fff', border:'none', cursor:'pointer' }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? 'Saving…' : 'Save Details'}
          </motion.button>
        )}
      </div>
    </div>
  )
}


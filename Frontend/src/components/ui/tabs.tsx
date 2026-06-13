import { useState, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

const TabsContext = createContext<{ value: string; onChange: (v: string) => void }>({ value: '', onChange: () => {} })

export function Tabs({ defaultValue, value, onValueChange, children, className }: {
  defaultValue?: string; value?: string; onValueChange?: (v: string) => void
  children: React.ReactNode; className?: string
}) {
  const [internal, setInternal] = useState(defaultValue ?? '')
  const current = value ?? internal
  const onChange = onValueChange ?? setInternal
  return (
    <TabsContext.Provider value={{ value: current, onChange }}>
      <div className={cn('', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-1 p-1 rounded-[9px] mb-1', className)}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: current, onChange } = useContext(TabsContext)
  const isActive = current === value
  return (
    <button type="button" onClick={() => onChange(value)}
      className={cn('flex-1 py-1.5 px-3 rounded-[7px] text-[11px] font-syne font-bold transition-all', className)}
      style={{
        background: isActive ? 'var(--bg-card)' : 'transparent',
        color: isActive ? 'var(--text-1)' : 'var(--text-3)',
        boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
      }}>
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: current } = useContext(TabsContext)
  if (current !== value) return null
  return <div className={cn('', className)}>{children}</div>
}

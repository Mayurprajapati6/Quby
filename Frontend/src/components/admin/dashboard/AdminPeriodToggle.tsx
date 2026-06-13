import React from 'react'
import { Button } from '@/components/ui/button'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}

export function AdminPeriodToggle<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="flex items-center gap-2">
      {options.map(opt => (
        <Button key={opt.value} variant={opt.value === value ? undefined : 'ghost'} className="text-xs px-3 py-1"
          onClick={() => onChange(opt.value)}>
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

export default AdminPeriodToggle

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('q-input', className)} {...props} />
  )
)
Input.displayName = 'Input'

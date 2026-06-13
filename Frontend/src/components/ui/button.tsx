import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; className?: string }>(
  ({ className, variant, children, ...props }, ref) => (
    <button type="button" ref={ref}
      className={cn(variant === 'ghost' ? 'q-btn-ghost' : variant === 'destructive' ? 'q-btn-danger' : 'q-btn-primary', 'h-9 px-4 text-[12px]', className)}
      {...props}>
      {children}
    </button>
  )
)
Button.displayName = 'Button'

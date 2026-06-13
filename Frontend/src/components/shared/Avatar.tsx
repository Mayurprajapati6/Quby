import { cn, getInitials } from '@/lib/utils'
import { useState } from 'react'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  onClick?: () => void
}

const sizeMap = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-[13px]',
  lg: 'w-12 h-12 text-[15px]',
  xl: 'w-16 h-16 text-[19px]',
}

export function Avatar({ src, name, size = 'md', className, onClick }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  const sizeClass = sizeMap[size]
  const initials = getInitials(name)

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        onClick={onClick}
        className={cn(
          'rounded-full object-cover flex-shrink-0',
          sizeClass,
          onClick && 'cursor-pointer',
          className,
        )}
      />
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'avatar-gradient rounded-full flex-shrink-0 font-syne font-bold select-none',
        sizeClass,
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {initials}
    </div>
  )
}

interface LogoProps {
  variant?: 'full' | 'compact' | 'icon'
  className?: string
  size?: number
}

export function Logo({ variant = 'full', className = '', size }: LogoProps) {

  function Mark({ px }: { px: number }) {
    const s = px / 64  
    const cx = 32 * s, cy = 26 * s   
    const cr = 17 * s                  
    const sw = 4.2 * s                 
    const sw2 = 2.8 * s                

    return (
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${64 * s} ${64 * s}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="qmg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#c084fc" />
            <stop offset="55%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="qmg2" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%"   stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        <circle
          cx={32 * s} cy={26 * s} r={17 * s}
          fill="none"
          stroke="url(#qmg)"
          strokeWidth={sw}
        />

        <line
          x1={32 * s} y1={26 * s}
          x2={24.5 * s} y2={19.5 * s}
          stroke="#c084fc"
          strokeWidth={sw2}
          strokeLinecap="round"
          opacity={0.9}
        />
        
        <line
          x1={32 * s} y1={26 * s}
          x2={39 * s} y2={16.5 * s}
          stroke="#a78bfa"
          strokeWidth={sw2 * 0.75}
          strokeLinecap="round"
          opacity={0.75}
        />
       
        <circle
          cx={32 * s} cy={26 * s} r={1.6 * s}
          fill="#c084fc"
        />

        <line
          x1={20 * s} y1={18 * s}
          x2={25 * s} y2={22 * s}
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={sw2 * 0.75}
          strokeLinecap="round"
        />

        <line
          x1={32 * s} y1={43 * s}
          x2={32 * s} y2={53 * s}
          stroke="url(#qmg)"
          strokeWidth={sw}
          strokeLinecap="round"
        />

        <path
          d={`M ${20 * s} ${53 * s} Q ${32 * s} ${46 * s} ${44 * s} ${53 * s}`}
          fill="none"
          stroke="url(#qmg)"
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (variant === 'icon') {
    const px = size ?? 32
    return <Mark px={px} />
  }

  if (variant === 'compact') {
    const px = size ?? 30
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(px * 0.3),
          textDecoration: 'none',
        }}
      >
        <Mark px={px} />
        <span
          className="font-syne"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: Math.round(px * 0.67),
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          <span style={{
            background: 'linear-gradient(90deg, #c084fc, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Qu</span>
          <span style={{ color: 'var(--text-1, #dde0ff)' }}>by</span>
        </span>
      </div>
    )
  }

  const px = size ?? 48
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(px * 0.28),
      }}
    >
      <Mark px={px} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          className="font-syne"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: Math.round(px * 0.7),
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          <span style={{
            background: 'linear-gradient(90deg, #c084fc, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Qu</span>
          <span style={{ color: 'var(--text-1, #dde0ff)' }}>by</span>
        </span>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: Math.round(px * 0.2),
            fontWeight: 500,
            letterSpacing: '0.16em',
            color: 'var(--text-3, #5a5c7a)',
            textTransform: 'uppercase' as const,
            userSelect: 'none',
          }}
        >
          Smart Salon Platform
        </span>
      </div>
    </div>
  )
}

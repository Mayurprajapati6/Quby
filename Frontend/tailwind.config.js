/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* Dark theme surfaces */
        dark: {
          page:    '#16172b',
          surface: '#1c1d31',
          card:    '#21223a',
          border:  '#2a2b45',
          text1:   '#dde0ff',
          text2:   'rgba(200,203,240,0.7)',
          text3:   '#383958',
          text4:   '#2a2b42',
        },
        /* Light theme surfaces */
        light: {
          page:  '#dce8f8',
          surf:  '#eef5ff',
          card:  '#ffffff',
          border: 'rgba(59,127,255,0.1)',
          text1: '#0a1a4e',
          text2: 'rgba(10,26,78,0.55)',
          text3: 'rgba(10,26,78,0.35)',
          text4: 'rgba(10,26,78,0.18)',
        },
        /* Brand colors */
        violet: {
          DEFAULT:  '#7c3aed',
          light:    '#a78bfa',
          lighter:  '#c084fc',
          bg:       'rgba(124,58,237,0.18)',
          border:   'rgba(124,58,237,0.25)',
        },
        brand: {
          DEFAULT: '#3B7FFF',
          light:   '#5a95ff',
          bg:      'rgba(59,127,255,0.08)',
          border:  'rgba(59,127,255,0.16)',
        },
        /* Semantic */
        success: { DEFAULT: '#34d399', dark: '#10B981', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)' },
        danger:  { DEFAULT: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
        warning: { DEFAULT: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        pink:    { DEFAULT: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
        blue:    { DEFAULT: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
      },
      fontFamily: {
        sans:   ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        outfit: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        syne:   ['Syne', 'sans-serif'],
        dm:     ['DM Sans', 'sans-serif'],
        inter:  ['Inter', 'system-ui', 'sans-serif'],
        mono:   ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '9px',
        card:    '14px',
        xl:      '18px',
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease',
        'slide-up':    'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-down':  'slideDown 0.2s ease',
        'scale-in':    'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        'shimmer':     'shimmer 1.5s infinite',
        'pulse-dot':   'pulseDot 2s infinite',
        'spin-slow':   'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                         to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.92)' },       to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:   { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        pulseDot:  { '0%,100%': { transform: 'scale(1)', opacity: '1' }, '50%': { transform: 'scale(1.3)', opacity: '0.7' } },
      },
      boxShadow: {
        'card-light': '0 4px 24px rgba(59,127,255,0.1), 0 1px 4px rgba(59,127,255,0.06)',
        'card-dark':  '0 2px 16px rgba(0,0,0,0.4)',
        'glow-violet':'0 0 20px rgba(124,58,237,0.35)',
        'glow-brand': '0 4px 18px rgba(59,127,255,0.38)',
        'btn-dark':   '0 0 20px rgba(124,58,237,0.35)',
        'btn-light':  '0 4px 18px rgba(59,127,255,0.38)',
      },
    },
  },
  plugins: [],
}

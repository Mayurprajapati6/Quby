import React from 'react'
import { motion } from 'framer-motion'

type Props = {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  color?: string
  delay?: number
}

export const AdminKpiCard = ({ label, value, sub, icon, color = 'var(--text-1)', delay = 0 }: Props) => {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="p-3 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-syne font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
          <p className="font-syne font-black text-lg" style={{ color }}>{value}</p>
          {sub && <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
        </div>
        {icon && <div className="flex-shrink-0 mt-1" style={{ color }}>{icon}</div>}
      </div>
    </motion.div>
  )
}

export default AdminKpiCard

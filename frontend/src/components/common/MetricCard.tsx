import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

type Props = {
  label: string
  value: number
  formatter?: (n: number) => string
  delta?: number
  sparkline?: number[]
  hero?: boolean
}

export function MetricCard({ label, value, formatter = (n) => n.toFixed(2), delta = 0, sparkline, hero }: Props) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const start = display
    const duration = 500
    const t0 = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      setDisplay(start + (value - start) * p)
      if (p < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const tone = delta >= 0 ? 'text-emerald-300' : 'text-red-300'
  const bgTone = hero
    ? delta >= 0
      ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent shadow-[0_0_45px_rgba(16,185,129,0.18)]'
      : 'bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent shadow-[0_0_45px_rgba(239,68,68,0.2)]'
    : 'bg-[#111827]/80'

  return (
    <div className={`rounded-2xl border border-[#1e293b] p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-lg ${bgTone}`}>
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className={`font-semibold text-slate-100 transition-all ${hero ? 'text-3xl' : 'text-xl'}`}>{formatter(display)}</div>
          <div className={`mt-1 inline-flex items-center gap-1 text-sm ${tone}`}>
            {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(delta).toFixed(2)}%
          </div>
        </div>
        {sparkline && (
          <div className="h-14 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline.map((y, i) => ({ i, y }))}>
                <Area type="monotone" dataKey="y" stroke={delta >= 0 ? '#10b981' : '#ef4444'} fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

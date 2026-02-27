import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '../../lib/utils'

const ranges = ['1H', '6H', '1D', '1W', 'ALL']

export function EquityCurve({ data }: { data: Array<{ ts: number; value: number }> }) {
  const [range, setRange] = useState('1D')

  const sliced =
    range === '1H' ? data.slice(-60) : range === '6H' ? data.slice(-120) : range === '1D' ? data.slice(-240) : range === '1W' ? data.slice(-400) : data

  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl transition hover:shadow-lg xl:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Equity Curve</h2>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2 py-1 text-xs ${range === r ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sliced}>
            <defs>
              <linearGradient id="eqCurve" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="ts" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <ReferenceLine y={sliced[0]?.value} stroke="#334155" strokeDasharray="5 5" />
            <Tooltip labelFormatter={(l) => new Date(Number(l)).toLocaleString()} formatter={(v) => formatMoney(Number(v || 0))} />
            <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fill="url(#eqCurve)" isAnimationActive animationDuration={650} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

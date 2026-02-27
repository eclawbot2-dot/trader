import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { formatMoney } from '../lib/utils'

interface PortfolioCardsProps {
  equity: number
  usdc: number
  roi: number
  realized: number
  unrealized: number
  trades: number
}

function AnimatedValue({ value, prefix = '', suffix = '', digits = 0 }: { value: number; prefix?: string; suffix?: string; digits?: number }) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { damping: 30, stiffness: 120 })
  const display = useTransform(spring, (latest) => `${prefix}${latest.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`)

  useEffect(() => {
    motionValue.set(value)
  }, [motionValue, value])

  return <motion.span>{display}</motion.span>
}

export function PortfolioCards({ equity, usdc, roi, realized, unrealized, trades }: PortfolioCardsProps) {
  const cards = [
    { label: 'Total Equity', value: equity, positive: equity >= 0, money: true },
    { label: 'USDC Balance', value: usdc, positive: usdc >= 0, money: true },
    { label: 'ROI', value: roi * 100, positive: roi >= 0, pct: true },
    { label: 'Realized P&L', value: realized, positive: realized >= 0, money: true },
    { label: 'Unrealized P&L', value: unrealized, positive: unrealized >= 0, money: true },
    { label: 'Total Trades', value: trades, positive: true },
  ]

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg ${card.positive ? 'shadow-emerald-900/20' : 'shadow-red-900/20'}`}
        >
          <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
          <p className={`mt-3 text-3xl font-bold ${card.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {card.money ? (
              <AnimatedValue value={card.value} prefix="$" digits={2} />
            ) : card.pct ? (
              <AnimatedValue value={card.value} suffix="%" digits={2} />
            ) : (
              <AnimatedValue value={card.value} digits={0} />
            )}
          </p>
          {card.money && <p className="mt-1 text-xs text-slate-500">{formatMoney(card.value)}</p>}
        </article>
      ))}
    </section>
  )
}

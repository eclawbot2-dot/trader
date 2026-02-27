import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatMoney = (v: number, digits = 2) =>
  `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })}`

export const formatPct = (v: number, digits = 2) => `${(Number(v || 0) * 100).toFixed(digits)}%`

export const formatNum = (v: number, digits = 4) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: digits })

export const truncateAddress = (address?: string, lead = 6, tail = 4) => {
  if (!address) return '—'
  if (address.length <= lead + tail) return address
  return `${address.slice(0, lead)}...${address.slice(-tail)}`
}

export const asMeta = (meta: unknown): Record<string, any> => {
  if (typeof meta === 'object' && meta) return meta as Record<string, any>
  try {
    return JSON.parse(String(meta || '{}')) as Record<string, any>
  } catch {
    return {}
  }
}

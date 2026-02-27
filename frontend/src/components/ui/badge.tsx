import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import type { HTMLAttributes } from 'react'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-slate-600 text-slate-200',
      success: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
      danger: 'border-red-500/40 text-red-300 bg-red-500/10',
      warning: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
      muted: 'border-slate-700 text-slate-400',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

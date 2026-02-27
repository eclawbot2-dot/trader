export function SkeletonLoader({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-700/30 ${className}`} />
}

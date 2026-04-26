import type { HTMLAttributes } from 'react'

export function Skeleton({ className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      style={style}
      {...props}
    />
  )
}

export function VillaCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
    >
      {/* Photo area */}
      <Skeleton style={{ aspectRatio: '3/4', borderRadius: 0 }} />

      {/* Footer */}
      <div className="px-4 py-3.5 space-y-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <Skeleton className="h-3.5 w-3/4 rounded-lg" />
        <Skeleton className="h-3 w-1/2 rounded-lg" />
        <div className="flex gap-2 pt-0.5">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <Skeleton className="w-10 h-10 rounded-xl mb-4" />
      <Skeleton className="h-2.5 w-20 rounded mb-2" />
      <Skeleton className="h-9 w-16 rounded" />
    </div>
  )
}

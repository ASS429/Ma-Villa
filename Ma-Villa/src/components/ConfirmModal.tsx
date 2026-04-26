import { useEffect, useRef } from 'react'
import { Trash2, CheckCircle } from 'lucide-react'

interface Props {
  message: string
  detail?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  message,
  detail,
  confirmLabel = 'Confirmer',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  const Icon = danger ? Trash2 : CheckCircle

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up sm:animate-scale-in glass-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon accent */}
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: danger ? 'rgba(220,38,38,0.10)' : 'var(--accent-bg)' }}
        >
          <Icon size={20} style={{ color: danger ? 'var(--danger)' : 'var(--accent)' }} />
        </div>

        <p id="confirm-modal-title" className="font-semibold text-base mb-1" style={{ color: 'var(--text-1)' }}>
          {message}
        </p>
        {detail && (
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-2)' }}>{detail}</p>
        )}
        {!detail && <div className="mb-5" />}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98]"
            style={{ border: '1px solid var(--border-2)', color: 'var(--text-2)', background: 'var(--bg-elevated)' }}
          >
            Annuler
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type TypeToast = 'succes' | 'erreur' | 'info'

interface Toast {
  id: number
  type: TypeToast
  message: string
}

interface ToastContextType {
  succes: (message: string) => void
  erreur: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const DUREE = 5000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const retirer = useCallback((id: number) => {
    setToasts((liste) => liste.filter((t) => t.id !== id))
  }, [])

  const ajouter = useCallback((type: TypeToast, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((liste) => [...liste, { id, type, message }])
    setTimeout(() => retirer(id), DUREE)
  }, [retirer])

  const api = useMemo(() => ({
    succes: (m: string) => ajouter('succes', m),
    erreur: (m: string) => ajouter('erreur', m),
    info:   (m: string) => ajouter('info', m),
  }), [ajouter])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
        // Les erreurs sont annoncées aux lecteurs d'écran sans voler le focus.
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => retirer(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const couleur = {
    succes: 'var(--success)',
    erreur: 'var(--danger)',
    info: 'var(--accent)',
  }[toast.type]

  return (
    <div
      className="pointer-events-auto rounded-xl px-4 py-3 flex items-start gap-3 animate-slide-up"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${couleur}`,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span className="text-sm flex-1 th-text-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        className="shrink-0 th-text-3 hover:th-text-1 transition-colors leading-none text-lg"
        aria-label="Fermer la notification"
      >
        ×
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- convention des modules de contexte : le hook vit auprès de son provider
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider')
  return ctx
}

import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from '../../components/ConfirmModal'

interface Utilisateur {
  id: number
  name: string
  email: string
  role: string
  phone: string | null
  created_at: string
}

const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  proprietaire: { label: 'Propriétaire', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  client: { label: 'Client', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function AdminUtilisateurs() {
  const { user: me } = useAuth()
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmModal, setConfirmModal] = useState<{ id: number } | null>(null)

  const fetchUsers = () => {
    api.get('/admin/utilisateurs')
      .then((res) => setUtilisateurs(res.data))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const supprimer = async (id: number) => {
    await api.delete(`/admin/utilisateurs/${id}`)
    setConfirmModal(null)
    fetchUsers()
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR')

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
      Chargement...
    </div>
  )

  return (
    <div>
      {confirmModal && (
        <ConfirmModal
          message="Supprimer cet utilisateur ?"
          detail="Cette action est irréversible. Toutes les données associées seront perdues."
          confirmLabel="Supprimer"
          danger
          onConfirm={() => supprimer(confirmModal.id)}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '-0.03em' }}>Utilisateurs</h1>
        <span className="text-sm" style={{ color: 'var(--text-3)' }}>{utilisateurs.length} au total</span>
      </div>

      <div className="flex flex-col gap-3">
        {utilisateurs.map((u) => {
          const config = roleConfig[u.role] ?? { label: u.role, color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' }
          return (
            <div
              key={u.id}
              className="rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-1)' }}
                >
                  {initials(u.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <span className={`shrink-0 text-xs border px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-2)' }}>{u.email}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Inscrit le {fmt(u.created_at)}</p>
                </div>
              </div>
              {u.id !== me?.id && (
                <button
                  onClick={() => setConfirmModal({ id: u.id })}
                  className="shrink-0 text-sm transition-colors hover:text-red-400"
                  style={{ color: 'var(--text-3)' }}
                >
                  Supprimer
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

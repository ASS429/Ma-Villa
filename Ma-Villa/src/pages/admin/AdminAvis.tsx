import { useEffect, useState } from 'react'
import api from '../../services/api'
import ConfirmModal from '../../components/ConfirmModal'

interface Avis {
  id: number
  note: number
  commentaire: string | null
  client: { name: string }
  villa: { nom: string }
  created_at: string
}

export default function AdminAvis() {
  const [avis, setAvis] = useState<Avis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const fetchAvis = () => {
    api.get('/admin/avis')
      .then((res) => setAvis(res.data))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchAvis() }, [])

  const supprimer = async (id: number) => {
    await api.delete(`/admin/avis/${id}`)
    setConfirmId(null)
    fetchAvis()
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
      Chargement...
    </div>
  )

  return (
    <div>
      {confirmId !== null && (
        <ConfirmModal
          message="Supprimer cet avis ?"
          detail="L'avis sera définitivement supprimé de la plateforme."
          confirmLabel="Supprimer"
          danger
          onConfirm={() => supprimer(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '-0.03em' }}>Modération des avis</h1>
        <span className="text-sm" style={{ color: 'var(--text-3)' }}>{avis.length} au total</span>
      </div>

      {avis.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg-surface)' }}>
            <svg className="w-6 h-6" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Aucun avis pour l'instant.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {avis.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl px-6 py-4"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <p className="text-sm font-medium">{a.client.name}</p>
                    <span className="text-amber-400 text-sm">{'★'.repeat(a.note)}{'☆'.repeat(5 - a.note)}</span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>sur {a.villa.nom}</span>
                  </div>
                  {a.commentaire && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{a.commentaire}</p>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>{fmt(a.created_at)}</p>
                </div>
                <button
                  onClick={() => setConfirmId(a.id)}
                  className="shrink-0 text-sm transition-colors hover:text-red-400"
                  style={{ color: 'var(--text-3)' }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

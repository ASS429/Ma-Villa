import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

interface Villa {
  id: number
  nom: string
  ville: string
  statut: 'en_attente' | 'validee' | 'rejetee'
  telephone: string
  created_at: string
}

const statutConfig: Record<Villa['statut'], { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  validee: { label: 'Validée', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  rejetee: { label: 'Rejetée', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

export default function MesVillas() {
  const [villas, setVillas] = useState<Villa[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/proprietaire/villas')
      .then((res) => setVillas(res.data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
      Chargement...
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-normal">Mes villas</h1>
        <Link
          to="/dashboard/villas/nouvelle"
          className="px-5 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
          style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
        >
          + Nouvelle villa
        </Link>
      </div>

      {villas.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-bg)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
          </div>
          <p className="font-medium mb-1">Aucune villa pour l'instant</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
            Ajoutez votre première villa pour commencer à recevoir des réservations.
          </p>
          <Link
            to="/dashboard/villas/nouvelle"
            className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
          >
            Ajouter ma première villa
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {villas.map((villa) => {
            const config = statutConfig[villa.statut]
            return (
              <div
                key={villa.id}
                className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-bg)' }}
                  >
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{villa.nom}</p>
                    <p className="text-sm" style={{ color: 'var(--text-3)' }}>{villa.ville}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={`text-xs border px-2.5 py-1 rounded-full ${config.color}`}>
                    {config.label}
                  </span>
                  <Link
                    to={`/dashboard/villas/${villa.id}`}
                    className="text-sm font-medium transition-opacity hover:opacity-70"
                  >
                    Gérer →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

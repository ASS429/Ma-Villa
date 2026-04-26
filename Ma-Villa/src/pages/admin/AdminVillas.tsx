import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

interface Villa {
  id: number
  nom: string
  ville: string
  statut: string
  vedette: boolean
  description: string
  telephone: string
  proprietaire: { name: string; email: string }
  created_at: string
}

const TABS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee', label: 'Validées' },
  { value: 'rejetee', label: 'Rejetées' },
]

function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-colors ${filled ? 'text-amber-400' : 'text-gray-600'}`}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  )
}

export default function AdminVillas() {
  const [villas, setVillas] = useState<Villa[]>([])
  const [statut, setStatut] = useState('en_attente')
  const [isLoading, setIsLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchVillas = (s: string) => {
    setIsLoading(true)
    api.get(`/admin/villas?statut=${s}`)
      .then((res) => setVillas(res.data))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchVillas(statut) }, [statut])

  const updateStatut = async (villa: Villa, newStatut: 'validee' | 'rejetee') => {
    await api.patch(`/admin/villas/${villa.id}/statut`, { statut: newStatut })
    fetchVillas(statut)
  }

  const toggleVedette = async (villa: Villa) => {
    setTogglingId(villa.id)
    try {
      const res = await api.patch(`/admin/villas/${villa.id}/vedette`)
      setVillas((prev) => prev.map((v) => v.id === villa.id ? { ...v, vedette: res.data.vedette } : v))
    } finally {
      setTogglingId(null)
    }
  }

  const vedetteCount = villas.filter((v) => v.vedette).length

  return (
    <div>
      <h1 className="text-3xl font-light mb-6" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '-0.03em' }}>Gestion des villas</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatut(t.value)}
            className="px-4 py-1.5 rounded-xl text-sm transition-all"
            style={
              statut === t.value
                ? { background: 'var(--text-1)', color: 'var(--bg)' }
                : { border: '1px solid var(--border)', color: 'var(--text-2)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {statut === 'validee' && !isLoading && villas.length > 0 && (
        <div className="flex items-center gap-2 mb-5 text-sm" style={{ color: 'var(--text-3)' }}>
          <IconStar filled />
          <span>{vedetteCount} villa{vedetteCount !== 1 ? 's' : ''} en vedette sur la page d'accueil</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-2xl px-6 py-5 animate-pulse"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div className="h-4 rounded w-1/3 mb-2" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 rounded w-1/4" style={{ background: 'var(--border)' }} />
            </div>
          ))}
        </div>
      ) : villas.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <p style={{ color: 'var(--text-2)' }}>Aucune villa dans cette catégorie.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {villas.map((villa) => (
            <div
              key={villa.id}
              className="rounded-2xl px-5 py-4 md:px-6 md:py-5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-medium truncate">{villa.nom}</h2>
                    {villa.vedette && (
                      <span className="shrink-0 text-xs bg-amber-400/10 border border-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full">
                        Vedette
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>{villa.ville} · {villa.telephone}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {villa.proprietaire.name} · {villa.proprietaire.email}
                  </p>
                  <Link
                    to={`/villas/${villa.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs mt-2 transition-colors th-text-3 hover:th-text-1"
                  >
                    Voir la villa ↗
                  </Link>
                  {villa.description && (
                    <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-3)' }}>{villa.description}</p>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  {statut === 'en_attente' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatut(villa, 'validee')}
                        className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                        style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => updateStatut(villa, 'rejetee')}
                        className="px-4 py-1.5 rounded-xl text-sm transition-all th-text-2 hover:th-text-1"
                        style={{ border: '1px solid var(--border)' }}
                      >
                        Rejeter
                      </button>
                    </div>
                  )}

                  {statut === 'validee' && (
                    <button
                      onClick={() => toggleVedette(villa)}
                      disabled={togglingId === villa.id}
                      title={villa.vedette ? 'Retirer de la vedette' : 'Mettre en vedette'}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-all disabled:opacity-50 ${
                        villa.vedette
                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                          : 'th-text-2 hover:th-text-1'
                      }`}
                      style={!villa.vedette ? { border: '1px solid var(--border)' } : {}}
                    >
                      <IconStar filled={villa.vedette} />
                      {villa.vedette ? 'En vedette' : 'Mettre en vedette'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

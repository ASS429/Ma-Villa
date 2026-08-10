import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import VillaCard from '../../components/VillaCard'

interface FavoriVilla {
  id: number
  nom: string
  ville: string
  description: string
  telephone: string
  photos: { url: string; alt: string }[]
  avis: { note: number }[]
}

interface Favori {
  id: number
  villa_id: number
  villa: FavoriVilla
}

export default function Favoris() {
  const [favoris, setFavoris] = useState<Favori[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/favoris')
      .then((res) => setFavoris(res.data))
      .finally(() => setIsLoading(false))
  }, [])

  const retirer = async (villaId: number) => {
    await api.delete(`/villas/${villaId}/favoris`)
    setFavoris((prev) => prev.filter((f) => f.villa_id !== villaId))
  }

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
      Chargement...
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-normal">Mes favoris</h1>
        {favoris.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-3)' }}>
            {favoris.length} villa{favoris.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {favoris.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-bg)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
          </div>
          <p className="font-medium mb-2" style={{ color: 'var(--text-1)' }}>Aucun favori pour l'instant</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
            Explorez les villas et sauvegardez vos préférées ici.
          </p>
          <Link
            to="/villas"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Explorer les villas
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoris.map((f) => (
            <VillaCard
              key={f.id}
              villa={f.villa}
              isFavori={true}
              onToggleFavori={(e) => { e.preventDefault(); retirer(f.villa_id) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

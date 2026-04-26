import { Link } from 'react-router-dom'
import { Users, Waves, Wifi } from 'lucide-react'

interface Villa {
  id: number
  nom: string
  ville: string
  description: string
  telephone: string
  photos: { url: string; alt: string }[]
  avis: { note: number }[]
  vedette?: boolean
  prix_min?: number
  capacite?: number
  piscine?: boolean
  wifi?: boolean
}

interface VillaCardProps {
  villa: Villa
  isFavori?: boolean
  onToggleFavori?: (e: React.MouseEvent) => void
}

export default function VillaCard({ villa, isFavori, onToggleFavori }: VillaCardProps) {
  const avis = villa.avis ?? []
  const note = avis.length
    ? (avis.reduce((s, a) => s + a.note, 0) / avis.length).toFixed(1)
    : null

  const amenities = [
    villa.capacite ? { Icon: Users, label: `${villa.capacite} pers.` } : null,
    villa.piscine   ? { Icon: Waves, label: 'Piscine' } : null,
    villa.wifi      ? { Icon: Wifi,  label: 'WiFi' } : null,
  ].filter(Boolean) as { Icon: typeof Users; label: string }[]

  return (
    <Link to={`/villas/${villa.id}`} className="block group card-lift" style={{ textDecoration: 'none' }}>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Photo area */}
        <div className="relative overflow-hidden" style={{ aspectRatio: '3/4' }}>
          {villa.photos[0] ? (
            <img
              src={villa.photos[0].url}
              alt={villa.photos[0].alt || villa.nom}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: 'linear-gradient(135deg, #C4846A 0%, #D4B896 40%, #A8C5D0 100%)' }}
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-500" />

          {/* Vedette badge — top left */}
          {villa.vedette && (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold text-white uppercase"
              style={{
                background: 'linear-gradient(135deg, var(--accent-gold), var(--accent))',
                letterSpacing: '0.08em',
              }}
            >
              Vedette
            </div>
          )}

          {/* Price badge — top right */}
          {villa.prix_min ? (
            <div
              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: 'rgba(255,252,248,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#1A1614',
              }}
            >
              {villa.prix_min.toLocaleString('fr-FR')}
              <span className="font-normal opacity-60 ml-0.5">FCFA</span>
            </div>
          ) : null}

          {/* Favorite button */}
          {onToggleFavori && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavori(e) }}
              className="absolute w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
              style={{
                background: 'rgba(0,0,0,0.45)',
                top: villa.prix_min ? 48 : 12,
                right: 12,
              }}
              aria-label={isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavori ? '#ef4444' : 'none'} stroke={isFavori ? '#ef4444' : 'rgba(255,255,255,0.75)'} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          )}

          {/* Villa info bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-end justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-white leading-snug truncate"
                  style={{ fontSize: '0.95rem' }}
                >
                  {villa.nom}
                </h3>
                <p className="text-sm text-white/70 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  {villa.ville}
                </p>
              </div>
              {note && (
                <span
                  className="shrink-0 text-sm text-white font-medium px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                >
                  ★ {note}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-3.5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          {villa.description && (
            <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
              {villa.description}
            </p>
          )}
          {amenities.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {amenities.map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-2)' }}
                >
                  <Icon size={11} style={{ color: 'var(--accent)' }} />
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

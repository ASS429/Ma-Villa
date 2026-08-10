import { Link } from 'react-router-dom'
import { Users, Star } from 'lucide-react'
import type { VillaResume } from '../types'
import { fcfa, noteLisible } from '../lib/format'

interface VillaCardProps {
  villa: VillaResume
  isFavori?: boolean
  onToggleFavori?: (e: React.MouseEvent) => void
  /** Les cartes visibles d'emblée ne doivent pas être différées. */
  prioritaire?: boolean
}

export default function VillaCard({ villa, isFavori, onToggleFavori, prioritaire }: VillaCardProps) {
  const note = noteLisible(villa.note_moyenne)
  const nbAvis = villa.avis_count ?? 0
  const photo = villa.photos?.[0]

  return (
    <Link to={`/villas/${villa.id}`} className="block group card-lift" style={{ textDecoration: 'none' }}>
      <article
        className="rounded-2xl overflow-hidden h-full flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Photo */}
        <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
          {photo ? (
            <img
              src={photo.url}
              alt={photo.alt || `${villa.nom}, ${villa.ville}`}
              loading={prioritaire ? 'eager' : 'lazy'}
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: 'linear-gradient(135deg, #C4846A 0%, #D4B896 40%, #A8C5D0 100%)' }}
            />
          )}

          {villa.vedette && (
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold text-white uppercase"
              style={{
                background: 'linear-gradient(135deg, var(--accent-gold), var(--accent))',
                letterSpacing: '0.08em',
              }}
            >
              Vedette
            </span>
          )}

          {onToggleFavori && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavori(e) }}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              aria-label={isFavori ? `Retirer ${villa.nom} des favoris` : `Ajouter ${villa.nom} aux favoris`}
              aria-pressed={isFavori}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavori ? '#ef4444' : 'none'} stroke={isFavori ? '#ef4444' : 'rgba(255,255,255,0.85)'} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          )}
        </div>

        {/* Informations — hors de la photo : le texte posé sur une image de
            luminosité arbitraire n'était pas lisible de façon fiable. */}
        <div className="px-4 py-4 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold th-text-1 leading-snug truncate">{villa.nom}</h3>
              <p className="text-sm th-text-2 mt-0.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {villa.ville}
              </p>
            </div>

            {note && (
              <span className="shrink-0 flex items-center gap-1 text-sm th-text-1 font-medium">
                <Star size={13} fill="var(--accent-gold)" stroke="var(--accent-gold)" />
                {note}
                <span className="th-text-3 font-normal">({nbAvis})</span>
              </span>
            )}
          </div>

          {villa.description && (
            <p className="text-sm line-clamp-2 th-text-2" style={{ lineHeight: 1.5 }}>
              {villa.description}
            </p>
          )}

          {/* Le prix, l'information n°1 d'une place de marché. */}
          <div
            className="flex items-end justify-between gap-2 mt-auto pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {villa.prix_min != null ? (
              <p className="th-text-1">
                <span className="text-xs th-text-3">à partir de </span>
                <span className="font-semibold">{fcfa(villa.prix_min)}</span>
              </p>
            ) : (
              <p className="text-sm th-text-3">Tarif sur demande</p>
            )}

            {villa.capacite_max ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-xs th-text-2">
                <Users size={12} style={{ color: 'var(--accent)' }} />
                {villa.capacite_max} pers.
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  )
}

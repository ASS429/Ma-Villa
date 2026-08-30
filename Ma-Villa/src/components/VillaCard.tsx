import { Link } from 'react-router-dom'
import Badge from './ui/Badge'
import Inclinable from './ui/Inclinable'
import { UNITE_TARIF, type VillaResume } from '../types'
import { fcfa, noteLisible } from '../lib/format'

interface VillaCardProps {
  villa: VillaResume
  isFavori?: boolean
  onToggleFavori?: (e: React.MouseEvent) => void
  /** Les cartes visibles d'emblée ne doivent pas être différées. */
  prioritaire?: boolean
}

function IconeLieu() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

/**
 * Carte de villa — planche 02 du design system.
 *
 * Elle répond dans l'ordre aux questions du client : c'est où, combien, à quoi
 * ça ressemble, est-ce fiable. Le prix est passé d'absent — l'API ne le
 * renvoyait pas — à deuxième information la plus lourde, juste après la photo.
 *
 * Photo en 4/3 et non 3/4 : en 3/4 la carte dépassait 500 px de haut sur
 * mobile et on n'en voyait qu'une par écran. En 4/3 on en voit deux, donc on
 * compare — et c'est la comparaison qui fait défiler.
 */
export default function VillaCard({ villa, isFavori, onToggleFavori, prioritaire }: VillaCardProps) {
  const note = noteLisible(villa.note_moyenne)
  const nbAvis = villa.avis_count ?? 0
  const photos = villa.photos ?? []
  const photo = photos[0]
  const unite = villa.prix_min_unite ? UNITE_TARIF[villa.prix_min_unite] : null

  const equipements = [
    villa.a_piscine ? 'Piscine' : null,
    villa.capacite_max ? `${villa.capacite_max} personnes` : null,
    villa.a_climatisation ? 'Climatisation' : null,
  ].filter(Boolean) as string[]

  // Barre oblique finale : c'est la seule forme que l'hébergeur sert
  // pré-rendue. Sans elle, un lien partagé sur WhatsApp s'affiche avec le
  // titre générique du site, au lieu du nom et du prix de la villa.
  // Voir `scripts/prerendu.mjs`.
  return (
    <Link to={`/hebergements/${villa.id}/`} className="carte-villa" aria-label={`${villa.nom}, ${villa.ville}`}>
      {/* L'inclinaison ne s'applique qu'au curseur : au doigt, elle n'aurait
          aucune direction à suivre et coûterait une couche de rendu par carte.
          Le filtre est en CSS, pas ici. */}
      <Inclinable as="article" className="carte overflow-hidden h-full flex flex-col" reflet>
        <div className="carte-villa-photo">
          {photo ? (
            <img
              src={photo.url}
              alt={photo.alt || `${villa.nom}, ${villa.ville}`}
              loading={prioritaire ? 'eager' : 'lazy'}
              decoding="async"
              /* Dimensions déclarées : réserve la place et évite que la grille
                 ne saute au chargement des images. */
              width={640}
              height={480}
            />
          ) : (
            <div className="carte-villa-sans-photo" aria-hidden="true" />
          )}

          {/* Boolean() explicite : un entier 0 venant de SQL serait rendu tel quel
              par JSX — c'est ainsi qu'un « 0 » s'affichait sur chaque carte. */}
          {Boolean(villa.vedette) && (
            <Badge ton="vedette" className="absolute top-3 left-3">Vedette</Badge>
          )}

          {onToggleFavori && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavori(e) }}
              className="carte-villa-favori"
              aria-label={isFavori ? `Retirer ${villa.nom} des favoris` : `Ajouter ${villa.nom} aux favoris`}
              aria-pressed={isFavori}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavori ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          )}

          {photos.length > 1 && (
            <span className="carte-villa-compteur">{photos.length} photos</span>
          )}
        </div>

        {/* Nom et ville hors de la photo : en surimpression ils devenaient
            illisibles sur une image claire et imposaient un dégradé permanent.
            Sur fond opaque, le contraste se vérifie une fois pour toutes. */}
        <div className="carte-villa-corps">
          <div className="flex items-start justify-between gap-3">
            <h3 className="carte-villa-nom">{villa.nom}</h3>
            {note && (
              <span className="carte-villa-note">
                <span className="etoile" aria-hidden="true">★</span>
                {note}
                <span className="th-text-3 font-normal"> ({nbAvis})</span>
              </span>
            )}
          </div>

          <p className="carte-villa-ville">
            <IconeLieu />
            {villa.ville}
          </p>

          {equipements.length > 0 && (
            <ul className="carte-villa-equipements">
              {equipements.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          {/* Le prix est isolé sous un filet, et c'est la seule ligne dont la
              graisse dépasse celle du nom : dans une grille, l'œil compare des
              montants alignés, pas des noms. Chiffres tabulaires pour que les
              colonnes de prix s'alignent réellement. */}
          <div className="carte-villa-prix">
            {villa.prix_min != null ? (
              <p>
                <span className="th-text-3 text-xs">à partir de </span>
                <span className="carte-villa-montant">{fcfa(villa.prix_min)}</span>
                {unite && <span className="th-text-3 text-xs"> / {unite}</span>}
              </p>
            ) : (
              <p className="text-sm th-text-3">Tarif sur demande</p>
            )}
          </div>
        </div>
      </Inclinable>
    </Link>
  )
}

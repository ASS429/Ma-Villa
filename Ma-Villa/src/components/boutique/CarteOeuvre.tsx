import { ImageOff } from 'lucide-react'
import { fcfa } from '../../lib/format'
import Badge from '../ui/Badge'
import Inclinable from '../ui/Inclinable'
import type { Oeuvre } from '../../types'

/**
 * Carte d'œuvre.
 *
 * Format portrait, à l'inverse des cartes de villa qui sont en 4/3 : une villa
 * se compare sur ses équipements, une œuvre se regarde. La photo occupe donc
 * la carte, et le texte se réduit à ce qu'on lit sous un cartel de galerie —
 * titre, artiste, prix.
 *
 * Une œuvre vendue garde sa carte, marquée. La retirer donnerait une vitrine
 * clairsemée sans dire pourquoi, quand « vendue » raconte au contraire qu'ici
 * on achète.
 */
export default function CarteOeuvre({ oeuvre, prioritaire }: { oeuvre: Oeuvre; prioritaire?: boolean }) {
  const photo = oeuvre.photos?.[0]
  const vendue = oeuvre.statut === 'vendue'

  return (
    <Inclinable className={`carte-oeuvre${vendue ? ' est-vendue' : ''}`}>
      <div className="carte-oeuvre-image">
        {photo ? (
          <img
            src={photo.url}
            alt={photo.alt || `${oeuvre.titre}, ${oeuvre.artiste}`}
            loading={prioritaire ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <div className="carte-oeuvre-vide" aria-hidden="true">
            <ImageOff size={22} />
          </div>
        )}

        {vendue && (
          <span className="carte-oeuvre-marque">
            <Badge ton="neutre">{oeuvre.stock === 0 ? 'Épuisé' : 'Vendue'}</Badge>
          </span>
        )}
        {/* Le dernier exemplaire se signale : c'est ce qui décide d'acheter
            aujourd'hui plutôt que d'y repenser. */}
        {!vendue && oeuvre.stock === 1 && (
          <span className="carte-oeuvre-marque carte-oeuvre-marque-bas">
            <Badge ton="warning">Dernière pièce</Badge>
          </span>
        )}
        {!vendue && oeuvre.vedette && (
          <span className="carte-oeuvre-marque">
            <Badge ton="vedette">Coup de cœur</Badge>
          </span>
        )}
      </div>

      <div className="carte-oeuvre-texte">
        <p className="carte-oeuvre-titre">{oeuvre.titre}</p>
        <p className="carte-oeuvre-artiste">{oeuvre.artiste}</p>
        <p className="carte-oeuvre-prix">{fcfa(oeuvre.prix)}</p>
        {/* La technique et les dimensions font le cartel : c'est ce qu'un
            acheteur d'art regarde juste après le prix. */}
        {(oeuvre.technique || oeuvre.dimensions) && (
          <p className="carte-oeuvre-cartel">
            {[oeuvre.technique, oeuvre.dimensions].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </Inclinable>
  )
}

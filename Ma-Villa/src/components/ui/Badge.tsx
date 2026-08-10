import type { ReactNode } from 'react'

type Ton = 'success' | 'warning' | 'danger' | 'neutre' | 'vedette'

/**
 * Pastille de statut. Le point coloré n'est pas décoratif : il double
 * l'information portée par la couleur, pour rester lisible en cas de
 * daltonisme ou d'impression en niveaux de gris.
 */
export default function Badge({
  ton = 'neutre',
  point = true,
  children,
  className,
}: {
  ton?: Ton
  point?: boolean
  children: ReactNode
  className?: string
}) {
  const avecPoint = point && ton !== 'vedette'

  return (
    <span className={`badge badge-${ton} ${className ?? ''}`}>
      {avecPoint && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Note en étoiles. La valeur chiffrée porte le sens, les étoiles l'illustrent. */
export function Etoiles({ note, taille = 14 }: { note: number; taille?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${note} sur 5`} style={{ fontSize: taille }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className={i <= note ? 'etoile' : 'etoile-vide'}>
          ★
        </span>
      ))}
    </span>
  )
}

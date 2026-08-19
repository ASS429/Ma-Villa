import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../ui/Button'
import type { Page } from '../../lib/page'

interface Props {
  page: Page<unknown> | null
  onChange: (page: number) => void
  /** Nom de ce qu'on compte, au singulier : « villa », « compte », « avis ». */
  unite: string
}

/**
 * Pagination des listes d'administration.
 *
 * Volontairement réduite à « précédent / suivant » plus un état lisible : une
 * rangée de numéros de page tient mal en 375 px, et sur ces écrans on parcourt
 * de proche en proche ou on filtre — on ne saute pas à la page 7.
 *
 * L'état compte en éléments et non en pages : « 21 à 40 sur 137 comptes » dit
 * combien il reste à traiter, là où « page 2 sur 7 » oblige à multiplier.
 */
export default function Pagination({ page, onChange, unite }: Props) {
  if (!page || page.last_page <= 1) return null

  const pluriel = page.total > 1 && !unite.endsWith('s') ? `${unite}s` : unite

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-etat">
        {page.from ?? 0} à {page.to ?? 0} sur {page.total} {pluriel}
      </p>

      <div className="pagination-boutons">
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onChange(page.current_page - 1)}
          disabled={page.current_page <= 1}
          iconeAvant={<ChevronLeft size={15} />}
          aria-label="Page précédente"
        >
          Précédent
        </Button>
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onChange(page.current_page + 1)}
          disabled={page.current_page >= page.last_page}
          iconeApres={<ChevronRight size={15} />}
          aria-label="Page suivante"
        >
          Suivant
        </Button>
      </div>
    </nav>
  )
}

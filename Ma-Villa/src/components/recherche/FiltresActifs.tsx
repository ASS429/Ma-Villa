import { libelleFiltre, type CleFiltre } from '../../lib/filtres'
import { useLangue } from '../../i18n/langue'
import { TEXTES_RECHERCHE } from '../../i18n/recherche'

/**
 * Filtres actifs en pastilles retirables — planche 06.
 *
 * Sans elles, les critères restaient invisibles une fois le panneau refermé :
 * on voyait « aucun résultat » sans comprendre ce qui l'avait provoqué.
 */
export default function FiltresActifs({
  actifs,
  nomsCategories = {},
  onRetirer,
  onToutEffacer,
}: {
  actifs: [CleFiltre, string][]
  /** Noms lisibles des catégories, venus de la base. */
  nomsCategories?: Record<string, string>
  onRetirer: (cle: CleFiltre) => void
  onToutEffacer: () => void
}) {
  const { langue } = useLangue()
  const t = TEXTES_RECHERCHE[langue].filtres
  if (actifs.length === 0) return null

  return (
    <ul className="filtres-actifs" aria-label={t.appliques}>
      {actifs.map(([cle, valeur]) => (
        <li key={cle}>
          <button
            type="button"
            className="pastille-filtre"
            onClick={() => onRetirer(cle)}
            aria-label={t.retirer(libelleFiltre(cle, valeur, nomsCategories, langue))}
          >
            {libelleFiltre(cle, valeur, nomsCategories, langue)}
            <span aria-hidden="true">✕</span>
          </button>
        </li>
      ))}

      {actifs.length > 1 && (
        <li>
          <button type="button" className="filtres-effacer" onClick={onToutEffacer}>
            {t.toutEffacer}
          </button>
        </li>
      )}
    </ul>
  )
}

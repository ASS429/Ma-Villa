import { libelleFiltre, type CleFiltre } from '../../lib/filtres'

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
  if (actifs.length === 0) return null

  return (
    <ul className="filtres-actifs" aria-label="Filtres appliqués">
      {actifs.map(([cle, valeur]) => (
        <li key={cle}>
          <button
            type="button"
            className="pastille-filtre"
            onClick={() => onRetirer(cle)}
            aria-label={`Retirer le filtre ${libelleFiltre(cle, valeur, nomsCategories)}`}
          >
            {libelleFiltre(cle, valeur, nomsCategories)}
            <span aria-hidden="true">✕</span>
          </button>
        </li>
      ))}

      {actifs.length > 1 && (
        <li>
          <button type="button" className="filtres-effacer" onClick={onToutEffacer}>
            Tout effacer
          </button>
        </li>
      )}
    </ul>
  )
}

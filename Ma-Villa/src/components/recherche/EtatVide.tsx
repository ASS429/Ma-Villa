import Button from '../ui/Button'
import { libelleFiltre, type CleFiltre } from '../../lib/filtres'
import type { Suggestion } from './useSuggestionsFiltres'

/**
 * État « aucun résultat » — planche 06.
 *
 * Il ne se contente pas de constater : il désigne le filtre responsable et
 * annonce ce qu'on gagnerait à le retirer. Sans cela, l'utilisateur retire ses
 * critères au hasard, ou quitte la page.
 */
export default function EtatVide({
  actifs,
  suggestions,
  recherche,
  avecDates,
  nomsCategories = {},
  onRetirer,
  onToutEffacer,
}: {
  actifs: [CleFiltre, string][]
  nomsCategories?: Record<string, string>
  suggestions: Suggestion[]
  recherche: boolean
  avecDates: boolean
  onRetirer: (cle: CleFiltre) => void
  onToutEffacer: () => void
}) {
  const meilleure = suggestions[0]
  const valeur = meilleure ? actifs.find(([c]) => c === meilleure.cle)?.[1] : undefined

  return (
    <div className="etat-vide">
      <div className="etat-vide-icone" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
      </div>

      <h2 className="etat-vide-titre">
        {actifs.length > 0 ? 'Aucune villa avec ces filtres' : 'Aucune villa disponible'}
      </h2>

      {recherche && (
        <p className="etat-vide-texte">Recherche d'alternatives…</p>
      )}

      {!recherche && meilleure && valeur !== undefined && (
        <>
          <p className="etat-vide-texte">
            En retirant <strong>{libelleFiltre(meilleure.cle, valeur, nomsCategories)}</strong>,{' '}
            <strong>{meilleure.resultats}</strong> villa{meilleure.resultats > 1 ? 's' : ''}{' '}
            correspond{meilleure.resultats > 1 ? 'ent' : ''}.
          </p>
          <div className="etat-vide-actions">
            <Button
              variante="primaire"
              taille="sm"
              onClick={() => onRetirer(meilleure.cle)}
            >
              Retirer « {libelleFiltre(meilleure.cle, valeur, nomsCategories)} »
            </Button>
            <Button variante="discret" taille="sm" onClick={onToutEffacer}>
              Tout effacer
            </Button>
          </div>
        </>
      )}

      {!recherche && !meilleure && (
        <>
          <p className="etat-vide-texte">
            {avecDates
              ? 'Essayez d\'autres dates, ou élargissez votre budget.'
              : 'Essayez d\'autres critères de recherche.'}
          </p>
          {actifs.length > 0 && (
            <div className="etat-vide-actions">
              <Button variante="primaire" taille="sm" onClick={onToutEffacer}>
                Voir toutes les villas
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

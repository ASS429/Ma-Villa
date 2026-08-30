import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import { fcfa } from '../../lib/format'
import { LIBELLES_LOGEMENT, TYPES_LOGEMENT_PROPOSES } from '../../types'


const NOTES = [
  { valeur: '', libelle: 'Toutes' },
  { valeur: '3', libelle: '3★ et +' },
  { valeur: '4', libelle: '4★ et +' },
]

export interface Brouillon {
  prix_min: string
  prix_max: string
  type_logement: string
  note_min: string
}

/**
 * Feuille de filtres — planche 06.
 *
 * En 375 px, un panneau déroulant dans le flux repoussait les résultats hors
 * écran et n'offrait aucun point de sortie clair. La feuille occupe l'écran,
 * annonce ce qu'elle va donner (« Voir les 28 villas ») et se ferme d'un geste.
 *
 * Les types sont des pastilles plutôt qu'un menu déroulant : quatre valeurs
 * forment une liste finie, et un menu coûte deux tapotements de plus pour rien.
 */
export default function FeuilleFiltres({
  initiaux,
  nbResultats,
  onAppliquer,
  onEffacer,
  onFermer,
}: {
  initiaux: Brouillon
  nbResultats: number
  onAppliquer: (b: Brouillon) => void
  onEffacer: () => void
  onFermer: () => void
}) {
  const [brouillon, setBrouillon] = useState<Brouillon>(initiaux)
  const panneau = useRef<HTMLDivElement>(null)

  const maj = (cle: keyof Brouillon, valeur: string) =>
    setBrouillon((b) => ({ ...b, [cle]: b[cle] === valeur ? '' : valeur }))

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', surTouche)

    // La page derrière ne doit pas défiler pendant que la feuille est ouverte.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panneau.current?.focus()

    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = overflow
    }
  }, [onFermer])

  return (
    <div className="feuille-fond" onClick={onFermer}>
      <div
        ref={panneau}
        className="feuille"
        role="dialog"
        aria-modal="true"
        aria-label="Filtres de recherche"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="feuille-entete">
          <h2 className="feuille-titre">Filtres</h2>
          <button type="button" onClick={onFermer} className="feuille-fermer" aria-label="Fermer les filtres">
            ✕
          </button>
        </header>

        <div className="feuille-corps">
          <section className="feuille-section">
            <h3 className="feuille-section-titre">Budget</h3>
            <div className="feuille-budget">
              <label>
                <span className="champ-label">Minimum</span>
                <input
                  type="number" min={0} inputMode="numeric" placeholder="0"
                  className="champ-controle"
                  value={brouillon.prix_min}
                  onChange={(e) => setBrouillon({ ...brouillon, prix_min: e.target.value })}
                />
              </label>
              <label>
                <span className="champ-label">Maximum</span>
                <input
                  type="number" min={0} inputMode="numeric" placeholder="500 000"
                  className="champ-controle"
                  value={brouillon.prix_max}
                  onChange={(e) => setBrouillon({ ...brouillon, prix_max: e.target.value })}
                />
              </label>
            </div>
            {(brouillon.prix_min || brouillon.prix_max) && (
              <p className="champ-aide">
                {brouillon.prix_min && brouillon.prix_max
                  ? `De ${fcfa(brouillon.prix_min)} à ${fcfa(brouillon.prix_max)}`
                  : brouillon.prix_min
                    ? `À partir de ${fcfa(brouillon.prix_min)}`
                    : `Jusqu'à ${fcfa(brouillon.prix_max)}`}
              </p>
            )}
          </section>

          <section className="feuille-section">
            <h3 className="feuille-section-titre">Type de logement</h3>
            <div className="feuille-pastilles">
              {TYPES_LOGEMENT_PROPOSES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pastille-choix${brouillon.type_logement === t ? ' est-choisi' : ''}`}
                  onClick={() => maj('type_logement', t)}
                  aria-pressed={brouillon.type_logement === t}
                >
                  {LIBELLES_LOGEMENT[t]}
                </button>
              ))}
            </div>
          </section>

          <section className="feuille-section">
            <h3 className="feuille-section-titre">Note minimale</h3>
            <div className="feuille-pastilles">
              {NOTES.map((n) => (
                <button
                  key={n.valeur || 'toutes'}
                  type="button"
                  className={`pastille-choix${brouillon.note_min === n.valeur ? ' est-choisi' : ''}`}
                  onClick={() => setBrouillon({ ...brouillon, note_min: n.valeur })}
                  aria-pressed={brouillon.note_min === n.valeur}
                >
                  {n.libelle}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="feuille-pied">
          <Button variante="discret" taille="sm" onClick={onEffacer}>Effacer</Button>
          {/* Annoncer le résultat attendu évite d'appliquer à l'aveugle. */}
          <Button variante="primaire" taille="sm" onClick={() => onAppliquer(brouillon)}>
            {nbResultats > 0 ? `Voir les ${nbResultats} villas` : 'Appliquer'}
          </Button>
        </footer>
      </div>
    </div>
  )
}

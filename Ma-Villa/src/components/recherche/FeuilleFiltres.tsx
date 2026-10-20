import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import { fcfa } from '../../lib/format'
import { TYPES_LOGEMENT_PROPOSES } from '../../types'
import { useLangue } from '../../i18n/langue'
import { METIER } from '../../i18n/metier'
import { TEXTES_RECHERCHE } from '../../i18n/recherche'

const NOTES = ['', '3', '4']

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
  const { langue } = useLangue()
  const t = TEXTES_RECHERCHE[langue].filtres
  const metier = METIER[langue]
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
        aria-label={t.dialogue}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="feuille-entete">
          <h2 className="feuille-titre">{t.titre}</h2>
          <button type="button" onClick={onFermer} className="feuille-fermer" aria-label={t.fermer}>
            ✕
          </button>
        </header>

        <div className="feuille-corps">
          <section className="feuille-section">
            <h3 className="feuille-section-titre">{t.budget}</h3>
            <div className="feuille-budget">
              <label>
                <span className="champ-label">{t.minimum}</span>
                <input
                  type="number" min={0} inputMode="numeric" placeholder="0"
                  className="champ-controle"
                  value={brouillon.prix_min}
                  onChange={(e) => setBrouillon({ ...brouillon, prix_min: e.target.value })}
                />
              </label>
              <label>
                <span className="champ-label">{t.maximum}</span>
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
                  ? t.deA(fcfa(brouillon.prix_min), fcfa(brouillon.prix_max))
                  : brouillon.prix_min
                    ? t.aPartirDe(fcfa(brouillon.prix_min))
                    : t.jusquA(fcfa(brouillon.prix_max))}
              </p>
            )}
          </section>

          <section className="feuille-section">
            <h3 className="feuille-section-titre">{t.typeLogement}</h3>
            <div className="feuille-pastilles">
              {TYPES_LOGEMENT_PROPOSES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`pastille-choix${brouillon.type_logement === type ? ' est-choisi' : ''}`}
                  onClick={() => maj('type_logement', type)}
                  aria-pressed={brouillon.type_logement === type}
                >
                  {metier.logement[type]}
                </button>
              ))}
            </div>
          </section>

          <section className="feuille-section">
            <h3 className="feuille-section-titre">{t.noteMin}</h3>
            <div className="feuille-pastilles">
              {NOTES.map((n) => (
                <button
                  key={n || 'toutes'}
                  type="button"
                  className={`pastille-choix${brouillon.note_min === n ? ' est-choisi' : ''}`}
                  onClick={() => setBrouillon({ ...brouillon, note_min: n })}
                  aria-pressed={brouillon.note_min === n}
                >
                  {n ? t.etPlus(Number(n)) : t.toutes}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="feuille-pied">
          <Button variante="discret" taille="sm" onClick={onEffacer}>{t.effacer}</Button>
          {/* Annoncer le résultat attendu évite d'appliquer à l'aveugle. */}
          <Button variante="primaire" taille="sm" onClick={() => onAppliquer(brouillon)}>
            {nbResultats > 0 ? t.voirLes(nbResultats) : t.appliquer}
          </Button>
        </footer>
      </div>
    </div>
  )
}

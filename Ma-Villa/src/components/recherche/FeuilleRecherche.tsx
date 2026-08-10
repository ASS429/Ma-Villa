import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import { aujourdhui } from '../../lib/format'

const DESTINATIONS = ['Saly', 'Mbour', 'Dakar', 'Ziguinchor', 'Somone', 'Saint-Louis']

export interface CriteresRecherche {
  ville: string
  date_debut: string
  date_fin: string
  capacite: string
}

/**
 * Feuille de recherche mobile — planches 04 et 06.
 *
 * Quatre champs côte à côte en 375 px ne sont ni tapables ni lisibles : la
 * barre segmentée donnait des cibles de 80 px de large. Ici chaque contrôle
 * fait au moins 44 px de haut, et le calendrier a la place d'exister.
 *
 * La destination est en pastilles et non en menu déroulant : quatre villes
 * forment une liste finie, et un menu coûte deux tapotements de plus pour rien.
 *
 * Les dates restent facultatives — beaucoup arrivent par un lien WhatsApp sans
 * dates arrêtées, et exiger un calendrier avant de voir la moindre villa ferait
 * chuter la conversion.
 */
export default function FeuilleRecherche({
  initiaux,
  onValider,
  onFermer,
}: {
  initiaux: CriteresRecherche
  onValider: (criteres: CriteresRecherche) => void
  onFermer: () => void
}) {
  const [criteres, setCriteres] = useState<CriteresRecherche>(initiaux)
  const panneau = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', surTouche)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panneau.current?.focus()
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = overflow
    }
  }, [onFermer])

  const maj = (cle: keyof CriteresRecherche, valeur: string) =>
    setCriteres((c) => {
      const suivant = { ...c, [cle]: valeur }
      if (cle === 'date_debut' && suivant.date_fin && suivant.date_fin < valeur) {
        suivant.date_fin = valeur
      }
      return suivant
    })

  const voyageurs = Number(criteres.capacite) || 0

  return (
    <div
      ref={panneau}
      className="feuille-recherche"
      role="dialog"
      aria-modal="true"
      aria-label="Rechercher une villa"
      tabIndex={-1}
    >
      <header className="feuille-entete">
        <h2 className="feuille-titre">Où allez-vous ?</h2>
        <button type="button" onClick={onFermer} className="feuille-fermer" aria-label="Fermer la recherche">
          ✕
        </button>
      </header>

      <div className="feuille-corps">
        <section className="feuille-section">
          <h3 className="feuille-section-titre">Destination</h3>
          <div className="feuille-pastilles">
            {DESTINATIONS.map((v) => (
              <button
                key={v}
                type="button"
                className={`pastille-choix${criteres.ville === v ? ' est-choisi' : ''}`}
                onClick={() => maj('ville', criteres.ville === v ? '' : v)}
                aria-pressed={criteres.ville === v}
              >
                {v}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="champ-controle"
            placeholder="Ou saisissez une autre ville"
            aria-label="Autre destination"
            value={DESTINATIONS.includes(criteres.ville) ? '' : criteres.ville}
            onChange={(e) => maj('ville', e.target.value)}
          />
        </section>

        <section className="feuille-section">
          <h3 className="feuille-section-titre">
            Dates <span className="champ-aide">— facultatives</span>
          </h3>
          <div className="feuille-budget">
            <label>
              <span className="champ-label">Arrivée</span>
              <input
                type="date" className="champ-controle"
                min={aujourdhui()}
                value={criteres.date_debut}
                onChange={(e) => maj('date_debut', e.target.value)}
              />
            </label>
            <label>
              <span className="champ-label">Départ</span>
              <input
                type="date" className="champ-controle"
                min={criteres.date_debut || aujourdhui()}
                value={criteres.date_fin}
                onChange={(e) => maj('date_fin', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="feuille-section">
          <h3 className="feuille-section-titre">Voyageurs</h3>
          {/* Incrémenteur plutôt qu'un champ numérique : au doigt, deux cibles
              de 44 px valent mieux qu'un clavier qui recouvre l'écran. */}
          <div className="compteur">
            <button
              type="button"
              onClick={() => maj('capacite', String(Math.max(0, voyageurs - 1) || ''))}
              disabled={voyageurs === 0}
              aria-label="Un voyageur de moins"
            >
              −
            </button>
            <span aria-live="polite">
              {voyageurs > 0 ? `${voyageurs} voyageur${voyageurs > 1 ? 's' : ''}` : 'Peu importe'}
            </span>
            <button
              type="button"
              onClick={() => maj('capacite', String(Math.min(50, voyageurs + 1)))}
              aria-label="Un voyageur de plus"
            >
              +
            </button>
          </div>
        </section>
      </div>

      <footer className="feuille-pied">
        <Button
          variante="discret"
          taille="sm"
          onClick={() => setCriteres({ ville: '', date_debut: '', date_fin: '', capacite: '' })}
        >
          Effacer
        </Button>
        {/* Reste actif même sans dates : la destination seule suffit. */}
        <Button variante="primaire" taille="md" onClick={() => onValider(criteres)}>
          Rechercher
        </Button>
      </footer>
    </div>
  )
}

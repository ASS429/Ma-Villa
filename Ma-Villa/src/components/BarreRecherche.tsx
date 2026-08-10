import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import Button from './ui/Button'
import { aujourdhui } from '../lib/format'

const DESTINATIONS = ['Saly', 'Mbour', 'Dakar', 'Ziguinchor', 'Somone', 'Cap Skirring']

interface Props {
  /** `hero` : posé sur la vidéo. `page` : intégré dans une page claire. */
  variante?: 'hero' | 'page'
  valeursInitiales?: { ville?: string; date_debut?: string; date_fin?: string; capacite?: string }
  /** Fourni sur /villas pour filtrer sur place plutôt que de renaviguer. */
  onRecherche?: (criteres: Record<string, string>) => void
}

/**
 * Destination + dates + voyageurs.
 * L'accueil n'offrait aucune recherche : le visiteur devait atteindre /villas
 * puis découvrir un panneau de filtres. C'est pourtant le point d'entrée du
 * parcours sur une place de marché de séjour.
 */
export default function BarreRecherche({ variante = 'hero', valeursInitiales, onRecherche }: Props) {
  const navigate = useNavigate()
  const [criteres, setCriteres] = useState({
    ville: valeursInitiales?.ville ?? '',
    date_debut: valeursInitiales?.date_debut ?? '',
    date_fin: valeursInitiales?.date_fin ?? '',
    capacite: valeursInitiales?.capacite ?? '',
  })

  const surHero = variante === 'hero'

  const majCritere = (cle: keyof typeof criteres, valeur: string) => {
    setCriteres((c) => {
      const suivant = { ...c, [cle]: valeur }
      // Un départ antérieur à l'arrivée n'a pas de sens : on le repousse.
      if (cle === 'date_debut' && suivant.date_fin && suivant.date_fin < valeur) {
        suivant.date_fin = valeur
      }
      return suivant
    })
  }

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault()
    const remplis = Object.fromEntries(
      Object.entries(criteres).filter(([, v]) => v !== '')
    ) as Record<string, string>

    if (onRecherche) {
      onRecherche(remplis)
      return
    }
    navigate({ pathname: '/villas', search: new URLSearchParams(remplis).toString() })
  }

  const styleChamp: React.CSSProperties = surHero
    ? {
        background: 'rgba(255,255,255,0.16)',
        border: '1px solid rgba(255,255,255,0.28)',
        color: '#fff',
        colorScheme: 'dark',
      }
    : {
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        color: 'var(--text-1)',
      }

  const classeLabel = surHero
    ? 'text-xs mb-1.5 block text-white/75'
    : 'text-xs mb-1.5 block th-text-2'

  return (
    <form
      onSubmit={soumettre}
      className="rounded-2xl p-4 md:p-5"
      style={
        surHero
          ? {
              background: 'rgba(0,0,0,0.32)',
              border: '1px solid rgba(255,255,255,0.20)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }
          : {
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }
      }
      role="search"
      aria-label="Rechercher une villa"
    >
      <div className="grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] gap-3 items-end">
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="rech-ville" className={classeLabel}>Destination</label>
          <input
            id="rech-ville"
            list="destinations-senegal"
            value={criteres.ville}
            onChange={(e) => majCritere('ville', e.target.value)}
            placeholder="Saly, Mbour, Dakar…"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none placeholder:opacity-60"
            style={styleChamp}
          />
          <datalist id="destinations-senegal">
            {DESTINATIONS.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>

        <div>
          <label htmlFor="rech-debut" className={classeLabel}>Arrivée</label>
          <input
            id="rech-debut"
            type="date"
            min={aujourdhui()}
            value={criteres.date_debut}
            onChange={(e) => majCritere('date_debut', e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={styleChamp}
          />
        </div>

        <div>
          <label htmlFor="rech-fin" className={classeLabel}>Départ</label>
          <input
            id="rech-fin"
            type="date"
            min={criteres.date_debut || aujourdhui()}
            value={criteres.date_fin}
            onChange={(e) => majCritere('date_fin', e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={styleChamp}
          />
        </div>

        <div>
          <label htmlFor="rech-capacite" className={classeLabel}>Voyageurs</label>
          <input
            id="rech-capacite"
            type="number"
            min={1}
            max={50}
            value={criteres.capacite}
            onChange={(e) => majCritere('capacite', e.target.value)}
            placeholder="2"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:opacity-60"
            style={styleChamp}
          />
        </div>

        <Button
          type="submit"
          variante="primaire"
          taille="sm"
          className="col-span-2 lg:col-span-1"
          iconeAvant={<Search size={16} aria-hidden="true" />}
        >
          Rechercher
        </Button>
      </div>
    </form>
  )
}

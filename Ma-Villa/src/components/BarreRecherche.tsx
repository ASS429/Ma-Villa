import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import Button from './ui/Button'
import FeuilleRecherche, { type CriteresRecherche } from './recherche/FeuilleRecherche'
import { aujourdhui, dateCourte } from '../lib/format'

const DESTINATIONS = ['Saly', 'Mbour', 'Dakar', 'Ziguinchor', 'Somone', 'Cap Skirring']

interface Props {
  /** `hero` : posé sur la photo. `page` : intégré dans une page claire. */
  variante?: 'hero' | 'page'
  valeursInitiales?: Partial<CriteresRecherche>
  /** Fourni sur /villas pour filtrer sur place plutôt que de renaviguer. */
  onRecherche?: (criteres: Record<string, string>) => void
}

/** Résumé affiché sur le champ unique en mobile. */
function resume(c: CriteresRecherche): { titre: string; detail: string } {
  const morceaux: string[] = []
  if (c.date_debut && c.date_fin) {
    morceaux.push(`${dateCourte(c.date_debut)} → ${dateCourte(c.date_fin)}`)
  } else if (c.date_debut) {
    morceaux.push(`dès le ${dateCourte(c.date_debut)}`)
  }
  if (c.capacite) morceaux.push(`${c.capacite} voyageur${Number(c.capacite) > 1 ? 's' : ''}`)

  return {
    titre: c.ville || 'Où allez-vous ?',
    detail: morceaux.join(' · ') || 'Dates · voyageurs',
  }
}

/**
 * Destination + dates + voyageurs.
 *
 * En mobile, un champ unique qui ouvre une feuille plein écran : quatre champs
 * côte à côte en 375 px donnent des cibles de 80 px de large, sur lesquelles on
 * tape à côté. En desktop, la barre segmentée reste le geste le plus direct.
 */
export default function BarreRecherche({ variante = 'hero', valeursInitiales, onRecherche }: Props) {
  const navigate = useNavigate()
  const [feuilleOuverte, setFeuilleOuverte] = useState(false)
  const [criteres, setCriteres] = useState<CriteresRecherche>({
    ville: valeursInitiales?.ville ?? '',
    date_debut: valeursInitiales?.date_debut ?? '',
    date_fin: valeursInitiales?.date_fin ?? '',
    capacite: valeursInitiales?.capacite ?? '',
  })

  const surHero = variante === 'hero'

  const majCritere = (cle: keyof CriteresRecherche, valeur: string) => {
    setCriteres((c) => {
      const suivant = { ...c, [cle]: valeur }
      // Un départ antérieur à l'arrivée n'a pas de sens : on le repousse.
      if (cle === 'date_debut' && suivant.date_fin && suivant.date_fin < valeur) {
        suivant.date_fin = valeur
      }
      return suivant
    })
  }

  const lancer = (valeurs: CriteresRecherche) => {
    const remplis = Object.fromEntries(
      Object.entries(valeurs).filter(([, v]) => v !== '')
    ) as Record<string, string>

    if (onRecherche) onRecherche(remplis)
    else navigate({ pathname: '/villas', search: new URLSearchParams(remplis).toString() })
  }

  const styleChamp: React.CSSProperties = surHero
    ? { background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', colorScheme: 'dark', minHeight: 44 }
    : { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-1)', minHeight: 44 }

  const classeLabel = surHero ? 'text-xs mb-1.5 block text-white/75' : 'text-xs mb-1.5 block th-text-2'
  const { titre, detail } = resume(criteres)

  return (
    <>
      {/* — mobile : un champ unique qui ouvre la feuille — */}
      <button
        type="button"
        className={`recherche-compacte${surHero ? ' sur-hero' : ''}`}
        onClick={() => setFeuilleOuverte(true)}
        aria-haspopup="dialog"
      >
        <Search size={18} aria-hidden="true" />
        <span className="recherche-compacte-texte">
          <span className="recherche-compacte-titre">{titre}</span>
          <span className="recherche-compacte-detail">{detail}</span>
        </span>
      </button>

      {feuilleOuverte && (
        <FeuilleRecherche
          initiaux={criteres}
          onValider={(v) => { setCriteres(v); setFeuilleOuverte(false); lancer(v) }}
          onFermer={() => setFeuilleOuverte(false)}
        />
      )}

      {/* — desktop : la barre segmentée — */}
      <form
        onSubmit={(e) => { e.preventDefault(); lancer(criteres) }}
        className="recherche-etendue rounded-2xl p-4 md:p-5"
        style={
          surHero
            ? {
                background: 'rgba(0,0,0,0.32)',
                border: '1px solid rgba(255,255,255,0.20)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }
            : { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }
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
              id="rech-debut" type="date" min={aujourdhui()}
              value={criteres.date_debut}
              onChange={(e) => majCritere('date_debut', e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={styleChamp}
            />
          </div>

          <div>
            <label htmlFor="rech-fin" className={classeLabel}>Départ</label>
            <input
              id="rech-fin" type="date" min={criteres.date_debut || aujourdhui()}
              value={criteres.date_fin}
              onChange={(e) => majCritere('date_fin', e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={styleChamp}
            />
          </div>

          <div>
            <label htmlFor="rech-capacite" className={classeLabel}>Voyageurs</label>
            <input
              id="rech-capacite" type="number" min={1} max={50}
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
    </>
  )
}

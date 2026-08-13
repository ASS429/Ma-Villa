import { useNavigate } from 'react-router-dom'
import { Home, Building2, DoorOpen, Waves, BedDouble, Hotel, Tent } from 'lucide-react'
import { useConfig, type Categorie } from '../../context/ConfigContext'

/**
 * « Que cherchez-vous ? » avant « Où ? » — planche 10.
 *
 * L'ordre compte : chercher un lieu avant de savoir ce qu'on loue oblige à
 * filtrer ensuite dans un catalogue mélangé, où une piscine à la journée
 * côtoie un studio au mois. La catégorie choisie d'abord détermine les filtres
 * proposés et l'unité sous le prix — le reste de l'écran ne bouge pas.
 *
 * Cinq cibles ou plus, pleine largeur, aucune sous 88 px : c'est une colonne,
 * pas une grille. La liste s'allonge sans refonte quand une catégorie s'ajoute.
 */

const ICONES: Record<string, typeof Home> = {
  villa: Home,
  appartement: Building2,
  studio: DoorOpen,
  chambre: BedDouble,
  piscine: Waves,
  hotel: Hotel,
  auberge: Tent,
}

/** Ce que la catégorie promet, en une ligne — pas une définition, un usage. */
const PROMESSES: Record<string, string> = {
  villa: 'Toute la maison pour vous',
  appartement: 'Un logement indépendant',
  studio: 'Pour un séjour au long cours',
  chambre: 'Une chambre chez l\'habitant',
  piscine: 'À la journée, sans dormir sur place',
  hotel: 'Service et réception',
  auberge: 'Simple et économique',
}

export default function ChoixCategorie({ compact = false }: { compact?: boolean }) {
  const { categories } = useConfig()
  const navigate = useNavigate()

  if (categories.length === 0) return null

  const aller = (c: Categorie) =>
    navigate({ pathname: '/villas', search: `?categorie=${encodeURIComponent(c.cle)}` })

  return (
    <ul className={`choix-categorie${compact ? ' est-compact' : ''}`}>
      {categories.map((c) => {
        const Icone = ICONES[c.cle] ?? Home
        return (
          <li key={c.cle}>
            <button type="button" onClick={() => aller(c)} className="categorie-cible">
              <span className="categorie-icone" aria-hidden="true">
                <Icone size={22} strokeWidth={1.8} />
              </span>
              <span className="categorie-texte">
                <span className="categorie-nom">{c.nom}</span>
                {PROMESSES[c.cle] && (
                  <span className="categorie-promesse">{PROMESSES[c.cle]}</span>
                )}
              </span>
              <span className="categorie-fleche" aria-hidden="true">›</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

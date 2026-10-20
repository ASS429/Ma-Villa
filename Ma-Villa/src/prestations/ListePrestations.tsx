import { Bus, UtensilsCrossed } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { fcfa } from '../lib/format'
import { useLangue } from '../i18n/langue'
import { TEXTES_PRESTATIONS } from './textes'
import type { CataloguePrestations, FamillePrestation } from '../types'

const ICONE: Record<FamillePrestation, typeof Bus> = {
  transport: Bus,
  restauration: UtensilsCrossed,
}

/**
 * Les prestations d'une ou plusieurs familles, chacune avec son prix de départ
 * et un bouton qui la choisit dans le formulaire.
 *
 * Une famille en aperçu porte un badge : l'administrateur doit voir d'un coup
 * d'œil ce que le public, lui, ne voit pas.
 */
export default function ListePrestations({
  catalogue,
  familles: seulement,
  onChoisir,
}: {
  catalogue: CataloguePrestations
  familles?: FamillePrestation[]
  onChoisir: (cle: string) => void
}) {
  const { langue } = useLangue()
  const t = TEXTES_PRESTATIONS[langue]
  const familles = (Object.keys(catalogue.familles) as FamillePrestation[])
    .filter((f) => !seulement || seulement.includes(f))

  return (
    <div className={`grid gap-6 ${familles.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {familles.map((famille) => {
        const Icone = ICONE[famille] ?? Bus
        const prestations = catalogue.catalogue.filter((p) => p.famille === famille)

        return (
          <div key={famille} className="panneau">
            <h3 className="panneau-titre">
              <Icone size={17} aria-hidden="true" /> {catalogue.familles[famille]?.[langue] ?? famille}
              {catalogue.en_apercu?.includes(famille) && <Badge ton="warning">Aperçu</Badge>}
            </h3>
            <ul className="flex flex-col">
              {prestations.map((p, i) => (
                <li
                  key={p.cle}
                  className="py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  style={i ? { borderTop: '1px solid var(--border)' } : undefined}
                >
                  <div style={{ minWidth: 0 }}>
                    <p className="font-medium th-text-1">{p.libelle[langue]}</p>
                    <p className="text-sm th-text-2 leading-relaxed mt-1">{p.description[langue]}</p>
                    <p className="text-sm mt-2 th-text-1">
                      <span className="th-text-3">{t.aPartirDe} </span>
                      <strong className="font-semibold">{fcfa(p.prix_a_partir_de)}</strong>
                      <span className="th-text-3"> · {p.unite[langue]}</span>
                    </p>
                  </div>
                  <Button
                    variante="secondaire"
                    taille="sm"
                    onClick={() => onChoisir(p.cle)}
                    aria-label={`${t.demander} : ${p.libelle[langue]}`}
                  >
                    {t.demander}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

import { useConfig } from '../context/ConfigContext'
import { estVisible, useOuverture } from '../lib/ouverture'
import { useLangue } from '../i18n/langue'
import { CHEMIN_FAMILLE, TEXTES_PRESTATIONS } from './textes'
import type { FamillePrestation } from '../types'

/**
 * Les liens vers les pages de services, pour la navigation et le pied de page.
 *
 * Un lien n'apparaît que si sa page existe pour la personne qui regarde :
 * ouverte à tous, ou en aperçu pour l'administrateur. Annoncer une page fermée
 * mènerait le visiteur à l'accueil, sans un mot.
 */
export function useLiensServices(): { cle: FamillePrestation; to: string; label: string }[] {
  const { services } = useConfig()
  const { langue, lien } = useLangue()
  const t = TEXTES_PRESTATIONS[langue]
  const transport = useOuverture(services.transport)
  const restauration = useOuverture(services.restauration)

  return ([['transport', transport], ['restauration', restauration]] as const)
    .filter(([, o]) => estVisible(o))
    .map(([cle]) => ({ cle, to: lien(CHEMIN_FAMILLE[cle]), label: t.familles[cle].eyebrow }))
}

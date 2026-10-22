import type { Tarif, TypeTarif } from '../types'
import { nuits } from './format'

/** Les seuils des longs séjours, les mêmes que `App\Services\PrixSejour`. */
export const NUITS_SEMAINE = 7
export const NUITS_MOIS = 30

export interface PrixSejour {
  unites: number
  montant: number
  /** Ce qu'aurait coûté le séjour nuit par nuit (ou jour par jour). */
  sansReduction: number
  prixApplique: 'unite' | 'semaine' | 'mois'
}

/** Nuits pour une nuitée (une au moins), jours bornes comprises pour une formule de jour. */
export function unitesSejour(type: TypeTarif, debut: string, fin: string): number {
  const ecart = nuits(debut, fin)
  return type === 'nuitee' ? Math.max(ecart, 1) : ecart + 1
}

/**
 * Le prix d'un séjour, pour l'afficher avant de réserver.
 *
 * ⚠️ Copie exacte du calcul du serveur (`backend/app/Services/PrixSejour.php`),
 * qui fait foi : c'est lui qui fixe le montant réservé. Changer l'un, c'est
 * changer l'autre, sinon la fiche annonce un prix et la réservation en porte
 * un autre.
 */
export function prixSejour(tarif: Tarif, debut: string, fin: string): PrixSejour {
  const unites = unitesSejour(tarif.type_tarif, debut, fin)
  const sansReduction = Math.round(Number(tarif.prix) * unites)
  let montant = sansReduction
  let prixApplique: PrixSejour['prixApplique'] = 'unite'

  if (tarif.type_tarif === 'nuitee') {
    const periodes: [PrixSejour['prixApplique'], number, number | null | undefined][] = [
      ['semaine', NUITS_SEMAINE, tarif.prix_semaine],
      ['mois', NUITS_MOIS, tarif.prix_mois],
    ]
    for (const [nom, seuil, prixPeriode] of periodes) {
      if (prixPeriode == null || unites < seuil) continue
      const candidat = Math.round((unites * prixPeriode) / seuil)
      if (candidat < montant) {
        montant = candidat
        prixApplique = nom
      }
    }
  }

  return { unites, montant, sansReduction, prixApplique }
}

import { dateCourte, fcfa } from './format'
import type { Langue } from '../types'

export type TypeParticuliere = 'evenement' | 'seminaire' | 'groupe' | 'long_sejour' | 'autre'
export type BesoinParticulier = 'traiteur' | 'decoration' | 'musique' | 'photographe' | 'transport' | 'menage'
export type StatutParticuliere = 'nouvelle' | 'traitee' | 'abandonnee'

export const TYPES_PARTICULIERS: TypeParticuliere[] = ['evenement', 'seminaire', 'groupe', 'long_sejour', 'autre']
export const BESOINS_PARTICULIERS: BesoinParticulier[] = ['traiteur', 'decoration', 'musique', 'photographe', 'transport', 'menage']

/** Une demande particulière telle que la console la reçoit. */
export interface DemandeParticuliere {
  id: number
  reference: string
  type: TypeParticuliere
  libelle_type: string
  villa_id: number | null
  villa?: { id: number; nom: string; ville?: string | null; quartier?: string | null } | null
  date_debut: string | null
  date_fin: string | null
  dates_a_confirmer: boolean
  personnes_sejour: number | null
  invites: number | null
  besoins: BesoinParticulier[] | null
  budget: number | null
  message: string
  nom: string
  telephone: string | null
  email: string | null
  langue: Langue
  statut: StatutParticuliere
  traitee_le: string | null
  traitee_par?: { id: number; name: string } | null
  created_at: string
}

/** Les dates telles qu'on les écrit : « 20 nov. → 22 nov. 2026 (à confirmer) ». */
export function datesLisibles(
  d: Pick<DemandeParticuliere, 'date_debut' | 'date_fin' | 'dates_a_confirmer'>,
  langue: Langue,
  aConfirmer: string,
): string | undefined {
  const plage = d.date_debut
    ? `${dateCourte(d.date_debut, langue)}${d.date_fin ? ` → ${dateCourte(d.date_fin, langue)}` : ''}`
    : ''
  if (!plage) return d.dates_a_confirmer ? aConfirmer : undefined
  return d.dates_a_confirmer ? `${plage} (${aConfirmer})` : plage
}

/** Une ligne par détail donné, comme le message d'une réservation. */
export function lignesDuMessage(paires: [string, string | number | undefined | null][], deuxPoints: string): string[] {
  return paires
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([l, v]) => `${l}${deuxPoints}${v}`)
}

export const budgetLisible = (budget: number | null | undefined) => (budget ? fcfa(budget) : undefined)

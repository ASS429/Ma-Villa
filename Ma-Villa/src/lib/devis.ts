import { fcfa } from './format'
import { lienWhatsApp } from './contact'
import { formuleDe } from './demande'
import { prixSejour } from './prix'
import type { Logement, Tarif } from '../types'

/** Une prestation du devis. Le montant est recalculé par le serveur. */
export interface LigneDevis {
  designation: string
  detail?: string | null
  quantite: number
  unite?: string | null
  prix_unitaire: number
  montant?: number
}

export type StatutDevis = 'emis' | 'accepte' | 'refuse'

export interface Devis {
  id: number
  numero: string
  origine: 'console' | 'site'
  statut: StatutDevis
  libelle_statut: string
  titre: string
  client_nom: string
  occupant_nom: string | null
  client_telephone: string | null
  client_email: string | null
  villa_id: number | null
  logement_id: number | null
  tarif_id: number | null
  villa?: { id: number; nom: string; ville?: string | null } | null
  date_arrivee: string | null
  date_depart: string | null
  personnes: number | null
  lignes: LigneDevis[]
  total: number
  date_emission: string
  valable_jusqu_au: string | null
  conditions: string | null
  cachet: boolean
  suivi_le: string | null
  created_at: string
  pdf: string
}

export const LIBELLES_STATUT_DEVIS: Record<StatutDevis, string> = {
  emis: 'Émis',
  accepte: 'Accepté',
  refuse: 'Refusé',
}

const UNITES: Record<string, string> = {
  nuitee: 'nuitée',
  journee: 'journée',
  demi_journee: 'demi-journée',
  pass: 'pass',
}

/** Le total tel que le serveur le calculera : quantité × prix, ligne à ligne. */
export function totalDesLignes(lignes: LigneDevis[]): number {
  return lignes.reduce((t, l) => t + Math.max(1, Math.round(Number(l.quantite) || 0)) * Math.max(0, Math.round(Number(l.prix_unitaire) || 0)), 0)
}

/**
 * La ligne d'un séjour, comptée comme la réservation : nuits ou jours, et le
 * prix de la semaine ou du mois quand il s'applique.
 */
export function ligneDuSejour(logement: Logement, tarif: Tarif, debut: string, fin: string): LigneDevis {
  const prix = prixSejour(tarif, debut, fin)
  const formule = formuleDe(tarif, 'fr')
  const unite = UNITES[tarif.type_tarif] ?? null

  if (prix.prixApplique !== 'unite') {
    const long = prix.prixApplique === 'semaine' ? 'de la semaine' : 'du mois'
    return {
      designation: `Location · ${logement.nom}`,
      detail: `${formule} · ${prix.unites} ${unite}s au prix ${long} (au lieu de ${fcfa(prix.sansReduction)})`,
      quantite: 1,
      unite: 'séjour',
      prix_unitaire: prix.montant,
    }
  }

  return {
    designation: `Location · ${logement.nom}`,
    detail: formule,
    quantite: Math.max(1, prix.unites),
    unite,
    prix_unitaire: Math.round(Number(tarif.prix)),
  }
}

/** Le message qui envoie le devis au client sur WhatsApp. */
export function lienEnvoiDevis(devis: Devis): string | null {
  if (!devis.client_telephone) return null
  return lienWhatsApp(
    devis.client_telephone,
    `Bonjour ${devis.client_nom}, voici votre devis PasseTemps ${devis.numero} (${devis.titre}, ${fcfa(devis.total)}) : ${devis.pdf}`
  )
}

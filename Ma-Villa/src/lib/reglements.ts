import { fcfa } from './format'
import { lienWhatsApp } from './contact'

/** Une somme reçue hors du site. Le serveur seul écrit le numéro, le montant et le statut. */
export interface Reglement {
  id: number
  numero: string
  montant: number
  moyen: string
  libelle_moyen: string
  reference: string | null
  payeur_telephone: string | null
  client_nom: string
  devis_id: number | null
  devis_numero: string | null
  /** Le reçu d'un trajet est rattaché à sa demande, pas à un devis (7 nov. 2026). */
  demande_service_id?: number | null
  langue: 'fr' | 'en'
  recu_le: string
  note: string | null
  statut: 'valide' | 'annule'
  annule_le: string | null
  annule_motif: string | null
  annule_par_nom: string | null
  createur_nom: string
  pdf: string
}

/** Ce que l'écran d'un devis doit savoir pour dire où en est l'argent. */
export interface EtatReglements {
  total: number
  encaisse: number
  solde: number
  manques: string[]
  moyens: Record<string, string>
  reglements: Reglement[]
  repartition: { commission: number; proprietaire: number; taux: string; circuit: string | null } | null
  reservation: { id: number; statut: string; annulation_demandee_le: string | null } | null
  reparti: boolean
  rembourse: number
}

export interface SoldeOuvert {
  devis_id: number | null
  devis: string | null
  client: string | null
  telephone: string | null
  hebergement: string | null
  date_debut: string
  date_fin: string
  encaisse: number
  solde: number
}

export interface TotalParMoyen {
  moyen: string
  libelle: string
  total: number
  nombre: number
}

/** Le reçu part sur WhatsApp, dans la langue du devis. Rien ne part sans ce geste. */
export function lienEnvoiRecu(
  reglement: Pick<Reglement, 'montant' | 'langue' | 'client_nom' | 'numero' | 'pdf' | 'demande_service_id'>,
  telephone: string | null,
): string | null {
  if (!telephone) return null
  const somme = fcfa(reglement.montant)
  const trajet = Boolean(reglement.demande_service_id)
  return lienWhatsApp(
    telephone,
    reglement.langue === 'en'
      ? `Hello ${reglement.client_nom}, we have received ${somme} for your ${trajet ? 'ride' : 'stay'}. Here is your PasseTemps receipt ${reglement.numero}: ${reglement.pdf}`
      : `Bonjour ${reglement.client_nom}, nous avons bien reçu ${somme} pour votre ${trajet ? 'trajet' : 'séjour'}. Voici votre reçu PasseTemps ${reglement.numero} : ${reglement.pdf}`,
  )
}

/** Ce qu'on écrit dans la référence dépend du moyen : c'est ce qui permet de retrouver la somme. */
export function aideReference(moyen: string): string {
  if (moyen === 'wave' || moyen === 'orange_money') return 'Le numéro de transaction du SMS : il empêche de noter deux fois la même somme.'
  if (moyen === 'virement') return 'La référence du virement.'
  if (moyen === 'cheque') return 'Le numéro du chèque.'
  return 'Facultatif.'
}

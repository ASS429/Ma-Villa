import { useAuth } from '../context/AuthContext'
import { useConfig } from '../context/ConfigContext'

/**
 * Où en est un module qui s'ouvre par une variable (`JOJ_ACTIF`,
 * `TRANSPORT_ACTIF`…), pour la personne qui regarde.
 *
 * - `inconnu` : la configuration n'est pas encore arrivée. **Ne pas encore
 *   savoir n'est pas « fermé »** — les écrans de la boutique redirigeaient
 *   vers l'accueil avant même d'avoir la réponse ;
 * - `ferme` : fermé, et vous n'êtes pas administrateur ;
 * - `apercu` : fermé au public, mais vous êtes administrateur. C'est ce qui
 *   permet d'éprouver un module en production avant de l'ouvrir ;
 * - `ouvert` : ouvert à tous.
 */
export type Ouverture = 'inconnu' | 'ferme' | 'apercu' | 'ouvert'

export function useOuverture(ouvert: boolean): Ouverture {
  const { chargee } = useConfig()
  const { user } = useAuth()

  if (ouvert) return 'ouvert'
  if (user?.role === 'admin') return 'apercu'
  return chargee ? 'ferme' : 'inconnu'
}

/** Visible pour la personne qui regarde : ouvert à tous, ou en aperçu. */
export function estVisible(o: Ouverture): boolean {
  return o === 'ouvert' || o === 'apercu'
}

/**
 * Comment se réserve une annonce, pour le client.
 *
 * - `suspendue` : la réservation en ligne est fermée pour tous
 *   (`RESERVATIONS_OUVERTES`) ;
 * - `equipe` : elle est ouverte, mais cette annonce passe par les associés et
 *   se réserve auprès du contact (`RESERVATIONS_ASSOCIES_OUVERTES`, décision
 *   du 31 octobre 2026 : « pour nos annonces à nous, contacter directement
 *   Abdou Ndour ») ;
 * - `en_ligne` : formulaire, puis règlement.
 *
 * Le serveur refuse de la même façon : ceci ne fait que l'annoncer.
 */
export type ModeReservation = 'en_ligne' | 'equipe' | 'suspendue'

export function modeReservation(
  reservations: { ouvertes: boolean; associes_ouvertes?: boolean },
  villa?: { encaisse_par_la_plateforme?: boolean },
): ModeReservation {
  if (!reservations.ouvertes) return 'suspendue'
  return villa?.encaisse_par_la_plateforme && !reservations.associes_ouvertes ? 'equipe' : 'en_ligne'
}

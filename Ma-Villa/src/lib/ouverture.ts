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

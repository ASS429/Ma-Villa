/**
 * Demander au menu de la console de relire ses compteurs.
 *
 * Le menu ne relisait « Ce qui attend » qu'au changement d'écran. Traiter une
 * demande sans quitter la page laissait donc son compteur à 1 : un travail
 * fait qui paraît encore à faire, et qu'on finit par ne plus croire.
 */
export const EVENEMENT_ATTENTES = 'passetemps:attentes-a-relire'

export function relireAttentes(): void {
  window.dispatchEvent(new Event(EVENEMENT_ATTENTES))
}

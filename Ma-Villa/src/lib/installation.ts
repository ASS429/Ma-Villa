/**
 * Le déclencheur de l'invitation à installer.
 *
 * Planche 36 : l'invitation n'attend plus un nombre de pages vues mais la
 * **première réservation confirmée**. Trois pages ne prouvent rien — on peut en
 * regarder trois et repartir. Une réservation confirmée est le seul moment où
 * « garder PasseTemps sous la main » rend un service : il y a désormais quelque
 * chose à retrouver, et l'argument devient vérifiable plutôt que promotionnel.
 *
 * Ici plutôt que dans le composant : un module qui exporte autre chose qu'un
 * composant casse le rafraîchissement à chaud de tout le fichier.
 */

const CLE = 'a-reserve'

/** Appelé par l'écran de confirmation, et lui seul. */
export function marquerPremiereReservation(): void {
  try {
    localStorage.setItem(CLE, '1')
  } catch {
    /* Navigation privée : l'invitation ne s'affichera pas, ce n'est pas grave. */
  }
}

export function aReserve(): boolean {
  try {
    return localStorage.getItem(CLE) === '1'
  } catch {
    return false
  }
}

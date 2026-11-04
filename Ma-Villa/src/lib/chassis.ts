/**
 * Les écrans qui se passent du châssis d'application — navigation basse et
 * bouton flottant de contact —, lus sur le chemin sans sa langue.
 *
 * Le tunnel de paiement et la commande d'un article se terminent par un
 * paiement : y superposer d'autres destinations invite à abandonner au moment
 * de payer. La confirmation fait exception, c'est le dernier écran du tunnel et
 * l'on veut justement que le client reparte dans l'application. La console
 * d'administration a son propre menu.
 */
export function sansChassis(chemin: string): boolean {
  return (chemin.startsWith('/reservation/') && !chemin.endsWith('/confirmee'))
    || chemin.startsWith('/admin')
    || chemin.startsWith('/paiement')
    || chemin.endsWith('/commander')
    || /^\/boutique\/commandes\/\d+/.test(chemin)
}

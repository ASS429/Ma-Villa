/**
 * L'appareil peut-il ouvrir Wave ou Orange Money ?
 *
 * Les URL renvoyées par le prestataire sont des liens d'application : sur un
 * ordinateur elles ne mènent nulle part, et c'est là qu'un code QR prend le
 * relais. Le pointeur grossier est un meilleur signal que la chaîne d'agent,
 * qui ment de plus en plus.
 *
 * Partagée par le tunnel de réservation et le règlement d'une commande : la
 * boutique envoyait l'ordinateur sur la page de l'opérateur, et celle
 * d'Orange Money n'y montre aucun code (relevé le 31 octobre 2026).
 */
export function surAppareilMobile(): boolean {
  if (typeof window === 'undefined') return false

  return window.matchMedia?.('(pointer: coarse)').matches === true
    || /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

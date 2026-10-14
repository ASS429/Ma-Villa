/**
 * Le lieu d'une annonce, écrit sans se répéter.
 *
 * Une annonce porte trois champs de lieu — adresse, quartier, ville — et les
 * propriétaires écrivent souvent la même chose dans plusieurs. Mis bout à bout,
 * cela donnait, en production le 14 octobre 2026 :
 *
 *     « Thies, Thies, Thiès »
 *     « Saly Carrefour, Saly Carrefour, Saly »
 *     « Saly Niakh Niakhal, Niakh Niakhal, Saly »
 *
 * On ne peut pas le corriger à la saisie seulement : un propriétaire est libre
 * d'écrire son adresse comme il l'entend, et il écrira encore « Saly » dans le
 * quartier. C'est donc à l'affichage que la répétition se retire.
 *
 * La règle : **une partie déjà contenue dans une autre ne s'écrit pas**. La
 * comparaison ignore accents, casse et ponctuation — « Thies » et « Thiès »
 * sont le même mot — et c'est la partie la plus longue qui l'emporte, parce
 * qu'elle est la plus précise. À longueur égale, la dernière gagne : la ville
 * arrive en fin de liste et porte l'orthographe rangée par le serveur.
 */

const comparable = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function lieu(...parties: (string | null | undefined)[]): string {
  const retenues = parties
    .map((p, rang) => ({ texte: (p ?? '').trim(), rang }))
    .filter((p) => p.texte !== '')
    .map((p) => ({ ...p, cle: comparable(p.texte) }))
    .filter((p) => p.cle !== '')

  const gardees = retenues
    // La plus longue d'abord : elle absorbe les autres. À égalité, la dernière,
    // qui est la ville.
    .slice()
    .sort((a, b) => b.cle.length - a.cle.length || b.rang - a.rang)
    .reduce<typeof retenues>((acc, p) => {
      const deja = acc.some((g) => g.cle === p.cle || g.cle.includes(p.cle))
      return deja ? acc : [...acc, p]
    }, [])

  return gardees
    .sort((a, b) => a.rang - b.rang)
    .map((p) => p.texte)
    .join(', ')
}

/**
 * Lire un numéro tel que les gens l'écrivent — le pendant de
 * `App\Services\Telephone` côté serveur.
 *
 * Aucun préfixe n'est filtré : 70, 71, 75, 76, 77, 78, les fixes en 33 ou 30,
 * les plages changent avec les opérateurs. On garde les chiffres, et
 * l'indicatif se reconnaît sous ses trois écritures : « +221 », « 221 » et
 * « 00221 », la plus ancienne et encore très courante.
 */

/** Chiffres seuls, préfixe international « 00 » retiré : aucun numéro national ne commence ainsi. */
export function chiffresDuNumero(numero: string | null | undefined): string {
  const chiffres = (numero ?? '').replace(/\D+/g, '')
  return chiffres.startsWith('00') ? chiffres.slice(2) : chiffres
}

/**
 * Le numéro sénégalais sans indicatif (neuf chiffres), sinon les chiffres
 * avec leur indicatif : un numéro étranger garde le sien.
 */
export function numeroLocal(numero: string | null | undefined): string {
  const chiffres = chiffresDuNumero(numero)
  return /^221\d{9}$/.test(chiffres) ? chiffres.slice(3) : chiffres
}

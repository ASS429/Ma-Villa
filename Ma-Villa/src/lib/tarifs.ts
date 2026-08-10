import type { Logement, Tarif, TypeTarif } from '../types'

/** Ordre d'affichage des formules, du plus courant au plus rare. */
export const FORMULES: TypeTarif[] = ['nuitee', 'journee', 'demi_journee', 'pass']

/**
 * Tarif le moins cher d'un logement pour une formule donnée, ou null si la
 * formule n'est pas proposée. Un logement peut avoir plusieurs tarifs d'un même
 * type, qui ne diffèrent que par les options (climatisation, buffet).
 */
export function tarifLeMoinsCher(logement: Logement, type: TypeTarif): Tarif | null {
  const candidats = logement.tarifs.filter((t) => t.type_tarif === type)
  if (candidats.length === 0) return null
  return candidats.reduce((a, b) => (Number(a.prix) <= Number(b.prix) ? a : b))
}

/** « avec clim et buffet », « sans option ». */
export function libelleOptions(t: Tarif): string {
  const options = [t.avec_clim ? 'clim' : null, t.avec_buffet ? 'buffet' : null].filter(Boolean)
  return options.length ? `avec ${options.join(' et ')}` : 'sans option'
}

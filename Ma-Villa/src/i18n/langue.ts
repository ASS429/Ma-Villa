import { useLocation } from 'react-router-dom'
import type { Langue } from '../types'

/**
 * Les langues des pages client.
 *
 * ── Ce qui est traduit, et ce qui ne l'est pas ──────────────────────
 * Les pages que voit un client — qui peut venir de n'importe où — sont en
 * français et en anglais. Celles des propriétaires, des prestataires et de la
 * console restent en français : tous sont sénégalais et le lisent (décision
 * du 20 octobre 2026). Le contenu saisi par les propriétaires — titres,
 * descriptions — reste dans la langue où il a été écrit.
 *
 * ── Pourquoi la langue est dans l'adresse ──────────────────────────
 * `/hebergements/` est en français, `/en/hebergements/` en anglais. Une langue
 * gardée seulement dans le navigateur (ou dans `?lang=en`) donne une seule
 * adresse pour deux pages : le pré-rendu n'en produit qu'une, et Google ne voit
 * jamais l'anglaise. C'est la leçon des pages de destination, et le défaut du
 * site d'Agence Touristique, qui sert ses quatre langues à la même adresse.
 *
 * Le français reste à la racine : c'est la langue de toutes les adresses déjà
 * partagées sur WhatsApp, et aucune ne doit casser.
 */

export const LANGUES: Langue[] = ['fr', 'en']

const PREFIXE: Record<Langue, string> = { fr: '', en: '/en' }

/** La préférence mémorisée quand le visiteur change de langue lui-même. */
export const CLE_PREFERENCE = 'passetemps_langue'

export function langueDuChemin(chemin: string): Langue {
  return chemin === '/en' || chemin.startsWith('/en/') ? 'en' : 'fr'
}

/** Le chemin sans son préfixe de langue : `/en/transport/` → `/transport/`. */
export function cheminSansLangue(chemin: string): string {
  if (chemin === '/en') return '/'
  return chemin.startsWith('/en/') ? chemin.slice(3) : chemin
}

/** Un chemin de l'application, dans la langue voulue. `/` reste `/` en français. */
export function cheminEn(langue: Langue, chemin: string): string {
  const nu = cheminSansLangue(chemin)
  if (langue === 'fr') return nu
  return nu === '/' ? '/en/' : `${PREFIXE.en}${nu}`
}

/** Les chemins de l'application qui existent dans les deux langues. */
export function prefixes(): string[] {
  return LANGUES.map((l) => PREFIXE[l])
}

/**
 * La langue de la page, et de quoi construire des liens qui la gardent.
 *
 * Tirée de l'adresse à chaque rendu : il n'y a donc pas d'état à
 * synchroniser, et un lien partagé s'ouvre toujours dans sa langue.
 */
export function useLangue() {
  const { pathname, search, hash } = useLocation()
  const langue = langueDuChemin(pathname)
  const autre: Langue = langue === 'fr' ? 'en' : 'fr'

  return {
    langue,
    autre,
    /** Un chemin de l'application, dans la langue de la page. */
    lien: (chemin: string) => cheminEn(langue, chemin),
    /** La même page, dans l'autre langue — requête et ancre comprises. */
    versAutre: `${cheminEn(autre, pathname)}${search}${hash}`,
  }
}

/** Le dictionnaire d'un module, dans la langue de la page. */
export function useTextes<T>(dictionnaire: Record<Langue, T>): T {
  return dictionnaire[useLangue().langue]
}

export function memoriserLangue(langue: Langue): void {
  try {
    localStorage.setItem(CLE_PREFERENCE, langue)
  } catch {
    /* navigation privée : la préférence ne sera pas retenue, la page reste juste */
  }
}

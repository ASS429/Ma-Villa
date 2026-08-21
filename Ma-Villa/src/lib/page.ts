/** Forme d'une réponse paginée Laravel — celle que renvoient les listes admin. */
export interface Page<T> {
  /** Champ ajouté par la vitrine de la boutique : le prix d'entrée
   *  de la sélection entière, calculé par le serveur. */
  prix_min?: number | null
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

/**
 * Ramène une réponse d'API à une page, qu'elle en soit une ou non.
 *
 * Le front et l'API sont déployés séparément : Render reconstruit le front à
 * chaque poussée, Railway demande une action manuelle. Entre les deux, un
 * front neuf interroge une API ancienne, qui renvoie encore un tableau nu là
 * où il attend `{ data, total… }` — et les listes d'administration
 * s'affichent vides, ce qui se lit comme « plus aucune villa » plutôt que
 * comme un décalage de version.
 *
 * Cette tolérance n'est pas un contournement : deux services qui se déploient
 * indépendamment ne sont jamais synchrones, et l'interface doit traverser la
 * fenêtre sans mentir sur les données.
 */
export function versPage<T>(reponse: Page<T> | T[] | null | undefined): Page<T> | null {
  if (!reponse) return null

  if (Array.isArray(reponse)) {
    return {
      data: reponse,
      current_page: 1,
      last_page: 1,
      per_page: reponse.length,
      total: reponse.length,
      from: reponse.length ? 1 : null,
      to: reponse.length || null,
    }
  }

  return reponse
}

/**
 * L'adresse lisible d'une destination : « Saint-Louis » → `saint-louis`.
 *
 * Une page par ville existe pour être trouvée : `/destinations/saly/` porte le
 * mot que les gens tapent, là où `?ville=Saly` n'est ni pré-rendu ni au plan de
 * site. Les accents et la ponctuation disparaissent — une adresse qui contient
 * `Thi%C3%A8s` se partage mal et se retient moins bien.
 *
 * ⚠️ `scripts/prerendu.mjs` tient la même fonction, en JavaScript : les deux
 * doivent produire exactement le même texte, sans quoi la page pré-rendue et la
 * page de l'application ne vivraient pas à la même adresse.
 */
export function enSlug(ville: string): string {
  return ville
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

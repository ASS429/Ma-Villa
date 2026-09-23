/**
 * L'adresse lisible d'une destination : « Saint-Louis » → `saint-louis`.
 *
 * Partagée par `prerendu.mjs`, qui écrit les pages, et par
 * `fraicheur-du-plan-de-site.mjs`, qui vérifie qu'elles sont à jour. Les deux
 * doivent nommer la même adresse, sinon le contrôle nocturne réclamerait une
 * reconstruction à chaque passage.
 *
 * ⚠️ `src/lib/villes.ts` en tient la version TypeScript, pour l'application.
 * Elles doivent rendre exactement le même texte : c'est la seule chose qui
 * garantit que la page pré-rendue et la page de l'application vivent à la
 * même adresse.
 */
export const enSlug = (ville) =>
  String(ville)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

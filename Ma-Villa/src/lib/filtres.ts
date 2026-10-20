import type { Langue, TypeLogement } from '../types'
import { fcfa, dateCourte } from './format'
import { METIER } from '../i18n/metier'
import { TEXTES_RECHERCHE } from '../i18n/recherche'

export type CleFiltre =
  | 'categorie' | 'ville' | 'date_debut' | 'date_fin' | 'capacite'
  | 'prix_min' | 'prix_max' | 'type_logement' | 'note_min' | 'meuble'

/**
 * Libellé affiché sur la pastille d'un filtre actif.
 *
 * Le nom des catégories vient de la base : il est passé en argument plutôt que
 * codé ici, sinon ajouter « studio meublé » demanderait de redéployer le front
 * — exactement ce que la table `categories` sert à éviter.
 */
export function libelleFiltre(
  cle: CleFiltre,
  valeur: string,
  nomsCategories: Record<string, string> = {},
  langue: Langue = 'fr',
): string {
  const t = TEXTES_RECHERCHE[langue].pastille
  switch (cle) {
    case 'categorie':     return nomsCategories[valeur] ?? valeur
    case 'ville':         return valeur
    case 'date_debut':    return t.desLe(dateCourte(valeur, langue))
    case 'date_fin':      return t.jusquAu(dateCourte(valeur, langue))
    case 'capacite':      return t.voyageurs(Number(valeur))
    case 'prix_min':      return t.des(fcfa(valeur))
    case 'prix_max':      return t.jusquA(fcfa(valeur))
    case 'type_logement': return METIER[langue].logement[valeur as TypeLogement] ?? valeur
    case 'note_min':      return t.etoiles(valeur)
    case 'meuble':        return valeur === '0' ? t.nonMeuble : t.meuble
  }
}

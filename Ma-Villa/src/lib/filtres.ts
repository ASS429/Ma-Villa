import { LIBELLES_LOGEMENT, type TypeLogement } from '../types'
import { fcfa, dateCourte } from './format'

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
  nomsCategories: Record<string, string> = {}
): string {
  switch (cle) {
    case 'categorie':     return nomsCategories[valeur] ?? valeur
    case 'ville':         return valeur
    case 'date_debut':    return `dès le ${dateCourte(valeur)}`
    case 'date_fin':      return `jusqu'au ${dateCourte(valeur)}`
    case 'capacite':      return `${valeur} voyageur${Number(valeur) > 1 ? 's' : ''}`
    case 'prix_min':      return `dès ${fcfa(valeur)}`
    case 'prix_max':      return `jusqu'à ${fcfa(valeur)}`
    case 'type_logement': return LIBELLES_LOGEMENT[valeur as TypeLogement] ?? valeur
    case 'note_min':      return `${valeur} étoiles et plus`
    case 'meuble':        return valeur === '0' ? 'non meublé' : 'meublé'
  }
}

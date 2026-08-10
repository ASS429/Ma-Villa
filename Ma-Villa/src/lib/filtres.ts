import { LIBELLES_LOGEMENT, type TypeLogement } from '../types'
import { fcfa, dateCourte } from './format'

export type CleFiltre =
  | 'ville' | 'date_debut' | 'date_fin' | 'capacite'
  | 'prix_min' | 'prix_max' | 'type_logement' | 'note_min'

/** Libellé affiché sur la pastille d'un filtre actif. */
export function libelleFiltre(cle: CleFiltre, valeur: string): string {
  switch (cle) {
    case 'ville':         return valeur
    case 'date_debut':    return `dès le ${dateCourte(valeur)}`
    case 'date_fin':      return `jusqu'au ${dateCourte(valeur)}`
    case 'capacite':      return `${valeur} voyageur${Number(valeur) > 1 ? 's' : ''}`
    case 'prix_min':      return `dès ${fcfa(valeur)}`
    case 'prix_max':      return `jusqu'à ${fcfa(valeur)}`
    case 'type_logement': return LIBELLES_LOGEMENT[valeur as TypeLogement] ?? valeur
    case 'note_min':      return `${valeur} étoiles et plus`
  }
}


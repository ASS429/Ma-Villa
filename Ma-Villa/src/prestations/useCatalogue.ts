import api from '../services/api'
import { useRequete } from '../lib/useRequete'
import type { CataloguePrestations } from '../types'

/**
 * Le catalogue des services ouverts — tout, en aperçu, pour l'administration.
 *
 * Le jeton part avec la requête (instance `api`) : c'est lui qui donne
 * l'aperçu. La clé de cache est donc la même pour tous, mais la réponse non.
 */
export function useCatalogue() {
  return useRequete<CataloguePrestations>(
    async (signal) => (await api.get('/prestations', { signal })).data,
    'prestations',
    { messageErreurParDefaut: 'Impossible de charger les services.' },
  )
}

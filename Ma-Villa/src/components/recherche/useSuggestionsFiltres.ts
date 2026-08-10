import { useEffect, useState } from 'react'
import api from '../../services/api'
import type { CleFiltre } from '../../lib/filtres'

export interface Suggestion {
  cle: CleFiltre
  /** Nombre de villas obtenues si l'on retire ce seul filtre. */
  resultats: number
}

/**
 * Quand une recherche ne renvoie rien, cherche quel filtre en est responsable.
 *
 * Un écran « aucun résultat » sans explication laisse l'utilisateur retirer ses
 * critères au hasard. Ici on rejoue la requête en retirant chaque filtre à tour
 * de rôle, et on peut dire : « en retirant le budget, 9 villas correspondent ».
 *
 * Les requêtes ne partent que sur un résultat vide, et se limitent aux filtres
 * réellement posés — au plus une poignée d'appels, sur un écran par ailleurs
 * inactif.
 */
export function useSuggestionsFiltres(
  actifs: [CleFiltre, string][],
  aucunResultat: boolean,
  requete: string
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [recherche, setRecherche] = useState(false)

  useEffect(() => {
    if (!aucunResultat || actifs.length < 2) return

    const controleur = new AbortController()
    let annule = false

    const essais = actifs.map(async ([cle]) => {
      const params = new URLSearchParams(requete)
      params.delete(cle)
      params.delete('page')

      // Les bornes de dates n'ont pas de sens l'une sans l'autre.
      if (cle === 'date_debut') params.delete('date_fin')
      if (cle === 'date_fin') params.delete('date_debut')

      try {
        const { data } = await api.get('/villas', {
          params: Object.fromEntries(params),
          signal: controleur.signal,
        })
        return { cle, resultats: data.total ?? 0 }
      } catch {
        return { cle, resultats: 0 }
      }
    })

    // L'indicateur passe à vrai dans un rappel, pas dans le corps de l'effet :
    // un setState synchrone y déclencherait un rendu en cascade.
    queueMicrotask(() => { if (!annule) setRecherche(true) })

    Promise.all(essais).then((resultats) => {
      if (annule) return
      setSuggestions(
        resultats
          .filter((r) => r.resultats > 0)
          .sort((a, b) => b.resultats - a.resultats)
      )
      setRecherche(false)
    })

    return () => {
      annule = true
      controleur.abort()
      // Les suggestions d'une recherche précédente ne valent plus rien.
      setSuggestions([])
      setRecherche(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aucunResultat, requete])

  return { suggestions, recherche }
}
